# aiAgent/memory_handler.py
from chat.models import Message
from aiAgent.models import UserMemory
from aiAgent.memory_service import extract_and_update_memory

def handle_smart_memory_update(agent_config, sender, current_text):
    # ১. মেমোরি আনা
    memory, created = UserMemory.objects.get_or_create(ai_agent=agent_config, sender_id=sender)
    memory_data = memory.data or {}

    # ২. গুরুত্বপূর্ণ ফিল্ড চেক
    important_fields = ['name', 'address', 'phone', 'location']
    has_full_info = all(memory_data.get(field) for field in important_fields)

    # ৩. কি-ওয়ার্ড চেক (আরো গুরুত্বপূর্ণ কি-ওয়ার্ড যোগ করা হলো)
    keywords = [
        'অর্ডার', 'order', 'ঠিকানা', 'address', 'নাম', 'phone', 'ফোন', 'বিকাশ', 'কনফার্ম',
        'পছন্দ', 'প্রয়োজন', 'অসুবিধা', 'আগের বার', 'হবে না', 'চাই', 'লাগবে', 'নিবো',
        'prefer', 'need', 'issue', 'last time', 'want', 'buy', 'airport', 'location'
    ]
    has_keywords = any(word in current_text.lower() for word in keywords)

    # ৪. মেসেজ কাউন্ট
    msg_count = Message.objects.filter(conversation__agentAi=agent_config, conversation__contact_id=sender).count()

    should_call_extractor = False
    
    # পিরিওডিক আপডেটের জন্য মেসেজটা অন্তত ১০ অক্ষরের হতে হবে
    is_long_enough = len(current_text.strip()) > 10

    # লজিক
    if has_keywords:
        should_call_extractor = True
        print(f"🚀 [Smart Memory] Keyword detected in message: '{current_text[:20]}...'. Triggering extraction.")
    
    elif is_long_enough: 
        if has_full_info:
            if msg_count > 0 and msg_count % 15 == 0: # ২০ থেকে কমিয়ে ১৫ করা হলো
                should_call_extractor = True
                print("Full info exists. Periodic 15-msg intelligence sync...")
        else:
            if msg_count > 0 and msg_count % 5 == 0:
                should_call_extractor = True
                print("Strategic info missing. Periodic 5-msg extraction...")

    # --- এক্সট্রাক্টর প্রসেস শুরু ---
    if should_call_extractor:
        # লেটেস্ট ১০টি মেসেজ নেয়া হচ্ছে গভীরতর কন্টেক্সটের জন্য
        recent_chat = Message.objects.filter(
            conversation__agentAi=agent_config,
            conversation__contact_id=sender,
        ).order_by('-sent_at')[:10]

        chat_history = "\n".join([
            f"{'User' if m.role == 'user' else 'AI'}: {m.content}"
            for m in reversed(recent_chat)
        ])

        try:
            print(f"🧠 >>> Deepening Intelligence for {sender}...")
            extract_and_update_memory(agent_config, sender, chat_history)
        except Exception as e:
            print(f"Intelligence sync failed: {str(e)}")