import logging
import json
from django.conf import settings
from google import genai
from google.genai import types

logger = logging.getLogger('aiAgent')

try:
    GENAI_CLIENT = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize GenAI client for payment verification: {e}")
    GENAI_CLIENT = None


def verify_payment_screenshot(image_bytes, mime_type):
    """
    Sends payment screenshot bytes to Gemini to verify if it represents a successful
    payment/send-money transaction. Extracts amount, transaction_id, and payment_method.
    """
    if not GENAI_CLIENT:
        logger.error("GenAI client is not configured.")
        return {"status": "error", "reason": "AI client not initialized"}

    model_name = 'models/gemini-3.1-flash-lite'
    prompt = """
    Analyze this transaction receipt/screenshot from a mobile financial service in Bangladesh (e.g. bKash, Nagad, Rocket, Upay) or bank transfer receipt.
    Extract the following information and return ONLY a valid JSON object:
    {
      "status": "success" | "failed" | "unknown",
      "amount": float or null,
      "transaction_id": "string" or null,
      "payment_method": "bkash" | "nagad" | "rocket" | "bank" | "unknown",
      "reason": "string describing why it failed or why details are unclear"
    }
    
    Ensure the screenshot represents a successful "Send Money", "Payment", or "Transfer" transaction. 
    If the transaction is pending, failed, or the screenshot represents an input screen/amount input page instead of a successful receipt, set status to "failed".
    If the transaction ID or amount is not readable, set status to "unknown".
    Do not include any markup, backticks (like ```json), preamble, or explanation outside the JSON. Return only the JSON string.
    """

    try:
        response = GENAI_CLIENT.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                ),
                prompt
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1000
            )
        )
        
        raw_text = response.text.strip() if response.text else ""
        logger.info(f"Gemini payment verification raw reply: {raw_text}")
        
        # Clean potential markdown backticks in response
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()
            
        data = json.loads(raw_text)
        return data
    except Exception as e:
        logger.error(f"Error calling Gemini for payment verification: {e}")
        return {"status": "error", "reason": str(e)}
