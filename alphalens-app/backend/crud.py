from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, update, delete, or_, and_, text
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
import uuid
from database import FundManager, Fund, Workflow, WorkflowComment
import schemas

# ── Aggregation helpers ───────────────────────────────────────────────────────
def _safe_avg(values):
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 3) if vals else None

def _weighted_avg(nums, weights):
    pairs = [(n, w) for n, w in zip(nums, weights) if n is not None and w is not None and w > 0]
    if not pairs: return None
    total_w = sum(w for _, w in pairs)
    return round(sum(n * w for n, w in pairs) / total_w, 3) if total_w else None

def _enrich_manager(mgr: FundManager) -> dict:
    """Compute all derived metrics for a manager from its loaded funds."""
    funds = mgr.funds
    irrs = [f.irr for f in funds if f.irr is not None]
    tvpis = [f.tvpi for f in funds if f.tvpi is not None]
    dpis = [f.dpi for f in funds if f.dpi is not None]
    sizes = [f.fund_size_usd_m for f in funds if f.fund_size_usd_m is not None]

    q_map = {
        "1 (Top Quartile)": "top_quartile_funds",
        "2 (Upper-Mid Quartile)": "upper_mid_quartile_funds",
        "3 (Lower-Mid Quartile)": "lower_mid_quartile_funds",
        "4 (Bottom Quartile)": "bottom_quartile_funds",
    }
    q_counts = {k: 0 for k in q_map.values()}
    for f in funds:
        if f.fund_quartile and f.fund_quartile in q_map:
            q_counts[q_map[f.fund_quartile]] += 1
    total_q = sum(q_counts.values())
    top_q_pct = round(q_counts["top_quartile_funds"] / total_q * 100, 1) if total_q > 0 else None

    # IRR vs benchmark
    bm_pairs = [(f.irr, f.irr_benchmark) for f in funds if f.irr is not None and f.irr_benchmark is not None]
    irr_vs_bm = round(sum(a - b for a, b in bm_pairs) / len(bm_pairs), 2) if bm_pairs else None

    return {
        "num_funds": len(funds),
        "avg_irr": _safe_avg(irrs),
        "avg_tvpi": _safe_avg(tvpis),
        "avg_dpi": _safe_avg(dpis),
        "weighted_avg_irr": _weighted_avg(irrs, sizes),
        "weighted_avg_tvpi": _weighted_avg(tvpis, sizes),
        "irr_vs_benchmark": irr_vs_bm,
        "top_quartile_pct": top_q_pct,
        "total_funds_with_quartile": total_q,
        **q_counts,
    }

# ── Fund Managers CRUD ────────────────────────────────────────────────────────
async def get_managers(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 200,
    search: Optional[str] = None,
    strategy: Optional[str] = None,
    with_funds: bool = True,
) -> Tuple[List[dict], int]:
    q = select(FundManager)
    if with_funds:
        q = q.options(selectinload(FundManager.funds))
    if search:
        q = q.where(FundManager.name.ilike(f"%{search}%"))
    if strategy:
        q = q.where(FundManager.strategy == strategy)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()
    q = q.order_by(FundManager.name).offset(skip).limit(limit)
    result = await db.execute(q)
    managers = result.scalars().all()
    enriched = []
    for m in managers:
        d = {c.name: getattr(m, c.name) for c in m.__table__.columns}
        if with_funds:
            d.update(_enrich_manager(m))
        enriched.append(d)
    return enriched, total

async def get_manager(db: AsyncSession, manager_id: uuid.UUID) -> Optional[dict]:
    q = select(FundManager).where(FundManager.id == manager_id).options(selectinload(FundManager.funds))
    result = await db.execute(q)
    m = result.scalar_one_or_none()
    if not m: return None
    d = {c.name: getattr(m, c.name) for c in m.__table__.columns}
    d.update(_enrich_manager(m))
    d["funds"] = [{c.name: getattr(f, c.name) for c in f.__table__.columns} for f in m.funds]
    return d

async def create_manager(db: AsyncSession, data: schemas.FundManagerCreate) -> dict:
    m = FundManager(**data.model_dump())
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return {c.name: getattr(m, c.name) for c in m.__table__.columns}

async def update_manager(db: AsyncSession, manager_id: uuid.UUID, data: schemas.FundManagerUpdate) -> Optional[dict]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates: return await get_manager(db, manager_id)
    await db.execute(update(FundManager).where(FundManager.id == manager_id).values(**updates))
    return await get_manager(db, manager_id)

