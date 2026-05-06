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
    scrape_max_reviews: int = Field(default=5000, validation_alias="SCRAPE_MAX_REVIEWS")
    scrape_requests_per_second: float = Field(
        default=7.0,
        validation_alias="SCRAPE_REQUESTS_PER_SECOND",
        description="Play/App Store HTTP için token-bucket hızı (5–10 önerilir).",
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
