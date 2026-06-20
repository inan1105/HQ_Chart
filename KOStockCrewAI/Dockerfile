# KOStockCrewAI Dockerfile
# 가벼운 파이썬 3.11 이미지를 기반으로 합니다.
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# reportlab / matplotlib / psycopg2 등이 필요로 하는 시스템 라이브러리 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

# 먼저 requirements 만 복사하여 캐시 효율을 높입니다.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 나머지 소스 코드 전체 복사
COPY . .

# FastAPI(8000), Streamlit(8501) 포트 노출
EXPOSE 8000 8501

# 기본 실행: FastAPI 서버
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
