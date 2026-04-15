# AlphaLens PE — Full-Stack Intelligence Platform

A production-grade web application for PE fund manager data management and analytics.  
**Stack:** React 18 · FastAPI · PostgreSQL 16 · Docker · Nginx

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  React 18 + TanStack Query + Chart.js                       │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP/JSON
┌───────────────────▼─────────────────────────────────────────┐
│  Nginx (reverse proxy)                                       │
│  /api/* → FastAPI    /*  → React SPA                        │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  FastAPI (Python 3.12 + SQLAlchemy async)                   │
│  Full REST API: Managers / Funds / Analytics / Workflows    │
└──────────┬──────────────────────────────────────────────────┘
           │ asyncpg
┌──────────▼──────────────────────────────────────────────────┐
│  PostgreSQL 16                                               │
│  Tables: fund_managers · funds · workflows · audit_log      │
└─────────────────────────────────────────────────────────────┘
```

## Features

| Module | Capabilities |
|---|---|
| **Overview** | Live KPI strip, key shortlist, top quartile leaders, bar + donut charts |
| **Fund Managers** | Search, filter, sort, paginate · Full create/edit/delete · Side panel with all fund details |
| **Funds** | Per-fund CRUD · Filter by manager, vintage · All 20 performance fields editable |
| **Analytics** | 4 scatter plots (live DB) · Persistent name labels for top N · Filter bar |
| **Workflows** | Create/edit/delete DD tasks · Status management · Threaded comments |
| **Import** | Drag-and-drop Excel upload · Idempotent upsert · Supports both sheets |

---

## Quick Start (Local)

**Requires:** Docker Desktop

```bash
# 1. Clone / unzip this project
cd alphalens-pe

# 2. Start everything with one command
chmod +x scripts/start-local.sh
./scripts/start-local.sh

# 3. Open your browser
#    Frontend:  http://localhost:5173
#    API docs:  http://localhost:8000/docs

# 4. Import your data
#    Go to http://localhost:5173/import
#    Upload MM_Buyout_Fund_Manager_Info_Masked.xlsx
```

**Stop:** `docker compose down`  
**Reset DB:** `docker compose down -v`

---

## Deployment Options

### Option A — Netlify (Frontend) + Railway (Backend) [Easiest, Free Tier]

Best for: quick public URL, zero infra management.

#### 1. Deploy Backend to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and init
railway login
railway init

# Add PostgreSQL database
railway add postgresql

# Deploy backend
cd backend
railway up

# Set environment variables in Railway dashboard:
#   DATABASE_URL  → (Railway provides this automatically)
#   SECRET_KEY    → run: python3 -c "import secrets; print(secrets.token_hex(32))"
#   CORS_ORIGINS  → https://your-app.netlify.app
```

Copy the Railway backend URL (e.g. `https://alphalens-backend.up.railway.app`)

#### 2. Deploy Frontend to Netlify

```bash
cd frontend
npm install
npm run build   # builds to frontend/dist/

# Option A: Netlify CLI
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir dist

# Option B: Netlify Dashboard drag-and-drop
#   Go to app.netlify.com → Add new site → Deploy manually
#   Drag the frontend/dist/ folder
```

**Set in Netlify Dashboard → Environment Variables:**
```
VITE_API_URL = https://alphalens-backend.up.railway.app
```

Then redeploy (Deploys → Trigger deploy).

---

### Option B — Render.com [Free PostgreSQL + Backend, One-Click]

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR_ORG/alphalens-pe.git
git push -u origin main

# 2. Go to https://render.com → New → Blueprint
# 3. Connect your GitHub repo — Render detects render.yaml automatically
# 4. Click Deploy — provisions DB + backend + frontend automatically
```

**CORS:** Update `CORS_ORIGINS` in Render dashboard → alphalens-backend → Environment after deploy.

---

### Option C — AWS Full Stack [Production-grade]

#### Quick (EC2 + RDS automated)

```bash
# Prerequisites: AWS CLI configured, Docker installed
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh
```

The script provisions:
- **EC2 t3.small** (app server with Docker)
- **RDS PostgreSQL t3.micro** (managed database)
- **ECR** (container registry for images)
- **Security groups** wired correctly

#### Serverless (ECS Fargate + RDS)

```bash
# 1. Create ECR repos and push images
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

aws ecr create-repository --repository-name alphalens-backend
aws ecr create-repository --repository-name alphalens-frontend

aws ecr get-login-password | docker login --username AWS --password-stdin $ECR
docker build -t $ECR/alphalens-backend:latest ./backend && docker push $_
docker build -t $ECR/alphalens-frontend:latest ./frontend && docker push $_

# 2. Create RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier alphalens-db \
  --db-instance-class db.t3.micro \
  --engine postgres --engine-version 16.1 \
  --master-username alphalens \
  --master-user-password YOUR_SECURE_PASSWORD \
  --db-name alphalens \
  --allocated-storage 20

# 3. Deploy via ECS Fargate (use AWS Console or CDK for full setup)
# See: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html
```

#### S3 + CloudFront (Frontend only, simplest AWS option)

```bash
# Build frontend
cd frontend
VITE_API_URL=https://your-api-url npm run build

# Deploy to S3
BUCKET="alphalens-pe-frontend"
aws s3 mb s3://$BUCKET
aws s3 sync dist/ s3://$BUCKET/ --delete
aws s3 website s3://$BUCKET/ --index-document index.html --error-document index.html

# Create CloudFront distribution pointing to S3
# (Do in AWS Console or with CDK for HTTPS + custom domain)
```

---

### Option D — Self-Hosted VPS (DigitalOcean / Hetzner / Linode)

```bash
# On your server (Ubuntu 22.04):
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl start docker && sudo usermod -aG docker $USER

# Clone and configure
git clone https://github.com/YOUR_ORG/alphalens-pe.git
cd alphalens-pe
cp .env.example .env
nano .env   # Set DB_PASSWORD, SECRET_KEY, CORS_ORIGINS

# Start production stack
docker compose -f docker-compose.prod.yml up -d

# Add HTTPS with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Updating Data / Re-importing

```bash
# Via UI: Go to /import → upload new Excel file
# Idempotent: re-import updates existing records, no duplicates

# Via API (curl):
curl -X POST https://your-api/api/import \
  -F "file=@MM_Buyout_Fund_Manager_Info_Masked.xlsx"
```

---

## API Reference

Interactive docs at: `http://localhost:8000/docs` (Swagger UI)

| Endpoint | Method | Description |
|---|---|---|
| `/api/analytics/dashboard` | GET | KPI stats |
| `/api/analytics/scatter?x=irr&y=tvpi` | GET | Scatter data |
| `/api/analytics/top-managers?metric=irr&limit=20` | GET | Top N managers |
| `/api/managers` | GET/POST | List / create managers |
| `/api/managers/{id}` | GET/PATCH/DELETE | Read / update / delete |
| `/api/funds` | GET/POST | List / create funds |
| `/api/funds/{id}` | GET/PATCH/DELETE | Read / update / delete |
| `/api/workflows` | GET/POST | List / create workflows |
| `/api/workflows/{id}/comments` | POST | Add comment |
| `/api/import` | POST | Upload Excel (multipart) |

---

## Database Schema

```sql
fund_managers   -- 103 rows: name, strategy, pb_score, aum_usd_m, description, year_founded
funds           -- 444 rows: irr, tvpi, rvpi, dpi, quartile, benchmarks, vintage, geography
workflows       -- User-created DD tasks with status + priority
workflow_comments -- Threaded comments per workflow
audit_log       -- Change history
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | asyncpg connection string |
| `SECRET_KEY` | ✅ | 32+ char random string |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `VITE_API_URL` | ✅ (build) | Backend URL for frontend |
| `DB_PASSWORD` | Docker only | Used in docker-compose |

---

## Project Structure

```
alphalens-pe/
├── backend/
│   ├── main.py          # FastAPI app + all routes
│   ├── database.py      # SQLAlchemy async models
│   ├── crud.py          # All DB operations + analytics
│   ├── schemas.py       # Pydantic request/response models
│   ├── importer.py      # Excel → PostgreSQL upsert
│   ├── config.py        # Settings from environment
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Router + nav
│   │   ├── pages/
│   │   │   ├── Overview.jsx    # Dashboard with live charts
│   │   │   ├── Managers.jsx    # Full CRUD + side panel
│   │   │   ├── Funds.jsx       # Fund CRUD
│   │   │   ├── Analytics.jsx   # Scatter plots
│   │   │   ├── Workflows.jsx   # ITSM system
│   │   │   └── Import.jsx      # Excel upload
│   │   ├── lib/
│   │   │   ├── api.js      # Axios API client
│   │   │   └── utils.js    # Formatters + chart config
│   │   └── index.css       # Dark navy/gold theme
│   └── Dockerfile
├── migrations/
│   └── init.sql         # Full PostgreSQL schema
├── nginx/
│   └── nginx.conf       # Reverse proxy config
├── scripts/
│   ├── start-local.sh   # One-command local start
│   └── deploy-aws.sh    # Automated AWS provisioning
├── docker-compose.yml       # Local dev stack
├── docker-compose.prod.yml  # Production stack
├── netlify.toml             # Netlify deploy config
├── render.yaml              # Render.com blueprint
└── railway.toml             # Railway.app config
```
