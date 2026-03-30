"""
Markdown parser: frontmatter, wikilinks, tags 추출
"""

import re
import yaml
from pathlib import Path
from dataclasses import dataclass, field


@dataclass
class ParsedNote:
    filepath: str
    title: str
    frontmatter: dict = field(default_factory=dict)
    wikilinks: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    body: str = ""


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
_TAG_RE = re.compile(r"(?:^|\s)#([A-Za-z가-힣][\w가-힣/\-]*)", re.MULTILINE)


def parse_markdown(filepath: str | Path) -> ParsedNote:
    filepath = Path(filepath)
    text = filepath.read_text(encoding="utf-8")

    # frontmatter
    frontmatter = {}
    body = text
    fm_match = _FRONTMATTER_RE.match(text)
    if fm_match:
        try:
            frontmatter = yaml.safe_load(fm_match.group(1)) or {}
        except yaml.YAMLError:
            frontmatter = {}
        body = text[fm_match.end():]

    # title: frontmatter title > first H1 > filename
    title = frontmatter.get("title", "")
    if not title:
        h1 = re.search(r"^#\s+(.+)", body, re.MULTILINE)
        title = h1.group(1).strip() if h1 else filepath.stem

    # wikilinks
    wikilinks = _WIKILINK_RE.findall(body)

    # tags: frontmatter tags + inline #tags
    tags = []
    fm_tags = frontmatter.get("tags", [])
    if isinstance(fm_tags, list):
        tags.extend(fm_tags)
    elif isinstance(fm_tags, str):
        tags.extend(fm_tags.split(","))
    tags.extend(_TAG_RE.findall(body))
    tags = list(dict.fromkeys(t.strip() for t in tags if t.strip()))

    return ParsedNote(
        filepath=str(filepath),
        title=title,
        frontmatter=frontmatter,
        wikilinks=wikilinks,
        tags=tags,
        body=body.strip(),
    )


def parse_vault(vault_path: str | Path) -> list[ParsedNote]:
    vault = Path(vault_path)
    notes = []
    for md in sorted(vault.rglob("*.md")):
        try:
            notes.append(parse_markdown(md))
        except Exception as e:
            print(f"[WARN] {md}: {e}")
    return notes
