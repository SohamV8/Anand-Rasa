"""Natural-language patron review generator — complete sentences only."""

import re
from collections import Counter

from prv_category_rules import BANNED_BODY_PATTERNS, FORBIDDEN, FRAGMENT_PATTERNS
from prv_review_banks import BANKS


def _cap(s: str) -> str:
    s = re.sub(r"\s+", " ", s.strip())
    if not s:
        return s
    return s[0].upper() + s[1:]


def _normalize(body: str) -> str:
    body = body.replace("—", ", ").replace("–", ", ")
    body = re.sub(r"\s+,", ",", body)
    body = re.sub(r",\s*,", ",", body)
    body = re.sub(r"\s+", " ", body).strip()
    if body and body[-1] not in ".!?":
        body += "."
    return _cap(body)


def _word_count(body: str) -> int:
    return len(re.findall(r"\b\w+\b", body))


def _sentence_count(body: str) -> int:
    return len(re.findall(r"[.!?]+", body))


def _opening_key(body: str) -> str:
    return " ".join(body.split()[:8]).lower()


def _validate(axis: str, body: str) -> bool:
    low = body.lower()
    if "{{ prv_short }}" in body or "prv_short" in low:
        return False
    if re.search(r"[—–]", body):
        return False
    for pat in BANNED_BODY_PATTERNS:
        if re.search(pat, body, re.IGNORECASE):
            return False
    for pat in FRAGMENT_PATTERNS:
        if re.search(pat, body, re.IGNORECASE):
            return False
    for term in FORBIDDEN.get(axis, []):
        if term.lower() in low:
            return False
    if _word_count(body) < 18:
        return False
    if _sentence_count(body) < 2:
        return False
    if body.count(",") > 5:
        return False
    return True


def build_axis(axis: str, count: int = 95) -> list[str]:
    bank = BANKS[axis]
    opens = bank["open"]
    mids = bank["mid"]
    closes = bank.get("close", [])
    shorts = bank.get("short", [])
    o_n, m_n = len(opens), len(mids)
    c_n = max(len(closes), 1)
    s_n = max(len(shorts), 1)

    out: list[str] = []
    used: set[str] = set()
    start_counts: Counter[str] = Counter()

    for i in range(count):
        found = False
        for attempt in range(o_n * m_n * c_n * 16):
            if shorts and (i + attempt) % 8 == 0:
                body = _normalize(shorts[(i * 3 + attempt) % s_n])
            elif closes and (i + attempt) % 5 != 0:
                o = opens[(i + attempt) % o_n]
                m = mids[(i * 11 + attempt * 3) % m_n]
                c = closes[(i * 13 + attempt * 7) % c_n]
                body = _normalize(f"{o} {m} {c}")
            else:
                o = opens[(i + attempt) % o_n]
                m = mids[(i * 11 + attempt * 3) % m_n]
                body = _normalize(f"{o} {m}")

            start = _opening_key(body)
            if body in used:
                continue
            if start_counts[start] >= 2:
                continue
            if not _validate(axis, body):
                continue
            used.add(body)
            start_counts[start] += 1
            out.append(body)
            found = True
            break
        if not found:
            raise RuntimeError(f"Could not build natural review {i} for {axis}")
    return out[:count]


GENERATORS = {axis: (lambda a=axis: build_axis(a)) for axis in BANKS}
