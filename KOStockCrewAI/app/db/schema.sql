-- ============================================================
-- KOStockCrewAI 데이터베이스 스키마
-- ------------------------------------------------------------
-- 모든 테이블은 IF NOT EXISTS 로 생성되어 여러 번 실행해도 안전합니다.
-- ticker/date 기준 UNIQUE 제약과 INDEX 를 포함합니다.
-- ============================================================

-- 1) 종목 기본정보
CREATE TABLE IF NOT EXISTS stocks (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL UNIQUE,   -- 종목코드 (예: 005930)
    corp_name       VARCHAR(200),                  -- 종목명 (예: 삼성전자)
    corp_code       VARCHAR(20),                   -- DART 고유 corp_code
    market          VARCHAR(20),                   -- KOSPI / KOSDAQ 등
    sector          VARCHAR(100),                  -- 업종
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks (ticker);

-- 2) 일별 시세 (OHLCV)
CREATE TABLE IF NOT EXISTS stock_prices (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL,
    trade_date      DATE NOT NULL,                 -- 거래일 (YYYY-MM-DD)
    open            NUMERIC(18, 2),
    high            NUMERIC(18, 2),
    low             NUMERIC(18, 2),
    close           NUMERIC(18, 2),
    volume          BIGINT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_stock_prices UNIQUE (ticker, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker_date ON stock_prices (ticker, trade_date);

-- 3) 투자자별 수급 (외국인/기관 등 순매수)
CREATE TABLE IF NOT EXISTS investor_flows (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL,
    trade_date      DATE NOT NULL,
    foreign_net     BIGINT,                        -- 외국인 순매수 (주 또는 금액)
    institution_net BIGINT,                        -- 기관 순매수
    individual_net  BIGINT,                        -- 개인 순매수
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_investor_flows UNIQUE (ticker, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_investor_flows_ticker_date ON investor_flows (ticker, trade_date);

-- 4) 재무제표 주요계정
CREATE TABLE IF NOT EXISTS financial_statements (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL,
    fiscal_year     VARCHAR(8) NOT NULL,           -- 사업연도 (예: 2023)
    report_code     VARCHAR(20),                   -- 보고서코드 (11011 사업보고서 등)
    account_name    VARCHAR(200) NOT NULL,         -- 계정명 (매출액, 영업이익 등)
    amount          NUMERIC(24, 2),                -- 금액
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_statements UNIQUE (ticker, fiscal_year, report_code, account_name)
);
CREATE INDEX IF NOT EXISTS idx_financial_ticker_year ON financial_statements (ticker, fiscal_year);

-- 5) 거시지표
CREATE TABLE IF NOT EXISTS macro_indicators (
    id              SERIAL PRIMARY KEY,
    indicator       VARCHAR(50) NOT NULL,          -- 지표명 (base_rate, usd_krw, cpi_yoy 등)
    indicator_date  DATE NOT NULL,                 -- 기준일
    value           NUMERIC(18, 4),
    unit            VARCHAR(30),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_macro_indicators UNIQUE (indicator, indicator_date)
);
CREATE INDEX IF NOT EXISTS idx_macro_indicator_date ON macro_indicators (indicator, indicator_date);

-- 6) 기술적 지표(계산 결과 저장용)
CREATE TABLE IF NOT EXISTS technical_indicators (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL,
    trade_date      DATE NOT NULL,
    ma5             NUMERIC(18, 2),
    ma20            NUMERIC(18, 2),
    ma60            NUMERIC(18, 2),
    rsi14           NUMERIC(8, 2),
    macd            NUMERIC(18, 4),
    macd_signal     NUMERIC(18, 4),
    bb_upper        NUMERIC(18, 2),
    bb_lower        NUMERIC(18, 2),
    atr14           NUMERIC(18, 4),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_technical_indicators UNIQUE (ticker, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_technical_ticker_date ON technical_indicators (ticker, trade_date);

-- 7) 분석 점수
CREATE TABLE IF NOT EXISTS analysis_scores (
    id                  SERIAL PRIMARY KEY,
    ticker              VARCHAR(20) NOT NULL,
    analysis_date       DATE NOT NULL,
    fundamental_score   NUMERIC(6, 2),
    technical_score     NUMERIC(6, 2),
    flow_score          NUMERIC(6, 2),
    macro_score         NUMERIC(6, 2),
    total_score         NUMERIC(6, 2),
    risk_score          NUMERIC(6, 2),
    rating              VARCHAR(20),               -- STRONG_BUY / BUY / HOLD / WATCH / RISK
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_analysis_scores UNIQUE (ticker, analysis_date)
);
CREATE INDEX IF NOT EXISTS idx_analysis_ticker_date ON analysis_scores (ticker, analysis_date);

-- 8) 뉴스 메모리 (RAG 용 메타데이터)
CREATE TABLE IF NOT EXISTS news_memory (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20),
    title           TEXT,
    content         TEXT,
    source          VARCHAR(200),
    news_date       DATE,
    chroma_id       VARCHAR(100),                  -- ChromaDB 내부 문서 ID
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_news_ticker_date ON news_memory (ticker, news_date);

-- 9) 생성된 리포트 이력
CREATE TABLE IF NOT EXISTS generated_reports (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20) NOT NULL,
    corp_name       VARCHAR(200),
    report_date     DATE NOT NULL,
    total_score     NUMERIC(6, 2),
    rating          VARCHAR(20),
    pdf_path        TEXT,
    brief_json      TEXT,                          -- GPT 브리프 결과(JSON 문자열)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_generated_reports UNIQUE (ticker, report_date)
);
CREATE INDEX IF NOT EXISTS idx_reports_ticker_date ON generated_reports (ticker, report_date);
