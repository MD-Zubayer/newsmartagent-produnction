import uuid
import datetime
from django.utils.deprecation import MiddlewareMixin
from aiAgent.models import WebsiteVisitor

class VisitorTrackingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        if request.path.startswith('/api/') or request.path.startswith('/admin/') or request.path.startswith('/static/') or request.path.startswith('/media/'):
            return None

        visitor_uuid = request.COOKIES.get('VISITOR_ID')
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
            
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:512]
        device_type = 'Mobile' if 'Mobile' in user_agent else 'Desktop'

        try:
            if visitor_uuid:
                visitor = WebsiteVisitor.objects.filter(visitor_uuid=visitor_uuid).first()
                if visitor:
                    # Update without spamming DB too much
                    visitor.view_count += 1
                    visitor.ip_address = ip
                    visitor.user_agent = user_agent
                    if request.user.is_authenticated and not visitor.user:
                        visitor.user = request.user
                    visitor.save(update_fields=['view_count', 'last_visited', 'ip_address', 'user_agent', 'user'])
                    request.visitor = visitor
                    return None
            
            # New Session
            new_uuid = uuid.uuid4()
            visitor = WebsiteVisitor.objects.create(
                visitor_uuid=new_uuid,
                ip_address=ip,
                user_agent=user_agent,
                device_type=device_type
            )
            if request.user.is_authenticated:
                visitor.user = request.user
                visitor.save(update_fields=['user'])
                
            request.visitor = visitor
            request._new_visitor_cookie = str(new_uuid)
            
        except Exception:
            pass

        return None

    def process_response(self, request, response):
        if hasattr(request, '_new_visitor_cookie'):
            response.set_cookie(
                'VISITOR_ID', 
                request._new_visitor_cookie, 
                max_age=365 * 24 * 60 * 60,
                httponly=False,  # Needs to be readable by Frontend scripts for API updates
                samesite='Lax'
            )
        return response
