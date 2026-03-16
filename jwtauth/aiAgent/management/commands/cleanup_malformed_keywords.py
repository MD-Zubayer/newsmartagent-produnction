from django.core.management.base import BaseCommand
from aiAgent.models import SmartKeyword

class Command(BaseCommand):
    help = 'Deletes malformed keywords (containing quotes, colons, brackets, etc.)'

    def handle(self, *args, **kwargs):
        all_keywords = SmartKeyword.objects.all()
        to_delete = []
        
        malformed_chars = [':', '"', '{', '}', '[', ']']
        
        for k in all_keywords:
            if any(char in k.text for char in malformed_chars):
                to_delete.append(k.id)
        
        count = len(to_delete)
        if count > 0:
            SmartKeyword.objects.filter(id__in=to_delete).delete()
            self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} malformed keywords.'))
        else:
            self.stdout.write(self.style.NOTICE('No malformed keywords found.'))
