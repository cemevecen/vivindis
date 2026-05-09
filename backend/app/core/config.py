"""Ortam değişkenleri — değerler runtime'da process env'den gelir (Docker Compose ile enjekte edilir)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.database_url import normalize_database_url
from app.core.redis_url import normalize_rediss_url, patch_process_environ_rediss_urls

# Celery conf önce os.environ okur; Pydantic normalize etse bile Celery ham rediss görür.
patch_process_environ_rediss_urls()


class Settings(BaseSettings):
    """Tüm backend yapılandırması env üzerinden."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = Field(default="", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    database_url: str = Field(
        default="",
        validation_alias="DATABASE_URL",
        description="Supabase + Railway: Transaction pooler (port 6543) önerilir; doğrudan 5432 IPv4 erişilemeyebilir.",
    )
    database_echo: bool = Field(default=False, validation_alias="DATABASE_ECHO")

    redis_url: str = Field(
        default="",
        validation_alias="REDIS_URL",
        description="rediss:// için ssl_cert_reqs yoksa otomatik CERT_NONE eklenir.",
    )
    celery_broker_url: str = Field(default="", validation_alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="", validation_alias="CELERY_RESULT_BACKEND")

    secret_key: str = Field(default="", validation_alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", validation_alias="ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=10080,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )

    cors_origins: str = Field(default="", validation_alias="CORS_ORIGINS")

    clerk_secret_key: str = Field(default="", validation_alias="CLERK_SECRET_KEY")
    clerk_webhook_secret: str = Field(default="", validation_alias="CLERK_WEBHOOK_SECRET")
    clerk_jwks_url: str = Field(default="", validation_alias="CLERK_JWKS_URL")
    clerk_jwt_issuer: str = Field(default="", validation_alias="CLERK_JWT_ISSUER")

    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="", validation_alias="GEMINI_MODEL")
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")

    api_host: str = Field(default="0.0.0.0", validation_alias="API_HOST")
    api_port: int = Field(default=8000, validation_alias="API_PORT")

    scrape_play_lang: str = Field(default="tr", validation_alias="SCRAPE_PLAY_LANG")
    scrape_play_country: str = Field(default="tr", validation_alias="SCRAPE_PLAY_COUNTRY")
    scrape_app_store_country: str = Field(default="tr", validation_alias="SCRAPE_APP_STORE_COUNTRY")
    scrape_play_sleep_seconds: float = Field(default=1.5, validation_alias="SCRAPE_PLAY_SLEEP_SECONDS")
    scrape_app_store_sleep_seconds: int = Field(default=2, validation_alias="SCRAPE_APP_STORE_SLEEP_SECONDS")
    scrape_app_store_max_pages: int = Field(default=250, validation_alias="SCRAPE_APP_STORE_MAX_PAGES")
    scrape_max_reviews: int = Field(default=5000, validation_alias="SCRAPE_MAX_REVIEWS")
    scrape_play_global_locale_limit: int = Field(
        default=30,
        validation_alias="SCRAPE_PLAY_GLOBAL_LOCALE_LIMIT",
        description="Global Play taramasında kullanılacak azami locale sayısı (hız/kaplama dengesi).",
    )
    scrape_app_store_global_country_limit: int = Field(
        default=30,
        validation_alias="SCRAPE_APP_STORE_GLOBAL_COUNTRY_LIMIT",
        description="Global App Store taramasında kullanılacak azami ülke sayısı (hız/kaplama dengesi).",
    )
    scrape_http_timeout_seconds: float = Field(
        default=60.0,
        validation_alias="SCRAPE_HTTP_TIMEOUT_SECONDS",
        description="Store HTTP istek timeout süresi (saniye). Uzun global taramalarda artırılabilir.",
    )
    scrape_play_sync_timeout_seconds: float = Field(
        default=120.0,
        validation_alias="SCRAPE_PLAY_SYNC_TIMEOUT_SECONDS",
        description=(
            "google-play-scraper senkron çağrıları için asyncio üst zaman aşımı (saniye). "
            "Tek bir shard takılırsa tüm global çekimin kilitlenmesini önler."
        ),
    )
    scrape_requests_per_second: float = Field(
        default=7.0,
        validation_alias="SCRAPE_REQUESTS_PER_SECOND",
        description="Play/App Store HTTP için token-bucket hızı (5–10 önerilir).",
    )

    fetch_approval_disabled: bool = Field(
        default=False,
        validation_alias="FETCH_APPROVAL_DISABLED",
        description="True ise büyük çekimler için yönetici onayı devre dışı (yerel geliştirme).",
    )
    fetch_approval_review_threshold: int = Field(
        default=1000,
        validation_alias="FETCH_APPROVAL_REVIEW_THRESHOLD",
        description="review_limit bu değerden büyükse veya limitsiz (null) ise onay gerekir.",
    )
    telegram_bot_token: str = Field(default="", validation_alias="TELEGRAM_BOT_TOKEN")
    telegram_admin_chat_ids: str = Field(
        default="",
        validation_alias="TELEGRAM_ADMIN_CHAT_IDS",
        description="Virgülle ayrılmış Telegram chat id’leri.",
    )
    public_api_base_url: str = Field(
        default="",
        validation_alias="PUBLIC_API_BASE_URL",
        description="Onay linki için API kökü (örn. https://api.vivindis.com), sondaki / olmadan.",
    )
    external_scraper_apify_token: str = Field(default="", validation_alias="EXTERNAL_SCRAPER_APIFY_TOKEN")
    external_scraper_marketplace_actor: str = Field(
        default="seralifatih/turkish-marketplace-seller-intelligence",
        validation_alias="EXTERNAL_SCRAPER_MARKETPLACE_ACTOR",
        description="Apify actor id for TR marketplace seller intelligence.",
    )
    external_scraper_marketplace_reviews_actor: str = Field(
        default="seralifatih/turkish-e-commerce-review-aggregator",
        validation_alias="EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR",
        description="Apify actor id for TR marketplace product reviews (searchQuery flow).",
    )
    external_scraper_marketplace_review_max_per_product: int = Field(
        default=80,
        validation_alias="EXTERNAL_SCRAPER_MARKETPLACE_REVIEW_MAX_PER_PRODUCT",
        description="Cap passed to review aggregator maxReviewsPerProduct for marketplace pulls.",
    )
    external_scraper_timeout_seconds: int = Field(
        default=120,
        validation_alias="EXTERNAL_SCRAPER_TIMEOUT_SECONDS",
        description="External scraper HTTP timeout in seconds.",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url_field(cls, v: object) -> object:
        if not isinstance(v, str) or not v.strip():
            return v
        return normalize_database_url(v)

    @field_validator("redis_url", "celery_broker_url", "celery_result_backend", mode="before")
    @classmethod
    def normalize_rediss_url_fields(cls, v: object) -> object:
        if not isinstance(v, str) or not v.strip():
            return v
        return normalize_rediss_url(v.strip())

    @field_validator("access_token_expire_minutes", mode="before")
    @classmethod
    def empty_expire_to_default(cls, v: object) -> object:
        if v == "" or v is None:
            return 10080
        return v

    @field_validator("scrape_requests_per_second", mode="before")
    @classmethod
    def empty_scrape_rps_to_default(cls, v: object) -> object:
        if v == "" or v is None:
            return 7.0
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
