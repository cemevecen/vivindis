"""DATABASE_URL — şifrede @, #, % vb. için yüzde kodlama (Railway / Supabase)."""

from __future__ import annotations

from urllib.parse import quote, urlsplit, urlunsplit

from sqlalchemy.engine.url import make_url

_UNSAFE = frozenset("@#%!?&=+")

def normalize_database_url(raw: str) -> str:
    """Şifre URL için güvensiz karakter içeriyorsa yüzde kodlar.

    ``postgresql+asyncpg://user:secret@host:6543/db`` — şifredeki ``@`` bağlantıyı kırar;
    ``secret`` içinde ``%`` zaten encode parçası olabilir, tam encode edilmiş şifrede
    ``%`` vardır; o durumda dokunmayız.
    """
    url = raw.strip()
    if not url:
        return url

    parts = urlsplit(url)
    scheme = parts.scheme
    if not scheme.startswith("postgres"):
        return url

    netloc = parts.netloc
    if "@" not in netloc or ":" not in netloc:
        try:
            return make_url(url).render_as_string(hide_password=False)
        except Exception:
            return url

    userinfo, _, host = netloc.rpartition("@")
    if not host or not userinfo:
        return url
    username, _, password = userinfo.rpartition(":")
    if not password:
        return url
    if "%" in password:
        try:
            return make_url(url).render_as_string(hide_password=False)
        except Exception:
            return url
    if not any(c in password for c in _UNSAFE):
        try:
            return make_url(url).render_as_string(hide_password=False)
        except Exception:
            return url

    enc = quote(password, safe="")
    new_netloc = f"{username}:{enc}@{host}"
    rebuilt = urlunsplit((scheme, new_netloc, parts.path, parts.query, parts.fragment))
    try:
        return make_url(rebuilt).render_as_string(hide_password=False)
    except Exception:
        return url
