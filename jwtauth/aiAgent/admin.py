# aiAgent/admin.py
from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import AgentAI,MissingRequirement, Contact, WidgetSettings
from django.utils.html import format_html
from .models import UserMemory, AgentAI
import json
from django.db.models import Sum, Count, Avg
from django.utils.html import format_html
from .models import TokenUsageLog
from .models import AIProviderModel, SmartKeyword, SmartTranslationMap
from django import forms
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
import json
import re

class KeywordUploadForm(forms.Form):
    category = forms.ChoiceField(choices=SmartKeyword.CATEGORY_CHOICES)
    json_file = forms.FileField(label="Select JSON File")

class TranslationMapBulkUploadForm(forms.Form):
    json_file = forms.FileField(
        label="JSON File (Optional)",
        required=False,
        help_text='Accepted: {"source":"target"} or [{"source":"...","target":"..."}]'
    )
    bulk_text = forms.CharField(
        label="Bulk Text (Optional)",
        required=False,
        widget=forms.Textarea(attrs={"rows": 12, "placeholder": "দাম => price\nkoto => price"}),
        help_text='One mapping per line. Supported separators: "=>", "->", tab, comma, "|", ":"'
    )

    


# Register your models here.

@admin.register(AIProviderModel)
class AIProviderModelAdmin(admin.ModelAdmin):
    # অ্যাডমিন লিস্টে যা যা দেখা যাবে
    list_display = ('id', 'name', 'provider', 'model_id', 'is_active')
    
    # ডানপাশে ফিল্টার অপশন (প্রোভাইডার বা একটিভ স্ট্যাটাস অনুযায়ী খোঁজার জন্য)
    list_filter = ('provider', 'is_active')
    
    # সার্চ বক্স (নাম বা মডেল আইডি দিয়ে সার্চ করার জন্য)
    search_fields = ('name', 'model_id')
    
    # লিস্ট ভিউতেই যেন একটিভ/ইনএকটিভ করা যায়
    list_editable = ('is_active',)
    
    # প্রোভাইডার অনুযায়ী গ্রুপ করে দেখানোর জন্য অর্ডারিং
    ordering = ('provider', 'name')

    # অ্যাডমিন প্যানেলে একটু সুন্দর দেখানোর জন্য ফিল্ডসেট (অপশনাল)
    fieldsets = (
        ('General Information', {
            'fields': ('name', 'model_id', 'provider')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


from settings.models import AgentAISettings

class AgentAISettingsInline(admin.StackedInline):
    model = AgentAISettings
    can_delete = False
    verbose_name_plural = 'Agent AI Settings'
    extra = 1

class WidgetSettingsInline(admin.StackedInline):
    model = WidgetSettings
    can_delete = False
    verbose_name_plural = 'Web Widget Settings'
    extra = 1

@admin.register(AgentAI)
class AgentAIAdmin(ModelAdmin):
    list_display = [ 'id', 'name', 'user', 'platform', 'number', 'page_id', 'widget_key', 'ai_agent_type', 'special_agent_status', 'is_special_agent', 'is_active','custom_keywords', 'created_at']
    list_filter = ['platform', 'special_agent_status', 'is_active', 'is_special_agent', 'user', 'ai_agent_type',]
    search_fields = ['name', 'page_id', 'number', 'user__username']
    inlines = [AgentAISettingsInline, WidgetSettingsInline]

    def created_short(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_short.short_description = "Created"




@admin.register(MissingRequirement)
class MissingRequirementAdmin(ModelAdmin):
    list_display = [
        'question',
        'sender_id',
        'ai_agent',
        'checked_at',
    ]
    
    list_filter = [
        'ai_agent',
        'checked_at',
    ]
    
    search_fields = [
        'question',
        'sender_id',
        'ai_agent__name',
        'ai_agent__page_id',
    ]
    
    date_hierarchy = 'checked_at'
    
    readonly_fields = ['checked_at']
    
    list_per_page = 25
    
    ordering = ['-checked_at']
    
    fieldsets = (
        ('Relation', {
            'fields': ('ai_agent', 'sender_id'),
        }),
        ('Question', {
            'fields': ('question',),
        }),
        ('Metadata', {
            'fields': ('checked_at',),
            'classes': ('collapse',)
        }),
    )





@admin.register(UserMemory)
class UserMemoryAdmin(ModelAdmin):
    list_display = ('ai_agent', 'sender_id', 'updated_at', 'short_data_preview')
    list_filter = ('ai_agent', 'updated_at')
    search_fields = ('sender_id',)
    readonly_fields = ('updated_at', 'data_preview')
    ordering = ('-updated_at',)
    list_per_page = 20

    def short_data_preview(self, obj):
        try:
            data_str = json.dumps(obj.data, ensure_ascii=False, indent=None)
            if len(data_str) > 80:
                data_str = data_str[:77] + "..."
            return data_str
        except:
            return "Invalid JSON"

    short_data_preview.short_description = "Memory Preview"

    def data_preview(self, obj):
        try:
            pretty = json.dumps(obj.data, ensure_ascii=False, indent=2)
            return format_html("<pre>{}</pre>", pretty)
        except Exception as e:
            return f"Error displaying data: {e}"

    data_preview.short_description = "Full Memory Content"


from django.contrib import admin
from .models import TokenUsageLog

@admin.register(TokenUsageLog)
class TokenUsageLogAdmin(ModelAdmin):
    # যে কলামগুলো অ্যাডমিন প্যানেলে দেখাবে
    list_display = (
        'short_user_info', 
        'ai_agent', 
        'platform', 
        'input_tokens',
        'output_tokens',
        'total_tokens', 
        'request_type',
        'sender_id',
        'success', 
        'error_message',
        'response_time', 
        'created_at'
    )

    # ডানপাশে ফিল্টার অপশন
    list_filter = ('platform', 'success', 'model_name', 'created_at', 'ai_agent')

    # সার্চ করার সুবিধা
    search_fields = ('sender_id', 'model_name', 'user__email', 'error_message')

    # শুধুমাত্র পড়ার জন্য (যেহেতু এটি একটি লগ, তাই এডিট না করাই ভালো)
    readonly_fields = (
        'user', 'ai_agent', 'sender_id', 'platform', 'model_name',
        'input_tokens', 'output_tokens', 'total_tokens',
        'request_type', 'success', 'error_message', 'response_time', 'created_at'
    )

    # কাস্টম ফাংশন: ইউজারের ইমেইল সংক্ষেপে দেখানোর জন্য
    def short_user_info(self, obj):
        if obj.user:
            return obj.user.email
        return "Anonymous"
    
    # অ্যাডমিন প্যানেলে কলামের নাম সেট করা
    short_user_info.short_description = 'User Email'

    # তারিখ অনুযায়ী ড্রিল-ডাউন করার সুবিধা
    date_hierarchy = 'created_at'


from django.contrib import admin
from .models import DashboardAILog

@admin.register(DashboardAILog)
class DashboardAILogAdmin(ModelAdmin):
    # লিস্ট ভিউতে যা যা দেখাবে
    list_display = ('user', 'pathname', 'question_summary', 'answer', 'input_tokens', 'output_tokens', 'total_tokens', 'created_at')
    
    # ফিল্টার করার অপশন (ডানপাশে থাকবে)
    list_filter = ('created_at', 'pathname', 'user')
    
    # সার্চ বার (ইউজারনাম এবং প্রশ্নের বিষয়বস্তু দিয়ে খোঁজা যাবে)
    search_fields = ('user__username', 'question', 'answer', 'pathname')
    
    # শুধু পড়ার জন্য (অ্যাডমিন যাতে AI এর উত্তর বা টোকেন এডিট করতে না পারে)
    readonly_fields = ('user', 'pathname', 'question', 'answer', 'input_tokens', 'output_tokens', 'total_tokens', 'created_at')
    
    # তারিখ অনুযায়ী ড্রিল-ডাউন করার অপশন
    date_hierarchy = 'created_at'

    # বড় প্রশ্নগুলোকে ছোট করে দেখানোর জন্য একটি কাস্টম মেথড
    def question_summary(self, obj):
        return obj.question[:50] + "..." if len(obj.question) > 50 else obj.question
    question_summary.short_description = 'Question'

    # নতুন ডাটা এন্ট্রি করার বাটন হাইড করা (যেহেতু এটি একটি লগ টেবিল)
    def has_add_permission(self, request):
        return False
    
    
    

@admin.register(SmartKeyword)
class SmartKeywordAdmin(ModelAdmin):
    list_display = ('id', 'text', 'category', 'is_active', 'created_at')
    list_filter = ('category', 'is_active')
    search_fields = ('text',)
    list_editable = ('is_active',)
    ordering = ('category', 'text')
    list_per_page = 50

    change_list_template = "admin/aiAgent/smartkeyword/change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('upload-json/', self.admin_site.admin_view(self.upload_json), name='aiAgent_smartkeyword_upload_json'),
        ]
        return custom_urls + urls

    def upload_json(self, request):
        if request.method == "POST":
            form = KeywordUploadForm(request.POST, request.FILES)
            if form.is_valid():
                category = form.cleaned_data['category']
                json_file = request.FILES['json_file']
                
                try:
                    # Read and decode the file as UTF-8
                    file_content = json_file.read().decode('utf-8').strip()
                    
                    extracted_keywords = []
                    is_json = False
                    
                    try:
                        data = json.loads(file_content)
                        is_json = True
                    except json.JSONDecodeError:
                        # Fallback: Treat as raw text (one keyword per line)
                        data = file_content.splitlines()
                        is_json = False

                    def extract_strings(obj):
                        """Recursively extract meaningful strings, handling numbers based on category."""
                        if isinstance(obj, str):
                            val = obj.strip()
                            if category == 'number':
                                if val: extracted_keywords.append(val)
                            else:
                                if not val.isdigit() and val:
                                    extracted_keywords.append(val)
                        elif isinstance(obj, (int, float)):
                            if category == 'number':
                                extracted_keywords.append(str(obj))
                        elif isinstance(obj, list):
                            for item in obj:
                                extract_strings(item)
                        elif isinstance(obj, dict):
                            # Prioritize common keys including geographic/village fields
                            priority_keys = [
                                'text', 'name', 'keyword', 'value', 'word', 
                                'village_name_bn', 'village_name_en', 'village', 'city', 'district', 'thana',
                                'bn_name', 'en_name', 'union_name', 'upazila_name', 'upazilla_name'
                            ]
                            found_priority = False
                            for key in priority_keys:
                                if key in obj and (isinstance(obj[key], str) or isinstance(obj[key], (int, float))):
                                    val = str(obj[key]).strip()
                                    if category == 'number' or not val.isdigit():
                                        extracted_keywords.append(val)
                                        found_priority = True
                            
                            # ALWAYS check all values for nested structures (like "data": [...])
                            # regardless of whether priority keys were found at this level.
                            for value in obj.values():
                                if not found_priority and isinstance(value, str):
                                    val = value.strip()
                                    if category == 'number' or not val.isdigit():
                                        extracted_keywords.append(val)
                                elif isinstance(value, (int, float)) and category == 'number' and not found_priority:
                                    extracted_keywords.append(str(value))
                                elif isinstance(value, (list, dict)):
                                    extract_strings(value)

                    if is_json:
                        extract_strings(data)
                    else:
                        # Smarter Text Fallback: Try to clean lines that look like "key": "value"
                        for line in data:
                            line = line.strip()
                            if not line or line in ['[', ']', '{', '}', '],', '},']:
                                continue
                            
                            # Remove trailing commas
                            line = line.rstrip(',')
                            
                            # If it looks like "something": "value"
                            if ':' in line:
                                parts = line.split(':', 1)
                                val = parts[1].strip()
                            else:
                                val = line
                            
                            # Strip quotes
                            val = val.strip('"').strip("'").strip()
                            
                            if category == 'number':
                                if val: extracted_keywords.append(val)
                            elif val and not val.isdigit():
                                extracted_keywords.append(val)
                    
                    if not extracted_keywords:
                        messages.error(request, "Could not find any keywords in the file.")
                        return redirect("..")
                    
                    # Remove duplicates and empty strings
                    extracted_keywords = list(set(kw for kw in extracted_keywords if kw))
                    
                    count = 0
                    for item in extracted_keywords:
                        _, created = SmartKeyword.objects.get_or_create(
                            text=item,
                            category=category
                        )
                        if created:
                            count += 1
                    
                    source_type = "JSON" if is_json else "Plain Text"
                    messages.success(request, f"Processed as {source_type}. Added {count} new keywords (Total: {len(extracted_keywords)}) to {category}.")
                    return redirect("admin:aiAgent_smartkeyword_changelist")
                except Exception as e:
                    messages.error(request, f"Error processing file: {str(e)}")
                    return redirect("..")
        else:
            form = KeywordUploadForm()
        
        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'opts': self.model._meta,
        }
        return render(request, "admin/aiAgent/smartkeyword/upload_json.html", context)

@admin.register(SmartTranslationMap)
class SmartTranslationMapAdmin(ModelAdmin):
    list_display = ('id', 'source_text', 'target_text', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('source_text', 'target_text')
    list_editable = ('is_active',)
    ordering = ('source_text',)
    list_per_page = 50
    change_list_template = "admin/aiAgent/smarttranslationmap/change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-bulk/',
                self.admin_site.admin_view(self.upload_bulk),
                name='aiAgent_smarttranslationmap_upload_bulk'
            ),
        ]
        return custom_urls + urls

    def _parse_mapping_json(self, parsed):
        pairs = []
        if isinstance(parsed, dict):
            for k, v in parsed.items():
                if isinstance(k, str) and isinstance(v, str):
                    pairs.append((k.strip(), v.strip()))
        elif isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict):
                    src = item.get("source") or item.get("source_text") or item.get("from") or item.get("key")
                    tgt = item.get("target") or item.get("target_text") or item.get("to") or item.get("value")
                    if isinstance(src, str) and isinstance(tgt, str):
                        pairs.append((src.strip(), tgt.strip()))
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    src, tgt = item[0], item[1]
                    if isinstance(src, str) and isinstance(tgt, str):
                        pairs.append((src.strip(), tgt.strip()))
        return pairs

    def _parse_mapping_lines(self, text):
        pairs = []
        separators = ["=>", "->", "\t", ",", "|", ":"]
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            matched = False
            for sep in separators:
                if sep in line:
                    left, right = line.split(sep, 1)
                    src = left.strip().strip('"').strip("'")
                    tgt = right.strip().strip('"').strip("'")
                    if src and tgt:
                        pairs.append((src, tgt))
                    matched = True
                    break
            if not matched:
                continue
        return pairs

    def upload_bulk(self, request):
        if request.method == "POST":
            form = TranslationMapBulkUploadForm(request.POST, request.FILES)
            if form.is_valid():
                json_file = form.cleaned_data.get("json_file")
                bulk_text = (form.cleaned_data.get("bulk_text") or "").strip()
                extracted_pairs = []

                try:
                    if json_file:
                        file_content = json_file.read().decode("utf-8").strip()
                        parsed = json.loads(file_content)
                        extracted_pairs.extend(self._parse_mapping_json(parsed))

                    if bulk_text:
                        extracted_pairs.extend(self._parse_mapping_lines(bulk_text))

                    if not extracted_pairs:
                        messages.error(
                            request,
                            "No valid mappings found. Provide JSON or line format like: source => target"
                        )
                        return redirect("..")

                    normalized = []
                    seen = set()
                    for src, tgt in extracted_pairs:
                        if not src or not tgt:
                            continue
                        key = src.lower()
                        if key in seen:
                            continue
                        seen.add(key)
                        normalized.append((src, tgt))

                    created_count = 0
                    updated_count = 0
                    for src, tgt in normalized:
                        _, created = SmartTranslationMap.objects.update_or_create(
                            source_text=src,
                            defaults={"target_text": tgt, "is_active": True}
                        )
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1

                    messages.success(
                        request,
                        f"Bulk mapping done. Created {created_count}, Updated {updated_count}, Total processed {len(normalized)}."
                    )
                    return redirect("admin:aiAgent_smarttranslationmap_changelist")
                except Exception as e:
                    messages.error(request, f"Bulk upload failed: {str(e)}")
                    return redirect("..")
        else:
            form = TranslationMapBulkUploadForm()

        context = {
            **self.admin_site.each_context(request),
            "form": form,
            "opts": self.model._meta,
        }
        return render(request, "admin/aiAgent/smarttranslationmap/upload_bulk.html", context)

@admin.register(Contact)
class ContactAdmin(ModelAdmin):
    list_display = ['identifier', 'name', 'push_name', 'agent', 'platform', 'is_auto_reply_enabled', 'updated_at']
    list_filter = ['platform', 'is_auto_reply_enabled', 'agent', 'platform']
    search_fields = ['identifier', 'name', 'push_name']
    readonly_fields = ['created_at', 'updated_at']
@admin.register(WidgetSettings)
class WidgetSettingsAdmin(ModelAdmin):
    list_display = ['agent', 'primary_color', 'widget_position', 'is_enabled', 'updated_at']
    list_filter = ['is_enabled', 'widget_position']
    search_fields = ['agent__name', 'header_title']
