
from aiAgent.models import AgentAI, Contact
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from aiAgent.contact_views import ContactListView, UnifiedReplyView

User = get_user_model()

def test_unified_inbox():
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        print("No user found in database.")
        return
    
    # Create a dummy agent if needed
    agent, _ = AgentAI.objects.get_or_create(
        user=user,
        name="Test Agent",
        page_id="test_page_123",
        platform="whatsapp"
    )
    
    # Create a dummy contact
    contact, _ = Contact.objects.get_or_create(
        agent=agent,
        identifier="1234567890",
        defaults={
            "name": "Test User",
            "platform": "whatsapp"
        }
    )
    
    print(f"Test data ready. User: {user.email}, Agent: {agent.name}, Contact: {contact.name}")
    
    factory = APIRequestFactory()
    
    # 1. Test Fetching ALL contacts
    view = ContactListView.as_view()
    request = factory.get('/AgentAI/contacts/all/')
    force_authenticate(request, user=user)
    response = view(request, agent_id='all')
    
    print(f"Unified Contacts Response Status: {response.status_code}")
    if response.status_code == 200:
        contacts = response.data.get('contacts', [])
        print(f"Found {len(contacts)} contacts in unified view.")
        for c in contacts:
            print(f"Contact: {c.get('name')} (Platform: {c.get('platform')}, Agent: {c.get('agent_name')})")

    # 2. Test Unified Reply (Mocking delivery)
    if contacts:
        contact_id = contacts[0]['id']
        reply_view = UnifiedReplyView.as_view()
        reply_request = factory.post('/AgentAI/contacts/unified/reply/', {
            'contact_id': contact_id,
            'message': 'Test unified reply from shell'
        }, format='json')
        force_authenticate(reply_request, user=user)
        
        try:
            reply_response = reply_view(reply_request)
            print(f"Unified Reply Response Status: {reply_response.status_code}")
            print(f"Reply Response Data: {reply_response.data}")
            
            # Clean up dummy data
            # contact.delete()
            # agent.delete()
            # print("Test data cleaned up.")
            
        except Exception as e:
            print(f"Error during reply test: {e}")

test_unified_inbox()
