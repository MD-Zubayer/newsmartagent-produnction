import requests
import logging

logger = logging.getLogger('aiAgent')

class MetaService:
    @staticmethod
    def send_message(access_token, recipient_id, message_text, quick_replies=None, msg_type='text', media_url=None, buttons=None, elements=None):
        """
        Send a direct message on Messenger/Instagram via Send API (Supports Text, Audio, Image, Video, File attachments, Button Templates, and Generic Templates)
        """
        if elements:
            return MetaService.send_generic_template(access_token, recipient_id, elements)

        url = f"https://graph.facebook.com/v21.0/me/messages?access_token={access_token}"
        
        # Meta supports attachment types: audio, image, video, file
        mapped_type = msg_type
        if mapped_type not in ['audio', 'image', 'video', 'file']:
            mapped_type = 'file'  # fallback if some other media type is passed

        if buttons:
            clean_buttons = []
            for btn in buttons:
                b_type = btn.get('type', 'web_url')
                b_obj = {
                    "type": b_type,
                    "title": str(btn.get('title') or 'View').strip()[:20]
                }
                if b_type == 'web_url':
                    b_obj["url"] = btn.get('url')
                    b_obj["webview_height_ratio"] = btn.get('webview_height_ratio', 'full')
                    if 'messenger_extensions' in btn:
                        b_obj['messenger_extensions'] = bool(btn['messenger_extensions'])
                elif b_type == 'postback':
                    b_obj["payload"] = str(btn.get('payload') or 'PAYLOAD')
                clean_buttons.append(b_obj)

            message_payload = {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": message_text,
                        "buttons": clean_buttons
                    }
                }
            }
        elif msg_type != 'text' and media_url:
            message_payload = {
                "attachment": {
                    "type": mapped_type,
                    "payload": {
                        "url": media_url,
                        "is_reusable": True
                    }
                }
            }
        else:
            message_payload = {"text": message_text}
            if quick_replies:
                message_payload["quick_replies"] = quick_replies

        payload = {
            "recipient": {"id": recipient_id},
            "message": message_payload
        }
        
        try:
            logger.info(f"[MetaService] Direct Graph API message send to recipient: {recipient_id} | Type: {msg_type}")
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                logger.info(f"[MetaService] Direct Graph API message send OK to {recipient_id}")
                return True
            logger.error(f"[MetaService] Error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[MetaService] Exception: {e}")
            return False

    @staticmethod
    def send_generic_template(access_token, recipient_id, elements, image_aspect_ratio="square", quick_replies=None):
        """
        Send a Generic Template (Image Cards / Horizontal Carousel with Buttons)
        on Messenger / Instagram via Graph Send API.
        
        Meta limits:
        - elements: 1-10 items
        - title: max 80 chars
        - subtitle: max 80 chars
        - buttons: max 3 per element (title max 20 chars)
        - image_aspect_ratio: 'square' (1:1, full picture) or 'horizontal' (1.91:1)
        - quick_replies: optional list of quick reply pill objects
        """
        if not elements:
            return False

        url = f"https://graph.facebook.com/v21.0/me/messages?access_token={access_token}"

        sanitized_elements = []
        for el in elements[:10]:
            title = str(el.get('title') or 'Product').strip()[:80]
            clean_el = {"title": title}
            if el.get('subtitle'):
                clean_el["subtitle"] = str(el.get('subtitle')).strip()[:80]
            if el.get('image_url'):
                clean_el["image_url"] = str(el.get('image_url')).strip()
            if el.get('default_action') and isinstance(el.get('default_action'), dict):
                def_action = dict(el.get('default_action'))
                if def_action.get('type') == 'web_url':
                    def_action.setdefault('webview_height_ratio', 'full')
                    if 'messenger_extensions' not in def_action:
                        def_action['messenger_extensions'] = False
                clean_el["default_action"] = def_action

            raw_buttons = el.get('buttons') or []
            if raw_buttons and isinstance(raw_buttons, list):
                clean_buttons = []
                for btn in raw_buttons[:3]:
                    b_type = btn.get('type', 'web_url')
                    b_title = str(btn.get('title') or 'View').strip()[:20]
                    b_obj = {
                        "type": b_type,
                        "title": b_title
                    }
                    if b_type == 'web_url':
                        b_obj["url"] = btn.get('url')
                        b_obj["webview_height_ratio"] = btn.get('webview_height_ratio', 'full')
                        if 'messenger_extensions' in btn:
                            b_obj['messenger_extensions'] = bool(btn['messenger_extensions'])
                    elif b_type == 'postback':
                        b_obj["payload"] = str(btn.get('payload') or 'PAYLOAD')
                    clean_buttons.append(b_obj)
                if clean_buttons:
                    clean_el["buttons"] = clean_buttons

            sanitized_elements.append(clean_el)

        message_obj = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "image_aspect_ratio": image_aspect_ratio,
                    "elements": sanitized_elements
                }
            }
        }
        if quick_replies:
            message_obj["quick_replies"] = quick_replies

        payload = {
            "recipient": {"id": str(recipient_id)},
            "message": message_obj
        }

        try:
            logger.info(f"[MetaService] Direct Graph API generic template send to recipient: {recipient_id} | Elements: {len(sanitized_elements)}")
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                logger.info(f"[MetaService] Direct Graph API generic template send OK to {recipient_id}")
                return True
            logger.error(f"[MetaService] Generic template error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[MetaService] Generic template exception: {e}")
            return False

    @staticmethod
    def send_comment_reply(access_token, comment_id, message_text):
        """
        Reply to a public comment on Facebook/Instagram via Graph API
        """
        url = f"https://graph.facebook.com/v21.0/{comment_id}/replies?access_token={access_token}"
        payload = {
            "message": message_text
        }
        try:
            logger.info(f"[MetaService] Direct Graph API comment reply to comment: {comment_id}")
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                return True
            logger.error(f"[MetaService] Error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[MetaService] Exception: {e}")
            return False
