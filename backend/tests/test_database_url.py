"""DATABASE_URL normalleştirme."""

from sqlalchemy.engine.url import make_url

from app.core.database_url import normalize_database_url


def test_normalize_encodes_at_in_password() -> None:
    raw2 = "postgresql+asyncpg://postgres.abc:MyPass@word@pooler.example.com:6543/postgres"
    out = normalize_database_url(raw2)
    assert "MyPass%40word" in out
    assert make_url(out).password == "MyPass@word"


def test_normalize_alphanumeric_password_unchanged() -> None:
    raw = "postgresql+asyncpg://user:abc123xyz@host:5432/db"
    assert normalize_database_url(raw) == make_url(raw).render_as_string(hide_password=False)


def test_empty() -> None:
    assert normalize_database_url("") == ""
    assert normalize_database_url("   ") == ""
