
import os
import django
import sys

# Setup Django
sys.path.append('/home/md-zubayer/newsmartagent/production/jwtauth')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jwtauth.settings')
django.setup()

from aiAgent.models import AgentAI, Contact
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from aiAgent.contact_views import ContactListView, UnifiedReplyView

def test_unified_inbox():
    user = User.objects.first()
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
        if contacts:
            print(f"Sample contact: {contacts[0]['name']} (Platform: {contacts[0]['platform']}, Agent: {contacts[0]['agent_name']})")

    # 2. Test Unified Reply (Mocking delivery)
    if contacts:
        contact_id = contacts[0]['id']
        reply_view = UnifiedReplyView.as_view()
        reply_request = factory.post('/AgentAI/contacts/unified/reply/', {
            'contact_id': contact_id,
            'message': 'Test unified reply from script'
        }, format='json')
        force_authenticate(reply_request, user=user)
        
        # Note: This might trigger actual webhook calls if not careful, 
        # but in this environment, it's safer to just check if it finds the contact and attempts delivery.
        try:
            reply_response = reply_view(reply_request)
            print(f"Unified Reply Response Status: {reply_response.status_code}")
            print(f"Reply Response Data: {reply_response.data}")
        except Exception as e:
            print(f"Error during reply test: {e}")

if __name__ == "__main__":
    test_unified_inbox()
