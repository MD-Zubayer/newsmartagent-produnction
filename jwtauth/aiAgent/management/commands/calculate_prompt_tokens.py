from django.core.management.base import BaseCommand
from aiAgent.models import AgentAI

class Command(BaseCommand):
    help = 'Calculates and backfills prompt_tokens for all existing AgentAI instances.'

    def handle(self, *args, **kwargs):
        agents = AgentAI.objects.all()
        total_updated = 0
        total_failed = 0
        
        try:
            import tiktoken
            encoding = tiktoken.get_encoding('cl100k_base')
            has_tiktoken = True
            self.stdout.write("Using tiktoken for exact calculation...")
        except ImportError:
            has_tiktoken = False
            self.stdout.write(self.style.WARNING("tiktoken not found! Using approximation..."))

        for agent in agents:
            if not agent.system_prompt:
                agent.prompt_tokens = 0
                agent.save(update_fields=['prompt_tokens'])
                continue
                
            try:
                if has_tiktoken:
                    agent.prompt_tokens = len(encoding.encode(agent.system_prompt))
                else:
                    agent.prompt_tokens = len(agent.system_prompt) // 4
                agent.save(update_fields=['prompt_tokens'])
                total_updated += 1
            except Exception as e:
                self.stderr.write(f"Error calculating tokens for agent {agent.id}: {str(e)}")
                total_failed += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully calculated and updated {total_updated} agents. Failed: {total_failed}."))
