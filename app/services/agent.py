"""Finance agent prototype."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Set

from sqlalchemy.orm import Session

from .. import models


class FinanceAgent:
    """Heuristic finance agent to surface risk across the purchasing pipeline."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def evaluate_purchase_order(
        self, purchase_order: models.PurchaseOrder
    ) -> list[models.AgentSuggestion]:
        suggestions: list[models.AgentSuggestion] = []
        existing_types: Set[str] = {
            suggestion.suggestion_type for suggestion in purchase_order.suggestions
        }

        # Overdue payments
        if purchase_order.due_date:
            now = datetime.now(timezone.utc)
            if (
                purchase_order.due_date.replace(tzinfo=timezone.utc) < now
                and purchase_order.status != "paid"
            ):
                suggestions.extend(
                    self._ensure_suggestion(
                        purchase_order,
                        suggestion_type="flag-overdue",
                        message="Payment appears overdue. Flag for follow-up.",
                        existing_types=existing_types,
                    )
                )

        # Large purchase repayment plan
        if purchase_order.total_amount >= 10000:
            suggestions.extend(
                self._ensure_suggestion(
                    purchase_order,
                    suggestion_type="create-repayment-plan",
                    message="Consider creating a repayment plan for this large purchase.",
                    existing_types=existing_types,
                )
            )

        # Status reconciliation
        normalized_status = (purchase_order.status or "").lower()
        if normalized_status in {"overdue", "late", "past-due"}:
            suggestions.extend(
                self._ensure_suggestion(
                    purchase_order,
                    suggestion_type="reconcile-payment-status",
                    message="Invoice is marked overdue in the source packet. Confirm collections status.",
                    existing_types=existing_types,
                )
            )

        # Vendor history review
        open_history = self._open_orders_for_vendor(purchase_order)
        if open_history >= 2:
            suggestions.extend(
                self._ensure_suggestion(
                    purchase_order,
                    suggestion_type="review-vendor-history",
                    message=(
                        f"{purchase_order.vendor.name} has {open_history} other open orders. "
                        "Review payment cadence before approving new spend."
                    ),
                    existing_types=existing_types,
                )
            )

        # Related claim links
        claim_links = self._claim_links_from_media(purchase_order.media_object)
        if claim_links:
            first_link = claim_links[0]
            suggestions.extend(
                self._ensure_suggestion(
                    purchase_order,
                    suggestion_type="review-related-claim",
                    message=f"Source packet references an open claim ({first_link}). Verify status prior to approval.",
                    existing_types=existing_types,
                )
            )

        for suggestion in suggestions:
            self.session.add(suggestion)
        self.session.flush()
        return suggestions

    def approve_suggestion(self, suggestion: models.AgentSuggestion) -> models.Event:
        suggestion.approved = True
        suggestion.approved_at = datetime.now(timezone.utc)
        event = models.Event(
            event_type="agent_suggestion.approved",
            payload={
                "suggestion_id": suggestion.id,
                "agent_name": suggestion.agent_name,
                "suggestion_type": suggestion.suggestion_type,
                "message": suggestion.message,
            },
        )
        self.session.add(event)
        self.session.flush()
        return event

    def _ensure_suggestion(
        self,
        purchase_order: models.PurchaseOrder,
        *,
        suggestion_type: str,
        message: str,
        existing_types: Set[str],
    ) -> list[models.AgentSuggestion]:
        if suggestion_type in existing_types:
            return []
        existing_types.add(suggestion_type)
        return [
            models.AgentSuggestion(
                purchase_order=purchase_order,
                agent_name="FinanceAgent",
                suggestion_type=suggestion_type,
                message=message,
            )
        ]

    def _open_orders_for_vendor(self, purchase_order: models.PurchaseOrder) -> int:
        return (
            self.session.query(models.PurchaseOrder)
            .filter(
                models.PurchaseOrder.vendor_id == purchase_order.vendor_id,
                models.PurchaseOrder.id != purchase_order.id,
                models.PurchaseOrder.status != "paid",
            )
            .count()
        )

    def _claim_links_from_media(self, media: models.MediaObject | None) -> list[str]:
        if not media or not media.storage_path:
            return []
        path = Path(media.storage_path)
        if not path.exists():
            return []
        try:
            content = path.read_text(errors="ignore")
        except OSError:
            return []
        return [
            link
            for link in re.findall(r"https?://\S+", content)
            if re.search(r"claim|ticket|case", link, re.IGNORECASE)
        ]
