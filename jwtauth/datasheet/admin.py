from django.contrib import admin
from .models import Spreadsheet


@admin.register(Spreadsheet)
class SpreadsheetAdmin(admin.ModelAdmin):
    list_display =[ 
        'id',
        'title',
        'user',
        'rows',
        'cols',
        'is_dark_mode',
        'zoom_level',
        'updated_at',
        'created_at',
    ]
    list_filter = (
        'user',
        'is_dark_mode',
        'created_at',
        'updated_at',
    )
    search_fields = (
        'title',
        'user__username',
        'user__email',
    )
    date_hierarchy = 'updated_at'
    readonly_fields = (
        'created_at',
        'updated_at',
        'rows',
        'cols',
    )
    list_per_page = 20

    fieldsets = (
        ('Basic Information', {
            'fields': (
                'title',
                'user',
                'rows',
                'cols',
                'is_dark_mode',
                'zoom_level',
            )
        }),
        ('Data & Styling (JSON)', {
            'fields': (
                'data',
                'colors',
                'styles',
            ),
            'classes': ('collapse',),
            'description': 'These fields store spreadsheet cell values, colors, and styles in JSON format.',
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',),
        }),
    )

    # Optional: JSON fields সুন্দরভাবে দেখানোর জন্য custom display
    def preview_data(self, obj):
        """Admin লিস্টে data ফিল্ডের ছোট প্রিভিউ দেখানো"""
        if obj.data:
            items = list(obj.data.items())[:3]
            preview = ", ".join(f"{k}: {v}" for k, v in items)
            return f"{preview} ..." if len(obj.data) > 3 else preview
        return "-"
    preview_data.short_description = "Data Preview"

    def preview_colors(self, obj):
        if obj.colors:
            items = list(obj.colors.items())[:2]
            preview = ", ".join(f"{k}: {v}" for k, v in items)
            return f"{preview} ..."
        return "-"
    preview_colors.short_description = "Colors Preview"

    # list_display-এ যোগ করতে চাইলে
    # list_display = ('title', 'user', 'preview_data', 'preview_colors', 'updated_at')