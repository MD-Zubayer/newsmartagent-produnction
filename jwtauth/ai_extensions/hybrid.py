"""Built-in PostgreSQL FTS + pgvector retrieval extension."""


class HybridSearchExtension:
    def __init__(self, config=None):
        self.config = config or {}

    def retrieve(self, query, agent, context=None):
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
        from pgvector.django import CosineDistance
        from embedding.models import DocumentKnowledge, SpreadsheetKnowledge

        context = context or {}
        vector = context.get("query_vector")
        top_k = max(3, min(int(self.config.get("top_k", 8)), 20))
        fts_weight = float(self.config.get("fulltext_weight", 0.4))
        vector_weight = float(self.config.get("vector_weight", 0.6))
        search_query = SearchQuery(query or "", search_type="websearch")
        hits = {}

        docs = DocumentKnowledge.objects.filter(user=agent.user).annotate(fts_rank=SearchRank(SearchVector("content"), search_query)).filter(fts_rank__gt=0).order_by("-fts_rank")[:top_k]
        for row in docs:
            hits[f"doc_{row.pk}"] = {"content": row.content, "source": row.doc_title or "Document", "fts": float(row.fts_rank), "vector": 0.0}
        sheets = SpreadsheetKnowledge.objects.filter(user=agent.user).annotate(fts_rank=SearchRank(SearchVector("content"), search_query)).filter(fts_rank__gt=0).order_by("-fts_rank")[:top_k]
        for row in sheets:
            hits[f"sheet_{row.row_id}"] = {"content": row.content, "source": "Spreadsheet", "fts": float(row.fts_rank), "vector": 0.0}

        if vector:
            for row in DocumentKnowledge.objects.filter(user=agent.user, embedding__isnull=False).annotate(distance=CosineDistance("embedding", vector)).order_by("distance")[:top_k]:
                item = hits.setdefault(f"doc_{row.pk}", {"content": row.content, "source": row.doc_title or "Document", "fts": 0.0, "vector": 0.0})
                item["vector"] = max(0.0, 1.0 - float(row.distance))
            for row in SpreadsheetKnowledge.objects.filter(user=agent.user, embedding__isnull=False).annotate(distance=CosineDistance("embedding", vector)).order_by("distance")[:top_k]:
                item = hits.setdefault(f"sheet_{row.row_id}", {"content": row.content, "source": "Spreadsheet", "fts": 0.0, "vector": 0.0})
                item["vector"] = max(0.0, 1.0 - float(row.distance))

        ranked = sorted(hits.values(), key=lambda item: fts_weight * item["fts"] + vector_weight * item["vector"], reverse=True)[:top_k]
        text = "\n\n".join(f"[{item['source']}]\n{item['content']}" for item in ranked if item.get("content"))
        return {"sheet_context": f"\n[HYBRID KNOWLEDGE CONTEXT]\n{text}" if text else "", "extra_instruction": "Use the hybrid knowledge context when answering.", "best_hit_row_id": None}
