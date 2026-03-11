# aiAgent/gemini.py
from google import genai
from google.genai import types
from django.conf import settings
from aiAgent.utils import count_gemini_tokens



client = genai.Client(api_key=settings.GEMINI_API_KEY)



def generate_gemini_reply(system_prompt, messages, agent_config):

    model_name = agent_config.ai_model if 'gemini' in agent_config.ai_model else 'models/gemini-2.0-flash'

    formatted_history = []

    # 1️⃣ Always push current prompt as USER message
    formatted_history.append({
        "role": "user",
        "parts": [{"text": system_prompt}]
    })

    # 2️⃣ Add previous chat history
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        formatted_history.append({
            "role": role,
            "parts": [{"text": m["content"]}]
        })

    # 🚨 Safety guard
    if not formatted_history:
        return {
            "reply": "System error. Empty prompt.",
            "total_tokens": 0,
            "status": "error"
        }

    safety_settings = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]

    try:
        max_token = int(agent_config.max_tokens) if agent_config.max_tokens else 500
    except:
        max_token = 500

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=formatted_history,
            config=types.GenerateContentConfig(
                temperature=agent_config.temperature or 0.7,
                max_output_tokens=max_token,
                safety_settings=safety_settings,
                candidate_count=1
            )
        )

        reply = response.text.strip() if response.text else ""

        input_tokens = response.usage_metadata.prompt_token_count or 0
        output_tokens = response.usage_metadata.candidates_token_count or 0
        total_tokens = input_tokens + output_tokens

        return {
            "reply": reply or "Sorry, I didn't understand.",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": model_name,
            "status": "success" if reply else "empty"
        }

    except Exception as e:
        print(f'Gemini API Error: {str(e)}')
        return {
            "reply": "The system is experiencing some problems, please try again later.",
            "total_tokens": 0,
            "status": "error",
            "error_message": str(e)
        }

            
def generate_quick_summary(raw_text):
    try:
        model_name = 'models/gemini-2.5-flash'

        prompt = f"""Summarize the following Facebook post in maximum 3 short sentences.
                Rules:
                - Keep all key points.
                - Keep total length under 60-80 words.
                - No opinion.
                - No extra explanation.
                - Simple and clear language.
                Post: {raw_text}"""

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=600
            )
        )

        if response.text:
            summary = response.text.strip()
            print(f"✅ Summary Generated Successfully: {summary[:50]}...")
            return summary
        return None
    except Exception as e:
        print(f'Summary Generation Error: {str(e)}')
        return None



def generate_dashboard_help(user_query, page_context, chat_history=[]):
    """
    ড্যাশবোর্ড ইউজারদের প্রশ্নের উত্তর দেওয়ার জন্য বিশেষ ফাংশন।
    """
    model_name = 'models/gemini-2.5-flash' # আপনার লগের কোটা অনুযায়ী 1.5-flash ও দিতে পারেন
    
    # সিস্টেম প্রম্পট যা AI-কে আপনার ড্যাশবোর্ড বিশেষজ্ঞ বানাবে
    system_prompt = f"""
Role: Smart Professional Assistant.
Context: {page_context}
Language: Bengali.

Instruction:
- ইউজার তার একাউন্ট বা ড্যাশবোর্ড সম্পর্কিত তথ্য জানতে চাইলে "ইউজারের লাইভ ডাটা" অংশটি থেকে উত্তর দিন।
- লাইভ ডাটাতে যা নেই, সেটি নিয়ে অনুমান করে কোনো সংখ্যা বা তথ্য দেবেন না।
- তথ্য না থাকলে বিনীতভাবে বলুন যে আপনি এই মুহূর্তে সেটি দেখতে পাচ্ছেন না।
"""

    formatted_history = []
    
    # ১. সিস্টেম ইনস্ট্রাকশন সেট করা
    # নতুন SDK-তে contents এর বদলে config এও system_instruction দেওয়া যায়
    
    # ২. হিস্ট্রি ফরম্যাট করা
    for m in chat_history:
        role = "model" if m["role"] == "assistant" else "user"
        formatted_history.append({"role": role, "parts": [{"text": m["content"]}]})
    
    # ৩. বর্তমান প্রশ্ন যুক্ত করা
    formatted_history.append({"role": "user", "parts": [{"text": user_query}]})

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=formatted_history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt, # এখানে ইনস্ট্রাকশন দেওয়া সবচেয়ে কার্যকর
                temperature=0.3, # ড্যাশবোর্ড হেল্পের জন্য ক্রিয়েটিভিটি কম, একুরেসি বেশি দরকার
                max_output_tokens=200,
            )
        )

        reply = response.text.strip() if response.text else ""
        
        return {
            "reply": reply or "দুঃখিত, আমি বুঝতে পারছি না।",
            "total_tokens": response.usage_metadata.total_token_count or 0,
            "status": "success"
        }

    except Exception as e:
        print(f'Dashboard AI Error: {str(e)}')
        return {
            "reply": "সার্ভারে সমস্যা হচ্ছে, অনুগ্রহ করে একটু পরে চেষ্টা করুন।",
            "status": "error"
        }