# aiAgent/services.py
from .models import Conversation, Message





def get_or_create_conversation(agentAi, contact_id):
    return Conversation.objects.get_or_create(
        agentAi=agentAi,
        contact_id=str(contact_id)
    )[0]



def save_message(agentAi, contact_id, text, role, tokens=0):

    convo = get_or_create_conversation(agentAi, contact_id)

    return Message.objects.create(
        conversation=convo,
        role=role,
        content=text,
        tokens_used=tokens)

def get_last_message(agentAi, contact_id, limit=5):
    convo = Conversation.objects.filter(
        agentAi=agentAi,
        contact_id=contact_id
    ).first()

    if not convo:
        return []
    messages = convo.messages.all().order_by('-sent_at')[:limit]
    print("Ordering field:", '-sent_at')


    return [
        {'role': m.role,
         'content': m.content,
         'timestamp': m.sent_at.timestamp()
         }
        for m in reversed(messages)
    ]