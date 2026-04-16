"""
Django management command to populate ML data from existing messages
Run: python manage.py populate_ml_embeddings
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from aiAgent.models import AgentAI, UserMemory
from aiAgent.ml_models import MessageEmbedding, ConversationAnalysis
from aiAgent.embedding_service import get_embedding_service
from aiAgent.nlp_classifier import get_nlp_classifier
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Populate ML embeddings and classifications for existing conversations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--agent-id',
            type=int,
            help='Process specific agent by ID'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=1000,
            help='Maximum messages to process'
        )

    def handle(self, *args, **options):
        embedding_service = get_embedding_service()
        nlp_classifier = get_nlp_classifier()
        
        self.stdout.write(self.style.SUCCESS('🚀 Starting ML data population...'))
        
        # Get agents
        agents = AgentAI.objects.all()
        if options['agent_id']:
            agents = agents.filter(id=options['agent_id'])
        
        total_processed = 0
        total_messages = options['limit']
        
        for agent in agents:
            self.stdout.write(f"\n📊 Processing agent: {agent.name}")
            
            # Get user memories for this agent
            memories = UserMemory.objects.filter(ai_agent=agent)[:10]
            
            for memory in memories:
                sender_id = memory.sender_id
                
                # Extract messages from memory data if available
                chat_history = memory.data.get('chat_history', [])
                
                if not chat_history:
                    self.stdout.write(f"  ⚠️  No chat history for {sender_id}")
                    continue
                
                self.stdout.write(f"  👤 Processing user: {sender_id}")
                
                # Create conversation analysis
                conv_analysis, created = ConversationAnalysis.objects.get_or_create(
                    ai_agent=agent,
                    sender_id=sender_id,
                    defaults={
                        'total_messages': 0,
                    }
                )
                
                message_count = 0
                for msg in chat_history:
                    if message_count >= (total_messages // len(memories)):
                        break
                    
                    message_text = msg.get('text', msg.get('content', ''))
                    if not message_text:
                        continue
                    
                    # Skip if already processed
                    if MessageEmbedding.objects.filter(
                        ai_agent=agent,
                        sender_id=sender_id,
                        message_text=message_text
                    ).exists():
                        continue
                    
                    try:
                        # Get embedding
                        embedding = embedding_service.embed_text(message_text)
                        
                        # Get classifications
                        sentiment = nlp_classifier.classify_sentiment(message_text)
                        intent = nlp_classifier.classify_intent(message_text)
                        
                        # Create record
                        msg_embedding = MessageEmbedding.objects.create(
                            ai_agent=agent,
                            sender_id=sender_id,
                            message_text=message_text,
                            embedding=embedding,
                            sentiment=sentiment.get('label', 'neutral'),
                            intent=intent.get('intent', 'other'),
                            message_type=_get_message_type(intent),
                        )
                        
                        message_count += 1
                        total_processed += 1
                        
                        self.stdout.write(f"    ✅ Processed: {msg_embedding.id}")
                    
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"    ❌ Error: {str(e)[:100]}")
                        )
                
                # Update conversation analysis
                conv_analysis.total_messages = MessageEmbedding.objects.filter(
                    ai_agent=agent,
                    sender_id=sender_id
                ).count()
                conv_analysis.save()
                
                self.stdout.write(f"    ✅ Analyzed {message_count} messages")
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✨ Done! Processed {total_processed} messages')
        )


def _get_message_type(intent_result):
    """Map intent to message type"""
    intent = intent_result.get('intent', 'other')
    mapping = {
        'price_inquiry': 'question',
        'order': 'order',
        'complaint': 'complaint',
        'support_request': 'question',
        'greeting': 'greeting',
        'feedback': 'feedback',
    }
    return mapping.get(intent, 'other')
