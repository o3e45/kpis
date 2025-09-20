"""FastAPI application wiring for Empire OS prototype."""
from __future__ import annotations

from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db, init_db
from .services.agent import FinanceAgent
from .services.ingest import IngestService, list_events, search_documents


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="Empire OS Prototype", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/ingest/purchase", response_model=schemas.PurchaseIngestResponse)
    def ingest_purchase(
        llc_name: str = Form(...),
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
    ) -> schemas.PurchaseIngestResponse:
        llc = db.query(models.LLC).filter(models.LLC.name == llc_name).one_or_none()
        if not llc:
            llc = models.LLC(name=llc_name)
            db.add(llc)
            db.commit()
            db.refresh(llc)

        service = IngestService(db)
        purchase_order, events, suggestions = service.ingest_purchase(llc, file)
        return schemas.PurchaseIngestResponse(
            purchase_order=purchase_order,
            events=events,
            suggestions=suggestions,
        )

    @app.get("/events", response_model=List[schemas.Event])
    def get_events(limit: int = 50, db: Session = Depends(get_db)) -> List[schemas.Event]:
        return list(list_events(db, limit=limit))

    @app.get("/purchase_orders", response_model=List[schemas.PurchaseOrder])
    def get_purchase_orders(db: Session = Depends(get_db)) -> List[schemas.PurchaseOrder]:
        return db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.created_at.desc()).all()

    @app.get("/search/documents", response_model=List[schemas.SearchResult])
    def search(query: str, db: Session = Depends(get_db)) -> List[schemas.SearchResult]:
        results = search_documents(db, query)
        payload: List[schemas.SearchResult] = []
        for media, score in results:
            excerpt = Path(media.storage_path).read_text(errors="ignore")[:160] if media.storage_path else ""
            filename = Path(media.storage_path).name if media.storage_path else None
            payload.append(
                schemas.SearchResult(
                    media_object_id=media.id,
                    score=score,
                    excerpt=excerpt,
                    filename=filename,
                    mime=media.mime,
                )
            )
        return payload

    @app.get("/agents/suggestions", response_model=List[schemas.AgentSuggestion])
    def get_suggestions(limit: int = 50, db: Session = Depends(get_db)) -> List[schemas.AgentSuggestion]:
        query = (
            db.query(models.AgentSuggestion)
            .order_by(models.AgentSuggestion.created_at.desc())
        )
        if limit:
            query = query.limit(limit)
        return query.all()

    @app.post("/agents/suggestions/{suggestion_id}/approve", response_model=schemas.SuggestionApprovalResponse)
    def approve_suggestion(
        suggestion_id: int,
        db: Session = Depends(get_db),
    ) -> schemas.SuggestionApprovalResponse:
        suggestion = db.get(models.AgentSuggestion, suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.approved:
            raise HTTPException(status_code=400, detail="Suggestion already approved")
        agent = FinanceAgent(db)
        event = agent.approve_suggestion(suggestion)
        db.commit()
        db.refresh(suggestion)
        db.refresh(event)
        return schemas.SuggestionApprovalResponse(suggestion=suggestion, event=event)

    return app


app = create_app()