async def delete_manager(db: AsyncSession, manager_id: uuid.UUID) -> bool:
    r = await db.execute(delete(FundManager).where(FundManager.id == manager_id))
    return r.rowcount > 0

# ── Funds CRUD ────────────────────────────────────────────────────────────────
async def get_funds(db: AsyncSession, manager_id: Optional[uuid.UUID] = None, skip: int = 0, limit: int = 500) -> List[dict]:
    q = select(Fund)
    if manager_id:
        q = q.where(Fund.manager_id == manager_id)
    q = q.order_by(Fund.vintage.asc().nullslast(), Fund.fund_name).offset(skip).limit(limit)
    result = await db.execute(q)
    return [{c.name: getattr(f, c.name) for c in f.__table__.columns} for f in result.scalars().all()]

async def get_fund(db: AsyncSession, fund_id: uuid.UUID) -> Optional[dict]:
    result = await db.execute(select(Fund).where(Fund.id == fund_id))
    f = result.scalar_one_or_none()
    if not f: return None
    return {c.name: getattr(f, c.name) for c in f.__table__.columns}

async def create_fund(db: AsyncSession, data: schemas.FundCreate) -> dict:
    f = Fund(**data.model_dump())
    db.add(f)
    await db.flush()
    await db.refresh(f)
    return {c.name: getattr(f, c.name) for c in f.__table__.columns}

async def update_fund(db: AsyncSession, fund_id: uuid.UUID, data: schemas.FundUpdate) -> Optional[dict]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.execute(update(Fund).where(Fund.id == fund_id).values(**updates))
    return await get_fund(db, fund_id)

async def delete_fund(db: AsyncSession, fund_id: uuid.UUID) -> bool:
    r = await db.execute(delete(Fund).where(Fund.id == fund_id))
    return r.rowcount > 0

# ── Analytics ─────────────────────────────────────────────────────────────────
async def get_dashboard_stats(db: AsyncSession) -> dict:
    # Manager count
    mgr_count = (await db.execute(select(func.count()).select_from(FundManager))).scalar_one()
    fund_count = (await db.execute(select(func.count()).select_from(Fund))).scalar_one()
    # Fund aggregates
    agg = (await db.execute(
        select(func.avg(Fund.irr), func.avg(Fund.tvpi), func.avg(Fund.dpi))
    )).one()
    # AUM
    aum = (await db.execute(select(func.sum(FundManager.aum_usd_m)))).scalar_one()
    # PB score
    pb_avg = (await db.execute(select(func.avg(FundManager.pb_score)).where(FundManager.pb_score > 0))).scalar_one()
    # Quartile counts
    q1_count = (await db.execute(select(func.count()).where(Fund.fund_quartile == "1 (Top Quartile)"))).scalar_one()
    rated = (await db.execute(select(func.count()).where(Fund.fund_quartile.isnot(None)))).scalar_one()
    # High conviction (avg irr >= 20 per manager) — count via subquery
    sub = select(FundManager.id, func.avg(Fund.irr).label("avg_irr")) \
        .join(Fund, Fund.manager_id == FundManager.id) \
        .group_by(FundManager.id).subquery()
    hc_count = (await db.execute(select(func.count()).where(sub.c.avg_irr >= 20))).scalar_one()
    return {
        "total_managers": mgr_count,
        "total_funds": fund_count,
        "avg_irr": round(float(agg[0]), 2) if agg[0] else None,
        "avg_tvpi": round(float(agg[1]), 3) if agg[1] else None,
        "avg_dpi": round(float(agg[2]), 3) if agg[2] else None,
        "avg_pb_score": round(float(pb_avg), 1) if pb_avg else None,
        "total_aum_usd_b": round(float(aum) / 1000, 1) if aum else None,
        "top_quartile_count": q1_count,
        "total_rated_funds": rated,
        "high_conviction_count": hc_count,
    }

