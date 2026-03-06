import subprocess
import datetime
from pathlib import Path
import sys
import logging

# ===== CONFIG =====
BASE_DIR = Path(__file__).resolve().parent
BACKUP_DIR = BASE_DIR / "files"
LOG_FILE = BASE_DIR / "backup.log"
RETENTION_DAYS = 7

POSTGRES_CONTAINER = "newsmartagent-db"
DB_NAME = "new_smart_db"
DB_USER = "zubayer"

MEDIA_VOLUME = "newsmartagent-media"
REDIS_VOLUME = "production_redis_data"
N8N_VOLUME = "production_n8n_data"

# ---- Logging Setup ----
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

def log(msg):
    print(msg)
    logging.info(msg)

def run(cmd, check=True):
    log(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if check and result.returncode != 0:
        logging.error(f"Command failed: {cmd}")
        sys.exit(1)

# ---- Start ----
try:
    date_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # 1️⃣ PostgreSQL Dump
    pg_file_host = BACKUP_DIR / f"postgres_{date_str}.dump"
    log("🔹 Creating Postgres dump")
    run(
        f"docker exec -i {POSTGRES_CONTAINER} pg_dump -U {DB_USER} -Fc {DB_NAME} > {pg_file_host}"
    )

    if not pg_file_host.exists() or pg_file_host.stat().st_size == 0:
        raise Exception("❌ Postgres dump is empty!")
    log(f"✅ Postgres backup OK ({pg_file_host.stat().st_size / 1024:.2f} KB)")

    # 2️⃣ Media
    media_file = BACKUP_DIR / f"media_{date_str}.tar.gz"
    run(
        f"docker run --rm -v {MEDIA_VOLUME}:/volume -v {BACKUP_DIR}:/backup alpine "
        f"tar czf /backup/{media_file.name} -C /volume ."
    )

    # 3️⃣ Redis
    redis_file = BACKUP_DIR / f"redis_{date_str}.tar.gz"
    run(
        f"docker run --rm -v {REDIS_VOLUME}:/volume -v {BACKUP_DIR}:/backup alpine "
        f"tar czf /backup/{redis_file.name} -C /volume ."
    )

    # 4️⃣ n8n
    n8n_file = BACKUP_DIR / f"n8n_{date_str}.tar.gz"
    run(
        f"docker run --rm -v {N8N_VOLUME}:/volume -v {BACKUP_DIR}:/backup alpine "
        f"tar czf /backup/{n8n_file.name} -C /volume ."
    )

    log("✅ All backup files created successfully.")

    # 5️⃣ Cleanup old backups
    now = datetime.datetime.now()
    allowed_prefix = ("postgres_", "media_", "redis_", "n8n_")
    for file in BACKUP_DIR.iterdir():
        if file.is_file() and file.name.startswith(allowed_prefix):
            age_seconds = (now - datetime.datetime.fromtimestamp(file.stat().st_mtime)).total_seconds()
            if age_seconds > RETENTION_DAYS * 86400:
                file.unlink()
                log(f"🗑 Deleted old backup: {file.name}")

    log("✅ Cleanup completed. Backup finished successfully.")

except Exception as e:
    logging.error(f"🔥 Backup failed: {e}")
    print(f"\n🔥 Backup failed: {e}")
    sys.exit(1)