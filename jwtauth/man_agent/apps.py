from django.apps import AppConfig


class ManAgentConfig(AppConfig):
    name = 'man_agent'

    def ready(self):
        import man_agent.signals
    
    
  