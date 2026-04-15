"""
Import from Excel: MM_Buyout_Fund_Manager_Info_Masked.xlsx
Handles both sheets: 'Fund Manager Info' and 'Consol View Values'
Upserts on name (manager) and fund_id_raw (fund).
"""
import pandas as pd
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import FundManager, Fund
from typing import Optional
import uuid

def _clean(val):
    """Return None for NaN/NaT, else the value."""
    if val is None: return None
    if isinstance(val, float) and np.isnan(val): return None
    if pd.isna(val): return None
    return val

def _str(val) -> Optional[str]:
    v = _clean(val)
    return str(v).strip() if v is not None else None

def _float(val) -> Optional[float]:
    v = _clean(val)
    try: return float(v) if v is not None else None
    except (ValueError, TypeError): return None

def _int(val) -> Optional[int]:
    v = _clean(val)
    try: return int(v) if v is not None else None
    except (ValueError, TypeError): return None

async def import_excel(db: AsyncSession, file_bytes: bytes) -> dict:
    import io
    xl = pd.ExcelFile(io.BytesIO(file_bytes))
    errors = []
    mgr_created = mgr_updated = fund_created = fund_updated = 0

    # ── Sheet 1: Consol View Values (manager meta) ────────────────────────────
    df_consol = pd.read_excel(xl, sheet_name="Consol View Values")
    df_consol.columns = [c.strip() for c in df_consol.columns]

    for _, row in df_consol.iterrows():
        name = _str(row.get("Masked Investor Name"))
        if not name: continue
        try:
            pb = _float(row.get("Pitchbook Mgr  Score")) or _float(row.get("Pitchbook Mgr Score"))
            if pb == 0.0: pb = None
            meta = dict(
                strategy=_str(row.get("Strategy")),
                pb_score=pb,
                aum_usd_m=_float(row.get("AUM (USD M)")),
                description=_str(row.get("Description")),
                year_founded=_int(row.get("Year Found")),
                segment=_str(row.get("Segment")),
                latest_fund_size_usd_m=_float(row.get("Latest Fund Size (USD M)")),
            )
            existing = (await db.execute(select(FundManager).where(FundManager.name == name))).scalar_one_or_none()
            if existing:
                for k, v in meta.items():
                    if v is not None: setattr(existing, k, v)
                mgr_updated += 1
            else:
                db.add(FundManager(name=name, **{k: v for k, v in meta.items()}))
                mgr_created += 1
        except Exception as e:
            errors.append(f"Manager '{name}': {e}")
    await db.flush()

    # ── Sheet 2: Fund Manager Info ────────────────────────────────────────────
    df_funds = pd.read_excel(xl, sheet_name="Fund Manager Info")
    df_funds.columns = [c.strip() for c in df_funds.columns]

    # Build name → id lookup
    mgr_map = {m.name: m.id for m in (await db.execute(select(FundManager))).scalars().all()}

    for _, row in df_funds.iterrows():
        mgr_name = _str(row.get("Masked Investor Name"))
        fund_name = _str(row.get("Masked Fund Name"))
        if not mgr_name or not fund_name: continue
        mgr_id = mgr_map.get(mgr_name)
        if not mgr_id:
            errors.append(f"Manager not found for fund: {fund_name}")
            continue
        try:
            raw_id = _str(row.get("Fund ID"))
            fund_data = dict(
                manager_id=mgr_id,
                fund_name=fund_name,
                fund_id_raw=raw_id if raw_id and raw_id != "nan" else None,
                vintage=_int(row.get("Vintage")),
                fund_size_usd_m=_float(row.get("Fund Size")),
                fund_type=_str(row.get("Fund Type")),
                investments=_int(row.get("Investments")),
                total_investments=_int(row.get("Total Investments")),
                irr=_float(row.get("IRR")),
                tvpi=_float(row.get("TVPI")),
                rvpi=_float(row.get("RVPI")),
                dpi=_float(row.get("DPI")),
                fund_quartile=_str(row.get("Fund Quartile")),
                irr_benchmark=_float(row.get("IRR Benchmark*")),
                tvpi_benchmark=_float(row.get("TVPI Benchmark*")),
                dpi_benchmark=_float(row.get("DPI Benchmark*")),
                as_of_quarter=_str(row.get("As of Quarter")),
                as_of_year=_int(row.get("As of Year")),
                preferred_geography=_str(row.get("Preferred Geography")),
                preferred_industry=_str(row.get("Preferred Industry")),
            )
            # Try upsert by fund_id_raw first, then by (manager_id, fund_name)
            existing = None
            if fund_data["fund_id_raw"]:
                existing = (await db.execute(select(Fund).where(Fund.fund_id_raw == fund_data["fund_id_raw"]))).scalar_one_or_none()
            if not existing:
                existing = (await db.execute(select(Fund).where(
                    Fund.manager_id == mgr_id, Fund.fund_name == fund_name
                ))).scalar_one_or_none()

            if existing:
                for k, v in fund_data.items():
                    if v is not None: setattr(existing, k, v)
                fund_updated += 1
            else:
                db.add(Fund(**fund_data))
                fund_created += 1
        except Exception as e:
            errors.append(f"Fund '{fund_name}': {e}")

    await db.flush()
    return {"managers_imported": mgr_created, "funds_imported": fund_created,
            "managers_updated": mgr_updated, "funds_updated": fund_updated, "errors": errors}
