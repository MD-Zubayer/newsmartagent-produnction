from django.core.management.base import BaseCommand
from datasheet.models import Spreadsheet
from datasheet.tasks import run_auto_image_search_task


class Command(BaseCommand):
    help = 'Trigger auto image search for a spreadsheet if auto_image_search is enabled.'

    def add_arguments(self, parser):
        parser.add_argument('sheet_id', type=int, help='Spreadsheet ID to process')
        parser.add_argument('--delay', action='store_true', help='Schedule as a Celery task instead of running inline')

    def handle(self, *args, **options):
        sheet_id = options['sheet_id']
        delay = options['delay']

        try:
            sheet = Spreadsheet.objects.get(pk=sheet_id)
        except Spreadsheet.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Spreadsheet {sheet_id} does not exist."))
            return

        if not sheet.auto_image_search:
            self.stdout.write(self.style.WARNING(f"Auto image search is disabled for sheet {sheet_id}."))
            return

        if delay:
            run_auto_image_search_task.delay(sheet_id)
            self.stdout.write(self.style.SUCCESS(f"Scheduled auto image search task for sheet {sheet_id}."))
        else:
            result = run_auto_image_search_task.run(sheet_id)
            self.stdout.write(self.style.SUCCESS(f"Auto image search completed with result: {result}"))
