from pathlib import Path

from pydantic_settings import BaseSettings

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/postgres"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RATE_LIMIT_WINDOW: int = 900
    MAX_FAILED_ATTEMPTS: int = 5
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {"env_file": str(_env_path), "env_file_encoding": "utf-8"}


settings = Settings()
