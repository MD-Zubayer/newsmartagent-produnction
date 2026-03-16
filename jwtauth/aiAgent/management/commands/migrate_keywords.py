import json
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from aiAgent.models import SmartKeyword

class Command(BaseCommand):
    help = 'Migrates keywords from JSON files to the SmartKeyword model'

    def handle(self, *args, **options):
        # 1. Migrate Skip Keywords
        skip_path = os.path.join(settings.BASE_DIR, 'webhooks', 'history_skip_keywords.json')
        if os.path.exists(skip_path):
            with open(skip_path, 'r', encoding='utf-8') as f:
                keywords = json.load(f)
                for kw in keywords:
                    SmartKeyword.objects.get_or_create(text=kw, category='skip')
            self.stdout.write(self.style.SUCCESS('Successfully migrated initial skip keywords'))

        # 1.1 Migrate Embedding Skip Keywords
        embedding_skip_path = os.path.join(settings.BASE_DIR, 'webhooks', 'embedding_skip_keywords.json')
        if os.path.exists(embedding_skip_path):
            with open(embedding_skip_path, 'r', encoding='utf-8') as f:
                keywords = json.load(f)
                for kw in keywords:
                    if isinstance(kw, str):
                        SmartKeyword.objects.get_or_create(text=kw.strip(), category='skip')
            self.stdout.write(self.style.SUCCESS('Successfully migrated embedding skip keywords'))

        # 2. Migrate Target Keywords
        target_path = os.path.join(settings.BASE_DIR, 'webhooks', 'target_keywords.json')
        if os.path.exists(target_path):
            with open(target_path, 'r', encoding='utf-8') as f:
                keywords = json.load(f)
                for kw in keywords:
                    # Target keywords are also useful for context scoring
                    SmartKeyword.objects.get_or_create(text=kw, category='target')
            self.stdout.write(self.style.SUCCESS('Successfully migrated target keywords'))

        # 3. Migrate Hardcoded Locations
        locations = ['ঢাকা', 'dhaka', 'চট্টগ্রাম', 'মিরপুর', 'উত্তরা', 'mirpur', 'uttara', 'বনানী', 'banani', 'গুলশান', 'gulshan']
        for loc in locations:
            SmartKeyword.objects.get_or_create(text=loc, category='location')

        # 4. Migrate Hardcoded Intents
        intents = ['অর্ডার', 'order', 'কিনবো', 'লাগবে', 'চাই', 'প্রয়োজন', 'ঠিকানা', 'address', 'নিবো', 'দাম']
        for intent in intents:
            SmartKeyword.objects.get_or_create(text=intent, category='intent')

        # 5. Migrate Hardcoded Urgency
        urgency = ['খারাপ', 'বাজে', 'দেরি', 'স্লো', 'সমস্যা', 'issue', 'problem', 'slow', 'urgent', 'জরুরি']
        for u in urgency:
            SmartKeyword.objects.get_or_create(text=u, category='urgency')

        self.stdout.write(self.style.SUCCESS('Keyword migration complete!'))
