import os
import subprocess
from pathlib import Path
import datetime
import sys
import time
import shutil

# ===== CONFIG =====
BASE_DIR = Path(__file__).resolve().parent
BACKUP_DIR = BASE_DIR / "files"
RESTORE_BACKUP_DIR = BACKUP_DIR / "restore_backup"
RESTORE_BACKUP_DIR.mkdir(parents=True, exist_ok=True)

DB_CONTAINER = "newsmartagent-db"
REDIS_CONTAINER = "newsmartagent-redis"
N8N_CONTAINER = "newsmartagent-n8n"

PROD_MEDIA = BASE_DIR / "media_volume"
PROD_N8N = BASE_DIR / "production_n8n_data"

DB_NAME = "new_smart_db"
DB_USER = "zubayer"
DB_PASS = "mypassword"

RETENTION_DAYS = 7
LOG_FILE = BASE_DIR / f"restore_log_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt"

def log(msg):
    print(msg)
    with open(LOG_FILE, "a") as f:
        f.write(msg + "\n")

def run(cmd, check=True):
    log(f"🔹 Running: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}")

def wait_for_postgres(container, user, db, timeout=60):
    log(f"⏳ Waiting for Postgres container {container} to be ready...")
    start = time.time()
    while True:
        result = subprocess.run(
            f'docker exec -i {container} psql -U {user} -d {db} -c "\\q"',
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if result.returncode == 0:
            log("✅ Postgres is ready!")
            break
        if time.time() - start > timeout:
            raise TimeoutError("❌ Postgres did not become ready in time!")
        time.sleep(1)

def backup_folder(folder_path: Path):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_file = RESTORE_BACKUP_DIR / f"{folder_path.name}_backup_{timestamp}.tar.gz"
    if folder_path.exists():
        run(f"tar -czf {backup_file} -C {folder_path.parent} {folder_path.name}")
        log(f"✅ Backup of {folder_path} saved as {backup_file.name}")
    else:
        log(f"⚠️ Folder {folder_path} does not exist, skipping backup.")

def cleanup_old_backups():
    now = datetime.datetime.now()
    for file in BACKUP_DIR.iterdir():
        if file.is_file() and file.suffix in ['.tar.gz', '.dump']:
            age_days = (now - datetime.datetime.fromtimestamp(file.stat().st_mtime)).days
            if age_days > RETENTION_DAYS:
                file.unlink()
                log(f"🗑 Deleted old backup: {file.name}")

def rollback():
    log("\n♻️ Rolling back from restore_backup...")
    for item in RESTORE_BACKUP_DIR.iterdir():
        dest = BASE_DIR / item.name.replace("_backup_", "")
        if dest.exists():
            shutil.rmtree(dest)
        run(f"tar -xzf {item} -C {BASE_DIR}")
        log(f"♻️ Rolled back {dest.name}")

try:
    # 0️⃣ Backup production volumes before restore
    log("\n0️⃣ Backup production volumes before restore")
    backup_folder(PROD_MEDIA)
    backup_folder(PROD_N8N)

    # 1️⃣ Restore Postgres (main data)
    log("\n1️⃣ Restoring Postgres")
    backups = sorted(BACKUP_DIR.glob("postgres_*.dump"), reverse=True)
    if not backups:
        raise FileNotFoundError("❌ No Postgres backup found")
    latest_pg = backups[0]
    run(f"docker cp {latest_pg} {DB_CONTAINER}:/dump.dump")
    wait_for_postgres(DB_CONTAINER, DB_USER, DB_NAME)
    run(f"docker exec -i {DB_CONTAINER} pg_restore -U {DB_USER} -d {DB_NAME} --no-owner --clean --if-exists /dump.dump || echo '⚠️ Warnings occurred'")
    log("✅ Postgres restored")

    # 2️⃣ Restore Media
    log("\n2️⃣ Restoring Media")
    media_backups = sorted(BACKUP_DIR.glob("media_*.tar.gz"), reverse=True)
    if media_backups:
        PROD_MEDIA.mkdir(parents=True, exist_ok=True)
        run(f"rm -rf {PROD_MEDIA}/*")
        run(f"tar -xzf {media_backups[0]} -C {PROD_MEDIA.parent}")
        log("✅ Media restored")

    # 3️⃣ Prepare n8n for Postgres (skip SQLite restore)
    log("\n3️⃣ Preparing n8n for Postgres")
    if PROD_N8N.exists():
        run(f"rm -rf {PROD_N8N}/*")  # wipe old SQLite files
    PROD_N8N.mkdir(parents=True, exist_ok=True)
    log("✅ n8n volume cleaned. Will use Postgres on next start.")

    # 4️⃣ Restore Redis (auto detect RDB + AOF)
    log("\n4️⃣ Restoring Redis (live)")
    redis_backups = sorted(BACKUP_DIR.glob("redis_*.tar.gz"), reverse=True)
    if redis_backups:
        run(f"tar -xzf {redis_backups[0]} -C {BACKUP_DIR}")
        redis_file = None
        for f in BACKUP_DIR.iterdir():
            if f.suffix in [".rdb", ".aof"]:
                redis_file = f
                break
        if redis_file:
            run(f"docker cp {redis_file} {REDIS_CONTAINER}:/data/{redis_file.name}")
            run(f"docker restart {REDIS_CONTAINER}")
            log(f"✅ Redis restored ({redis_file.name})")
        else:
            log("⚠️ No Redis RDB/AOF file found, skipping restore")

    # 5️⃣ Cleanup old backups
    log("\n5️⃣ Cleaning up old backups")
    cleanup_old_backups()

    log("\n✅ Full production backup & restore completed successfully!")
    log("ℹ️ n8n will now start in Postgres mode, setup page will not appear.")

except Exception as e:
    log(f"\n🔥 Restore failed: {e}")
    rollback()
    sys.exit(1)