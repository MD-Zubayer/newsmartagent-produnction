from aiAgent.models import AgentAI
qs = AgentAI.objects.filter(platform='web_widget')
print(f"Total web_widget agents: {qs.count()}")
for a in qs:
    print(f"Name: {a.name}, Key: {a.widget_key}, Active: {a.is_active}")
