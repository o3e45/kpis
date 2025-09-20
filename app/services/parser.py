"""Simple heuristics-based parser for purchase orders."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


CURRENCY_SYMBOLS = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
}

CURRENCY_CODES = {
    "usd": "USD",
    "eur": "EUR",
    "gbp": "GBP",
    "jpy": "JPY",
    "cad": "CAD",
    "aud": "AUD",
}


class ParsedPurchase(BaseModel):
    vendor_name: str
    total_amount: float
    currency: str = "USD"
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    asset_name: Optional[str] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    reference: Optional[str] = None
    claim_links: List[str] = Field(default_factory=list)


class PurchaseParser:
    """Parse structured information from raw text invoices."""

    def parse_text(self, content: str) -> tuple[ParsedPurchase, float]:
        normalized = content.replace("\r\n", "\n")
        raw_lines = [line.rstrip() for line in normalized.splitlines()]
        lines = [line.strip() for line in raw_lines if line.strip()]

        vendor_name = self._extract_value(lines, ["vendor", "vendor name", "supplier"], default="Unknown Vendor")
        reference = self._extract_value(lines, ["invoice", "reference", "po"], default=None)
        status = self._extract_value(lines, ["status", "payment status"], default=None)

        payment_status = None
        if status:
            lowered = status.lower()
            if any(keyword in lowered for keyword in ("paid", "settled", "cleared")):
                payment_status = "paid"
            elif any(keyword in lowered for keyword in ("partial", "deposit")):
                payment_status = "partial"
            elif any(keyword in lowered for keyword in ("overdue", "late", "past due")):
                payment_status = "overdue"

        total_amount = self._extract_amount(lines)
        currency = self._detect_currency(content) or "USD"

        due_date = self._extract_due_date(lines)
        description = self._extract_block(raw_lines, ["description", "details", "notes"])
        asset_name = self._extract_value(lines, ["item", "product", "asset", "service"], default=None)
        claim_links = self._extract_claim_links(content)

        parsed = ParsedPurchase(
            vendor_name=vendor_name,
            total_amount=total_amount,
            currency=currency,
            due_date=due_date,
            description=description,
            asset_name=asset_name,
            status=status,
            payment_status=payment_status,
            reference=reference,
            claim_links=claim_links,
        )

        confidence = self._calculate_confidence(parsed)
        return parsed, confidence

    def _extract_value(self, lines: list[str], prefixes: list[str], default: Optional[str]) -> Optional[str]:
        for line in lines:
            lowered = line.lower()
            for prefix in prefixes:
                prefix_lower = prefix.lower()
                if lowered.startswith(prefix_lower):
                    parts = re.split(r"[:\-]", line, maxsplit=1)
                    if len(parts) == 2:
                        return parts[1].strip()
                    return line[len(prefix):].strip()
        return default

    def _extract_amount(self, lines: list[str]) -> float:
        amount_candidates: list[float] = []
        amount_pattern = re.compile(r"(?i)(total|amount|balance due|grand total).*?(\d[\d,]*(?:\.\d{2})?)")
        for line in lines:
            match = amount_pattern.search(line)
            if match:
                raw_value = match.group(2).replace(",", "")
                try:
                    amount_candidates.append(float(raw_value))
                except ValueError:
                    continue
        if amount_candidates:
            return max(amount_candidates)

        # fallback: find standalone currency formatted numbers
        standalone_pattern = re.compile(r"([\$€£¥]?)(\d[\d,]*(?:\.\d{2})?)")
        for line in lines:
            match = standalone_pattern.search(line)
            if match and match.group(2):
                raw_value = match.group(2).replace(",", "")
                try:
                    return float(raw_value)
                except ValueError:
                    continue
        return 0.0

    def _detect_currency(self, content: str) -> Optional[str]:
        for symbol, code in CURRENCY_SYMBOLS.items():
            if symbol in content:
                return code
        code_pattern = re.compile(r"(?i)currency[:\s]+([A-Z]{3})")
        match = code_pattern.search(content)
        if match:
            return CURRENCY_CODES.get(match.group(1).lower(), match.group(1).upper())
        for code in CURRENCY_CODES:
            if re.search(rf"\b{code}\b", content, flags=re.IGNORECASE):
                return CURRENCY_CODES[code]
        return None

    def _extract_due_date(self, lines: list[str]) -> Optional[datetime]:
        due_date_str = self._extract_value(lines, ["due", "due date", "pay by", "payment due"], default="")
        if not due_date_str:
            return None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d %b %Y", "%B %d, %Y"):
            try:
                return datetime.strptime(due_date_str, fmt)
            except ValueError:
                continue
        return None

    def _extract_block(self, lines: list[str], prefixes: list[str]) -> Optional[str]:
        for index, line in enumerate(lines):
            lowered = line.lower()
            for prefix in prefixes:
                if lowered.startswith(prefix.lower()):
                    remainder = line.split(":", 1)
                    current = remainder[1].strip() if len(remainder) == 2 else ""
                    collected = [current] if current else []
                    for follow in lines[index + 1:]:
                        if not follow.strip():
                            break
                        if any(follow.lower().startswith(other.lower()) for other in prefixes):
                            break
                        if re.match(r"^[A-Za-z]+[:\-]", follow):
                            break
                        collected.append(follow.strip())
                    return " ".join(collected).strip() or None
        return None

    def _extract_claim_links(self, content: str) -> list[str]:
        links = re.findall(r"https?://\S+", content)
        return [link for link in links if re.search(r"claim|ticket|case", link, flags=re.IGNORECASE)]

    def _calculate_confidence(self, parsed: ParsedPurchase) -> float:
        confidence = 0.4
        if parsed.vendor_name and parsed.vendor_name != "Unknown Vendor":
            confidence += 0.15
        if parsed.total_amount > 0:
            confidence += 0.25
        if parsed.due_date:
            confidence += 0.1
        if parsed.status or parsed.payment_status:
            confidence += 0.05
        if parsed.claim_links:
            confidence += 0.05
        return min(confidence, 0.95)


def parser_event_payload(parsed: ParsedPurchase, confidence: float) -> Dict[str, Any]:
    return {
        "vendor_name": parsed.vendor_name,
        "total_amount": parsed.total_amount,
        "currency": parsed.currency,
        "due_date": parsed.due_date.isoformat() if parsed.due_date else None,
        "description": parsed.description,
        "asset_name": parsed.asset_name,
        "status": parsed.status,
        "payment_status": parsed.payment_status,
        "reference": parsed.reference,
        "claim_links": parsed.claim_links,
        "confidence": confidence,
    }
