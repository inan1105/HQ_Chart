#!/bin/bash
# ============================================================
# KOStockCrewAI — SessionStart 훅
# Claude Code(웹) 세션이 시작될 때 Python 의존성을 설치하여
# 세션 중 테스트/실행이 바로 가능하도록 준비합니다.
# - 멱등(여러 번 실행해도 안전), 비대화형
# - 독립 저장소(루트=KOStockCrewAI)와 모노레포(KOStockCrewAI 하위) 모두 지원
# ============================================================
set -euo pipefail

# 프로젝트 디렉토리 결정
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -f "$PROJ/requirements.txt" ]; then
  APP_DIR="$PROJ"
elif [ -f "$PROJ/KOStockCrewAI/requirements.txt" ]; then
  APP_DIR="$PROJ/KOStockCrewAI"
else
  APP_DIR="$(pwd)"
fi
cd "$APP_DIR"
echo "[hook] KOStockCrewAI 셋업 시작 (dir=$APP_DIR)"

# PEP668 환경에서도 설치되도록 일반 설치 → 실패 시 --break-system-packages
pipi() {
  python -m pip install --quiet "$@" 2>/dev/null \
    || python -m pip install --quiet --break-system-packages "$@"
}

# pip 업그레이드는 선택사항이며 환경에 따라 실패할 수 있어 조용히 시도만 합니다.
python -m pip install --quiet --upgrade pip >/dev/null 2>&1 || true

# 앱 실행/테스트에 필요한 핵심 의존성 (가볍고 안정적)
pipi fastapi uvicorn pydantic pydantic-settings python-dotenv requests \
     pandas numpy sqlalchemy psycopg2-binary reportlab loguru pytest httpx

# 선택(무거운) 의존성 — 있으면 더 많은 기능 활성화. 실패해도 무방(지연 로딩).
pipi openai apscheduler tiktoken || true

# 앱 패키지 import 를 위한 PYTHONPATH 영속화
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PYTHONPATH=\"$APP_DIR\"" >> "$CLAUDE_ENV_FILE"
fi

echo "[hook] 셋업 완료. 'pytest -q' 로 테스트, 'uvicorn main:app' 으로 실행하세요."
