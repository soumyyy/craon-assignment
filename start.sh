#!/bin/bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  Video Timeline Editor — Setup${NC}"
echo "  ──────────────────────────────"
echo ""

# ── Prerequisites check ───────────────────────────────────────────────────────

check() {
  command -v "$1" &>/dev/null
}

MISSING=()
check python3   || MISSING+=("python3 (3.11+)  → https://python.org")
check node      || MISSING+=("node (18+)        → https://nodejs.org")
check npm       || MISSING+=("npm               → comes with node")
check mongod    || MISSING+=("mongodb           → https://www.mongodb.com/try/download/community")
check ffmpeg    || MISSING+=("ffmpeg            → https://ffmpeg.org  /  brew install ffmpeg")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}  Missing prerequisites:${NC}"
  for m in "${MISSING[@]}"; do echo "    • $m"; done
  echo ""
  exit 1
fi

# ── Backend setup ─────────────────────────────────────────────────────────────

echo -e "${CYAN}[1/4]${NC} Setting up backend..."

cd backend

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}  ⚠  Add your OpenAI API key to backend/.env${NC}"
  echo -e "     Open the file and set: ${CYAN}OPENAI_API_KEY=sk-...${NC}"
  echo ""
  read -p "  Press Enter once you've saved the key... "
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt -q

cd ..

# ── Frontend setup ────────────────────────────────────────────────────────────

echo -e "${CYAN}[2/4]${NC} Setting up frontend..."

cd frontend

if [ ! -f ".env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
fi

npm install --silent

cd ..

# ── Start MongoDB ─────────────────────────────────────────────────────────────

echo -e "${CYAN}[3/4]${NC} Starting MongoDB..."

mkdir -p .mongo-data
mongod --dbpath .mongo-data --logpath .mongo-data/mongod.log --fork --quiet 2>/dev/null || true

sleep 1

# ── Start servers ─────────────────────────────────────────────────────────────

echo -e "${CYAN}[4/4]${NC} Starting servers..."
echo ""

# Backend
cd backend
source .venv/bin/activate
uvicorn main:app --port 8000 --reload &
BACKEND_PID=$!
cd ..

sleep 2

# Frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}  ✓ Ready${NC}"
echo ""
echo "    Frontend  →  http://localhost:3000"
echo "    Backend   →  http://localhost:8000"
echo "    API docs  →  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

# Cleanup on exit
trap "echo ''; echo '  Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; mongod --dbpath .mongo-data --shutdown 2>/dev/null; exit 0" INT TERM

wait $FRONTEND_PID
