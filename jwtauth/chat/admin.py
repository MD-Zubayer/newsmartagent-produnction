from django.contrib import admin
from .models import Conversation, Message, Contact, Notification, PostCache

# Register your models here.


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        'agentAi',
        'contact_id',
        'contact_name',
        'status',
        'last_message_at',
        'created_at',
    )
    list_filter = (
        'agentAi',
        'status',
        'created_at',
    )
    search_fields = (
        'contact_id',
        'contact_name',
        'agentAi__name',
        'agentAi__user__username',
        'agentAi__user__email',
    )
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'last_message_at')
    list_per_page = 20

    fieldsets = (
        ('Basic Information', {
            'fields': (
                'agentAi',
                'contact_id',
                'contact_name',
                'status',
            )
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'last_message_at',
            ),
            'classes': ('collapse',),
        }),
    )


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        'conversation',
        'role',
        'short_content',
        'sent_at',
        'tokens_used',
    )
    list_filter = (
        'role',
        'conversation__agentAi',
        'sent_at',
    )
    search_fields = (
        'content',
        'conversation__contact_id',
        'conversation__agentAi__name',
    )
    date_hierarchy = 'sent_at'
    readonly_fields = ('sent_at',)
    list_per_page = 25

    fieldsets = (
        ('Message Details', {
            'fields': (
                'conversation',
                'role',
                'content',
                'tokens_used',
                'sent_at',
            )
        }),
    )
    ordering = ['-sent_at']

    def short_content(self, obj):
        """Admin list-এ পুরো কনটেন্ট না দেখিয়ে ছোট করে দেখানো"""
        if obj.content:
            return (obj.content[:60] + "...") if len(obj.content) > 60 else obj.content
        return "-"
    short_content.short_description = "Content"


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    # অ্যাডমিন প্যানেলের তালিকায় কোন কোন কলাম দেখা যাবে
    list_display = ('name', 'email', 'subjects', 'messages', 'created_at')
    
    # কোন কোন ফিল্ড দিয়ে সার্চ করা যাবে
    search_fields = ('name', 'email', 'subjects', 'messages')
    
    # ডান পাশে ফিল্টার অপশন (তারিখ অনুযায়ী ফিল্টার করার জন্য)
    list_filter = ('created_at',)
    
    # তালিকাটি ডিফল্টভাবে নতুন থেকে পুরাতন ক্রমে সাজানো থাকবে
    ordering = ('-created_at',)
    
    # শুধু পড়ার জন্য (অ্যাডমিন প্যানেল থেকে যাতে কেউ মেসেজ এডিট করতে না পারে)
    readonly_fields = ('created_at',)

    # কলামের টাইটেল সুন্দর করার জন্য (অপশনাল)
    fieldsets = (
        ('Sender Information', {
            'fields': ('name', 'email')
        }),
        ('Message Content', {
            'fields': ('subjects', 'messages')
        }),
        ('Metadata', {
            'fields': ('created_at',),
        }),
    )
    
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id','user', 'message', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['message', 'user__username']

@admin.register(PostCache)
class PostCacheAdmin(admin.ModelAdmin):
    list_display = ['id', 'post_id', 'summary', 'created_at']