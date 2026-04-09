from django.core.management.base import BaseCommand
from datasheet.models import Spreadsheet
from embedding.models import Document

class Command(BaseCommand):
    help = 'Calculates and backfills tokens_count for all existing Spreadsheet and Document instances.'

    def handle(self, *args, **kwargs):
        docs = Document.objects.all()
        sheets = Spreadsheet.objects.all()
        
        doc_updated = 0
        sheet_updated = 0
        failed = 0
        
        try:
            import tiktoken
            encoding = tiktoken.get_encoding('cl100k_base')
            has_tiktoken = True
            self.stdout.write("Using tiktoken for exact calculation...")
        except ImportError:
            has_tiktoken = False
            self.stdout.write(self.style.WARNING("tiktoken not found! Using approximation..."))

        for doc in docs:
            if not doc.full_content:
                doc.tokens_count = 0
                doc.save(update_fields=['tokens_count'])
                continue
                
            try:
                if has_tiktoken:
                    doc.tokens_count = len(encoding.encode(doc.full_content))
                else:
                    doc.tokens_count = len(doc.full_content) // 4
                doc.save(update_fields=['tokens_count'])
                doc_updated += 1
            except Exception as e:
                self.stderr.write(f"Error doc {doc.id}: {str(e)}")
                failed += 1
                
        for sheet in sheets:
            if not getattr(sheet, 'data', None):
                sheet.tokens_count = 0
                sheet.save(update_fields=['tokens_count'])
                continue
                
            try:
                text_content = ""
                if isinstance(sheet.data, dict):
                    for val in sheet.data.values():
                        if val is not None:
                            text_content += str(val) + " "
                elif isinstance(sheet.data, str):
                    text_content = sheet.data

                if text_content.strip():
                    if has_tiktoken:
                        sheet.tokens_count = len(encoding.encode(text_content))
                    else:
                        sheet.tokens_count = len(text_content) // 4
                else:
                    sheet.tokens_count = 0
                
                sheet.save(update_fields=['tokens_count'])
                sheet_updated += 1
            except Exception as e:
                self.stderr.write(f"Error sheet {sheet.id}: {str(e)}")
                failed += 1
                
        self.stdout.write(self.style.SUCCESS(f"Updated {doc_updated} Documents and {sheet_updated} Spreadsheets. Failed: {failed}."))
