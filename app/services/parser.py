"""Simple heuristics-based parser for purchase orders."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ParsedPurchase(BaseModel):
    vendor_name: str
    total_amount: float
    currency: str = "USD"
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    asset_name: Optional[str] = None


class PurchaseParser:
    """Parse structured information from raw text invoices."""

    def parse_text(self, content: str) -> tuple[ParsedPurchase, float]:
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        vendor_name = self._extract_value(lines, ["vendor", "supplier"], default="Unknown Vendor")
        total_amount = float(self._extract_value(lines, ["total", "amount"], default="0").replace("$", ""))
        currency = "USD"
        due_date_str = self._extract_value(lines, ["due", "pay by"], default="")
        due_date = None
        if due_date_str:
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d %b %Y"):
                try:
                    due_date = datetime.strptime(due_date_str, fmt)
                    break
                except ValueError:
                    continue
        description = self._extract_value(lines, ["description", "notes"], default=None)
        asset_name = self._extract_value(lines, ["item", "product", "asset"], default=None)

        parsed = ParsedPurchase(
            vendor_name=vendor_name,
            total_amount=total_amount,
            currency=currency,
            due_date=due_date,
            description=description,
            asset_name=asset_name,
        )
        confidence = 0.7 if total_amount > 0 else 0.3
        return parsed, confidence

    def _extract_value(self, lines: list[str], prefixes: list[str], default: Optional[str]) -> Optional[str]:
        for line in lines:
            lowered = line.lower()
            for prefix in prefixes:
                if lowered.startswith(prefix.lower()):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        return parts[1].strip()
                    return line[len(prefix) :].strip()
        return default


def parser_event_payload(parsed: ParsedPurchase, confidence: float) -> Dict[str, Any]:
    return {
        "vendor_name": parsed.vendor_name,
        "total_amount": parsed.total_amount,
        "currency": parsed.currency,
        "due_date": parsed.due_date.isoformat() if parsed.due_date else None,
        "description": parsed.description,
        "asset_name": parsed.asset_name,
        "confidence": confidence,
    }
