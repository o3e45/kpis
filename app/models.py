"""SQLAlchemy models for the Empire OS prototype."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class LLC(Base):
    __tablename__ = "llcs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    ein: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    people: Mapped[list["Person"]] = relationship(back_populates="llc", cascade="all, delete-orphan")
    media_objects: Mapped[list["MediaObject"]] = relationship(back_populates="llc")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="llc")


class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    llc_id: Mapped[int | None] = mapped_column(ForeignKey("llcs.id"))
    name: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    llc: Mapped[Optional["LLC"]] = relationship(back_populates="people")
    user: Mapped[Optional["User"]] = relationship(back_populates="person", uselist=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"))
    username: Mapped[str | None] = mapped_column(String, unique=True)
    display_name: Mapped[str | None] = mapped_column(String)
    auth_provider: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    person: Mapped[Optional["Person"]] = relationship(back_populates="user")


class Town(Base):
    __tablename__ = "towns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)


class Platform(Base):
    __tablename__ = "platforms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)

    vendors: Mapped[list["Vendor"]] = relationship(back_populates="platform")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String)
    vendor_identifier: Mapped[str | None] = mapped_column(String)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    platform: Mapped[Optional["Platform"]] = relationship(back_populates="vendors")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="vendor")


class MediaObject(Base):
    __tablename__ = "media_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    llc_id: Mapped[int | None] = mapped_column(ForeignKey("llcs.id"))
    media_type: Mapped[str | None] = mapped_column(String)
    mime: Mapped[str | None] = mapped_column(String)
    storage_path: Mapped[str | None] = mapped_column(String)
    sha256: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    llc: Mapped[Optional["LLC"]] = relationship(back_populates="media_objects")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="media_object")
    vectors: Mapped[list["DocumentVector"]] = relationship(back_populates="media_object", cascade="all, delete-orphan")


class DocumentVector(Base):
    __tablename__ = "document_vectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    media_object_id: Mapped[int] = mapped_column(ForeignKey("media_objects.id"))
    vector: Mapped[list[float]] = mapped_column(JSON)
    embedding_strategy: Mapped[str] = mapped_column(String, default="hash-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    media_object: Mapped["MediaObject"] = relationship(back_populates="vectors")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    llc_id: Mapped[int] = mapped_column(ForeignKey("llcs.id"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    media_object_id: Mapped[int] = mapped_column(ForeignKey("media_objects.id"))
    total_amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="USD")
    status: Mapped[str] = mapped_column(String, default="pending")
    due_date: Mapped[datetime | None] = mapped_column(DateTime)
    received_at: Mapped[datetime | None] = mapped_column(DateTime)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    llc: Mapped["LLC"] = relationship(back_populates="purchase_orders")
    vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
    media_object: Mapped["MediaObject"] = relationship(back_populates="purchase_orders")
    assets: Mapped[list["Asset"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    suggestions: Mapped[list["AgentSuggestion"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"))
    name: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="assets")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    purchase_order: Mapped[Optional["PurchaseOrder"]] = relationship()


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="USD")
    direction: Mapped[str] = mapped_column(String, default="outgoing")
    happened_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    purchase_order: Mapped[Optional["PurchaseOrder"]] = relationship()


class AgentSuggestion(Base):
    __tablename__ = "agent_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"))
    agent_name: Mapped[str] = mapped_column(String)
    suggestion_type: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="suggestions")
