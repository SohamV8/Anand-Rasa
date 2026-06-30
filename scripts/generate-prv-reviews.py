#!/usr/bin/env python3
"""Generate experience-first patron review datasets for Anand Rasa theme."""
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prv_names import CITIES, DATES, NAME_PAIRS
from prv_natural_gen import GENERATORS
from prv_category_rules import (
    BANNED_BODY_PATTERNS,
    CONTEXT_NOTE,
    DEFAULT_CONTEXT_NOTE,
    FORBIDDEN,
    FRAGMENT_PATTERNS,
    PURCHASE_CONTEXT,
    TAGS,
)

OUT = Path(__file__).resolve().parent.parent / "snippets"
SEP_F = "~|~"
SEP_R = "~||~"


def initials(name: str) -> str:
    parts = name.split()
    return "".join(p[0] for p in parts[:2]).upper()


def row(name, city, rating, body, tag, ptype, note, date):
    return SEP_F.join([name, city, str(rating), body, tag, ptype, note, initials(name), date])


def clean_body(body: str) -> str:
    body = re.sub(r"[45] stars[—\-–]\s*", "", body, flags=re.IGNORECASE)
    body = re.sub(r"^[45] stars\s+", "", body, flags=re.IGNORECASE)
    body = re.sub(r"\bHonest\s+", "Honestly ", body, count=1)
    if body and body[0].islower():
        body = body[0].upper() + body[1:]
    return body.strip()


def validate_body(axis: str, body: str) -> list[str]:
    issues = []
    low = body.lower()
    if "{{ prv_short }}" in body or "prv_short" in low:
        issues.append("product_name_in_body")
    if re.search(r"[—–]", body):
        issues.append("em_dash")
    words = len(re.findall(r"\b\w+\b", body))
    if words < 18:
        issues.append(f"too_short:{words}_words")
    if len(re.findall(r"[.!?]+", body)) < 2:
        issues.append("needs_multiple_sentences")
    for pat in BANNED_BODY_PATTERNS:
        if re.search(pat, body, re.IGNORECASE):
            issues.append(f"banned:{pat}")
    for pat in FRAGMENT_PATTERNS:
        if re.search(pat, body, re.IGNORECASE):
            issues.append(f"fragment:{pat}")
    for term in FORBIDDEN.get(axis, []):
        if term.lower() in low:
            issues.append(f"forbidden:{term}")
    return issues


def pick_rating(rng: random.Random, body: str) -> int:
    low = body.lower()
    if any(
        x in low
        for x in (
            "only wish", "only critique", "honest drawback", "4 star",
            "delivery late", "delivery box", "opening sharp", "opening thoda sharp",
            "projection kam", "projection low", "projection bahut soft",
            "price high", "fomo pricing", "cap tight", "stick break",
            "plastic wrap", "shipping heavy", "holder include", "guide wish",
            "smoke sensitive", "dented", "break hoti",
        )
    ):
        return 4
    return 5 if rng.random() < 0.82 else 4


def meta_pick(axis: str, field: str, rng: random.Random, used_tags: set | None = None):
    if field == "tags":
        pool = TAGS.get(axis, TAGS["generic"])
        for _ in range(50):
            tag = rng.choice(pool)
            if used_tags is None or tag not in used_tags:
                return tag
        return rng.choice(pool)
    if field == "ptypes":
        return rng.choice(PURCHASE_CONTEXT)
    if field == "notes":
        pool = CONTEXT_NOTE.get(axis, DEFAULT_CONTEXT_NOTE)
        if rng.random() < 0.35:
            return ""
        return rng.choice(pool)
    raise ValueError(field)


def generate_collection(axis: str, rng: random.Random, used_names: set) -> tuple[str, list[str]]:
    bodies = GENERATORS[axis]()
    count = min(90, len(bodies))
    warnings = []

    names = []
    for _ in range(count):
        for _try in range(800):
            candidate = rng.choice(NAME_PAIRS)
            if candidate not in used_names:
                used_names.add(candidate)
                names.append(candidate)
                break
        else:
            raise RuntimeError(f"Ran out of unique names for {axis}")

    city_pool = CITIES[:]
    rng.shuffle(city_pool)
    cities = [city_pool[i] if i < len(city_pool) else rng.choice(CITIES) for i in range(count)]

    rows = []
    used_bodies = set()
    used_tags: set[str] = set()
    body_pool = bodies[:]
    rng.shuffle(body_pool)

    for i in range(count):
        body = clean_body(body_pool[i])
        issues = validate_body(axis, body)
        if issues:
            warnings.append(f"#{i} {issues} :: {body[:80]}...")
            raise RuntimeError(f"Invalid review for {axis} row {i}: {issues}")

        if body in used_bodies:
            raise RuntimeError(f"Duplicate body in {axis}: {body[:60]}...")
        used_bodies.add(body)

        rating = pick_rating(rng, body)
        tag = meta_pick(axis, "tags", rng, used_tags)
        used_tags.add(tag)
        rows.append(
            row(
                names[i],
                cities[i],
                rating,
                body,
                tag,
                meta_pick(axis, "ptypes", rng),
                meta_pick(axis, "notes", rng),
                rng.choice(DATES),
            )
        )

    return SEP_R.join(rows), warnings


def liquid_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def write_snippet(axis: str, data: str):
    path = OUT / f"prv-data-{axis}.liquid"
    chunk_size = 9000
    parts = []
    for i in range(0, len(data), chunk_size):
        chunk = liquid_escape(data[i : i + chunk_size])
        parts.append(f'  assign prv_chunk_{len(parts)} = "{chunk}"')
    join_expr = " | append: ".join(f"prv_chunk_{j}" for j in range(len(parts)))
    content = (
        "{%- comment -%} Patron review dataset: "
        + axis
        + " {%- endcomment -%}\n{%- liquid\n"
        + "\n".join(parts)
        + "\n  assign prv_data_rows = "
        + join_expr
        + "\n  echo prv_data_rows\n-%}\n"
    )
    path.write_text(content, encoding="utf-8")
    review_count = data.count(SEP_R) + 1
    print(f"Wrote {path.name} ({review_count} reviews, {len(parts)} chunks)")


def main():
    rng = random.Random(2025)
    used_names: set = set()
    all_warnings = []

    for axis in GENERATORS:
        data, warnings = generate_collection(axis, rng, used_names)
        if warnings:
            all_warnings.extend([f"{axis}: {w}" for w in warnings])
        write_snippet(axis, data)

    print(f"Collections: {len(GENERATORS)}")
    print(f"Unique names: {len(used_names)}")
    if all_warnings:
        print(f"Validation warnings: {len(all_warnings)}")
        for w in all_warnings[:15]:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
