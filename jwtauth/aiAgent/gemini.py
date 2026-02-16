# aiAgent/gemini.py
from google import genai
from google.genai import types
from django.conf import settings
from aiAgent.utils import count_gemini_tokens



client = genai.Client(api_key=settings.GEMINI_API_KEY)



def generate_reply(system_prompt, messages, agent_config):

    model_name = agent_config.ai_model if 'gemini' in agent_config.ai_model else 'models/gemini-2.5-flash'


    formatted_history = []
    for m in messages:
        # prompt += f'{m['role']}: {m['content']}\n'
        role = 'model' if m['role'] == 'assistant' else 'user'
        formatted_history.append({
            'role': role,
            'parts': [{'text': m['content']}]
        })
        
        
    safety_settings = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]
    
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=formatted_history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=agent_config.temperature or 0.7,
                max_output_tokens=agent_config.max_tokens or 500,
                safety_settings=safety_settings,
                candidate_count=1
            )
        )
        finish_reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
        
        if response.text:
            reply = response.text.strip()
            
            input_tokens = response.usage_metadata.prompt_token_count or 0
            output_tokens = response.usage_metadata.candidates_token_count or 0
            total_tokens = input_tokens + output_tokens
            
            print(f"Gemini Finish Reason: {finish_reason}")
            if response.candidates[0].finish_reason == 'SAFETY':
                print("WARNING: Gemini stopped due to Safety Filters!")
                
            print(f"Gemini Output Tokens: {output_tokens}")

            print(f"Gemini Input:  {input_tokens}")
            print(f"Gemini output: {output_tokens}")
            print(f"Gemini total_tokens: {total_tokens}")
            # return reply, total_tokens
            return {
                "reply": reply,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "model_name": model_name,
                "status": "success"
            }
        else:
            # return "Sorry, I didn't understand.", 0
            return {
                "reply": "Sorry, I didn't understand.",
                "total_tokens": 0,
                "status": "empty"
            }
                  
    except Exception as e:

        print(f'Gemini API Error: {str(e)}')
        return {
            "reply": "The system is experiencing some problems, please try again later.",
            "total_tokens": 0,
            "status": "error",
            "error_message": str(e)
        }

            



