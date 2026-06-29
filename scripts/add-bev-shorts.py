#!/usr/bin/env python3
"""Append new YouTube Shorts to brand-experience-videos sections in product templates."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "templates"
NEW_URLS = [
    "https://www.youtube.com/shorts/DETPBRVRNQk",
    "https://www.youtube.com/shorts/uIaW8dbqqDw",
]
MARKER = "DETPBRVRNQk"


def next_video_key(blocks: dict) -> tuple[str, str]:
    nums = []
    for key in blocks:
        m = re.match(r"video_(\d+)$", key)
        if m:
            nums.append(int(m.group(1)))
    n = max(nums) if nums else 0
    return f"video_{n + 1}", f"video_{n + 2}"


def update_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return False
    if '"type": "brand-experience-videos"' not in text:
        return False

    # Strip Shopify comment header if present
    json_text = text
    if json_text.lstrip().startswith("/*"):
        json_text = json_text[json_text.index("{") : json_text.rindex("}") + 1]

    data = json.loads(json_text)
    changed = False
    for section in data.get("sections", {}).values():
        if section.get("type") != "brand-experience-videos":
            continue
        blocks = section.setdefault("blocks", {})
        k1, k2 = next_video_key(blocks)
        blocks[k1] = {
            "type": "video",
            "settings": {"youtube_url": NEW_URLS[0], "title": "Brand experience video"},
        }
        blocks[k2] = {
            "type": "video",
            "settings": {"youtube_url": NEW_URLS[1], "title": "Brand experience video"},
        }
        order = section.setdefault("block_order", list(blocks.keys()))
        if k1 not in order:
            order.append(k1)
        if k2 not in order:
            order.append(k2)
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
    updated = []
    for path in sorted(ROOT.glob("product*.json")):
        if update_file(path):
            updated.append(path.name)
    print(f"Updated {len(updated)} templates")
    for name in updated[:5]:
        print(f"  - {name}")
    if len(updated) > 5:
        print(f"  ... +{len(updated) - 5} more")


if __name__ == "__main__":
    main()
