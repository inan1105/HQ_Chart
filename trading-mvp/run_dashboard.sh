#!/bin/bash
echo "============================================"
echo "  TradingMVP 대시보드 시작"
echo "============================================"
echo ""

cd "$(dirname "$0")"
source venv/bin/activate

echo "  브라우저에서 열어주세요:"
echo "  http://localhost:8501"
echo ""
echo "  종료하려면 Ctrl+C 를 누르세요."
echo ""

streamlit run dashboard.py
