# aiAgent/services.py
from .models import Conversation, Message





def get_or_create_conversation(agentAi, contact_id, platform='messenger'):
    platform = (platform or 'messenger').lower()
    return Conversation.objects.get_or_create(
        agentAi=agentAi,
        contact_id=str(contact_id),
        platform=platform
    )[0]



def save_message(agentAi, contact_id, text, role, tokens=0, platform='messenger'):
    platform = (platform or 'messenger').lower()
    convo = get_or_create_conversation(agentAi, contact_id, platform=platform)

    return Message.objects.create(
        conversation=convo,
        role=role,
        content=text,
        platform=platform,
        tokens_used=tokens)

def get_last_message(agentAi, contact_id, limit=5, platform='messenger'):
    # Normalize contact_id to string so it matches how conversations are stored
    normalized_contact_id = str(contact_id)

    convo = Conversation.objects.filter(
        agentAi=agentAi,
        contact_id=normalized_contact_id,
        platform=platform
    ).first()

    if not convo:
        return []
    # Fetch latest messages first, then reverse for chronological order
    messages = convo.messages.all().order_by('-id')[:limit]

    # Return chronological order (oldest → newest)
    return [
        {
            'role': m.role,
            'content': m.content,
            'timestamp': m.sent_at.timestamp(),
        }
        for m in reversed(messages)
    ]
