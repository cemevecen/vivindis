"""Insights hesapları için saf fonksiyon testleri."""

from __future__ import annotations

from app.api.v1.analysis import (
    build_action_items,
    build_alert_items,
    compute_keyword_counts,
    is_low_star_spike,
)


def test_compute_keyword_counts_counts_all_terms() -> None:
    blob = "crash crash ödeme payment login giriş login"
    groups = {
        "crash": ["crash"],
        "payment": ["ödeme", "payment"],
        "login": ["login", "giriş"],
    }
    counts = compute_keyword_counts(blob, groups)
    assert counts["crash"] == 2
    assert counts["payment"] == 2
    assert counts["login"] == 3


def test_low_star_spike_requires_volume_and_delta() -> None:
    assert is_low_star_spike(cur_ratio=0.30, prev_ratio=0.10, cur_total=25) is True
    assert is_low_star_spike(cur_ratio=0.16, prev_ratio=0.10, cur_total=25) is False
    assert is_low_star_spike(cur_ratio=0.30, prev_ratio=0.10, cur_total=5) is False


def test_build_alert_items_marks_keyword_burst_triggered() -> None:
    alerts = build_alert_items(
        cur_ratio=0.32,
        prev_ratio=0.12,
        cur_total=20,
        keyword_counts={"crash": 20, "payment": 5, "login": 2},
    )
    by_key = {a.key: a for a in alerts}
    assert by_key["low_star_spike"].triggered is True
    assert by_key["crash_burst"].triggered is True
    assert by_key["login_burst"].triggered is False


def test_build_action_items_prioritizes_hot_issues() -> None:
    actions = build_action_items({"crash": 12, "payment": 8, "login": 4}, low_star_spike=True)
    assert len(actions) >= 3
    assert actions[0].priority == "P0"
    assert any("Düşük yıldız oranı" in a.problem for a in actions)
