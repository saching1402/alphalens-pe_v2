#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AlphaLens PE — Quick start (local development)
# Requires: Docker + Docker Compose
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

echo "==> AlphaLens PE — Starting local environment"

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example (defaults are fine for local dev)"
fi

echo "==> Starting services (PostgreSQL + FastAPI + React)"
docker compose up --build -d

echo ""
echo "==> Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "    Backend ready ✓"
    break
  fi
  sleep 2
done

echo ""
echo "=========================================="
echo "  ✅ AlphaLens PE is running!"
echo "=========================================="
echo ""
echo "  🌐 Frontend:  http://localhost:5173"
echo "  ⚙️  Backend:   http://localhost:8000"
echo "  📖 API Docs:  http://localhost:8000/docs"
echo "  🐘 Database:  localhost:5432 (alphalens / alphalens_secret)"
echo ""
echo "  📥 To import data:"
echo "     Go to http://localhost:5173/import"
echo "     Upload MM_Buyout_Fund_Manager_Info_Masked.xlsx"
echo ""
echo "  To stop: docker compose down"
echo "  To reset DB: docker compose down -v"
