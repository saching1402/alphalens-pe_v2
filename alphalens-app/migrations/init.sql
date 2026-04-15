-- AlphaLens PE — PostgreSQL Schema
-- Run once on fresh DB; idempotent via IF NOT EXISTS

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram index for fast text search

-- ── fund_managers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_managers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    strategy        VARCHAR(20)  CHECK (strategy IN ('MM','LMM') OR strategy IS NULL),
    pb_score        NUMERIC(5,2),
    aum_usd_m       NUMERIC(14,2),
    description     TEXT,
    year_founded    SMALLINT,
    segment         VARCHAR(100),
    latest_fund_size_usd_m NUMERIC(14,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── funds ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funds (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_id_raw     VARCHAR(50) UNIQUE,               -- original Preqin ID
    manager_id      UUID NOT NULL REFERENCES fund_managers(id) ON DELETE CASCADE,
    fund_name       VARCHAR(200) NOT NULL,
    vintage         SMALLINT,
    fund_size_usd_m NUMERIC(14,2),
    fund_type       VARCHAR(100),
    investments     INTEGER,
    total_investments INTEGER,
    irr             NUMERIC(8,3),
    tvpi            NUMERIC(8,4),
    rvpi            NUMERIC(8,4),
    dpi             NUMERIC(8,4),
    fund_quartile   VARCHAR(80),
    irr_benchmark   NUMERIC(8,3),
    tvpi_benchmark  NUMERIC(8,4),
    dpi_benchmark   NUMERIC(8,4),
    as_of_quarter   VARCHAR(10),
    as_of_year      SMALLINT,
    preferred_geography TEXT,
    preferred_industry  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── workflows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wf_number       SERIAL,
    title           VARCHAR(500) NOT NULL,
    manager_id      UUID REFERENCES fund_managers(id) ON DELETE SET NULL,
    wf_type         VARCHAR(50) NOT NULL DEFAULT 'Due Diligence'
                    CHECK (wf_type IN ('Due Diligence','Clarification','Risk Review','Performance','Other')),
    priority        VARCHAR(20) NOT NULL DEFAULT 'Medium'
                    CHECK (priority IN ('High','Medium','Low')),
    status          VARCHAR(30) NOT NULL DEFAULT 'Open'
                    CHECK (status IN ('Open','In Progress','Resolved','Closed')),
    assignee        VARCHAR(200),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── workflow_comments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    author          VARCHAR(200) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'analyst'
                    CHECK (role IN ('analyst','pm','respondent','system')),
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── audit_log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID,
    action          VARCHAR(20) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','IMPORT')),
    changed_by      VARCHAR(200) DEFAULT 'system',
    old_values      JSONB,
    new_values      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_funds_manager_id   ON funds(manager_id);
CREATE INDEX IF NOT EXISTS idx_funds_vintage       ON funds(vintage);
CREATE INDEX IF NOT EXISTS idx_funds_irr           ON funds(irr DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_manager_strategy    ON fund_managers(strategy);
CREATE INDEX IF NOT EXISTS idx_manager_pb          ON fund_managers(pb_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_workflows_manager   ON workflows(manager_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status    ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_wf_comments_wf      ON workflow_comments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_table         ON audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_name_trgm   ON fund_managers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fund_name_trgm      ON funds USING gin(fund_name gin_trgm_ops);

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_managers_updated_at') THEN
    CREATE TRIGGER trg_managers_updated_at BEFORE UPDATE ON fund_managers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_funds_updated_at') THEN
    CREATE TRIGGER trg_funds_updated_at BEFORE UPDATE ON funds
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_workflows_updated_at') THEN
    CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON workflows
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
