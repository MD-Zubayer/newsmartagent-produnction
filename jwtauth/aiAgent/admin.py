# aiAgent/admin.py
from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import AgentAI,MissingRequirement
from django.utils.html import format_html
from .models import UserMemory, AgentAI
import json
from django.db.models import Sum, Count, Avg
from django.utils.html import format_html
from .models import TokenUsageLog
from .models import AIProviderModel, SmartKeyword
from django import forms
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
import json

class KeywordUploadForm(forms.Form):
    category = forms.ChoiceField(choices=SmartKeyword.CATEGORY_CHOICES)
    json_file = forms.FileField(label="Select JSON File")

    


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


@admin.register(AgentAI)
class AgentAIAdmin(ModelAdmin):
    list_display = [ 'id', 'name', 'user', 'platform', 'ai_agent_type', 'special_agent_status', 'is_special_agent', 'is_active','custom_keywords', 'created_at']
    list_filter = ['platform', 'special_agent_status', 'is_active', 'is_special_agent', 'user', 'ai_agent_type',]
    search_fields = ['name', 'page_id', 'user__username']
    # readonly_fields = ['create_at', 'access_token', 'webhook_secret']

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
    list_display = ('text', 'category', 'is_active', 'created_at')
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
                    data = json.load(json_file)
                    extracted_keywords = []

                    def extract_strings(obj):
                        """Recursively extract meaningful strings from JSON."""
                        if isinstance(obj, str):
                            extracted_keywords.append(obj.strip())
                        elif isinstance(obj, list):
                            for item in obj:
                                extract_strings(item)
                        elif isinstance(obj, dict):
                            # Prioritize common keys like 'text', 'name', 'keyword'
                            priority_keys = ['text', 'name', 'keyword', 'value', 'word']
                            found_priority = False
                            for key in priority_keys:
                                if key in obj and isinstance(obj[key], str):
                                    extracted_keywords.append(obj[key].strip())
                                    found_priority = True
                                    # Don't break, there might be multiple (though rare)
                            
                            # If no priority keys found, check all values
                            if not found_priority:
                                for value in obj.values():
                                    if isinstance(value, str):
                                        extracted_keywords.append(value.strip())
                                    elif isinstance(value, (list, dict)):
                                        extract_strings(value)

                    extract_strings(data)
                    
                    if not extracted_keywords:
                        messages.error(request, "Could not find any keywords in the uploaded JSON.")
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
                    
                    messages.success(request, f"Successfully processed JSON. Added {count} new keywords (Total found: {len(extracted_keywords)}) to {category}.")
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
