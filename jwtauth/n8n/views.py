from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings

class N8NErrorAlertView(APIView):
    permission_classes = []  # Allow external hits from n8n

    def post(self, request, *args, **kwargs):
        try:
            # Data typically sent from n8n error node
            data = request.data
            workflow_name = data.get('workflow_name', 'Unnamed Workflow')
            error_message = data.get('error_message', 'No specific error message provided.')
            execution_id = data.get('execution_id', 'Unknown')
            timestamp = data.get('timestamp', 'Just now')
            node_name = data.get('node_name', 'Unknown Node')

            subject = f"🚨 [n8n Error] {workflow_name}"
            body = f"""
N8N WORKFLOW ERROR DETECTED

Workflow: {workflow_name}
Execution ID: {execution_id}
Failed Node: {node_name}
Timestamp: {timestamp}

Error Details:
------------------------------------------------------------
{error_message}
------------------------------------------------------------

Action Required: Please check the n8n execution log for more details and resolution.
            """

            # Send the email alert
            send_mail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [settings.DEFAULT_FROM_EMAIL], # Sending to the admin email
                fail_silently=False,
            )

            return Response({
                "status": "success",
                "message": "Error alert email sent successfully."
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to send error alert: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
