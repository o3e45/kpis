"""Finance agent prototype."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .. import models


class FinanceAgent:
    """Simple heuristic finance agent to surface overdue or large purchases."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def evaluate_purchase_order(self, purchase_order: models.PurchaseOrder) -> list[models.AgentSuggestion]:
        suggestions: list[models.AgentSuggestion] = []

        if purchase_order.due_date:
            now = datetime.now(timezone.utc)
            if purchase_order.due_date.replace(tzinfo=timezone.utc) < now and purchase_order.status != "paid":
                suggestions.append(
                    models.AgentSuggestion(
                        purchase_order=purchase_order,
                        agent_name="FinanceAgent",
                        suggestion_type="flag-overdue",
                        message="Payment appears overdue. Flag for follow-up.",
                    )
                )

        if purchase_order.total_amount >= 10000:
            suggestions.append(
                models.AgentSuggestion(
                    purchase_order=purchase_order,
                    agent_name="FinanceAgent",
                    suggestion_type="create-repayment-plan",
                    message="Consider creating a repayment plan for this large purchase.",
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
