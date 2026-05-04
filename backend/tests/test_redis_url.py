"""Redis TLS URL normalleştirme."""

import os

import pytest

from app.core.redis_url import normalize_rediss_url, patch_process_environ_rediss_urls


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


def test_patch_process_environ_rediss_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = "rediss://default:secret@example.upstash.io:6379"
    monkeypatch.setenv("CELERY_RESULT_BACKEND", raw)
    patch_process_environ_rediss_urls()
    assert "ssl_cert_reqs=CERT_NONE" in os.environ["CELERY_RESULT_BACKEND"]


def test_celery_conf_result_backend_reads_patched_environ(monkeypatch: pytest.MonkeyPatch) -> None:
    """Celery ``result_backend`` özelliği önce ``os.environ`` kullanır — patch sonrası geçerli URL."""
    from celery import Celery

    raw = "rediss://user:pass@redis.example.com:6379/0"
    monkeypatch.setenv("CELERY_RESULT_BACKEND", raw)
    patch_process_environ_rediss_urls()

    isolated = Celery("test_rediss", broker=os.environ["CELERY_RESULT_BACKEND"], backend=os.environ["CELERY_RESULT_BACKEND"])
    rb = isolated.conf.result_backend
    assert rb is not None
    assert "ssl_cert_reqs" in rb
