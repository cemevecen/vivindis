"""
Mağaza uygulaması keşfi: Play arama (google-play-scraper) + App Store iTunes Search API.
Doğrudan paket / ID / ürün URL çözümleme (eski streamlit_app mantığından sadeleştirilmiş).
"""

from __future__ import annotations

import difflib
import re
import urllib.parse
from dataclasses import dataclass
from typing import Any, List, Literal, Optional, Tuple

import requests

Platform = Literal["android", "ios"]


def _relevance_score(query: str, title: str, app_id: str) -> float:
    """Sorgu ile başlık / kimlik eşleşmesi; Play ve iTunes sıralamasını yerel olarak iyileştirir."""
    q = (query or "").strip().lower()
    if not q:
        return 0.0
    t = (title or "").lower()
    aid = (app_id or "").lower()
    s = 0.0
    if q in t:
        s += 120.0
    if q in aid:
        s += 100.0
    q_compact = re.sub(r"\s+", "", q)
    aid_flat = re.sub(r"[._-]", "", aid)
    if len(q_compact) >= 4 and q_compact in aid_flat:
        s += 85.0
    for w in q.split():
        w = w.strip()
        if len(w) < 2:
            continue
        if w in t:
            s += 22.0 + min(len(w), 12) * 0.6
        if w in aid:
            s += 18.0
    pref = q[: min(len(q), 16)]
    if pref and t.startswith(pref):
        s += 38.0
    return s


# Tek kelimelik marka sorgularında Play: ana mağaza paketi (com.marka / marka.com) öne, Pro/Go/Satıcı cezası.
_PLAY_SATELLITE_SEGMENTS = frozenset(
    {
        "pro",
        "go",
        "milla",
        "lite",
        "beta",
        "dev",
        "debug",
        "hd",
        "pad",
        "tv",
        "wear",
        "sellercenter",
        "seller",
        "partner",
        "business",
        "b2b",
        "internal",
        "services",
        "inclub",
    }
)


def _play_brand_slug(query: str) -> Optional[str]:
    """Boşluksuz tek parça marka (örn. trendyol, sahibinden); çok kelimede None."""
    q = (query or "").strip().lower()
    if not q or " " in q or "\t" in q:
        return None
    slug = re.sub(r"[^a-z0-9]", "", q)
    return slug if len(slug) >= 4 else None


_PLAY_SKIP_SEGMENTS = frozenset(
    {"com", "android", "app", "apps", "mobile", "www", "net", "org", "io", "tv", "wear"}
)

# (arama_kökü, paket_segmenti): segment slug ile başlıyor ama farklı marka (yanlış genişletme)
_FALSE_BRAND_PREFIX: set[tuple[str, str]] = {
    ("letgo", "letgoo"),
}

# Arama kelimesi → bilinen ana Play paketi (paket yolunda marka geçmediğinde; örn. letgo)
ANDROID_SEARCH_CANONICAL_BY_SLUG: dict[str, str] = {
    "letgo": "com.abtnprojects.ambatana",
}

_ANDROID_CANONICAL_ALIAS_BONUS = 780.0


def _effective_brand_slug(slug: str, app_id: str) -> str:
    """
    Kısmi arama (örn. sahibin, trendyo) için paket / kimlikten tam marka kökünü çıkarır;
    böylece com.sahibinden ana uygulamasına bonus, com.sahibinden.pro için ceza uygulanır.
    """
    aid = (app_id or "").lower().strip()
    if not aid or len(slug) < 4:
        return slug
    if aid.startswith("tr.com."):
        aid = aid[6:]
    parts = [p for p in aid.split(".") if p and p not in _PLAY_SKIP_SEGMENTS and not p.isdigit()]
    best = ""
    for seg in parts:
        if len(seg) < len(slug):
            continue
        if (slug, seg) in _FALSE_BRAND_PREFIX:
            continue
        if seg.startswith(slug) and len(seg) > len(best):
            best = seg
    return best if best else slug


