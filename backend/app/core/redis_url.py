"""Redis DSN — TLS (`rediss://`) için Celery/redis-py uyumluluğu."""

from __future__ import annotations

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_REDISS_ENV_KEYS = ("REDIS_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND")


def normalize_rediss_url(raw: str) -> str:
    """``rediss://`` adresinde ``ssl_cert_reqs`` yoksa ekler.

    Yönetilen Redis (Railway, Upstash vb.) genelde ``rediss://`` verir; Celery sonuç
    backend'i ``ssl_cert_reqs`` olmadan ``ValueError`` fırlatır. Açıkça verilmişse
    dokunulmaz; üretimde ``CERT_REQUIRED`` ile kendi CA zincirinizi kullanabilirsiniz.
    """
    url = raw.strip()
    if not url:
        return url

    parts = urlsplit(url)
    if parts.scheme.lower() != "rediss":
        return url

    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    if "ssl_cert_reqs" in q:
        return url

    q["ssl_cert_reqs"] = "CERT_NONE"
    new_query = urlencode(q)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def patch_process_environ_rediss_urls() -> None:
    """İşlem ortamındaki Redis URL'lerini düzelt.

    Celery, ``broker_url`` / ``result_backend`` için **önce** ``os.environ`` okur
    (konstruktor ile verilen değerden önce). Railway vb. ham ``rediss://`` verince
    sonuç backend'i patlar; bu yüzden env'yi ``app.core.config`` yüklenmeden önce
    güncelleriz.
    """
    for key in _REDISS_ENV_KEYS:
        raw = os.environ.get(key)
        if not raw:
            continue
        s = str(raw).strip()
        if not s:
            continue
        normalized = normalize_rediss_url(s)
        if normalized != s:
            os.environ[key] = normalized
