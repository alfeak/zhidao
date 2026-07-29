"""Local full-text search backed by SQLite FTS5.

The trigram tokenizer makes substring search usable for CJK text without a
separate search service or language-specific dictionary.
"""
from __future__ import annotations

from typing import Iterable

from .database import engine


class SearchIndex:
    table = "paper_search"

    @classmethod
    def initialize(cls) -> None:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE VIRTUAL TABLE IF NOT EXISTS paper_search "
                "USING fts5(paper_id UNINDEXED, source UNINDEXED, language UNINDEXED, "
                "block_index UNINDEXED, page_index UNINDEXED, title, content, tokenize='trigram')"
            )

    def replace_paper(self, paper_id: str, documents: Iterable[dict]) -> None:
        rows = [
            (
                paper_id,
                item["source"],
                item.get("language") or "",
                item.get("blockIndex"),
                item.get("pageIndex"),
                item.get("title") or "",
                item.get("content") or "",
            )
            for item in documents
            if item.get("content")
        ]
        with engine.begin() as connection:
            connection.exec_driver_sql("DELETE FROM paper_search WHERE paper_id = ?", (paper_id,))
            if rows:
                connection.exec_driver_sql(
                    "INSERT INTO paper_search (paper_id, source, language, block_index, page_index, title, content) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    rows,
                )

    def delete_paper(self, paper_id: str) -> None:
        with engine.begin() as connection:
            connection.exec_driver_sql("DELETE FROM paper_search WHERE paper_id = ?", (paper_id,))

    def search(self, query: str, limit: int = 30) -> list[dict]:
        query = " ".join(query.split())
        if not query:
            return []
        # Quotes make the user input a literal FTS phrase instead of exposing
        # FTS5 query operators. Trigram is most useful from three characters.
        phrase = '"' + query.replace('"', '""') + '"'
        safe_limit = max(1, min(limit, 100))
        with engine.connect() as connection:
            if len(query) >= 3:
                result = connection.exec_driver_sql(
                    "SELECT paper_id, source, language, title, bm25(paper_search) AS relevance "
                    "FROM paper_search WHERE paper_search MATCH ? "
                    "ORDER BY relevance LIMIT ?",
                    (phrase, safe_limit * 20),
                )
            else:
                # FTS5 trigram cannot efficiently match one or two characters.
                result = connection.exec_driver_sql(
                    "SELECT paper_id, source, language, title, 0.0 AS relevance "
                    "FROM paper_search WHERE content LIKE ? ORDER BY rowid DESC LIMIT ?",
                    (f"%{query}%", safe_limit * 20),
                )
            # FTS returns matching chunks. Aggregate them here so consumers
            # receive papers, ordered by the best matching material.
            papers: dict[str, dict] = {}
            for row in result:
                item = papers.setdefault(row.paper_id, {
                    "paperId": row.paper_id,
                    "title": row.title,
                    "relevance": row.relevance,
                    "sources": [],
                })
                item["relevance"] = min(item["relevance"], row.relevance)
                source = {"source": row.source, "language": row.language or None}
                if source not in item["sources"]:
                    item["sources"].append(source)
            ordered = sorted(papers.values(), key=lambda item: item["relevance"])
            return [{key: value for key, value in item.items() if key != "relevance"} for item in ordered[:safe_limit]]
