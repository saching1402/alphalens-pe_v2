from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

# ── Fund Manager ──────────────────────────────────────────────────────────────
class FundManagerBase(BaseModel):
    name: str
    strategy: Optional[str] = None
    pb_score: Optional[float] = None
    aum_usd_m: Optional[float] = None
    description: Optional[str] = None
    year_founded: Optional[int] = None
    segment: Optional[str] = None
    latest_fund_size_usd_m: Optional[float] = None

class FundManagerCreate(FundManagerBase):
    pass

class FundManagerUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    pb_score: Optional[float] = None
    aum_usd_m: Optional[float] = None
    description: Optional[str] = None
    year_founded: Optional[int] = None
    segment: Optional[str] = None
    latest_fund_size_usd_m: Optional[float] = None

class FundManagerOut(FundManagerBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Computed aggregates (populated by API)
    num_funds: Optional[int] = None
    avg_irr: Optional[float] = None
    avg_tvpi: Optional[float] = None
    avg_dpi: Optional[float] = None
    weighted_avg_irr: Optional[float] = None
    weighted_avg_tvpi: Optional[float] = None
    top_quartile_funds: Optional[int] = None
    upper_mid_quartile_funds: Optional[int] = None
    lower_mid_quartile_funds: Optional[int] = None
    bottom_quartile_funds: Optional[int] = None
    total_funds_with_quartile: Optional[int] = None
    top_quartile_pct: Optional[float] = None
    irr_vs_benchmark: Optional[float] = None

class FundManagerWithFunds(FundManagerOut):
    funds: List["FundOut"] = []

# ── Fund ──────────────────────────────────────────────────────────────────────
class FundBase(BaseModel):
    fund_name: str
    fund_id_raw: Optional[str] = None
    vintage: Optional[int] = None
    fund_size_usd_m: Optional[float] = None
    fund_type: Optional[str] = None
    investments: Optional[int] = None
    total_investments: Optional[int] = None
    irr: Optional[float] = None
    tvpi: Optional[float] = None
    rvpi: Optional[float] = None
    dpi: Optional[float] = None
    fund_quartile: Optional[str] = None
    irr_benchmark: Optional[float] = None
    tvpi_benchmark: Optional[float] = None
    dpi_benchmark: Optional[float] = None
    as_of_quarter: Optional[str] = None
    as_of_year: Optional[int] = None
    preferred_geography: Optional[str] = None
    preferred_industry: Optional[str] = None

class FundCreate(FundBase):
    manager_id: uuid.UUID

class FundUpdate(BaseModel):
    fund_name: Optional[str] = None
    vintage: Optional[int] = None
    fund_size_usd_m: Optional[float] = None
    fund_type: Optional[str] = None
    investments: Optional[int] = None
    total_investments: Optional[int] = None
    irr: Optional[float] = None
    tvpi: Optional[float] = None
    rvpi: Optional[float] = None
    dpi: Optional[float] = None
    fund_quartile: Optional[str] = None
    irr_benchmark: Optional[float] = None
    tvpi_benchmark: Optional[float] = None
    dpi_benchmark: Optional[float] = None
    as_of_quarter: Optional[str] = None
    as_of_year: Optional[int] = None
    preferred_geography: Optional[str] = None
    preferred_industry: Optional[str] = None

class FundOut(FundBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    manager_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# ── Workflow ──────────────────────────────────────────────────────────────────
class WorkflowCommentBase(BaseModel):
    author: str
    role: str = "analyst"
    body: str

class WorkflowCommentCreate(WorkflowCommentBase):
    pass

class WorkflowCommentOut(WorkflowCommentBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    workflow_id: uuid.UUID
    created_at: datetime

class WorkflowBase(BaseModel):
    title: str
    manager_id: Optional[uuid.UUID] = None
    wf_type: str = "Due Diligence"
    priority: str = "Medium"
    status: str = "Open"
    assignee: Optional[str] = None
    description: Optional[str] = None

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(BaseModel):
    title: Optional[str] = None
    manager_id: Optional[uuid.UUID] = None
    wf_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    description: Optional[str] = None

class WorkflowOut(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    wf_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    comments: List[WorkflowCommentOut] = []
    manager_name: Optional[str] = None

# ── Analytics ─────────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_managers: int
    total_funds: int
    avg_irr: Optional[float]
    avg_tvpi: Optional[float]
    avg_dpi: Optional[float]
    avg_pb_score: Optional[float]
    total_aum_usd_b: Optional[float]
    top_quartile_count: int
    total_rated_funds: int
    high_conviction_count: int

class ScatterPoint(BaseModel):
    name: str
    strategy: Optional[str]
    x: Optional[float]
    y: Optional[float]
    pb_score: Optional[float]

class ImportResult(BaseModel):
    managers_imported: int
    funds_imported: int
    managers_updated: int
    funds_updated: int
    errors: List[str] = []

# Resolve forward refs
FundManagerWithFunds.model_rebuild()