def _play_canonical_package_bonus(slug: str, app_id: str) -> float:
    """Ana tüketici uygulaması paket kalıplarına yüksek bonus."""
    aid = (app_id or "").lower().strip()
    if not aid:
        return 0.0
    if aid.startswith("tr.com."):
        aid = "com." + aid[6:]
    b = 0.0
    if aid == f"{slug}.com":
        b += 560.0
    if aid == f"com.{slug}":
        b += 560.0
    if aid == f"com.{slug}.android":
        b += 540.0
    parts = aid.split(".")
    if len(parts) == 2 and parts[0] == slug and parts[1] == "com":
        b += 560.0
    if aid.startswith(f"com.{slug}."):
        rest = aid[len(f"com.{slug}.") :]
        head = (rest.split(".")[0] or "").lower()
        if head in _PLAY_SATELLITE_SEGMENTS:
            b -= 220.0
        elif head == "android" and rest.lower() in ("android", "android.beta", "android.dev"):
            b += 80.0
        elif head and head not in ("android",) and head not in _PLAY_SATELLITE_SEGMENTS:
            b -= 55.0
    return b


def _play_title_satellite_adjustment(slug: str, title: str) -> float:
    """Başlıkta Pro / Go / Satıcı vb. → tek kelimeli marka aramasında hafif ceza."""
    t = (title or "").lower()
    if not t or slug not in t:
        return 0.0
    penalties = (
        " pro",
        ": pro",
        "(pro",
        " go:",
        " go ",
        " go\n",
        "satıcı",
        "seller",
        "paneli",
        " milla",
        "partner",
        "b2b",
    )
    adj = 0.0
    for p in penalties:
        if p in t:
            adj -= 95.0
            break
    if t.startswith(slug) and adj == 0.0:
        adj += 35.0
    return adj


