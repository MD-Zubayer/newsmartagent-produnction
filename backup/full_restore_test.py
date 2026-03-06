import os
import subprocess
import datetime
from pathlib import Path
import sys
import time
import shutil

# ===== CONFIG =====
BASE_DIR = Path(__file__).resolve().parent
BACKUP_DIR = BASE_DIR / "files"
RETENTION_DAYS = 7

POSTGRES_IMAGE = "pgvector/pgvector:pg16"
TEST_DB_CONTAINER = "restore-test-db"
DB_NAME = "testdb"
DB_USER = "testuser"
DB_PASS = "testpass"

MEDIA_VOLUME = "newsmartagent-media"
REDIS_VOLUME = "production_redis_data"
N8N_VOLUME = "production_n8n_data"

# ==================

date_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    print(f"\n🔹 Running: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Failed: {cmd}")
        sys.exit(1)

def wait_for_postgres(container, user, db, timeout=60):
    print(f"⏳ Waiting for Postgres ({container}) to be ready...")
    start = time.time()
    while True:
        result = subprocess.run(
            f'docker exec -i {container} psql -U {user} -d {db} -c "\\q"',
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if result.returncode == 0:
            print("✅ Postgres is ready!")
            break
        if time.time() - start > timeout:
            raise TimeoutError("❌ Postgres did not become ready in time!")
        time.sleep(1)

try:
    # 0️⃣ Clean old test container
    run(f"docker rm -f {TEST_DB_CONTAINER} || true")

    # 1️⃣ Start Postgres test container
    run(f"docker run --name {TEST_DB_CONTAINER} -e POSTGRES_USER={DB_USER} -e POSTGRES_PASSWORD={DB_PASS} -e POSTGRES_DB={DB_NAME} -d {POSTGRES_IMAGE}")

    # Wait for Postgres to be ready
    wait_for_postgres(TEST_DB_CONTAINER, DB_USER, DB_NAME)

    # 2️⃣ Enable extensions inside test container
    run(f'docker exec -i {TEST_DB_CONTAINER} psql -U {DB_USER} -d {DB_NAME} -c "CREATE EXTENSION IF NOT EXISTS vector;"')

    # 3️⃣ Find latest postgres backup
    backups = sorted(BACKUP_DIR.glob("postgres_*.dump"), reverse=True)
    if not backups:
        print("❌ No postgres backup found!")
        sys.exit(1)
    latest_pg = backups[0]
    print(f"📦 Latest postgres backup: {latest_pg.name}")

    # 4️⃣ Copy backup to test container
    run(f"docker cp {latest_pg} {TEST_DB_CONTAINER}:/dump.dump")

    # 5️⃣ Restore database (ignore owner)
    run(f"docker exec -i {TEST_DB_CONTAINER} pg_restore -U {DB_USER} --no-owner -d {DB_NAME} /dump.dump")

    # 6️⃣ Verify tables
    run(f'docker exec -i {TEST_DB_CONTAINER} psql -U {DB_USER} -d {DB_NAME} -c "\\dt"')

    # 7️⃣ Media restore test
    run(f"mkdir -p {BASE_DIR}/test_media")
    media_backups = sorted(BACKUP_DIR.glob("media_*.tar.gz"), reverse=True)
    if media_backups:
        run(f"tar -xzf {media_backups[0]} -C {BASE_DIR}/test_media")
        print(f"✅ Media restored to test_media folder")

    # 8️⃣ Redis restore test
    run(f"mkdir -p {BASE_DIR}/test_redis")
    redis_backups = sorted(BACKUP_DIR.glob("redis_*.tar.gz"), reverse=True)
    if redis_backups:
        run(f"tar -xzf {redis_backups[0]} -C {BASE_DIR}/test_redis")
        print(f"✅ Redis data restored to test_redis folder")

    # 9️⃣ n8n restore test
    run(f"mkdir -p {BASE_DIR}/test_n8n")
    n8n_backups = sorted(BACKUP_DIR.glob("n8n_*.tar.gz"), reverse=True)
    if n8n_backups:
        run(f"tar -xzf {n8n_backups[0]} -C {BASE_DIR}/test_n8n")
        print(f"✅ n8n data restored to test_n8n folder")

    # 🔟 Cleanup old backups
    now = datetime.datetime.now()
    allowed_prefix = ("postgres_", "media_", "redis_", "n8n_")
    for file in BACKUP_DIR.iterdir():
        if file.is_file() and file.name.startswith(allowed_prefix):
            age_days = (now - datetime.datetime.fromtimestamp(file.stat().st_mtime)).days
            if age_days > RETENTION_DAYS:
                file.unlink()
                print(f"🗑 Deleted old backup: {file.name}")

    # 1️⃣1️⃣ Cleanup test container
    run(f"docker rm -f {TEST_DB_CONTAINER} || true")

    print("\n✅ Full backup & restore test completed successfully!")

except Exception as e:
    print(f"\n🔥 Script crashed: {e}")
    sys.exit(1)
    
shutil.rmtree(BASE_DIR / "test_media", ignore_errors=True)
shutil.rmtree(BASE_DIR / "test_redis", ignore_errors=True)
shutil.rmtree(BASE_DIR / "test_n8n", ignore_errors=True)
print("🗑 Test restore folders removed")