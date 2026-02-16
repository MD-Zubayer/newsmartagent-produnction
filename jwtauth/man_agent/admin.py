from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import ManAgentConfig, ReferralRelation

@admin.register(ManAgentConfig)
class ManAgentConfigAdmin(admin.ModelAdmin):
    # লিস্ট ভিউতে যা যা দেখাবে
    list_display = ('man_agent', 'otp_key', 'is_active', 'created_at')
    
    # এজেন্টের ইমেইল বা ওটিপি কী দিয়ে সার্চ করার সুবিধা
    search_fields = ('man_agent__email', 'otp_key')
    
    # স্ট্যাটাস অনুযায়ী ফিল্টার
    list_filter = ('is_active', 'created_at')
    
    # সরাসরি লিস্ট থেকেই একটিভ/ইন-এক্টিভ করার সুবিধা
    list_editable = ('is_active',)
    
    # তৈরি হওয়ার সময় পরিবর্তন করা যাবে না
    readonly_fields = ('created_at',)

@admin.register(ReferralRelation)
class ReferralRelationAdmin(admin.ModelAdmin):
    # রেফারেল হিস্ট্রি দেখার জন্য কলাম
    list_display = ('man_agent', 'referred_user', 'used_otp_key', 'joined_at')
    
    # এজেন্ট এবং যাকে রেফার করা হয়েছে উভয়ের তথ্য দিয়ে সার্চ
    search_fields = ('man_agent__email', 'referred_user__email', 'used_otp_key')
    
    # তারিখ অনুযায়ী ফিল্টার
    list_filter = ('joined_at',)
    
    # রেফারেল ডাটা সাধারণত এডিট করা হয় না, তাই এগুলো রিড-অনলি রাখা নিরাপদ
    readonly_fields = ('man_agent', 'referred_user', 'used_otp_key', 'joined_at')

    # ড্যাশবোর্ড থেকে সহজে দেখার জন্য সাজানো
    ordering = ('-joined_at',)
    
    
