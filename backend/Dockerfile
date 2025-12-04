FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for Pillow and building
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       libjpeg62-turbo-dev \
       zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app

# We will switch to appuser at runtime via entrypoint (after ensuring volume perms)
USER root

ENV DJANGO_DEBUG=False

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
