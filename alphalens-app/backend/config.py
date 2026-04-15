from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://alphalens:alphalens_secret@localhost:5432/alphalens"
    SECRET_KEY: str = "change_me_in_production"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    APP_NAME: str = "AlphaLens PE"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Auto-fix: Render provides postgresql:// or postgres:// but asyncpg needs postgresql+asyncpg://
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            object.__setattr__(self, "DATABASE_URL",
                url.replace("postgres://", "postgresql+asyncpg://", 1))
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            object.__setattr__(self, "DATABASE_URL",
                url.replace("postgresql://", "postgresql+asyncpg://", 1))

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
