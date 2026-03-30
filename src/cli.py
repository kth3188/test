#!/usr/bin/env python3
"""
milknow CLI: ingest markdown vault → extract triples → query knowledge graph
"""

import argparse
import json
import sys
from pathlib import Path

from . import parser, db, extractor


def cmd_init(args):
    db.init_db(args.db)
    print(f"Initialized database: {args.db}")


def cmd_ingest(args):
    db.init_db(args.db)
    vault = Path(args.vault)
    if not vault.exists():
        print(f"Error: {vault} not found", file=sys.stderr)
        sys.exit(1)

    notes = parser.parse_vault(vault) if vault.is_dir() else [parser.parse_markdown(vault)]
    print(f"Parsed {len(notes)} note(s)")

    with db.get_db(args.db) as conn:
        for note in notes:
            fm_json = json.dumps(note.frontmatter, ensure_ascii=False)
            note_id = db.upsert_note(conn, note.filepath, note.title, note.body, fm_json)
            db.set_tags(conn, note_id, note.tags)
            db.set_wikilinks(conn, note_id, note.wikilinks)

            triples = extractor.extract_triples(note.title, note.body, method=args.method)
            db.add_triples(conn, note_id, triples)
            print(f"  [{note.title}] {len(triples)} triple(s) extracted ({args.method})")

    print("Done.")


def cmd_query(args):
    with db.get_db(args.db) as conn:
        results = db.query_triples(conn, subject=args.subject, predicate=args.predicate, obj=args.object)

    if not results:
        print("No triples found.")
        return

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for r in results:
            conf = f" [{r['confidence']:.1f}]" if r.get("confidence") else ""
            src = f" ({r['source']})" if r.get("source") else ""
            print(f"  ({r['subject']}) --[{r['predicate']}]--> ({r['object']}){conf}{src}")


def cmd_search(args):
    with db.get_db(args.db) as conn:
        results = db.search_notes(conn, args.keyword)

    if not results:
        print("No notes found.")
        return

    for r in results:
        tags = f"  tags: {r['tags']}" if r.get("tags") else ""
        print(f"  {r['title']} ({r['filepath']}){tags}")


def cmd_graph(args):
    with db.get_db(args.db) as conn:
        edges = db.get_note_graph(conn)

    if not edges:
        print("No links found.")
        return

    if args.json:
        print(json.dumps(edges, ensure_ascii=False, indent=2))
    else:
        for e in edges:
            print(f"  {e['source']} --> {e['target']}")


def main():
    ap = argparse.ArgumentParser(prog="milknow", description="Personal knowledge graph from markdown notes")
    ap.add_argument("--db", default=db.DEFAULT_DB, help="SQLite database path")
    sub = ap.add_subparsers(dest="command", required=True)

    # init
    sub.add_parser("init", help="Initialize database")

    # ingest
    p_ingest = sub.add_parser("ingest", help="Ingest markdown files/vault")
    p_ingest.add_argument("vault", help="Path to markdown file or vault directory")
    p_ingest.add_argument("--method", choices=["auto", "ollama", "claude", "rules"], default="auto",
                          help="Triple extraction method (default: auto)")

    # query
    p_query = sub.add_parser("query", help="Query knowledge triples")
    p_query.add_argument("-s", "--subject", help="Filter by subject")
    p_query.add_argument("-p", "--predicate", help="Filter by predicate")
    p_query.add_argument("-o", "--object", help="Filter by object")
    p_query.add_argument("--json", action="store_true", help="Output as JSON")

    # search
    p_search = sub.add_parser("search", help="Search notes by keyword")
    p_search.add_argument("keyword", help="Search keyword")

    # graph
    p_graph = sub.add_parser("graph", help="Show wikilink graph")
    p_graph.add_argument("--json", action="store_true", help="Output as JSON")

    args = ap.parse_args()
    {"init": cmd_init, "ingest": cmd_ingest, "query": cmd_query, "search": cmd_search, "graph": cmd_graph}[args.command](args)


if __name__ == "__main__":
    main()
