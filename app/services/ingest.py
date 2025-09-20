"""Ingestion orchestration for Empire OS prototype."""
from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from typing import Iterable, Tuple

from fastapi import UploadFile
from sqlalchemy.orm import Session

from .. import models
from .agent import FinanceAgent
from .parser import PurchaseParser, parser_event_payload
from .vectorizer import embed_text

MEDIA_ROOT = Path("storage")
MEDIA_ROOT.mkdir(exist_ok=True)


class IngestService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.parser = PurchaseParser()

    def ingest_purchase(self, llc: models.LLC, upload: UploadFile) -> Tuple[models.PurchaseOrder, list[models.Event], list[models.AgentSuggestion]]:
        raw_bytes = upload.file.read()
        text = raw_bytes.decode("utf-8", errors="ignore")

        media = self._store_media(llc, upload.filename or "purchase.txt", raw_bytes, upload.content_type or "text/plain")
        parsed, confidence = self.parser.parse_text(text)
        vendor = self._get_or_create_vendor(parsed.vendor_name)
        status = parsed.payment_status or (parsed.status.lower().replace(" ", "-") if parsed.status else None)
        purchase_order = models.PurchaseOrder(
            llc=llc,
            vendor=vendor,
            media_object=media,
            total_amount=parsed.total_amount,
            currency=parsed.currency,
            due_date=parsed.due_date,
            description=parsed.description,
            status=status or "pending",
        )
        self.session.add(purchase_order)

        if parsed.asset_name:
            asset = models.Asset(purchase_order=purchase_order, name=parsed.asset_name, status="pending")
            self.session.add(asset)

        self.session.flush()

        events = self._create_events(
            media=media,
            llc=llc,
            parsed_payload=parser_event_payload(parsed, confidence),
            purchase_order=purchase_order,
        )

        vector = models.DocumentVector(media_object=media, vector=embed_text(text))
        self.session.add(vector)

        agent = FinanceAgent(self.session)
        suggestions = agent.evaluate_purchase_order(purchase_order)

        self.session.commit()
        self.session.refresh(purchase_order)
        for event in events:
            self.session.refresh(event)
        for suggestion in suggestions:
            self.session.refresh(suggestion)

        return purchase_order, events, suggestions

    def _store_media(self, llc: models.LLC, filename: str, raw_bytes: bytes, mime: str) -> models.MediaObject:
        sha = hashlib.sha256(raw_bytes).hexdigest()
        storage_path = MEDIA_ROOT / f"{datetime.utcnow().timestamp()}_{filename}"
        storage_path.write_bytes(raw_bytes)
        media = models.MediaObject(
            llc=llc,
            media_type="document",
            mime=mime,
            storage_path=str(storage_path),
            sha256=sha,
        )
        self.session.add(media)
        self.session.flush()
        return media

    def _get_or_create_vendor(self, name: str) -> models.Vendor:
        vendor = self.session.query(models.Vendor).filter(models.Vendor.name == name).one_or_none()
        if vendor:
            return vendor
        vendor = models.Vendor(name=name)
        self.session.add(vendor)
        self.session.flush()
        return vendor

    def _create_events(
        self,
        *,
        media: models.MediaObject,
        llc: models.LLC,
        parsed_payload: dict,
        purchase_order: models.PurchaseOrder,
    ) -> list[models.Event]:
        ingest_event = models.Event(
            event_type="ingest.received",
            payload={"llc_id": llc.id, "media_object_id": media.id},
        )
        parsed_event = models.Event(
            event_type="ingest.parsed",
            payload=parsed_payload,
        )
        purchase_event = models.Event(
            event_type="purchase_order.created",
            payload={"purchase_order_id": purchase_order.id},
        )
        events = [ingest_event, parsed_event, purchase_event]
        for event in events:
            self.session.add(event)
        self.session.flush()
        return events


def list_events(session: Session, limit: int = 50) -> Iterable[models.Event]:
    return session.query(models.Event).order_by(models.Event.created_at.desc()).limit(limit)


def search_documents(session: Session, query: str) -> list[tuple[models.MediaObject, float]]:
    from .vectorizer import cosine_similarity, embed_text

    query_vector = embed_text(query)
    results: list[tuple[models.MediaObject, float]] = []
    vectors = session.query(models.DocumentVector).all()
    for vector in vectors:
        score = cosine_similarity(vector.vector, query_vector)
        if score <= 0:
            continue
        results.append((vector.media_object, score))
    results.sort(key=lambda item: item[1], reverse=True)
    return results
