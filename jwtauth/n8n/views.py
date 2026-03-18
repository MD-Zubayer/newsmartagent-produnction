from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

class N8NErrorAlertView(APIView):
    permission_classes = []  # Allow external hits from n8n

    def post(self, request, *args, **kwargs):
        try:
            # Data sent from n8n
            data = request.data
            context = {
                'workflow_name': data.get('workflow_name', 'Unnamed Workflow'),
                'workflow_id': data.get('workflow_id', 'Unknown'),
                'error_message': data.get('error_message', 'No specific error message provided.'),
                'node_name': data.get('node_name', 'Unknown Node'),
                'execution_url': data.get('execution_url', 'https://dev-n8n.newsmartagent.com'),
                'timestamp': data.get('timestamp', 'Just now'),
            }

            subject = f"🚨 [n8n Error] {context['workflow_name']}"
            
            # Render HTML template
            html_message = render_to_string('n8n/error_alert.html', context)
            # Create plain text version for fallback
            plain_message = strip_tags(html_message)

            # Send the email alert
            send_mail(
                subject,
                plain_message,
                settings.DEFAULT_FROM_EMAIL,
                [settings.DEFAULT_FROM_EMAIL], # Sending to the admin email
                html_message=html_message,
                fail_silently=False,
            )

            return Response({
                "status": "success",
                "message": "Professional error alert email sent successfully."
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to send error alert: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
