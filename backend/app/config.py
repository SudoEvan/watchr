"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All config is loaded from environment variables or .env file."""

    # Application
    app_name: str = "watchr"
    app_env: str = "development"
    app_debug: bool = True

    # Backend
    backend_host: str = "0.0.0.0"  # noqa: S104
    backend_port: int = 8000
    backend_cors_origins: list[str] = ["http://localhost:5173"]

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/watchr.db"

    # Auth / JWT
    jwt_secret_key: str = "CHANGE_ME_GENERATE_A_REAL_SECRET"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # TMDB
    tmdb_api_key: str = ""
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    tmdb_image_base_url: str = "https://image.tmdb.org/t/p"
    tmdb_verify_ssl: bool = True

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