async def get_scatter_data(db: AsyncSession, x_field: str, y_field: str) -> List[dict]:
    """Return per-manager averages for scatter charts. x_field/y_field are fund metric names."""
    ALLOWED = {"irr", "tvpi", "dpi", "rvpi"}
    if x_field not in ALLOWED or y_field not in ALLOWED:
        return []
    x_col = getattr(Fund, x_field)
    y_col = getattr(Fund, y_field)
    rows = await db.execute(
        select(
            FundManager.name,
            FundManager.strategy,
            FundManager.pb_score,
            func.avg(x_col).label("x"),
            func.avg(y_col).label("y"),
        )
        .join(Fund, Fund.manager_id == FundManager.id)
        .group_by(FundManager.id, FundManager.name, FundManager.strategy, FundManager.pb_score)
        .having(func.avg(x_col).isnot(None), func.avg(y_col).isnot(None))
    )
    return [{"name": r.name, "strategy": r.strategy, "pb_score": float(r.pb_score) if r.pb_score else None,
             "x": round(float(r.x), 2), "y": round(float(r.y), 3)} for r in rows.all()]

async def get_top_managers(db: AsyncSession, metric: str = "irr", limit: int = 20) -> List[dict]:
    ALLOWED = {"irr": Fund.irr, "tvpi": Fund.tvpi, "dpi": Fund.dpi}
    if metric not in ALLOWED: return []
    col = ALLOWED[metric]
    rows = await db.execute(
        select(FundManager.name, FundManager.strategy, func.avg(col).label("value"))
        .join(Fund, Fund.manager_id == FundManager.id)
        .group_by(FundManager.id, FundManager.name, FundManager.strategy)
        .having(func.avg(col).isnot(None))
        .order_by(func.avg(col).desc())
        .limit(limit)
    )
    return [{"name": r.name, "strategy": r.strategy, "value": round(float(r.value), 2)} for r in rows.all()]

async def get_quartile_distribution(db: AsyncSession) -> dict:
    rows = await db.execute(
        select(Fund.fund_quartile, func.count().label("count"))
        .where(Fund.fund_quartile.isnot(None))
        .group_by(Fund.fund_quartile)
    )
    return {r.fund_quartile: r.count for r in rows.all()}

# ── Workflows CRUD ────────────────────────────────────────────────────────────
async def get_workflows(db: AsyncSession, status: Optional[str] = None) -> List[dict]:
    q = select(Workflow).options(selectinload(Workflow.comments), selectinload(Workflow.manager))
    if status:
        q = q.where(Workflow.status == status)
    q = q.order_by(Workflow.created_at.desc())
    result = await db.execute(q)
    out = []
    for w in result.scalars().all():
        d = {c.name: getattr(w, c.name) for c in w.__table__.columns}
        d["manager_name"] = w.manager.name if w.manager else None
        d["comments"] = [{c2.name: getattr(cm, c2.name) for c2 in cm.__table__.columns} for cm in w.comments]
        out.append(d)
    return out

async def get_workflow(db: AsyncSession, wf_id: uuid.UUID) -> Optional[dict]:
    q = select(Workflow).where(Workflow.id == wf_id).options(selectinload(Workflow.comments), selectinload(Workflow.manager))
    result = await db.execute(q)
    w = result.scalar_one_or_none()
    if not w: return None
    d = {c.name: getattr(w, c.name) for c in w.__table__.columns}
    d["manager_name"] = w.manager.name if w.manager else None
    d["comments"] = [{c2.name: getattr(cm, c2.name) for c2 in cm.__table__.columns} for cm in w.comments]
    return d

async def create_workflow(db: AsyncSession, data: schemas.WorkflowCreate) -> dict:
    # Get next wf_number
    max_num = (await db.execute(select(func.max(Workflow.wf_number)))).scalar_one() or 0
    w = Workflow(**data.model_dump(), wf_number=max_num + 1)
    db.add(w)
    await db.flush()
    return await get_workflow(db, w.id)

async def update_workflow(db: AsyncSession, wf_id: uuid.UUID, data: schemas.WorkflowUpdate) -> Optional[dict]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.execute(update(Workflow).where(Workflow.id == wf_id).values(**updates))
    return await get_workflow(db, wf_id)

async def delete_workflow(db: AsyncSession, wf_id: uuid.UUID) -> bool:
    r = await db.execute(delete(Workflow).where(Workflow.id == wf_id))
    return r.rowcount > 0

async def add_comment(db: AsyncSession, wf_id: uuid.UUID, data: schemas.WorkflowCommentCreate) -> dict:
    cm = WorkflowComment(workflow_id=wf_id, **data.model_dump())
    db.add(cm)
    await db.flush()
    await db.refresh(cm)
    return {c.name: getattr(cm, c.name) for c in cm.__table__.columns}
