"""
Kalıcı marka görselleri: SQLite BLOB + repodaki PNG yedekleri.
Uygulama bu tabloda DELETE / UPDATE kullanmaz; yalnızca SELECT ve eksik anahtar için INSERT.
"""

from __future__ import annotations

import base64
import sqlite3
from pathlib import Path

BRANDING_DIR = Path(__file__).resolve().parent
DB_PATH = BRANDING_DIR / "branding.db"
FAVICON_FILE = BRANDING_DIR / "favicon.png"
HEADER_FILE = BRANDING_DIR / "header_logo.png"

_ASSETS: tuple[tuple[str, Path, str], ...] = (
    ("favicon", FAVICON_FILE, "image/png"),
    ("header_logo", HEADER_FILE, "image/png"),
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS brand_assets (
            asset_key TEXT PRIMARY KEY NOT NULL,
            mime_type TEXT NOT NULL,
            image_blob BLOB NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _insert_if_missing(conn: sqlite3.Connection, key: str, path: Path, mime: str) -> None:
    row = conn.execute("SELECT 1 FROM brand_assets WHERE asset_key = ?", (key,)).fetchone()
    if row is not None:
        return
    if not path.is_file():
        return
    blob = path.read_bytes()
    conn.execute(
        "INSERT INTO brand_assets (asset_key, mime_type, image_blob) VALUES (?,?,?)",
        (key, mime, blob),
    )


def _restore_file_from_db(conn: sqlite3.Connection, key: str, path: Path) -> None:
    if path.is_file():
        return
    row = conn.execute(
        "SELECT image_blob FROM brand_assets WHERE asset_key = ?", (key,)
    ).fetchone()
    if row and row[0]:
        path.write_bytes(row[0])


def get_blob(conn: sqlite3.Connection, asset_key: str) -> bytes | None:
    row = conn.execute(
        "SELECT image_blob FROM brand_assets WHERE asset_key = ?", (asset_key,)
    ).fetchone()
    return row[0] if row else None


def ensure_branding_assets() -> None:
    """
    Şemayı oluştur, PNG dosyasından eksik satırları INSERT et, diskte PNG yoksa DB'den geri yaz.
    DELETE / UPDATE çağrılmaz.
    """
    BRANDING_DIR.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    try:
        _init_schema(conn)
        for key, path, mime in _ASSETS:
            _insert_if_missing(conn, key, path, mime)
        for key, path, _mime in _ASSETS:
            _restore_file_from_db(conn, key, path)
        conn.commit()
    finally:
        conn.close()


def favicon_abs_path() -> str | None:
    if FAVICON_FILE.is_file():
        return str(FAVICON_FILE.resolve())
    return None


def header_logo_data_uri() -> str | None:
    conn = _connect()
    try:
        blob = get_blob(conn, "header_logo")
    finally:
        conn.close()
    if not blob:
        if HEADER_FILE.is_file():
            blob = HEADER_FILE.read_bytes()
        else:
            return None
    b64 = base64.standard_b64encode(blob).decode("ascii")
    return f"data:image/png;base64,{b64}"
