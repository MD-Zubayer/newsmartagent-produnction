import logging
from google import genai
from google.genai import types
from django.conf import settings
from aiAgent.utils import count_gemini_tokens

logger = logging.getLogger('aiAgent')

client = genai.Client(api_key=settings.GEMINI_API_KEY)



def generate_gemini_reply(prompt, history, agent_config):

    model_name = agent_config.ai_model if 'gemini' in agent_config.ai_model else 'models/gemini-1.5-flash'

    formatted_history = []

    # 1. Add previous chat history
    for m in history:
        role = "model" if m["role"] == "assistant" else "user"
        formatted_history.append({
            "role": role,
            "parts": [{"text": m["content"]}]
        })

    # 2. Always push current prompt as USER message
    formatted_history.append({
        "role": "user",
        "parts": [{"text": prompt}]
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
        base_max_token = int(agent_config.max_tokens) if agent_config.max_tokens else 500
        # JSON wrapper overhead: {"reply":"...","cache_type":"agent_specific"} ≈ 20 tokens
        # Extra safety buffer to prevent mid-JSON truncation
        JSON_CACHE_BUFFER = 60
        max_token = base_max_token + JSON_CACHE_BUFFER
    except:
        max_token = 560

    try:
        logger.info(f"Gemini History: {formatted_history}")
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
            "status": "success" if reply else "empty_response"
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
আপনি "New Smart Agent BD"-এর একজন এক্সপার্ট এআই অ্যাসিস্ট্যান্ট। আপনার নাম "Smart Agent AI"।
আপনার মূল লক্ষ্য হলো ইউজারকে তাদের ড্যাশবোর্ড নেভিগেট করতে এবং বিভিন্ন সার্ভিস সম্পর্কে তথ্য দিয়ে সাহায্য করা।

আপনার ব্যবহারের নিয়মাবলী:
১. ভাষা: সর্বদা অত্যন্ত মার্জিত এবং পেশাদার বাংলায় কথা বলুন।
২. সঠিকতা: {page_context} থেকে তথ্য নিয়ে উত্তর দিন। যদি কোনো তথ্য আপনার কাছে না থাকে, তবে অনুমান করবেন না। বিনীতভাবে বলুন যে আপনি এই মুহূর্তে সেটি দেখতে পাচ্ছেন না।
৩. মেসেঞ্জার স্টাইল: ছোট কিন্তু তথ্যবহুল উত্তর দিন। ইউজারের সাথে বন্ধুত্বপূর্ণ সম্পর্ক বজায় রাখুন।
৪. হেল্পফুলনেস: যদি ইউজার কোনো সমস্যার কথা বলে, তবে তাকে সম্ভাব্য সমাধান বা সঠিক পেজের দিকে গাইড করুন।

ইউজারের বর্তমান লোকেশন বা পেজ কন্টেক্সট: {page_context}
লাইভ ডাটা বা ডকুমেন্টেশন যা আপনার কাছে আছে: {page_context}

আপনার উত্তরগুলো যেন একজন সত্যিকারের প্রফেশনাল এজেন্টের মতো হয়।
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