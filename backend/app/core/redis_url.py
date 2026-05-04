"""Redis DSN — TLS (`rediss://`) için Celery/redis-py uyumluluğu."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


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
