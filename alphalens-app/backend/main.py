from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import uuid

from config import settings
from database import get_db, engine, Base
import crud, schemas
from importer import import_excel

app = FastAPI(
    title="AlphaLens PE API",
    description="PE Fund Manager Intelligence Platform — REST API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

# ── Import ─────────────────────────────────────────────────────────────────────
@app.post("/api/import", response_model=schemas.ImportResult, tags=["Import"])
async def import_data(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Only Excel files (.xlsx/.xls) are supported")
    content = await file.read()
    result = await import_excel(db, content)
    return result

# ── Dashboard Analytics ────────────────────────────────────────────────────────
@app.get("/api/analytics/dashboard", response_model=schemas.DashboardStats, tags=["Analytics"])
async def dashboard(db: AsyncSession = Depends(get_db)):
    return await crud.get_dashboard_stats(db)

@app.get("/api/analytics/scatter", response_model=List[schemas.ScatterPoint], tags=["Analytics"])
async def scatter(
    x: str = Query("irr", description="X axis metric: irr|tvpi|dpi|rvpi"),
    y: str = Query("tvpi", description="Y axis metric: irr|tvpi|dpi|rvpi"),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_scatter_data(db, x, y)

@app.get("/api/analytics/top-managers", tags=["Analytics"])
async def top_managers(
    metric: str = Query("irr", description="irr|tvpi|dpi"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_top_managers(db, metric, limit)

@app.get("/api/analytics/quartile-distribution", tags=["Analytics"])
async def quartile_dist(db: AsyncSession = Depends(get_db)):
    return await crud.get_quartile_distribution(db)

# ── Fund Managers ──────────────────────────────────────────────────────────────
@app.get("/api/managers", tags=["Managers"])
async def list_managers(
    skip: int = 0,
    limit: int = Query(200, le=500),
    search: Optional[str] = None,
    strategy: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    managers, total = await crud.get_managers(db, skip=skip, limit=limit, search=search, strategy=strategy)
    return {"total": total, "items": managers}

@app.get("/api/managers/{manager_id}", tags=["Managers"])
async def get_manager(manager_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    m = await crud.get_manager(db, manager_id)
    if not m:
        raise HTTPException(404, "Manager not found")
    return m

@app.post("/api/managers", status_code=201, tags=["Managers"])
async def create_manager(data: schemas.FundManagerCreate, db: AsyncSession = Depends(get_db)):
    return await crud.create_manager(db, data)

@app.patch("/api/managers/{manager_id}", tags=["Managers"])
async def update_manager(manager_id: uuid.UUID, data: schemas.FundManagerUpdate, db: AsyncSession = Depends(get_db)):
    m = await crud.update_manager(db, manager_id, data)
    if not m:
        raise HTTPException(404, "Manager not found")
    return m

@app.delete("/api/managers/{manager_id}", status_code=204, tags=["Managers"])
async def delete_manager(manager_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await crud.delete_manager(db, manager_id)
    if not ok:
        raise HTTPException(404, "Manager not found")

# ── Funds ──────────────────────────────────────────────────────────────────────
@app.get("/api/funds", tags=["Funds"])
async def list_funds(
    manager_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = Query(500, le=1000),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_funds(db, manager_id=manager_id, skip=skip, limit=limit)

@app.get("/api/funds/{fund_id}", tags=["Funds"])
async def get_fund(fund_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    f = await crud.get_fund(db, fund_id)
    if not f:
        raise HTTPException(404, "Fund not found")
    return f

@app.post("/api/funds", status_code=201, tags=["Funds"])
async def create_fund(data: schemas.FundCreate, db: AsyncSession = Depends(get_db)):
    return await crud.create_fund(db, data)

@app.patch("/api/funds/{fund_id}", tags=["Funds"])
async def update_fund(fund_id: uuid.UUID, data: schemas.FundUpdate, db: AsyncSession = Depends(get_db)):
    f = await crud.update_fund(db, fund_id, data)
    if not f:
        raise HTTPException(404, "Fund not found")
    return f

@app.delete("/api/funds/{fund_id}", status_code=204, tags=["Funds"])
async def delete_fund(fund_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await crud.delete_fund(db, fund_id)
    if not ok:
        raise HTTPException(404, "Fund not found")

# ── Workflows ──────────────────────────────────────────────────────────────────
@app.get("/api/workflows", tags=["Workflows"])
async def list_workflows(status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    return await crud.get_workflows(db, status=status)

@app.get("/api/workflows/{wf_id}", tags=["Workflows"])
async def get_workflow(wf_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    w = await crud.get_workflow(db, wf_id)
    if not w:
        raise HTTPException(404, "Workflow not found")
    return w

@app.post("/api/workflows", status_code=201, tags=["Workflows"])
async def create_workflow(data: schemas.WorkflowCreate, db: AsyncSession = Depends(get_db)):
    return await crud.create_workflow(db, data)

@app.patch("/api/workflows/{wf_id}", tags=["Workflows"])
async def update_workflow(wf_id: uuid.UUID, data: schemas.WorkflowUpdate, db: AsyncSession = Depends(get_db)):
    w = await crud.update_workflow(db, wf_id, data)
    if not w:
        raise HTTPException(404, "Workflow not found")
    return w

@app.delete("/api/workflows/{wf_id}", status_code=204, tags=["Workflows"])
async def delete_workflow(wf_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await crud.delete_workflow(db, wf_id)
    if not ok:
        raise HTTPException(404, "Workflow not found")

@app.post("/api/workflows/{wf_id}/comments", status_code=201, tags=["Workflows"])
async def add_comment(wf_id: uuid.UUID, data: schemas.WorkflowCommentCreate, db: AsyncSession = Depends(get_db)):
    return await crud.add_comment(db, wf_id, data)
