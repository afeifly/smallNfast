import sqlite3
import json
from pathlib import Path
from typing import Optional
from backend.config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT 'docx',
    original_file   TEXT,
    markdown_content TEXT,
    placeholder_md  TEXT,
    source_lang     TEXT NOT NULL DEFAULT 'EN',
    target_lang     TEXT,
    status          TEXT NOT NULL DEFAULT 'uploaded',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS segments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sequence        INTEGER NOT NULL,
    paragraph_index INTEGER NOT NULL,
    container_paragraph_index INTEGER,
    run_index       INTEGER NOT NULL,
    run_count       INTEGER NOT NULL DEFAULT 1,
    source_text     TEXT NOT NULL,
    formatting_json TEXT NOT NULL DEFAULT '{}',
    paragraph_formatting_json TEXT NOT NULL DEFAULT '{}',
    container_type  TEXT NOT NULL DEFAULT 'paragraph',
    container_index INTEGER,
    table_row       INTEGER,
    table_col       INTEGER,
    section_index   INTEGER,
    key_id          INTEGER REFERENCES translation_keys(id),
    translated_text TEXT,
    is_translated   INTEGER NOT NULL DEFAULT 0,
    ignored         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_segments_key ON segments(key_id);

CREATE TABLE IF NOT EXISTS translation_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text     TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS translation_values (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id          INTEGER NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
    target_lang     TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    is_edited       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(key_id, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_segments_project ON segments(project_id, sequence);
CREATE INDEX IF NOT EXISTS idx_translation_keys_source ON translation_keys(source_text);
"""


def get_db_path() -> Path:
    return DATABASE_PATH


def init_db(db_path: Optional[Path] = None) -> None:
    if db_path is None:
        db_path = DATABASE_PATH
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
