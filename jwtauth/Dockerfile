FROM python:3.12-slim


RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
    
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app 
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/ 

RUN mkdir -p /app/static /app/media

CMD ["gunicorn", "jwtauth.wsgi:application", "--bind", "0.0.0.0:8000"]
