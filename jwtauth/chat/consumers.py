import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    
    
    async def connect(self):
        user = self.scope.get("user")
        
        if user and user.is_authenticated:
            self.group_name = f"user_{user.id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            print(f"🚀 Success: Connected User ID {user.id}")
        else:
            print("❌ Rejecting: Still Anonymous")
            await self.close()
    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            print(f"❌ WebSocket Disconnected: {self.group_name}")
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_notification(self, event):
        # ডাটাবেজ থেকে আসা ডাটা ফ্রন্টএন্ডে পাঠানো
        print(f"🔔 Sending Data to Frontend: {event['content']}")
        await self.send(text_data=json.dumps(event['content']))

    