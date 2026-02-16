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

    # ৩. কি-ওয়ার্ড চেক
    keywords = ['অর্ডার', 'order', 'ঠিকানা', 'address', 'নাম', 'phone', 'ফোন', 'বিকাশ', 'কনফার্ম']
    has_keywords = any(word in current_text.lower() for word in keywords)

    # ৪. মেসেজ কাউন্ট
    msg_count = Message.objects.filter(conversation__agentAi=agent_config, conversation__contact_id=sender).count()

    should_call_extractor = False
    
    # --- নতুন কন্ডিশন: মেসেজটা অন্তত ১০ অক্ষরের হতে হবে পিরিওডিক আপডেটের জন্য ---
    is_long_enough = len(current_text.strip()) > 10

    # লজিক
    if has_keywords:
        should_call_extractor = True
        print("Keyword detected! Updating memory instantly...")
    
    elif is_long_enough: # ছোট মেসেজ (যেমন: hi, ok) হলে পিরিওডিক চেক স্কিপ করবে
        if has_full_info:
            if msg_count > 0 and msg_count % 20 == 0:
                should_call_extractor = True
                print("Full info exists. Periodic 20-msg update...")
        else:
            if msg_count > 0 and msg_count % 5 == 0:
                should_call_extractor = True
                print("Information missing. Periodic 5-msg update...")
    else:
        print(f"Message too short ({len(current_text)} chars). Skipping periodic update.")

    # --- এক্সট্রাক্টর প্রসেস শুরু ---
    if should_call_extractor:
        # এখানে order_by('-sent_at') দিলে আপনি লেটেস্ট ৬টি পাবেন
        recent_chat = Message.objects.filter(
            conversation__agentAi=agent_config,
            conversation__contact_id=sender,
        ).order_by('-sent_at')[:6]

        # যেহেতু ডাটাবেস থেকে উল্টো এসেছে, তাই reversed() দিয়ে সোজা করা হলো
        chat_history = "\n".join([
            f"{'User' if m.role == 'user' else 'AI'}: {m.content}"
            for m in reversed(recent_chat)
        ])

        try:
            print(">>> Starting Extraction...")
            extract_and_update_memory(agent_config, sender, chat_history)
        except Exception as e:
            print(f"Memory update failed: {str(e)}")