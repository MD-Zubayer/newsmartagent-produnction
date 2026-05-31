FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    postgresql-client \
    redis-tools \
    wget \
    gnupg \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libegl1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-noto \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
    
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY requirements.txt /app 
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir playwright
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . /app/ 

RUN mkdir -p /app/static /app/media

CMD ["gunicorn", "jwtauth.wsgi:application", "--bind", "0.0.0.0:8000"]
