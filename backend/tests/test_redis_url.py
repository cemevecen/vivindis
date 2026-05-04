"""Redis TLS URL normalleştirme."""

from app.core.redis_url import normalize_rediss_url


def test_rediss_adds_ssl_cert_reqs() -> None:
    raw = "rediss://default:secret@example.upstash.io:6379"
    out = normalize_rediss_url(raw)
    assert "ssl_cert_reqs=CERT_NONE" in out
    assert out.startswith("rediss://")


def test_rediss_preserves_existing_query() -> None:
    raw = "rediss://h:6379/0?db=0"
    out = normalize_rediss_url(raw)
    assert "db=0" in out
    assert "ssl_cert_reqs=CERT_NONE" in out


def test_rediss_unchanged_when_ssl_cert_reqs_set() -> None:
    raw = "rediss://h:6379?ssl_cert_reqs=CERT_REQUIRED"
    assert normalize_rediss_url(raw) == raw


def test_redis_scheme_unchanged() -> None:
    raw = "redis://redis:6379/0"
    assert normalize_rediss_url(raw) == raw


def test_empty() -> None:
    assert normalize_rediss_url("") == ""
    assert normalize_rediss_url("   ") == ""
