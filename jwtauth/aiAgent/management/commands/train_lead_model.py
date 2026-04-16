"""
Django management command to train lead scoring model
Run: python manage.py train_lead_model
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from aiAgent.models import AgentAI, UserMemory
from aiAgent.ml_models import MessageEmbedding, LeadScorePrediction
from aiAgent.lead_scoring import get_lead_scoring_model
import json
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Train lead scoring model on historical conversion data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--agent-id',
            type=int,
            help='Train for specific agent'
        )
        parser.add_argument(
            '--min-messages',
            type=int,
            default=5,
            help='Minimum messages per user for training'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🤖 Starting Lead Scoring Model Training...'))
        
        # Get agents
        agents = AgentAI.objects.all()
        if options['agent_id']:
            agents = agents.filter(id=options['agent_id'])
        
        training_data = []
        
        for agent in agents:
            self.stdout.write(f"\n📊 Processing agent: {agent.name}")
            
            # Get user memories
            memories = UserMemory.objects.filter(ai_agent=agent)
            
            for memory in memories:
                # Skip if not enough messages
                message_count = MessageEmbedding.objects.filter(
                    ai_agent=agent,
                    sender_id=memory.sender_id
                ).count()
                
                if message_count < options['min_messages']:
                    continue
                
                # Extract label from memory or conversation
                label = self._extract_label(memory, agent)
                if label is None:
                    continue
                
                # Build conversation data
                conversation_data = {
                    'messages': list(
                        MessageEmbedding.objects.filter(
                            ai_agent=agent,
                            sender_id=memory.sender_id
                        ).order_by('created_at').values(
                            'message_text',
                            'sentiment',
                            'intent',
                            'message_type',
                            'created_at'
                        )[:100]
                    ),
                }
                
                # Extract features
                model = get_lead_scoring_model()
                features = model.extract_features(agent, memory.sender_id, conversation_data)
                
                training_data.append((features, label))
                
                self.stdout.write(f"  ✅ {memory.sender_id}: {message_count} messages, label={label}")
        
        if not training_data:
            self.stdout.write(
                self.style.ERROR('❌ No training data found. Label some leads first!')
            )
            return
        
        # Train model
        self.stdout.write(f"\n🎯 Training on {len(training_data)} samples...")
        
        model = get_lead_scoring_model()
        success = model.train(training_data)
        
        if success:
            # Save model
            import os
            model_path = os.path.join(
                os.path.dirname(__file__),
                '..',
                'models',
                'lead_scoring'
            )
            
            os.makedirs(model_path, exist_ok=True)
            model.save_model(model_path)
            
            self.stdout.write(
                self.style.SUCCESS(f'✨ Model trained and saved to {model_path}')
            )
            
            # Print feature importance
            if hasattr(model.model, 'feature_importances_'):
                self.stdout.write('\n📊 Feature Importance:')
                importances = sorted(
                    zip(model.feature_names, model.model.feature_importances_),
                    key=lambda x: x[1],
                    reverse=True
                )
                
                for feature, importance in importances[:5]:
                    bar = '█' * int(importance * 50)
                    self.stdout.write(f"  {feature:30s} {bar} {importance:.4f}")
        else:
            self.stdout.write(
                self.style.ERROR('❌ Model training failed')
            )
    
    def _extract_label(self, memory, agent):
        """
        Extract conversion label from memory
        
        Heuristics:
        1. Check UserMemory.data for explicit label
        2. Check if "order" intent exists
        3. Check sentiment trend
        4. If >30 days inactive, mark as lost
        """
        data = memory.data or {}
        
        # Explicit label
        if data.get('conversion_status'):
            status = data['conversion_status'].lower()
            if status in ['converted', 'ordered', 'purchased']:
                return 1
            elif status in ['lost', 'abandoned']:
                return 0
        
        # Message-based heuristics
        messages = MessageEmbedding.objects.filter(
            ai_agent=agent,
            sender_id=memory.sender_id
        ).order_by('created_at')
        
        if not messages.exists():
            return None
        
        # Check for order intents
        order_count = messages.filter(intent='order').count()
        total_count = messages.count()
        
        if order_count > 0:
            return 1  # Converted
        
        # Check recency
        last_message = messages.last()
        days_since = (timezone.now() - last_message.created_at).days
        
        if days_since > 60:
            return 0  # Likely lost
        
        # Not enough signal
        return None


# LABELING INSTRUCTIONS
"""
To improve model accuracy, manually label some UserMemory records:

In Django admin or shell:

from aiAgent.models import UserMemory

# Mark as converted
memory = UserMemory.objects.get(id=123)
memory.data['conversion_status'] = 'converted'
memory.save()

# Or in bulk:
UserMemory.objects.filter(...).update(
    data={
        'conversion_status': 'converted'
    }
)

Labels:
- 'converted' / 'ordered' / 'purchased' → 1 (converted)
- 'lost' / 'abandoned' / 'churned' → 0 (not converted)
- Unlabeled → auto-detect from message history
"""
