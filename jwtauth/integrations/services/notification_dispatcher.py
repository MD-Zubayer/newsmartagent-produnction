"""
Customer Notification Dispatcher
Unified multi-platform outbound customer notification engine.
Handles Messenger, WhatsApp, Instagram, Telegram, and linked customer identities.
"""

import logging
import re
from typing import List, Dict, Any, Optional
from django.db.models import Q

logger = logging.getLogger('aiAgent')


class CustomerNotificationDispatcher:
    """
    Dispatches customer notifications (e.g. order confirmation, courier tracking updates)
    to whichever platform the customer ordered/messaged from, as well as ALL platforms
    linked to their Customer profile (CustomerIdentity).
    """

    @classmethod
    def resolve_customer_channels(cls, order) -> List[Dict[str, Any]]:
        """
        Gathers all unique target messaging channels for a given CustomerOrder.
        Returns a list of dicts: [{'platform': ..., 'identifier': ..., 'agent': ...}]
        """
        channels = []
        seen_keys = set()
        merchant_id = getattr(order, 'user_id', None)

        def _is_valid_identifier(plat: str, ident_str: str) -> bool:
            if not ident_str:
                return False
            clean = str(ident_str).strip().lower()
            if clean in ('demo', 'test', 'unknown', 'none', 'null'):
                return False
            if clean.startswith('shop_cust_') or clean.startswith('temp_'):
                return False
            if plat == 'whatsapp':
                digits = re.sub(r'\D', '', ident_str)
                return len(digits) >= 8 or '@' in ident_str
            if plat in ('messenger', 'instagram'):
                digits = re.sub(r'\D', '', ident_str)
                return len(digits) >= 5
            if plat == 'telegram':
                digits = re.sub(r'\D', '', ident_str)
                return len(digits) >= 4 or ident_str.startswith('@')
            return True

        def _add_channel(platform: str, identifier: str, agent=None, source_label=''):
            if not platform or not identifier:
                return
            clean_platform = str(platform).strip().lower()
            if clean_platform in ('shop', 'web', 'direct', 'unknown', 'facebook_comment', 'web_widget'):
                return
            if clean_platform not in ('messenger', 'whatsapp', 'instagram', 'telegram'):
                return

            clean_id = str(identifier).strip()
            if not _is_valid_identifier(clean_platform, clean_id):
                return

            # Multi-tenant safety: Ensure agent belongs to this merchant
            if agent and merchant_id and getattr(agent, 'user_id', None) != merchant_id:
                return

            # Normalize WhatsApp identifier for deduplication
            norm_id = clean_id
            if clean_platform == 'whatsapp':
                digits = re.sub(r'\D', '', clean_id)
                if len(digits) >= 10:
                    norm_id = digits[-10:]

            dedup_key = (clean_platform, norm_id)
            if dedup_key in seen_keys:
                return

            seen_keys.add(dedup_key)
            channels.append({
                'platform': clean_platform,
                'identifier': clean_id,
                'agent': agent,
                'source': source_label,
            })

        # 1. Direct Contact linked to the order
        if getattr(order, 'contact', None):
            contact = order.contact
            _add_channel(
                platform=getattr(contact, 'platform', None),
                identifier=getattr(contact, 'identifier', None),
                agent=getattr(contact, 'agent', None),
                source_label='order_contact'
            )

        # 2. Source platform & contact ID recorded on order
        source_plat = getattr(order, 'source_platform', None)
        source_cid = getattr(order, 'source_contact_id', None)
        if source_plat and source_cid:
            _add_channel(
                platform=source_plat,
                identifier=source_cid,
                agent=getattr(order.contact, 'agent', None) if getattr(order, 'contact', None) else None,
                source_label='order_source_info'
            )

        # 3. Linked Customer Identities (Unified Profile)
        customer = getattr(order, 'customer', None)
        if not customer and getattr(order, 'contact', None):
            try:
                from storefront.models import CustomerIdentity
                cid = CustomerIdentity.objects.filter(contact=order.contact).select_related('customer').first()
                if cid:
                    customer = cid.customer
            except Exception as e:
                logger.debug(f"[NotificationDispatcher] Customer lookup via contact error: {e}")

        phone_str = str(getattr(order, 'phone_number', '') or '').strip()
        phone_digits = re.sub(r'\D', '', phone_str)

        if not customer and len(phone_digits) >= 10:
            try:
                from storefront.models import Customer
                customer = Customer.objects.filter(primary_phone__endswith=phone_digits[-10:]).first()
            except Exception as e:
                logger.debug(f"[NotificationDispatcher] Customer lookup via phone error: {e}")

        if customer:
            try:
                from storefront.models import CustomerIdentity
                # Only include identities matching this merchant's agent or unassigned
                query = CustomerIdentity.objects.filter(customer=customer)
                if merchant_id:
                    query = query.filter(Q(agent__user_id=merchant_id) | Q(agent__isnull=True))
                identities = query.select_related('agent', 'contact')
                for ident in identities:
                    _add_channel(
                        platform=ident.platform,
                        identifier=ident.platform_user_id,
                        agent=ident.agent or (ident.contact.agent if ident.contact else None),
                        source_label='customer_identity'
                    )
            except Exception as e:
                logger.warning(f"[NotificationDispatcher] Failed reading customer identities for #{customer.id}: {e}")

        # 4. Fallback phone matching across seller's contacts
        if not channels and len(phone_digits) >= 10 and getattr(order, 'user', None):
            try:
                from aiAgent.models import Contact
                matching_contacts = Contact.objects.filter(
                    agent__user=order.user,
                    identifier__endswith=phone_digits[-10:]
                ).select_related('agent')
                for mc in matching_contacts:
                    _add_channel(
                        platform=mc.platform,
                        identifier=mc.identifier,
                        agent=mc.agent,
                        source_label='phone_matched_contact'
                    )
            except Exception as e:
                logger.debug(f"[NotificationDispatcher] Phone fallback matching error: {e}")

        return channels

    @classmethod
    def dispatch_message(
        cls,
        order,
        message_text: str,
        buttons: Optional[List[Dict[str, Any]]] = None,
        event_tag: str = "general"
    ) -> Dict[str, Any]:
        """
        Dispatches message_text to all resolved platforms and accounts for the customer.
        Returns summary of successful sends.
        """
        channels = cls.resolve_customer_channels(order)
        if not channels:
            logger.info(f"[NotificationDispatcher] No eligible customer channels found for Order #{order.id}")
            return {'sent_count': 0, 'channels': []}

        sent_count = 0
        results = []

        for ch in channels:
            platform = ch['platform']
            identifier = ch['identifier']
            agent = ch['agent']
            delivered = False

            try:
                if platform == 'messenger':
                    delivered = cls._send_messenger(order, agent, identifier, message_text, buttons)
                elif platform == 'instagram':
                    delivered = cls._send_instagram(order, agent, identifier, message_text, buttons)
                elif platform == 'whatsapp':
                    delivered = cls._send_whatsapp(order, agent, identifier, message_text)
                elif platform == 'telegram':
                    delivered = cls._send_telegram(order, agent, identifier, message_text)

                if delivered:
                    sent_count += 1
                    logger.info(
                        f"✅ [NotificationDispatcher] Sent {event_tag} notification for Order #{order.id} "
                        f"via {platform.upper()} ({identifier}) [{ch['source']}]"
                    )
                results.append({'platform': platform, 'identifier': identifier, 'success': delivered})

            except Exception as e:
                logger.error(
                    f"❌ [NotificationDispatcher] Error dispatching to {platform} ({identifier}) "
                    f"for Order #{order.id}: {e}",
                    exc_info=True
                )
                results.append({'platform': platform, 'identifier': identifier, 'success': False, 'error': str(e)})

        return {'sent_count': sent_count, 'channels': results}

    # ─── Platform-Specific Dispatchers ────────────────────────────────────────

    @classmethod
    def _send_messenger(cls, order, agent, recipient_id: str, message_text: str, buttons=None) -> bool:
        from integrations.services.meta import MetaService
        from users.models import FacebookPage

        token = getattr(agent, 'facebook_access_token', None) or getattr(agent, 'access_token', None)
        if not token and getattr(agent, 'page_id', None):
            fb_page = FacebookPage.objects.filter(page_id=agent.page_id, is_active=True).first()
            if fb_page:
                token = fb_page.access_token

        if not token and getattr(order, 'user', None):
            fb_page = FacebookPage.objects.filter(user=order.user, is_active=True).first()
            if fb_page:
                token = fb_page.access_token
            if not token:
                from aiAgent.models import AgentAI
                m_agent = AgentAI.objects.filter(user=order.user, platform='messenger', is_active=True).first()
                if m_agent:
                    token = m_agent.access_token

        if not token:
            logger.warning(f"⚠️ [NotificationDispatcher] No active Messenger token found for Order #{order.id}")
            return False

        return bool(MetaService.send_message(
            access_token=token,
            recipient_id=recipient_id,
            message_text=message_text,
            buttons=buttons,
            msg_type='text'
        ))

    @classmethod
    def _send_instagram(cls, order, agent, recipient_id: str, message_text: str, buttons=None) -> bool:
        from integrations.services.meta import MetaService
        from aiAgent.models import AgentAI

        token = getattr(agent, 'access_token', None)
        if not token and getattr(order, 'user', None):
            ig_agent = AgentAI.objects.filter(user=order.user, platform='instagram', is_active=True).first()
            if ig_agent:
                token = ig_agent.access_token

        if not token:
            logger.warning(f"⚠️ [NotificationDispatcher] No active Instagram token found for Order #{order.id}")
            return False

        return bool(MetaService.send_message(
            access_token=token,
            recipient_id=recipient_id,
            message_text=message_text,
            buttons=buttons,
            msg_type='text'
        ))

    @classmethod
    def _send_whatsapp(cls, order, agent, recipient_id: str, message_text: str) -> bool:
        from integrations.services.whatsapp import WhatsAppService

        session_id = None
        if agent and getattr(agent, 'baileys_session_id', None):
            session_id = agent.baileys_session_id
        elif getattr(order, 'user_id', None):
            session_id = f"user_{order.user_id}"
        elif agent:
            session_id = str(agent.id)
        else:
            session_id = "default"

        to_jid = recipient_id
        if "@" not in to_jid:
            phone = to_jid.lstrip("+")
            if phone.startswith("0"):
                phone = "88" + phone
            to_jid = phone

        return bool(WhatsAppService.send_message(
            session_id=session_id,
            to=to_jid,
            message_text=message_text,
            msg_type='text'
        ))

    @classmethod
    def _send_telegram(cls, order, agent, chat_id: str, message_text: str) -> bool:
        from integrations.services.telegram import TelegramService
        from aiAgent.models import TelegramBot

        bot_token = None
        if agent:
            tg_details = getattr(agent, 'telegram_bot_details', None)
            if tg_details and getattr(tg_details, 'is_active', False):
                bot_token = tg_details.bot_token
            if not bot_token:
                bot = TelegramBot.objects.filter(agent=agent, is_active=True).first()
                if bot:
                    bot_token = bot.bot_token

        if not bot_token and getattr(order, 'user', None):
            bot = TelegramBot.objects.filter(agent__user=order.user, is_active=True).order_by('-id').first()
            if bot:
                bot_token = bot.bot_token

        if not bot_token:
            logger.warning(f"⚠️ [NotificationDispatcher] No active Telegram bot token found for Order #{order.id}")
            return False

        return bool(TelegramService.send_message(
            token=bot_token,
            chat_id=str(chat_id),
            message_text=message_text,
            msg_type='text'
        ))
