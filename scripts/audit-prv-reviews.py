#!/usr/bin/env python3
"""Audit generated prv-data-*.liquid files for experience-first compliance."""
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prv_category_rules import BANNED_BODY_PATTERNS, FORBIDDEN, FRAGMENT_PATTERNS, TAGS

SNIPPETS = Path(__file__).resolve().parent.parent / "snippets"
SEP_F = "~|~"
SEP_R = "~||~"

BAD_TAGS = {
    "Corporate Gift", "Discovery", "Restock", "Premium Texture", "Solar Glow",
    "Crown Light", "Energy Balance",
}


def parse_liquid(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    chunks = re.findall(r'assign prv_chunk_\d+ = "((?:[^"\\]|\\.)*)"', text)
    raw = "".join(chunks)
    return raw.encode().decode("unicode_escape")


def opening_key(body: str) -> str:
    return " ".join(body.split()[:8]).lower()



def audit_file(path: Path) -> dict:
    axis = path.stem.replace("prv-data-", "")
    data = parse_liquid(path)
    rows = data.split(SEP_R)
    issues = []
    names = []
    bodies = []
    tags = []
    openings = []
    allowed_tags = set(TAGS.get(axis, TAGS["generic"]))

    for i, row in enumerate(rows):
        cols = row.split(SEP_F)
        if len(cols) < 8:
            issues.append(f"row {i}: malformed columns ({len(cols)})")
            continue
        name, city, rating, body, tag, ptype, note = cols[0], cols[1], cols[2], cols[3], cols[4], cols[5], cols[6]
        names.append(name)
        bodies.append(body)
        tags.append(tag)
        openings.append(opening_key(body))
        low = body.lower()

        if "{{ prv_short }}" in body or "prv_short" in low:
            issues.append(f"row {i} ({name}): product name placeholder in body")

        if re.search(r"[—–]", body):
            issues.append(f"row {i} ({name}): em dash in body")

        words = len(re.findall(r"\b\w+\b", body))
        if words < 18:
            issues.append(f"row {i} ({name}): too short ({words} words)")

        if len(re.findall(r"[.!?]+", body)) < 2:
            issues.append(f"row {i} ({name}): fewer than two sentences")

        for pat in BANNED_BODY_PATTERNS:
            if re.search(pat, body, re.IGNORECASE):
                issues.append(f"row {i} ({name}): banned pattern '{pat}'")

        for pat in FRAGMENT_PATTERNS:
            if re.search(pat, body, re.IGNORECASE):
                issues.append(f"row {i} ({name}): fragment pattern '{pat}'")

        for term in FORBIDDEN.get(axis, []):
            if term.lower() in low:
                issues.append(f"row {i} ({name}): forbidden '{term}' in body")

        if allowed_tags and tag not in allowed_tags:
            issues.append(f"row {i} ({name}): tag '{tag}' not in allowed list")

        for bad in BAD_TAGS:
            if bad.lower() in tag.lower() or bad.lower() in note.lower() or bad.lower() in ptype.lower():
                issues.append(f"row {i} ({name}): generic tag/metadata '{bad}'")

    dup_names = [n for n in names if names.count(n) > 1]
    if dup_names:
        issues.append(f"duplicate names in file: {set(dup_names)}")

    dup_bodies = [b for b in bodies if bodies.count(b) > 1]
    if dup_bodies:
        issues.append(f"duplicate bodies: {len(set(dup_bodies))}")

    opening_counts = Counter(openings)
    repeated_openings = {k: v for k, v in opening_counts.items() if v > 3}
    if repeated_openings:
        worst = sorted(repeated_openings.items(), key=lambda x: -x[1])[:5]
        issues.append(f"repeated openings ({len(repeated_openings)}): {worst}")

    return {
        "axis": axis,
        "count": len(rows),
        "issues": issues,
    }


def main():
    files = sorted(SNIPPETS.glob("prv-data-*.liquid"))
    files = [f for f in files if f.name != "prv-data-loader.liquid"]
    total_issues = 0
    for path in files:
        result = audit_file(path)
        status = "OK" if not result["issues"] else "FAIL"
        print(f"{status} {result['axis']}: {result['count']} reviews, {len(result['issues'])} issues")
        for issue in result["issues"][:8]:
            print(f"    - {issue}")
        if len(result["issues"]) > 8:
            print(f"    ... +{len(result['issues']) - 8} more")
        total_issues += len(result["issues"])
    print(f"\nTotal issues: {total_issues}")
    return 1 if total_issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
