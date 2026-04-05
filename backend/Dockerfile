FROM python:3.12-slim

WORKDIR /app

# Install CA certs for HTTPS (TMDB API) and Poetry
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir poetry \
    && poetry config virtualenvs.create false

# Use system CA certs (certifi bundle inside the image can be stale)
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Install dependencies first for layer caching
COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-interaction --no-ansi

# Copy application code
COPY . .

# Create data directory for SQLite (volume-mounted at /app/data)
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
