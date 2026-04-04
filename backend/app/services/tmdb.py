"""TMDB API client for movie/TV show search and details."""

import httpx

from app.config import settings


class TMDBService:
    """Thin wrapper around the TMDB v3 REST API."""

    def __init__(self) -> None:
        self.base_url = settings.tmdb_base_url
        self.api_key = settings.tmdb_api_key
        self.image_base_url = settings.tmdb_image_base_url
        self._verify_ssl = settings.tmdb_verify_ssl

    def _client(self) -> httpx.AsyncClient:
        """Create an httpx client with appropriate SSL settings."""
        return httpx.AsyncClient(verify=self._verify_ssl)

    def _params(self, **kwargs: object) -> dict:
        """Merge API key into query params."""
        return {"api_key": self.api_key, **kwargs}

    async def search_multi(self, query: str, page: int = 1) -> dict:
        """Search for movies and TV shows by query string."""
        async with self._client() as client:
            resp = await client.get(
                f"{self.base_url}/search/multi",
                params=self._params(query=query, page=page, include_adult=False),
            )
            resp.raise_for_status()
            return resp.json()

    async def get_movie(self, movie_id: int) -> dict:
        """Get movie details by TMDB ID."""
        async with self._client() as client:
            resp = await client.get(
                f"{self.base_url}/movie/{movie_id}",
                params=self._params(),
            )
            resp.raise_for_status()
            return resp.json()

    async def get_tv(self, tv_id: int) -> dict:
        """Get TV show details by TMDB ID."""
        async with self._client() as client:
            resp = await client.get(
                f"{self.base_url}/tv/{tv_id}",
                params=self._params(),
            )
            resp.raise_for_status()
            return resp.json()

    def poster_url(self, poster_path: str | None, size: str = "w500") -> str | None:
        """Build a full poster image URL from a TMDB path."""
        if not poster_path:
            return None
        return f"{self.image_base_url}/{size}{poster_path}"


tmdb_service = TMDBService()
