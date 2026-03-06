import time
import subprocess

def wait_for_postgres(container, user, db, timeout=30):
    print(f"⏳ Waiting for Postgres ({container}) to be ready...")
    start = time.time()
    while True:
        try:
            result = subprocess.run(
                f'docker exec -i {container} psql -U {user} -d {db} -c "\q"',
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            if result.returncode == 0:
                print("✅ Postgres is ready!")
                break
        except Exception:
            pass

        if time.time() - start > timeout:
            raise TimeoutError("❌ Postgres did not become ready in time!")
        time.sleep(1)