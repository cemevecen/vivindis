"""Ortam değişkenleri — değerler runtime'da process env'den gelir (Docker Compose ile enjekte edilir)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Tüm backend yapılandırması env üzerinden."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = Field(default="", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    database_url: str = Field(default="", validation_alias="DATABASE_URL")
    database_echo: bool = Field(default=False, validation_alias="DATABASE_ECHO")

    redis_url: str = Field(default="", validation_alias="REDIS_URL")
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

    @field_validator("access_token_expire_minutes", mode="before")
    @classmethod
    def empty_expire_to_default(cls, v: object) -> object:
        if v == "" or v is None:
            return 10080
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
