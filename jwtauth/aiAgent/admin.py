from django.contrib import admin
from .models import AgentAI,MissingRequirement
from django.utils.html import format_html
from .models import UserMemory, AgentAI
import json
from django.db.models import Sum, Count, Avg
from django.utils.html import format_html
from .models import TokenUsageLog


# Register your models here.



@admin.register(AgentAI)
class AgentAIAdmin(admin.ModelAdmin):
    list_display = [ 'id', 'name', 'user', 'platform', 'ai_agent_type', 'page_id', 'is_active','custom_keywords', 'created_at', 'access_token', 'webhook_secret', 'token_expires_at']
    list_filter = ['platform', 'is_active', 'user', 'ai_agent_type',]
    search_fields = ['name', 'page_id', 'user__username']
    # readonly_fields = ['create_at', 'access_token', 'webhook_secret']

    def created_short(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_short.short_description = "Created"




@admin.register(MissingRequirement)
class MissingRequirementAdmin(admin.ModelAdmin):
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
class UserMemoryAdmin(admin.ModelAdmin):
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
class TokenUsageLogAdmin(admin.ModelAdmin):
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
class DashboardAILogAdmin(admin.ModelAdmin):
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