def _title_primary_brand_signal(slug: str, title: str) -> float:
    """Başlıkta markanın birincil geçişi (Boyner – …) vs ikincil (InClub by Boyner)."""
    t = (title or "").strip().lower()
    slug = (slug or "").lower()
    if len(slug) < 3 or not t:
        return 0.0
    t_ascii = (
        t.replace("ı", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
    )
    s_ascii = (
        slug.replace("ı", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
    )
    if s_ascii not in t_ascii:
        return 0.0
    if t.startswith(slug) or t_ascii.startswith(s_ascii):
        return 360.0
    if re.search(rf"(^|[^a-z0-9]){re.escape(slug)}([^a-z0-9]|$)", t):
        return 230.0
    if slug in t:
        return 85.0
    return 0.0


_DISCOVERY_PKG_TEMPLATES = (
    "{slug}.com",
    "com.{slug}.android",
    "com.{slug}",
    "tr.com.{slug}.{slug}",
    "com.mobisoft.{slug}",
)


def _discover_play_main_package_row(slug: str) -> Optional[dict[str, Any]]:
    """Yaygın Play paket kalıplarını dene; başlıkta arama kökü geçiyorsa ana uygulama satırı üret."""
    if len(slug) < 4:
        return None
    sl = slug.lower()
    try:
        from google_play_scraper import app as play_app
    except ImportError:
        return None
    for tmpl in _DISCOVERY_PKG_TEMPLATES:
        pkg = tmpl.format(slug=sl)
        try:
            info = play_app(pkg, lang="tr", country="tr")
            title = str(info.get("title") or "").lower()
            if sl not in title:
                continue
            if title.startswith(sl) or re.search(rf"(^|[^a-z0-9]){re.escape(sl)}([^a-z0-9]|$)", title):
                return {
                    "platform": "Android",
                    "appId": pkg,
                    "title": (info.get("title") or pkg)[:80],
                    "icon": str(info.get("icon") or "").strip(),
                }
        except Exception:
            continue
    return None


def _inject_play_main_discovery(rows: List[dict[str, Any]], query: str) -> List[dict[str, Any]]:
    """Arama API'si ana paketi döndürmese bile şablon + play_app ile ana uygulamayı ekler."""
    slug = _play_brand_slug(query)
    if not slug or not rows or not looks_like_search_keyword(query):
        return rows
    aids = {str(r.get("appId", "")).lower() for r in rows if r.get("appId")}
    row = _discover_play_main_package_row(slug)
    if not row:
        return rows
    pid = str(row.get("appId", "")).lower()
    if pid in aids:
        return rows
    return [row] + list(rows)


def _android_play_relevance_score(query: str, title: str, app_id: str) -> float:
    base = _relevance_score(query, title, app_id)
    slug = _play_brand_slug(query)
    if not slug:
        return base
    brand = _effective_brand_slug(slug, app_id)
    score = (
        base
        + _play_canonical_package_bonus(brand, app_id)
        + _play_title_satellite_adjustment(brand, title)
        + _title_primary_brand_signal(slug, title)
    )
    canon = ANDROID_SEARCH_CANONICAL_BY_SLUG.get(slug.lower())
    if canon and str(app_id).lower() == canon.lower():
        score += _ANDROID_CANONICAL_ALIAS_BONUS
    # letgo aramasında "LetgoO" (letgoo) vb. taklit başlıkları düşür
    tflat = re.sub(r"\s+", "", (title or "").lower())
    if slug == "letgo" and "letgoo" in tflat:
        score -= 450.0
    aid_l = str(app_id).lower()
    if "inclub" in aid_l:
        score -= 175.0
    if "grup" in aid_l.replace(".", "") and slug in aid_l and f"com.{slug}." not in aid_l and f"{slug}.com" != aid_l:
        score -= 210.0
    return score


def _stable_sort_android_play(query: str, rows: List[dict[str, Any]]) -> List[dict[str, Any]]:
    if not rows:
        return rows
    q = query.strip()
    decorated = [
        (
            -_android_play_relevance_score(q, str(r.get("title", "")), str(r.get("appId", ""))),
            i,
            r,
        )
        for i, r in enumerate(rows)
    ]
    decorated.sort()
    return [r for _, _, r in decorated]


def _stable_sort_by_query_relevance(query: str, rows: List[dict[str, Any]]) -> List[dict[str, Any]]:
    if not rows:
        return rows
    q = query.strip()
    if not q:
        return rows
    decorated = [
        (-_relevance_score(q, str(r.get("title", "")), str(r.get("appId", ""))), i, r)
        for i, r in enumerate(rows)
    ]
    decorated.sort()
    return [r for _, _, r in decorated]


@dataclass
class ResolvedApp:
    platform: Platform
    app_id: str


def _normalize_store_title(s: str) -> str:
    """Play / arama sonuçlarında başlık eşlemesi için hafif normalize."""
    t = (s or "").strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def _titles_close_enough(a: str, b: str, *, min_ratio: float = 0.88) -> bool:
    na, nb = _normalize_store_title(a), _normalize_store_title(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if len(na) >= 10 and len(nb) >= 10 and (na in nb or nb in na):
        return True
    return difflib.SequenceMatcher(None, na, nb).ratio() >= min_ratio


def _resolve_null_play_search_app_ids(hits: list[Any], query: str) -> None:
    """
    google_play_scraper.search bazen en iyi eşleşmede appId döndürmez (null).
    Play web araması + başlık eşlemesi ile paket kimliğini doldurur (yerinde).
    """
    if not hits:
        return
    orphans: list[tuple[int, str]] = []
    for i, h in enumerate(hits):
        if h is None:
            continue
        if h.get("appId"):
            continue
        title = str(h.get("title") or "").strip()
        if not title:
            continue
        orphans.append((i, title))
    if not orphans:
        return

    q = (query or "").strip()
    if len(q) < 2:
        return

    slug_brand = _play_brand_slug(q)
    if slug_brand:
        sl = slug_brand.lower()
        pkg_canon = ANDROID_SEARCH_CANONICAL_BY_SLUG.get(sl)
        if pkg_canon:
            for idx, want_title in orphans:
                if hits[idx].get("appId"):
                    continue
                wn = (want_title or "").casefold()
                if sl not in wn:
                    continue
                wcompact = re.sub(r"\s+", "", wn)
                if sl == "letgo" and "letgoo" in wcompact:
                    continue
                hits[idx]["appId"] = pkg_canon

    if all(hits[idx].get("appId") for idx, _ in orphans):
        return

    try:
        from google_play_scraper import app as play_app
    except ImportError:
        return

    html_rows = _play_store_search_html_packages(q, max_results=48)
    pkg_order = [str(r.get("appId") or "") for r in html_rows if r.get("appId")]
    if not pkg_order:
        return

    def fetch_title(pkg: str) -> str:
        try:
            info = play_app(pkg, lang="tr", country="tr")
            return str(info.get("title") or "")[:120]
        except Exception:
            return ""

    assigned_pkg: set[str] = set()
    max_probe = min(28, len(pkg_order))
    for pkg in pkg_order[:max_probe]:
        if all(hits[idx].get("appId") for idx, _ in orphans):
            break
        if not pkg or pkg in assigned_pkg:
            continue
        got = fetch_title(pkg)
        if not got:
            continue
        for idx, want_title in orphans:
            if hits[idx].get("appId"):
                continue
            if _titles_close_enough(want_title, got):
                hits[idx]["appId"] = pkg
                assigned_pkg.add(pkg)
                break


def _dedupe_play_hits_by_appid(hits: list[Any]) -> list[Any]:
    """Aynı paket birden fazla kez gelirse ilk sıradakini koru."""
    seen: set[str] = set()
    out: list[Any] = []
    for h in hits or []:
        if not h:
            continue
        aid = h.get("appId")
        if not aid:
            continue
        sid = str(aid).strip()
        if not sid or sid in seen:
            continue
        seen.add(sid)
        out.append(h)
    return out


def _play_hits_to_rows(hits: Any) -> List[dict[str, Any]]:
    out: List[dict[str, Any]] = []
    for a in hits or []:
        aid = a.get("appId")
        if not aid:
            continue
        icon = (a.get("icon") or "").strip()
        out.append(
            {
                "platform": "Android",
                "appId": str(aid),
                "title": (a.get("title") or "—")[:80],
                "icon": icon,
            }
        )
    return out


def _play_store_search_html_packages(search_query: str, max_results: int = 48) -> List[dict[str, Any]]:
    """play_search boş kaldığında Play mağaza web aramasından paket listesi (typo / API farkı için yedek)."""
    s = (search_query or "").strip()
    if len(s) < 2:
        return []
    try:
        q = urllib.parse.quote(s)
        url = f"https://play.google.com/store/search?q={q}&c=apps"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        r = requests.get(url, headers=headers, timeout=16)
        if r.status_code != 200:
            return []
        ids = re.findall(r"/store/apps/details\?id=([a-zA-Z0-9._]+)", r.text)
        seen: set[str] = set()
        rows: List[dict[str, Any]] = []
        for aid in ids:
            aid = aid.strip()
            if not aid or aid in seen:
                continue
            seen.add(aid)
            rows.append({"platform": "Android", "appId": aid, "title": "—", "icon": ""})
            if len(rows) >= max_results:
                break
        return rows
    except Exception:
        return []


def _inject_missing_main_play_row(rows: List[dict[str, Any]], query: str) -> List[dict[str, Any]]:
    """
    Sonuçlarda yalnızca com.marka.pro / com.marka.go gibi uydular var, com.marka veya marka.com yoksa
    ana paketi play_app ile listeye ekler (kısmi arama sahibin + yalnızca pro dönmesi gibi durumlar).
    """
    slug = _play_brand_slug(query)
    if not slug or not rows:
        return rows
    aids = {str(r.get("appId", "")) for r in rows if r.get("appId")}
    for r in rows:
        aid = str(r.get("appId", ""))
        if not aid.startswith("com."):
            continue
        b = _effective_brand_slug(slug, aid)
        if not b or len(b) < len(slug):
            continue
        main = f"com.{b}"
        alt = f"{b}.com"
        if main in aids or alt in aids:
            continue
        if not aid.startswith(main + "."):
            continue
        rest_head = aid[len(main) + 1 :].split(".")[0].lower()
        if rest_head not in _PLAY_SATELLITE_SEGMENTS:
            continue
        try:
            from google_play_scraper import app as play_app

            chosen: Optional[str] = None
            info: Any = None
            for cand in (main, alt):
                try:
                    info = play_app(cand, lang="tr", country="tr")
                    chosen = cand
                    break
                except Exception:
                    continue
            if not chosen or not info:
                break
            new_row: dict[str, Any] = {
                "platform": "Android",
                "appId": chosen,
                "title": (info.get("title") or chosen)[:80],
                "icon": str(info.get("icon") or "").strip(),
            }
            return [new_row] + [x for x in rows if str(x.get("appId", "")) != chosen]
        except Exception:
            break
    return rows


def _inject_canonical_alias_row(rows: List[dict[str, Any]], query: str) -> List[dict[str, Any]]:
    """Bilinen ana paket listede yoksa (marka paket adında yok) play_app ile başa ekler."""
    slug = _play_brand_slug(query)
    if not slug or not rows:
        return rows
    target = ANDROID_SEARCH_CANONICAL_BY_SLUG.get(slug.lower())
    if not target:
        return rows
    aids_lower = {str(r.get("appId", "")).lower() for r in rows if r.get("appId")}
    if target.lower() in aids_lower:
        return rows
    try:
        from google_play_scraper import app as play_app

        info = play_app(target, lang="tr", country="tr")
        new_row: dict[str, Any] = {
            "platform": "Android",
            "appId": target,
            "title": (info.get("title") or target)[:80],
            "icon": str(info.get("icon") or "").strip(),
        }
        return [new_row] + list(rows)
    except Exception:
        return rows


def _enrich_android_rows_parallel(
    rows: List[dict[str, Any]],
    *,
    max_fetch: int = 22,
    workers: int = 5,
) -> None:
    """HTML yedeğinden gelen satırlara başlık ve ikon ekler (yerinde)."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def fetch_title_icon(aid: str) -> tuple[str, str, str]:
        try:
            from google_play_scraper import app as play_app

            info = play_app(aid, lang="tr", country="tr")
            t = str(info.get("title") or aid)[:80]
            ic = str(info.get("icon") or "").strip()
            return aid, t, ic
        except Exception:
            return aid, str(aid)[:80], ""

    aids = [str(r["appId"]) for r in rows[:max_fetch]]
    if not aids:
        return
    meta: dict[str, tuple[str, str]] = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(fetch_title_icon, aid) for aid in dict.fromkeys(aids)]
        for fut in as_completed(futs):
            aid, t, ic = fut.result()
            meta[aid] = (t, ic)

    for r in rows:
        aid = str(r.get("appId", ""))
        if aid in meta:
            t, ic = meta[aid]
            r["title"] = t
            if ic:
                r["icon"] = ic


def search_play_store(query: str, n_hits: int = 40) -> List[dict[str, Any]]:
    try:
        from google_play_scraper import search as play_search
    except ImportError:
        return []

    q = query.strip()
    if not q:
        return []

    merged: list[Any] = []
    seen_ids: set[str] = set()
    seen_null_titles: set[str] = set()
    # Tek (tr) mağazası: UI araması için yeterli; iOS tek HTTP ile kıyaslanınca gecikme azalır.
    for lang, cc in (("tr", "tr"),):
        try:
            chunk = play_search(q, n_hits=n_hits, lang=lang, country=cc) or []
        except Exception:
            chunk = []
        for a in chunk:
            aid = a.get("appId")
            if aid:
                sid = str(aid).strip()
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)
                merged.append(a)
                continue
            title = str(a.get("title") or "").strip()
            if not title:
                continue
            tkey = title.casefold()
            if tkey in seen_null_titles:
                continue
            seen_null_titles.add(tkey)
            merged.append(a)
        if len(merged) >= n_hits:
            break

    _resolve_null_play_search_app_ids(merged, q)
    merged = _dedupe_play_hits_by_appid(merged)

    out = _play_hits_to_rows(merged[:n_hits])

    if not out and len(q) >= 3 and looks_like_search_keyword(q):
        html_rows = _play_store_search_html_packages(q, max_results=n_hits)
        if html_rows:
            _enrich_android_rows_parallel(html_rows, max_fetch=min(24, len(html_rows)), workers=5)
            out = html_rows

    out = _inject_missing_main_play_row(out, q)
    out = _inject_canonical_alias_row(out, q)
    out = _inject_play_main_discovery(out, q)
    return _stable_sort_android_play(query, out)


def search_app_store_itunes(query: str, country: str = "TR", limit: int = 50) -> List[dict[str, Any]]:
    try:
        r = requests.get(
            "https://itunes.apple.com/search",
            params={
                "term": query.strip(),
                "country": country,
                "media": "software",
                "entity": "software",
                "limit": limit,
                "lang": "tr_TR",
            },
            timeout=12,
        )
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    out: List[dict[str, Any]] = []
    for app in data.get("results", [])[:limit]:
        tid = app.get("trackId")
        if not tid:
            continue
        out.append(
            {
                "platform": "iOS",
                "appId": str(tid),
                "title": (app.get("trackCensoredName") or app.get("trackName") or "—")[:80],
                "icon": (app.get("artworkUrl512") or app.get("artworkUrl100") or "").strip(),
            }
        )
    return _stable_sort_by_query_relevance(query, out)


def _first_play_search_package(search_query: str) -> Optional[str]:
    try:
        from google_play_scraper import search as play_search

        hits = play_search(search_query.replace("+", " "), n_hits=1, lang="tr", country="tr")
        if hits:
            return str(hits[0].get("appId") or "")
    except Exception:
        pass
    try:
        q = urllib.parse.quote(search_query)
        url = f"https://play.google.com/store/search?q={q}&c=apps"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        r = requests.get(url, headers=headers, timeout=12)
        if r.status_code != 200:
            return None
        matches = re.findall(r"/store/apps/details\?id=([^\"&]+)", r.text)
        if matches:
            return matches[0]
    except Exception:
        return None
    return None


def _first_itunes_search_id(term: str, country: str = "tr") -> Optional[str]:
    try:
        r = requests.get(
            f"https://itunes.apple.com/search",
            params={"term": term, "entity": "software", "country": country, "limit": 5},
            timeout=10,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        res = data.get("results") or []
        if res:
            return str(res[0].get("trackId", ""))
    except Exception:
        return None
    return None


def resolve_play_product_or_search_url(raw: str) -> Tuple[Optional[ResolvedApp], Optional[str]]:
    """
    play.google.com ürün veya arama linki → ResolvedApp veya bilgi mesajı.
    """
    u = raw.strip()
    if "play.google.com" not in u.lower():
        return None, None
    m = re.search(r"id=([^&/]+)", u)
    if m:
        return ResolvedApp("android", m.group(1)), None
    sm = re.search(r"[?&]q=([^&/]+)", u)
    if sm:
        q = urllib.parse.unquote_plus(sm.group(1))
        pkg = _first_play_search_package(q)
        if pkg:
            return ResolvedApp("android", pkg), f"Play arama linki çözüldü: “{q}” → ilk sonuç."
        return None, f"Play Store’da “{q}” için sonuç bulunamadı."
    return None, None


def resolve_apple_product_or_search_url(raw: str) -> Tuple[Optional[ResolvedApp], Optional[str]]:
    u = raw.strip()
    if "apple.com" not in u.lower() and "apps.apple.com" not in u.lower():
        return None, None
    m = re.search(r"id(\d+)", u, re.I)
    if m:
        return ResolvedApp("ios", m.group(1)), None
    sm = re.search(r"[?&]term=([^&/]+)", u)
    if sm:
        term = urllib.parse.unquote_plus(sm.group(1))
        country_m = re.search(r"apple\.com/([a-z]{2})/", u.lower())
        cc = (country_m.group(1) if country_m else "tr").upper()
        aid = _first_itunes_search_id(term, country=cc.lower())
        if aid:
            return ResolvedApp("ios", aid), f"App Store arama linki çözüldü: “{term}” → ilk sonuç."
        return None, f"App Store’da “{term}” için sonuç bulunamadı."
    return None, None


def resolve_direct_input(raw: str) -> Tuple[Optional[ResolvedApp], Optional[str]]:
    """
    Metin kutusundaki değer doğrudan paket / sayısal id / ürün URL ise döner.
    Arama kelimesi (belirsiz) için None döner — listeden seçim gerekir.
    """
    u = raw.strip()
    if not u:
        return None, None

    r1, msg1 = resolve_play_product_or_search_url(u)
    if r1:
        return r1, msg1
    r2, msg2 = resolve_apple_product_or_search_url(u)
    if r2:
        return r2, msg2

    low = u.lower()
    if low.startswith("id") and len(u) > 2 and u[2:].isdigit():
        return ResolvedApp("ios", u[2:]), None
    if u.isdigit() and len(u) >= 6:
        return ResolvedApp("ios", u), None
    if "." in u and re.match(r"^[a-zA-Z0-9._]+$", u, re.IGNORECASE):
        return ResolvedApp("android", u), None

    return None, None


def looks_like_search_keyword(q: str) -> bool:
    """Liste araması göstermek için uygun mu (URL / paket / saf rakam değil)."""
    s = q.strip()
    if len(s) < 2:
        return False
    if s.lower().startswith("http"):
        return False
    if resolve_direct_input(s)[0] is not None:
        return False
    return True
