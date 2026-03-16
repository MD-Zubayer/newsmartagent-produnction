from django.core.management.base import BaseCommand
from aiAgent.models import SmartKeyword

class Command(BaseCommand):
    help = 'Deletes pure numeric keywords from SmartKeyword model'

    def handle(self, *args, **kwargs):
        all_keywords = SmartKeyword.objects.all()
        to_delete = []
        
        for k in all_keywords:
            if k.text.strip().isdigit():
                to_delete.append(k.id)
        
        count = len(to_delete)
        if count > 0:
            SmartKeyword.objects.filter(id__in=to_delete).delete()
            self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} numeric keywords.'))
        else:
            self.stdout.write(self.style.NOTICE('No numeric keywords found.'))
