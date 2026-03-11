#!/usr/bin/env python3
"""
Upload vlog storyboard analysis to a Notion page's STEP 4 section.

Usage:
    python notion_upload.py <notion_page_id> <storyboard_analysis_file>

    notion_page_id: The UUID from the end of your Notion page URL
    storyboard_analysis_file: Path to storyboard_analysis.md

Requirements:
    pip install notion-client
    NOTION_API_KEY set in .env (project root)
"""

import os
import sys
import re


def load_env():
    """Load .env from project root (two levels up from this script)."""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())


def extract_bullet_list(text):
    """Extract bullet points from a block of text."""
    return [
        m.strip()
        for m in re.findall(r"(?:^|\n)\s*[-•*]\s*(.+)", text)
        if m.strip()
    ]


def parse_storyboard(filepath):
    """Parse storyboard_analysis.md into structured data."""
    with open(filepath, "r") as f:
        content = f.read()

    result = {
        "summary": "",
        "hot_takes": [],
        "identities": [],
        "chapters": [],
    }

    # --- Part 1: Overall Analysis ---
    part1_match = re.search(
        r"(?:Part 1|Overall Analysis).*?\n(.*?)(?=(?:Part 2|Chapter Breakdown)|\Z)",
        content,
        re.DOTALL | re.IGNORECASE,
    )
    if part1_match:
        part1 = part1_match.group(1)
    else:
        part1_match2 = re.search(r"^(.*?)(?=###\s+Chapter\s+\d+)", content, re.DOTALL)
        part1 = part1_match2.group(1) if part1_match2 else ""

    # Extract summary
    summary_match = re.search(
        r"(?:summary|1\.\s*Based on|overall)[:\s]*\n*((?:.+\n?){2,})",
        part1,
        re.IGNORECASE,
    )
    if summary_match:
        result["summary"] = summary_match.group(1).strip()
    else:
        paragraphs = [p.strip() for p in part1.split("\n\n") if len(p.strip()) > 100]
        if paragraphs:
            result["summary"] = paragraphs[0]

    # Extract hot takes
    ht_match = re.search(
        r"(?:hot takes?|3\..*?hot takes?)[:\s]*\n*((?:.*\n?)+?)(?=\n\n\S|\Z)",
        part1,
        re.IGNORECASE,
    )
    if ht_match:
        result["hot_takes"] = extract_bullet_list(ht_match.group(1))[:5]

    # Extract identities
    id_match = re.search(
        r"(?:identit|personalities?)[:\s]*\n*((?:.*\n?)+?)(?=\n\n\S|\Z)",
        part1,
        re.IGNORECASE,
    )
    if id_match:
        result["identities"] = extract_bullet_list(id_match.group(1))[:5]

    # --- Part 2: Chapter Breakdown ---
    chapter_pattern = re.compile(
        r"###\s+Chapter\s+(\d+):\s*(.+?)\n(.*?)(?=###\s+Chapter\s+\d+|\Z)",
        re.DOTALL,
    )
    for match in chapter_pattern.finditer(content):
        body = match.group(3)
        chapter = {
            "num": int(match.group(1)),
            "title": match.group(2).strip(),
            "summary": "",
            "character_moment": "",
            "hot_take": "",
            "personality": "",
            "add_focus": [],
            "clips": "",
            "transcript": "",
        }

        s = re.search(r"\*\*Summary:\*\*\s*(.+?)(?=\*\*[A-Z]|\Z)", body, re.DOTALL)
        if s:
            chapter["summary"] = s.group(1).strip()

        m = re.search(r"\*\*Character Moment:\*\*\s*(.+?)(?=\*\*[A-Z]|\Z)", body, re.DOTALL)
        if m:
            chapter["character_moment"] = m.group(1).strip()

        ht = re.search(r"\*\*Hot Take:\*\*\s*(.+?)(?=\*\*[A-Z]|\Z)", body, re.DOTALL)
        if ht:
            chapter["hot_take"] = ht.group(1).strip()

        p = re.search(r"\*\*Personality:\*\*\s*(.+?)(?=\*\*[A-Z]|\Z)", body, re.DOTALL)
        if p:
            chapter["personality"] = p.group(1).strip()

        chapter["add_focus"] = re.findall(r"- \[ \]\s*(.+)", body)

        c = re.search(r"\*\*Clips?:\*\*\s*(.+?)(?=\n|$)", body)
        if c:
            chapter["clips"] = c.group(1).strip()

        t = re.search(r"\*\*Transcript excerpt:\*\*\s*\n((?:>.*\n?)+)", body)
        if t:
            raw = t.group(1)
            chapter["transcript"] = re.sub(r"^>\s?", "", raw, flags=re.MULTILINE).strip()
        else:
            t2 = re.search(
                r"\*\*Transcript excerpt:\*\*\s*\n(.+?)(?=---|###|\Z)", body, re.DOTALL
            )
            if t2:
                chapter["transcript"] = t2.group(1).strip()

        result["chapters"].append(chapter)

    return result


