"""Pydantic schemas for the Empire OS prototype."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MediaObject(BaseModel):
    id: int
    media_type: Optional[str]
    mime: Optional[str]
    storage_path: Optional[str]

    class Config:
        orm_mode = True


class Vendor(BaseModel):
    id: int
    name: Optional[str]

    class Config:
        orm_mode = True


class PurchaseOrder(BaseModel):
    id: int
    total_amount: float
    currency: str
    status: str
    due_date: Optional[datetime]
    description: Optional[str]
    vendor: Vendor
    media_object: MediaObject

    class Config:
        orm_mode = True


class Event(BaseModel):
    id: int
    event_type: str
    payload: dict
    created_at: datetime

    class Config:
        orm_mode = True


class AgentSuggestion(BaseModel):
    id: int
    agent_name: str
    suggestion_type: str
    message: str
    approved: bool
    created_at: datetime
    approved_at: Optional[datetime]

    class Config:
        orm_mode = True


class PurchaseIngestResponse(BaseModel):
    purchase_order: PurchaseOrder
    events: List[Event]
    suggestions: List[AgentSuggestion]


class SearchResult(BaseModel):
    media_object_id: int
    score: float = Field(..., ge=0)
    excerpt: str


class SuggestionApprovalResponse(BaseModel):
    suggestion: AgentSuggestion
    event: Event
