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
            # Data sent from n8n (Enhanced Structure)
            data = request.data
            context = {
                'project': data.get('project', 'New Smart Agent'),
                'workflow_name': data.get('workflow_name', 'Unnamed Workflow'),
                'workflow_url': data.get('workflow_url', '#'),
                'execution_id': data.get('execution_id', 'Unknown'),
                'failed_node': data.get('failed_node', 'Unknown Node'),
                'error_type': data.get('error_type', 'Error'),
                'error_message': data.get('error_message', 'No specific error message provided.'),
                'full_stack': data.get('full_stack', ''),
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