def truncate_text(text, limit=1900):
    """Truncate text to Notion's rich_text limit (2000 chars), with buffer."""
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def rich_text(content, bold=False, italic=False, color=None):
    """Build a Notion rich_text object."""
    annotations = {}
    if bold:
        annotations["bold"] = True
    if italic:
        annotations["italic"] = True
    if color:
        annotations["color"] = color
    obj = {"type": "text", "text": {"content": truncate_text(content)}}
    if annotations:
        obj["annotations"] = annotations
    return obj


def parse_transcript_with_clips(text):
    """Parse transcript text, bolding [Dx-xx] clip references.
    
    Returns a list of rich_text objects with clip refs bolded.
    """
    if not text:
        return [rich_text("(no transcript)")]
    
    parts = re.split(r"(\[D\d+-\d+\]|\*\*\[D\d+-\d+\]\*\*)", text)
    result = []
    for part in parts:
        if not part:
            continue
        # Strip markdown bold markers if present
        clean = re.sub(r"\*\*", "", part)
        if re.match(r"\[D\d+-\d+\]", clean):
            result.append(rich_text(clean, bold=True))
        else:
            result.append(rich_text(part))
    return result if result else [rich_text("(no transcript)")]


def build_chapter_toggle(chapter):
    """Build a Notion toggle block for one chapter.
    
    Structure inside toggle:
    - Callout (star): summary, character moment, hot take, personality, clips
    - Paragraph: transcript with bolded clip refs
    - To-do items: add focus suggestions
    """
    children = []

    # --- Callout: summary + character info ---
    callout_parts = []
    if chapter["summary"]:
        callout_parts.append(rich_text("Summary: ", bold=True))
        callout_parts.append(rich_text(chapter["summary"] + "\n\n"))
    if chapter["character_moment"]:
        callout_parts.append(rich_text("Character Moment: ", bold=True))
        callout_parts.append(rich_text(chapter["character_moment"] + "\n\n"))
    if chapter["hot_take"]:
        callout_parts.append(rich_text("Hot Take: ", bold=True))
        callout_parts.append(rich_text(chapter["hot_take"] + "\n\n"))
    if chapter["personality"]:
        callout_parts.append(rich_text("Personality: ", bold=True))
        callout_parts.append(rich_text(chapter["personality"] + "\n\n"))
    if chapter["clips"]:
        callout_parts.append(rich_text("Clips: ", bold=True))
        callout_parts.append(rich_text(chapter["clips"]))

    if callout_parts:
        children.append(
            {
                "type": "callout",
                "callout": {
                    "rich_text": callout_parts,
                    "icon": {"type": "emoji", "emoji": "⭐"},
                    "color": "yellow_background",
                },
            }
        )

    # --- Transcript paragraph with bolded clip refs ---
    if chapter["transcript"]:
        transcript_parts = [rich_text("[A Roll] ", bold=True)]
        transcript_parts.extend(parse_transcript_with_clips(chapter["transcript"]))
        children.append(
            {
                "type": "paragraph",
                "paragraph": {"rich_text": transcript_parts},
            }
        )

    # --- Add Focus to-do checkboxes ---
    for suggestion in chapter["add_focus"]:
        children.append(
            {
                "type": "to_do",
                "to_do": {
                    "rich_text": [rich_text(suggestion)],
                    "checked": False,
                },
            }
        )

    return {
        "type": "toggle",
        "toggle": {
            "rich_text": [
                rich_text(f"Story {chapter['num']}: {chapter['title']}")
            ],
            "children": children,
        },
    }


