import logging
from django.core.management.base import BaseCommand
from django.db import transaction, models
from django.db.models.functions import Lower
from aiAgent.models import AgentAI, Contact, UserMemory, TokenUsageLog
from chat.models import Conversation, Message

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Normalizes platform field to lowercase and standardizes WhatsApp identifiers across all models.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting global platform normalization..."))
        
        with transaction.atomic():
            # 1. Normalize AgentAI platform to lowercase
            self.stdout.write("Normalizing AgentAI platform names...")
            for agent in AgentAI.objects.all():
                if agent.platform and agent.platform != agent.platform.lower():
                    old_p = agent.platform
                    new_p = agent.platform.lower()
                    agent.platform = new_p
                    agent.save(update_fields=['platform'])
                    self.stdout.write(f"Updated Agent {agent.id}: {old_p} -> {new_p}")

            # 2. Normalize Contact platform and identifiers
            self.stdout.write("Normalizing Contact data...")
            contacts = Contact.objects.all()
            for contact in contacts:
                modified = False
                
                # Normalize platform
                if contact.platform and contact.platform != contact.platform.lower():
                    contact.platform = contact.platform.lower()
                    modified = True

                # Normalize WhatsApp Identifier (only if numeric and platform is whatsapp)
                if contact.platform == 'whatsapp':
                    if '@' not in contact.identifier and contact.identifier.isdigit() and len(contact.identifier) > 7:
                        old_id = contact.identifier
                        new_id = f"{old_id}@s.whatsapp.net"
                        
                        # Check if a contact with the new ID already exists
                        existing = Contact.objects.filter(agent=contact.agent, identifier=new_id).first()
                        if existing:
                            self.stdout.write(self.style.WARNING(f"Duplicate WhatsApp contact found for {new_id}. Merging..."))
                            # Merge Conversation, UserMemory, etc. to 'existing' first
                            self.merge_contacts(contact, existing)
                            self.stdout.write(self.style.SUCCESS(f"Merged {old_id} into {new_id}"))
                            continue # Skip saving 'contact' as it's being deleted in merge
                        else:
                            self.update_related_identifiers(contact, old_id, new_id)
                            contact.identifier = new_id
                            modified = True
                            self.stdout.write(f"Updated WhatsApp ID: {old_id} -> {new_id}")

                if modified:
                    contact.save()

            # 3. Normalize Conversation platform and identifiers
            self.stdout.write("Normalizing Conversation data...")
            for convo in Conversation.objects.all():
                modified = False
                if convo.platform and convo.platform != convo.platform.lower():
                    convo.platform = convo.platform.lower()
                    modified = True
                
                # Check for numeric WhatsApp ID
                if convo.platform == 'whatsapp' and '@' not in convo.contact_id and convo.contact_id.isdigit():
                    convo.contact_id = f"{convo.contact_id}@s.whatsapp.net"
                    modified = True
                
                if modified:
                    convo.save()

            # 4. Normalize Message platform
            self.stdout.write("Normalizing Message data...")
            Message.objects.filter(platform__isnull=False).update(platform=Lower('platform'))

            # 5. Normalize TokenUsageLog platform and identifiers
            self.stdout.write("Normalizing TokenUsageLog data...")
            for log in TokenUsageLog.objects.all():
                modified = False
                if log.platform and log.platform != log.platform.lower():
                    log.platform = log.platform.lower()
                    modified = True
                
                if log.platform == 'whatsapp' and log.sender_id and '@' not in log.sender_id and log.sender_id.isdigit():
                    log.sender_id = f"{log.sender_id}@s.whatsapp.net"
                    modified = True
                
                if modified:
                    log.save()

            # 6. Normalize UserMemory identifiers
            self.stdout.write("Normalizing UserMemory identifiers...")
            for memory in UserMemory.objects.all():
                # We don't have platform in UserMemory, but we can infer from its associated AgentAI if needed.
                # Usually UserMemory is platform-agonistic except for sender_id format.
                if memory.sender_id and '@' not in memory.sender_id and memory.sender_id.isdigit() and len(memory.sender_id) > 7:
                    # Check if associated agent is WhatsApp
                    if memory.ai_agent.platform == 'whatsapp':
                        memory.sender_id = f"{memory.sender_id}@s.whatsapp.net"
                        memory.save()
                        self.stdout.write(f"Updated UserMemory ID: {memory.sender_id}")

        self.stdout.write(self.style.SUCCESS("Normalization complete!"))

    def update_related_identifiers(self, contact, old_id, new_id):
        """Update any related models that use the identifier string as a key."""
        Conversation.objects.filter(agentAi=contact.agent, contact_id=old_id).update(contact_id=new_id)
        UserMemory.objects.filter(ai_agent=contact.agent, sender_id=old_id).update(sender_id=new_id)
        TokenUsageLog.objects.filter(ai_agent=contact.agent, sender_id=old_id).update(sender_id=new_id)

    def merge_contacts(self, old_contact, new_contact):
        """Merge data from old_contact into new_contact and delete old_contact."""
        old_id = old_contact.identifier
        new_id = new_contact.identifier
        
        # Move Conversations
        Conversation.objects.filter(agentAi=old_contact.agent, contact_id=old_id).update(contact_id=new_id)
        # Move UserMemory
        UserMemory.objects.filter(ai_agent=old_contact.agent, sender_id=old_id).update(sender_id=new_id)
        # Move TokenUsageLog
        TokenUsageLog.objects.filter(ai_agent=old_contact.agent, sender_id=old_id).update(sender_id=new_id)
        
        # Delete the redundant old contact
        old_contact.delete()
