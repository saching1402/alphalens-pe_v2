from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Numeric, SmallInteger, Integer, Text, ForeignKey, DateTime, func, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from typing import Optional, List
from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

class FundManager(Base):
    __tablename__ = "fund_managers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    strategy: Mapped[Optional[str]] = mapped_column(String(20))
    pb_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    aum_usd_m: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    description: Mapped[Optional[str]] = mapped_column(Text)
    year_founded: Mapped[Optional[int]] = mapped_column(SmallInteger)
    segment: Mapped[Optional[str]] = mapped_column(String(100))
    latest_fund_size_usd_m: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    funds: Mapped[List["Fund"]] = relationship("Fund", back_populates="manager", cascade="all, delete-orphan")
    workflows: Mapped[List["Workflow"]] = relationship("Workflow", back_populates="manager")

class Fund(Base):
    __tablename__ = "funds"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fund_id_raw: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    manager_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fund_managers.id", ondelete="CASCADE"), nullable=False)
    fund_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vintage: Mapped[Optional[int]] = mapped_column(SmallInteger)
    fund_size_usd_m: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    fund_type: Mapped[Optional[str]] = mapped_column(String(100))
    investments: Mapped[Optional[int]] = mapped_column(Integer)
    total_investments: Mapped[Optional[int]] = mapped_column(Integer)
    irr: Mapped[Optional[float]] = mapped_column(Numeric(8, 3))
    tvpi: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    rvpi: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    dpi: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    fund_quartile: Mapped[Optional[str]] = mapped_column(String(80))
    irr_benchmark: Mapped[Optional[float]] = mapped_column(Numeric(8, 3))
    tvpi_benchmark: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    dpi_benchmark: Mapped[Optional[float]] = mapped_column(Numeric(8, 4))
    as_of_quarter: Mapped[Optional[str]] = mapped_column(String(10))
    as_of_year: Mapped[Optional[int]] = mapped_column(SmallInteger)
    preferred_geography: Mapped[Optional[str]] = mapped_column(Text)
    preferred_industry: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    manager: Mapped["FundManager"] = relationship("FundManager", back_populates="funds")

class Workflow(Base):
    __tablename__ = "workflows"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wf_number: Mapped[Optional[int]] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fund_managers.id", ondelete="SET NULL"))
    wf_type: Mapped[str] = mapped_column(String(50), default="Due Diligence")
    priority: Mapped[str] = mapped_column(String(20), default="Medium")
    status: Mapped[str] = mapped_column(String(30), default="Open")
    assignee: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    manager: Mapped[Optional["FundManager"]] = relationship("FundManager", back_populates="workflows")
    comments: Mapped[List["WorkflowComment"]] = relationship("WorkflowComment", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowComment.created_at")

class WorkflowComment(Base):
    __tablename__ = "workflow_comments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    author: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="analyst")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="comments")

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
