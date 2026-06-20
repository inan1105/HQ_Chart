"""
pdf_report.py
-------------
ReportLab 으로 1페이지 요약형 PDF 투자 브리프를 생성합니다.

- 한글 깨짐 방지를 위해 NotoSansKR / NanumGothic 폰트 등록을 시도합니다.
- 폰트가 없으면 기본 폰트(Helvetica)로 자동 fallback 합니다(깨질 수 있으나 동작은 함).
- 하단에 투자자문 고지문을 반드시 포함합니다.
"""

from __future__ import annotations

import os
from datetime import date
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.core.logging import logger
from app.agents.gpt_brief_agent import DISCLAIMER_TEXT

# 한글 폰트를 찾기 위해 시도해 볼 경로들 (Windows / Linux / Docker)
_FONT_CANDIDATES = [
    ("NanumGothic", "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
    ("NanumGothic", "C:/Windows/Fonts/NanumGothic.ttf"),
    ("NotoSansKR", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ("NotoSansKR", "C:/Windows/Fonts/NotoSansKR-Regular.otf"),
    ("MalgunGothic", "C:/Windows/Fonts/malgun.ttf"),
    # 프로젝트 폴더에 폰트를 직접 넣어두는 경우(app/static/fonts)
    ("NanumGothic", "app/static/fonts/NanumGothic.ttf"),
]


def _register_korean_font() -> str:
    """
    한글 폰트를 등록하고 폰트 이름을 반환합니다.
    실패하면 'Helvetica'(기본 폰트)를 반환합니다.
    """
    for font_name, path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(font_name, path))
                logger.info(f"[PDF] 한글 폰트 등록 성공: {font_name} ({path})")
                return font_name
            except Exception as exc:
                logger.warning(f"[PDF] 폰트 등록 실패({path}): {exc}")
                continue
    logger.warning(
        "[PDF] 한글 폰트를 찾지 못해 기본 폰트로 대체합니다(한글이 깨질 수 있음). "
        "해결: 시스템에 나눔고딕 설치 또는 app/static/fonts/NanumGothic.ttf 추가."
    )
    return "Helvetica"


def build_pdf_report(
    ticker: str,
    corp_name: str,
    scores: Dict[str, Any],
    brief: Dict[str, Any],
    output_dir: Optional[str] = None,
) -> str:
    """
    1페이지 요약 PDF 를 생성하고 저장 경로를 반환합니다.

    포함 내용:
      - 제목: KOStockCrewAI 투자 브리프
      - 점수표(종합/리스크/기본/기술/수급/거시)
      - GPT 핵심요약, 주요 포인트, 리스크 요인, 대응전략
      - 하단 투자자문 고지문
    """
    output_dir = output_dir or settings.REPORT_DIR
    os.makedirs(output_dir, exist_ok=True)

    today = date.today().isoformat()
    filename = f"{ticker}_{today}.pdf"
    pdf_path = os.path.join(output_dir, filename)

    font = _register_korean_font()

    # 스타일 정의 (한글 폰트 적용)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleKR", parent=styles["Title"], fontName=font, fontSize=18, leading=22
    )
    h_style = ParagraphStyle(
        "HeadKR", parent=styles["Heading2"], fontName=font, fontSize=12, leading=16,
        textColor=colors.HexColor("#1a3d7c"),
    )
    body_style = ParagraphStyle(
        "BodyKR", parent=styles["Normal"], fontName=font, fontSize=9.5, leading=14
    )
    small_style = ParagraphStyle(
        "SmallKR", parent=styles["Normal"], fontName=font, fontSize=8, leading=11,
        textColor=colors.grey,
    )

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=15 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title="KOStockCrewAI 투자 브리프",
    )

    story: List[Any] = []

    # 제목
    story.append(Paragraph("KOStockCrewAI 투자 브리프", title_style))
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(f"종목: {corp_name} ({ticker})  ·  생성일: {today}  ·  분석등급: {scores.get('rating')}", body_style)
    )
    story.append(Spacer(1, 5 * mm))

    # 점수표
    story.append(Paragraph("■ 점수 요약", h_style))
    score_data = [
        ["종합점수", "리스크점수", "기본점수", "기술점수", "수급점수", "거시점수"],
        [
            _fmt(scores.get("total_score")),
            _fmt(scores.get("risk_score")),
            _fmt(scores.get("fundamental_score")),
            _fmt(scores.get("technical_score")),
            _fmt(scores.get("flow_score")),
            _fmt(scores.get("macro_score")),
        ],
    ]
    table = Table(score_data, colWidths=[28 * mm] * 6)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3d7c")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 5 * mm))

    # GPT 핵심요약
    story.append(Paragraph("■ 핵심 요약", h_style))
    story.append(Paragraph(_safe(brief.get("one_line_summary")), body_style))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(_safe(brief.get("investment_opinion")), body_style))
    story.append(Spacer(1, 4 * mm))

    # 주요 포인트
    story.append(Paragraph("■ 주요 포인트", h_style))
    for point in brief.get("key_points", []) or []:
        story.append(Paragraph(f"• {_safe(point)}", body_style))
    story.append(Spacer(1, 4 * mm))

    # 리스크 요인
    story.append(Paragraph("■ 리스크 요인", h_style))
    for risk in brief.get("risk_factors", []) or []:
        story.append(Paragraph(f"• {_safe(risk)}", body_style))
    story.append(Spacer(1, 4 * mm))

    # 대응 전략
    story.append(Paragraph("■ 대응 전략", h_style))
    story.append(Paragraph(_safe(brief.get("action_strategy")), body_style))
    story.append(Spacer(1, 6 * mm))

    # 투자자문 고지문 (반드시 포함)
    story.append(Paragraph("─" * 60, small_style))
    disclaimer = brief.get("disclaimer") or DISCLAIMER_TEXT
    story.append(Paragraph(f"※ {_safe(disclaimer)}", small_style))

    doc.build(story)
    logger.info(f"[PDF] 생성 완료: {pdf_path}")
    return pdf_path


def _fmt(value: Any) -> str:
    """숫자를 보기 좋게 문자열로 변환합니다."""
    if value is None:
        return "-"
    try:
        return f"{float(value):.1f}"
    except (TypeError, ValueError):
        return str(value)


def _safe(text: Any) -> str:
    """None 이나 특수문자를 PDF 에 안전하게 넣기 위한 처리."""
    if text is None:
        return ""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
