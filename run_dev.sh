#!/usr/bin/env bash
# ==============================================================================
# SubSync - Local Development & Verification Script
# Team NPSKY · Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026
# ==============================================================================

set -e

echo "=================================================="
echo " SubSync - Intelligent Subscription Platform"
echo "=================================================="

# 1. Run Automated Backend Tests
echo "[1/4] Running Backend Automated Tests..."
cd backend
source venv/bin/activate
python manage.py test core
echo "Backend test suites passed successfully!"

# 2. Seed Clean Demonstration Ledger
echo "[2/4] Seeding Clean Demonstration Ledger..."
python manage.py seed --fresh

# 3. Verify Scheduled Billing Engine
echo "[3/4] Verifying Scheduled Billing Engine..."
python manage.py run_billing

# 4. Build Frontend Production Bundle
echo "[4/4] Verifying Frontend Production Build..."
cd ../frontend
npm run build
echo "Frontend built successfully!"

echo "=================================================="
echo " SubSync is 100% demo-ready for evaluation!"
echo " Backend: http://127.0.0.1:8000/api/"
echo " Frontend: http://localhost:5173/"
echo " Demo Logins:"
echo "   Admin: admin@subsync.in / Admin@12345"
echo "   Staff: staff@subsync.in / Staff@12345"
echo "   Customer: customer@subsync.in / Customer@123"
echo "=================================================="
