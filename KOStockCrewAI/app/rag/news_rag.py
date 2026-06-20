"""
news_rag.py
-----------
뉴스/과거 사례를 벡터로 저장하고 유사 사례를 검색하는 RAG 모듈입니다.

- ChromaDB PersistentClient(path="./data/chroma") 사용
- OpenAI Embedding 으로 텍스트를 벡터화
- OpenAI API Key 가 없으면 임베딩 기능을 비활성화하고 안내합니다(앱은 죽지 않음).
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from app.core.config import settings, is_key_set
from app.core.logging import logger

# Chroma 저장 폴더
_CHROMA_PATH = "./data/chroma"
_COLLECTION_NAME = "news_memory"
_EMBED_MODEL = "text-embedding-3-small"


def _get_collection():
    """
    ChromaDB 컬렉션을 가져옵니다(없으면 생성).
    ChromaDB 미설치 시 None 을 반환합니다.
    """
    try:
        import chromadb

        os.makedirs(_CHROMA_PATH, exist_ok=True)
        client = chromadb.PersistentClient(path=_CHROMA_PATH)
        return client.get_or_create_collection(name=_COLLECTION_NAME)
    except Exception as exc:
        logger.warning(f"[RAG] ChromaDB 를 사용할 수 없습니다: {exc}")
        return None


def _embed(texts: List[str]) -> Optional[List[List[float]]]:
    """
    OpenAI Embedding 으로 텍스트들을 벡터화합니다.
    키가 없거나 실패하면 None 을 반환합니다.
    """
    if not is_key_set("OPENAI_API_KEY"):
        logger.warning(
            "[RAG] OPENAI_API_KEY 가 없어 임베딩 기능이 비활성화됩니다. "
            "뉴스 저장/검색을 사용하려면 .env 에 키를 입력하세요."
        )
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.embeddings.create(model=_EMBED_MODEL, input=texts)
        return [d.embedding for d in resp.data]
    except Exception as exc:
        logger.error(f"[RAG] 임베딩 생성 실패: {exc}")
        return None


def add_news_memory(
    doc_id: str,
    text: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    뉴스/사례 한 건을 벡터 DB 에 저장합니다.
    성공하면 True, 비활성/실패면 False.
    """
    collection = _get_collection()
    if collection is None:
        return False

    embeddings = _embed([text])
    if embeddings is None:
        return False

    try:
        collection.add(
            ids=[doc_id],
            embeddings=embeddings,
            documents=[text],
            metadatas=[metadata or {}],
        )
        logger.info(f"[RAG] 뉴스 메모리 저장: {doc_id}")
        return True
    except Exception as exc:
        logger.error(f"[RAG] 저장 실패: {exc}")
        return False


def search_similar_cases(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    질의(query)와 유사한 과거 사례를 검색합니다.
    비활성/실패 시 빈 리스트를 반환합니다.
    """
    collection = _get_collection()
    if collection is None:
        return []

    embeddings = _embed([query])
    if embeddings is None:
        return []

    try:
        result = collection.query(query_embeddings=embeddings, n_results=top_k)
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        cases = []
        for doc, meta, dist in zip(docs, metas, distances):
            cases.append({"document": doc, "metadata": meta, "distance": dist})
        return cases
    except Exception as exc:
        logger.error(f"[RAG] 검색 실패: {exc}")
        return []
