#!/usr/bin/env python3
"""Append AXpD-qtgZiM to brand-experience-videos sections in product templates."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "templates"
NEW_URL = "https://www.youtube.com/shorts/AXpD-qtgZiM"
MARKER = "AXpD-qtgZiM"


def next_key(blocks: dict) -> str:
    nums = []
    for key in blocks:
        m = re.match(r"video_(\d+)$", key)
        if m:
            nums.append(int(m.group(1)))
    return f"video_{max(nums) + 1 if nums else 1}"


def update_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return False
    if '"type": "brand-experience-videos"' not in text:
        return False

    json_text = text
    if json_text.lstrip().startswith("/*"):
        json_text = json_text[json_text.index("{") : json_text.rindex("}") + 1]

    data = json.loads(json_text)
    changed = False
    for section in data.get("sections", {}).values():
        if section.get("type") != "brand-experience-videos":
            continue
        blocks = section.setdefault("blocks", {})
        key = next_key(blocks)
        blocks[key] = {
            "type": "video",
            "settings": {"youtube_url": NEW_URL, "title": "Brand experience video"},
        }
        order = section.setdefault("block_order", list(blocks.keys()))
        if key not in order:
            order.append(key)
        changed = True

    if not changed:
        return False

    new_json = json.dumps(data, indent=2) + "\n"
    if text.lstrip().startswith("/*"):
        header = text[: text.index("{")]
        path.write_text(header + new_json, encoding="utf-8")
    else:
        path.write_text(new_json, encoding="utf-8")
    return True


def main():
    updated = [p.name for p in sorted(ROOT.glob("product*.json")) if update_file(p)]
    print(f"Updated {len(updated)} templates")


if __name__ == "__main__":
    main()