def find_step4_block_id(client, page_id):
    """Find the STEP 4 toggle heading block in the Notion page."""
    response = client.blocks.children.list(block_id=page_id)
    for block in response["results"]:
        # Check toggle headings (heading_2 with is_toggleable)
        if block["type"] == "heading_2":
            texts = block["heading_2"].get("rich_text", [])
            text = "".join(t.get("plain_text", "") for t in texts)
            if "STEP 4" in text or "Paper Cut" in text:
                return block["id"]
        # Also check plain toggles as fallback
        if block["type"] == "toggle":
            texts = block["toggle"].get("rich_text", [])
            text = "".join(t.get("plain_text", "") for t in texts)
            if "STEP 4" in text or "Paper Cut" in text:
                return block["id"]
    print("⚠️  Could not find STEP 4 toggle. Will append to page root instead.")
    return page_id


def upload_to_notion(page_id, storyboard_file):
    load_env()

    token = os.environ.get("NOTION_API_KEY")
    if not token:
        print("❌ NOTION_API_KEY not found. Add it to your .env file.")
        sys.exit(1)

    try:
        from notion_client import Client
    except ImportError:
        print("❌ notion-client not installed. Run: pip install notion-client")
        sys.exit(1)

    client = Client(auth=token)

    print(f"📖 Parsing {storyboard_file}...")
    data = parse_storyboard(storyboard_file)

    if not data["chapters"]:
        print("❌ No chapters found in storyboard analysis. Check the file format.")
        sys.exit(1)

    print(f"✅ Found {len(data['chapters'])} chapters")

    # Find STEP 4 block — append inside it as children (preserving existing children)
    step4_id = find_step4_block_id(client, page_id)

    # Build blocks to append
    blocks = []

    # Divider + AI heading
    blocks.append({"type": "divider", "divider": {}})
    blocks.append(
        {
            "type": "heading_3",
            "heading_3": {
                "rich_text": [rich_text("🤖 AI Storyboard Analysis")]
            },
        }
    )

    # Overall summary callout
    if data["summary"]:
        blocks.append(
            {
                "type": "callout",
                "callout": {
                    "rich_text": [rich_text(data["summary"])],
                    "icon": {"type": "emoji", "emoji": "📝"},
                    "color": "blue_background",
                },
            }
        )

    # Story toggles (one per chapter)
    for chapter in data["chapters"]:
        blocks.append(build_chapter_toggle(chapter))

    # Hot takes toggle
    if data["hot_takes"]:
        ht_children = []
        for ht in data["hot_takes"]:
            ht_children.append(
                {
                    "type": "paragraph",
                    "paragraph": {"rich_text": [rich_text(f"• {ht}")]},
                }
            )
        blocks.append(
            {
                "type": "toggle",
                "toggle": {
                    "rich_text": [rich_text("🔥 Relevant Hot Takes")],
                    "children": ht_children,
                },
            }
        )

    # Identities toggle
    if data["identities"]:
        id_children = []
        for identity in data["identities"]:
            id_children.append(
                {
                    "type": "paragraph",
                    "paragraph": {"rich_text": [rich_text(f"• {identity}")]},
                }
            )
        blocks.append(
            {
                "type": "toggle",
                "toggle": {
                    "rich_text": [rich_text("🎭 Relevant Identities")],
                    "children": id_children,
                },
            }
        )

    # Notion API: max 100 blocks per request
    BATCH_SIZE = 100
    for i in range(0, len(blocks), BATCH_SIZE):
        batch = blocks[i : i + BATCH_SIZE]
        client.blocks.children.append(block_id=step4_id, children=batch)

    print(f"✅ Uploaded {len(data['chapters'])} chapters to Notion!")
    clean_id = page_id.replace("-", "")
    print(f"🔗 https://notion.so/{clean_id}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python notion_upload.py <page_id> <storyboard_analysis_file>")
        print("  page_id: UUID from the end of your Notion page URL")
        print("  Example: python notion_upload.py 2aafac24288780d3b101d2722375e0df ./storyboard_analysis.md")
        sys.exit(1)

    upload_to_notion(sys.argv[1], sys.argv[2])