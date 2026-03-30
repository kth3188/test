"""
SQLite storage for notes and knowledge triples.
"""

import sqlite3
from pathlib import Path
from contextlib import contextmanager

DEFAULT_DB = "milknow.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    frontmatter TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (note_id, tag)
);

CREATE TABLE IF NOT EXISTS wikilinks (
    source_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_title TEXT NOT NULL,
    PRIMARY KEY (source_id, target_title)
);

CREATE TABLE IF NOT EXISTS triples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'rule'
);

CREATE INDEX IF NOT EXISTS idx_triples_subject ON triples(subject);
CREATE INDEX IF NOT EXISTS idx_triples_object ON triples(object);
CREATE INDEX IF NOT EXISTS idx_triples_predicate ON triples(predicate);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
"""


@contextmanager
def get_db(db_path: str = DEFAULT_DB):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(db_path: str = DEFAULT_DB):
    with get_db(db_path) as conn:
        conn.executescript(SCHEMA)


def upsert_note(conn, filepath: str, title: str, body: str, frontmatter_json: str) -> int:
    conn.execute(
        """INSERT INTO notes (filepath, title, body, frontmatter, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(filepath) DO UPDATE SET
             title=excluded.title, body=excluded.body,
             frontmatter=excluded.frontmatter, updated_at=CURRENT_TIMESTAMP""",
        (filepath, title, body, frontmatter_json),
    )
    row = conn.execute("SELECT id FROM notes WHERE filepath=?", (filepath,)).fetchone()
    return row["id"]


def set_tags(conn, note_id: int, tags: list[str]):
    conn.execute("DELETE FROM tags WHERE note_id=?", (note_id,))
    for tag in tags:
        conn.execute("INSERT OR IGNORE INTO tags (note_id, tag) VALUES (?, ?)", (note_id, tag))


def set_wikilinks(conn, note_id: int, targets: list[str]):
    conn.execute("DELETE FROM wikilinks WHERE source_id=?", (note_id,))
    for t in targets:
        conn.execute(
            "INSERT OR IGNORE INTO wikilinks (source_id, target_title) VALUES (?, ?)",
            (note_id, t),
        )


def add_triples(conn, note_id: int, triples: list[dict]):
    conn.execute("DELETE FROM triples WHERE note_id=?", (note_id,))
    for t in triples:
        conn.execute(
            "INSERT INTO triples (note_id, subject, predicate, object, confidence, source) VALUES (?, ?, ?, ?, ?, ?)",
            (note_id, t["subject"], t["predicate"], t["object"], t.get("confidence", 1.0), t.get("source", "rule")),
        )


def query_triples(conn, subject=None, predicate=None, obj=None) -> list[dict]:
    sql = "SELECT t.*, n.title as note_title FROM triples t LEFT JOIN notes n ON t.note_id = n.id WHERE 1=1"
    params = []
    if subject:
        sql += " AND t.subject LIKE ?"
        params.append(f"%{subject}%")
    if predicate:
        sql += " AND t.predicate LIKE ?"
        params.append(f"%{predicate}%")
    if obj:
        sql += " AND t.object LIKE ?"
        params.append(f"%{obj}%")
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def search_notes(conn, keyword: str) -> list[dict]:
    sql = """SELECT n.id, n.filepath, n.title,
                    GROUP_CONCAT(DISTINCT tg.tag) as tags
             FROM notes n
             LEFT JOIN tags tg ON n.id = tg.note_id
             WHERE n.title LIKE ? OR n.body LIKE ?
             GROUP BY n.id"""
    kw = f"%{keyword}%"
    return [dict(row) for row in conn.execute(sql, (kw, kw)).fetchall()]


def get_note_graph(conn) -> list[dict]:
    return [
        dict(row)
        for row in conn.execute(
            """SELECT n.title as source, w.target_title as target
               FROM wikilinks w JOIN notes n ON w.source_id = n.id"""
        ).fetchall()
    ]
