"""
Triple extractor: Ollama → Claude API → rule-based fallback
"""

import json
import os
import re
import subprocess

TRIPLE_PROMPT = """Extract knowledge triples (subject, predicate, object) from the following markdown note.
Return ONLY a JSON array of objects with keys: "subject", "predicate", "object".
Keep predicates simple and lowercase (e.g. "is a", "has", "belongs to", "created by").
Extract at most 20 triples. If no meaningful triples found, return [].

Title: {title}
Content:
{body}
"""


def extract_triples(title: str, body: str, method: str = "auto") -> list[dict]:
    """Extract triples using the specified method. 'auto' tries ollama → claude → rules."""
    if method == "auto":
        for fn in [_ollama_extract, _claude_extract, _rule_extract]:
            try:
                result = fn(title, body)
                if result is not None:
                    return result
            except Exception:
                continue
        return []
    elif method == "ollama":
        return _ollama_extract(title, body) or []
    elif method == "claude":
        return _claude_extract(title, body) or []
    elif method == "rules":
        return _rule_extract(title, body) or []
    return []


def _ollama_extract(title: str, body: str) -> list[dict] | None:
    """Use local Ollama for extraction."""
    model = os.environ.get("OLLAMA_MODEL", "llama3.2")
    prompt = TRIPLE_PROMPT.format(title=title, body=body[:3000])

    try:
        result = subprocess.run(
            ["ollama", "run", model, prompt],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            return None
        return _parse_json_triples(result.stdout)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def _claude_extract(title: str, body: str) -> list[dict] | None:
    """Use Claude API for extraction."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        prompt = TRIPLE_PROMPT.format(title=title, body=body[:3000])
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json_triples(message.content[0].text)
    except Exception:
        return None


def _rule_extract(title: str, body: str) -> list[dict]:
    """Rule-based fallback extraction."""
    triples = []

    # Rule 1: wikilinks → "title relates_to target"
    for link in re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", body):
        triples.append({
            "subject": title,
            "predicate": "relates_to",
            "object": link.strip(),
            "confidence": 0.6,
            "source": "rule",
        })

    # Rule 2: "X is a Y" / "X는 Y이다" patterns
    for m in re.finditer(r"(\b[A-Z][\w\s]{0,30}?)\s+is\s+(?:a|an|the)\s+(\w[\w\s]{0,30}?)(?:\.|,|\s+that|\s+which|\s+with|\s+created|\n)", body):
        triples.append({
            "subject": m.group(1).strip(),
            "predicate": "is_a",
            "object": m.group(2).strip(),
            "confidence": 0.7,
            "source": "rule",
        })

    # Rule 3: tags → "title tagged_with tag"
    for tag in re.findall(r"(?:^|\s)#([A-Za-z가-힣][\w가-힣/\-]*)", body):
        triples.append({
            "subject": title,
            "predicate": "tagged_with",
            "object": tag.strip(),
            "confidence": 0.8,
            "source": "rule",
        })

    # Rule 4: frontmatter-style "key: value" in body
    for m in re.finditer(r"^(\w+):\s+(.+)$", body, re.MULTILINE):
        key, val = m.group(1).strip(), m.group(2).strip()
        if key.lower() not in ("title", "date", "tags", "aliases", "created", "updated"):
            triples.append({
                "subject": title,
                "predicate": key.lower(),
                "object": val,
                "confidence": 0.5,
                "source": "rule",
            })

    return triples[:20]


def _parse_json_triples(text: str) -> list[dict] | None:
    """Parse JSON array of triples from LLM output."""
    # Find JSON array in the response
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group())
        result = []
        for item in data:
            if all(k in item for k in ("subject", "predicate", "object")):
                result.append({
                    "subject": str(item["subject"]),
                    "predicate": str(item["predicate"]),
                    "object": str(item["object"]),
                    "confidence": float(item.get("confidence", 0.9)),
                    "source": "llm",
                })
        return result if result else None
    except (json.JSONDecodeError, ValueError):
        return None
