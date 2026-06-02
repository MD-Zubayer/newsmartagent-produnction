#!/bin/bash

# ─── Baileys Session Reset Script ───────────────────────────────────────────
# এই স্ক্রিপ্ট সব Baileys সেশন ফাইল রিমুভ করে এবং কন্টেইনার রিস্টার্ট করে।
# Bad MAC Error ফিক্স করার জন্য ব্যবহার করুন।

echo "🔄 [Baileys] Starting session reset..."
echo ""

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTH_DIR="$ROOT_DIR/auth_info_baileys"

# ১. সব auth_info ফাইল ডিলিট করা
if [ -d "$AUTH_DIR" ]; then
    echo "🗑️  [Baileys] Removing corrupted auth_info_baileys folder at $AUTH_DIR..."
    rm -rf "$AUTH_DIR"
    sleep 1
    mkdir -p "$AUTH_DIR"
    echo "✅ [Baileys] auth_info_baileys cleaned"
else
    echo "ℹ️  [Baileys] No auth_info_baileys folder found at $AUTH_DIR, creating new one..."
    mkdir -p "$AUTH_DIR"
fi

echo ""

# २. Docker compose রিস্টার্ট (যদি Docker চলছে)
if command -v docker-compose &> /dev/null; then
    echo "🔄 [Baileys] Restarting Docker services..."
    docker-compose restart baileys || docker-compose up -d baileys
    sleep 5
    echo "✅ [Baileys] Docker services restarted"
else
    echo "ℹ️  [Baileys] Docker-compose not found. Running Node directly..."
    pkill -f "node.*baileys" || true
    sleep 2
    cd $(dirname "$0")
    node index.js > /tmp/baileys.log 2>&1 &
    echo "✅ [Baileys] Node process started (PID: $!)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 [Baileys] Session reset complete!"
echo ""
echo "📌 Next Steps:"
echo "   1. Baileys QR code সাথে সাথে generate হবে"
echo "   2. স্ক্যান করুন আপনার ফোন থেকে WhatsApp কিউআর সিম্বল দিয়ে"
echo "   3. লগস চেক করুন Bad MAC error আছে কি না"
echo ""
echo "📍 Log Location:"
if command -v docker-compose &> /dev/null; then
    echo "   docker-compose logs -f baileys"
else
    echo "   tail -f /tmp/baileys.log"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
