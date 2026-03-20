from aiAgent.models import WidgetSettings

qs = WidgetSettings.objects.exclude(bubble_icon_url='')
print(f"Checking {qs.count()} records:")
for ws in qs:
    print(f"Agent {ws.agent.id}: {ws.bubble_icon_url}")
