from aiAgent.models import WidgetSettings

qs = WidgetSettings.objects.filter(bubble_icon_url__contains='https//')
count = 0
for ws in qs:
    # Fix missing colon
    ws.bubble_icon_url = ws.bubble_icon_url.replace('https//', 'https://')
    # Ensure bucket name is present
    if 'newsmartagent-media' not in ws.bubble_icon_url:
        ws.bubble_icon_url = ws.bubble_icon_url.replace('s3.newsmartagent.com/', 's3.newsmartagent.com/newsmartagent-media/')
    ws.save()
    count += 1

print(f"Updated {count} records.")
