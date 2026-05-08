#!/usr/bin/env python3
"""Tek seferlik Telegram testi: onay bildirimi ile aynı env (TELEGRAM_*) kullanılır.

Kullanım (backend dizininden, .env yüklü):
  python3 scripts/telegram_fetch_approval_ping.py

Railway CLI veya yerel .env içinde TELEGRAM_BOT_TOKEN ve TELEGRAM_ADMIN_CHAT_IDS dolu olmalı.
"""

from __future__ import annotations

import os
import sys

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.core.config import get_settings  # noqa: E402
from app.services.fetch_approval import send_telegram_to_admins  # noqa: E402


def main() -> int:
    settings = get_settings()
    if not settings.telegram_bot_token.strip():
        print("TELEGRAM_BOT_TOKEN boş.", file=sys.stderr)
        return 1
    if not settings.telegram_admin_chat_ids.strip():
        print("TELEGRAM_ADMIN_CHAT_IDS boş.", file=sys.stderr)
        return 1
    send_telegram_to_admins(
        settings=settings,
        text="Vivindis — test: büyük çekim onay bildirimi kanalı çalışıyor.",
    )
    print("Gönderildi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
