from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ncbi_email: str = "demo@example.com"
    ncbi_tool: str = "biolit-lens"
    ncbi_api_key: str | None = None
    unpaywall_email: str | None = None
    frontend_origin: str = "http://localhost:5173"
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

