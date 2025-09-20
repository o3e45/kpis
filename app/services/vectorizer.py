"""Lightweight deterministic embedding generator."""
from __future__ import annotations

import hashlib
import math
from typing import Iterable, List

import numpy as np

VECTOR_DIM = 12


def _tokenize(text: str) -> Iterable[str]:
    for token in text.lower().split():
        cleaned = "".join(ch for ch in token if ch.isalnum())
        if cleaned:
            yield cleaned


def embed_text(text: str) -> List[float]:
    """Create a deterministic embedding using hashing and sine transforms."""
    if not text:
        return [0.0] * VECTOR_DIM

    vector = np.zeros(VECTOR_DIM, dtype=float)
    for token in _tokenize(text):
        token_hash = hashlib.sha256(token.encode("utf-8")).digest()
        for i in range(VECTOR_DIM):
            raw = token_hash[i] / 255.0
            vector[i] += math.sin(raw * math.pi)

    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector.tolist()
    return (vector / norm).tolist()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    vec_a = np.array(a)
    vec_b = np.array(b)
    denom = np.linalg.norm(vec_a) * np.linalg.norm(vec_b)
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)
