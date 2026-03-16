import subprocess
import os
import sys

def run_command(cmd, shell=True):
    print(f"🚀 Running: {cmd}")
    result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False, result.stderr
    return True, result.stdout

def main():
    print("🔄 Starting Automatic Redis Restore...")

    # ১. Django কন্টেইনারের মাধ্যমে ফাইল ডাউনলোড করা
    success, output = run_command("docker exec newsmartagent-django python manage.py restore_redis")
    if not success:
        print("Failed to download backup via Django container.")
        sys.exit(1)

    # ২. ড্রাইভ থেকে ডাউনলোড হওয়া ফাইলের পথ বের করা (এটি সাধারণ jwtauth/temp_restore ফোল্ডারে থাকে)
    # যেহেতু jwtauth ফোল্ডারটি হোস্টের সাথে মাউন্ট করা, আমরা হোস্ট থেকেই ফাইলটি এক্সেস করতে পারি।
    local_backup_path = "./jwtauth/temp_restore/redis_backup_latest.rdb"

    if not os.path.exists(local_backup_path):
        print(f"❌ Error: Backup file not found at {local_backup_path}")
        sys.exit(1)

    # ৩. রেডিস কন্টেইনারে ফাইল কপি করা
    print("📂 Copying backup to Redis container...")
    success, output = run_command(f"docker cp {local_backup_path} newsmartagent-redis:/data/dump.rdb")
    if not success:
        sys.exit(1)

    # ৪. রেডিস কন্টেইনার রিস্টার্ট করা
    print("🔄 Restarting Redis container to load new data...")
    success, output = run_command("docker restart newsmartagent-redis")
    if not success:
        sys.exit(1)

    print("\n✅ Redis Restore Successfully Completed in One Python command!")

if __name__ == "__main__":
    main()
