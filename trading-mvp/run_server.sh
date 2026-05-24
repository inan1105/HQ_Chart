#!/bin/bash
echo "============================================"
echo "  TradingMVP 서버 시작"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# 가상환경 확인
if [ ! -d "venv" ]; then
    echo "[1/4] 가상환경 생성 중..."
    python3 -m venv venv
    source venv/bin/activate
    echo "[2/4] 패키지 설치 중..."
    pip install -r requirements.txt
else
    source venv/bin/activate
    echo "[OK] 가상환경 활성화 완료"
fi

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo "[3/4] .env 파일 생성 중..."
    cp .env.example .env
fi

# DB 초기화
if [ ! -f "trading_mvp.db" ]; then
    echo "[4/4] 데이터베이스 초기화 중..."
    python -m app.init_db
fi

echo ""
echo "============================================"
echo "  서버를 시작합니다."
echo "  브라우저에서 열어주세요:"
echo ""
echo "  API 테스트:  http://127.0.0.1:8000/docs"
echo "  대시보드:    별도 터미널에서 ./run_dashboard.sh 실행"
echo "============================================"
echo ""
echo "  종료하려면 Ctrl+C 를 누르세요."
echo ""

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
