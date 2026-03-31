"""
Management command to test and debug YouTube OAuth flow from server side.

Usage: python manage.py test_youtube_flow --user-id=<id>
       python manage.py test_youtube_flow --check-redis
       python manage.py test_youtube_flow --check-db
"""

import json
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Debug YouTube OAuth connection flow'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, help='User ID to check')
        parser.add_argument('--check-redis', action='store_true', help='List all yt_session keys in Redis')
        parser.add_argument('--check-db', action='store_true', help='Show all YouTubeChannel and AgentAI youtube records')
        parser.add_argument('--simulate', action='store_true', help='Simulate confirm_youtube_connection for first available session')

    def handle(self, *args, **options):
        if options['check_redis']:
            self.check_redis()

        if options['check_db']:
            self.check_db(options.get('user_id'))

        if options['simulate']:
            self.simulate_confirm(options.get('user_id'))

        if not any([options['check_redis'], options['check_db'], options['simulate']]):
            self.check_redis()
            self.check_db(options.get('user_id'))

    def check_redis(self):
        self.stdout.write(self.style.WARNING("\n=== REDIS: Active YouTube Sessions ==="))
        try:
            from aiAgent.cache.client import get_redis_client
            r = get_redis_client()
            keys = r.keys("yt_session:*")
            self.stdout.write(f"Found {len(keys)} active session(s)")
            for key in keys:
                raw = r.get(key)
                ttl = r.ttl(key)
                data = json.loads(raw)
                channels = data.get("channels", [])
                self.stdout.write(f"\n  Key: {key.decode()}")
                self.stdout.write(f"  TTL: {ttl}s")
                self.stdout.write(f"  User ID: {data.get('user_id')}")
                self.stdout.write(f"  access_token present: {bool(data.get('access_token'))}")
                self.stdout.write(f"  refresh_token present: {bool(data.get('refresh_token'))}")
                self.stdout.write(f"  token_expires_at: {data.get('token_expires_at')}")
                self.stdout.write(f"  Channels ({len(channels)}):")
                for ch in channels:
                    ch_id = ch.get("id", "NO_ID")
                    snippet = ch.get("snippet", {})
                    title = snippet.get("title") if snippet else ch.get("name", "NO_TITLE")
                    handle = snippet.get("customUrl") if snippet else ch.get("handle", "")
                    self.stdout.write(f"    - id={ch_id} | title={title} | handle={handle}")
                    self.stdout.write(f"      snippet present: {bool(snippet)}")
                    self.stdout.write(f"      raw keys: {list(ch.keys())}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Redis error: {e}"))

    def check_db(self, user_id=None):
        self.stdout.write(self.style.WARNING("\n=== DATABASE: YouTubeChannel records ==="))
        try:
            from users.models import YouTubeChannel
            qs = YouTubeChannel.objects.all()
            if user_id:
                qs = qs.filter(user_id=user_id)
            self.stdout.write(f"Total: {qs.count()}")
            for ch in qs:
                self.stdout.write(f"  channel_id={ch.channel_id} | title={ch.channel_title} | user={ch.user_id} | active={ch.is_active}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"DB error (YouTubeChannel): {e}"))

        self.stdout.write(self.style.WARNING("\n=== DATABASE: AgentAI (youtube) records ==="))
        try:
            from aiAgent.models import AgentAI
            qs = AgentAI.objects.filter(platform='youtube')
            if user_id:
                qs = qs.filter(user_id=user_id)
            self.stdout.write(f"Total: {qs.count()}")
            for ag in qs:
                self.stdout.write(f"  page_id={ag.page_id} | name={ag.name} | user={ag.user_id} | active={ag.is_active}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"DB error (AgentAI): {e}"))

    def simulate_confirm(self, user_id=None):
        self.stdout.write(self.style.WARNING("\n=== SIMULATING: confirm_youtube_connection ==="))
        try:
            from aiAgent.cache.client import get_redis_client
            r = get_redis_client()
            keys = r.keys("yt_session:*")
            if not keys:
                self.stdout.write(self.style.ERROR("No active yt_session found in Redis. Connect YouTube first."))
                return

            key = keys[0].decode()
            session_id = key.replace("yt_session:", "")
            raw = r.get(key)
            data = json.loads(raw)

            channels = data.get("channels", [])
            if not channels:
                self.stdout.write(self.style.ERROR("Session has no channels!"))
                return

            ch = channels[0]
            channel_id = ch.get("id")
            snippet = ch.get("snippet", {})
            channel_title = snippet.get("title") if snippet else ch.get("name", f"Channel ({channel_id})")
            custom_url = (snippet.get("customUrl") if snippet else ch.get("handle")) or ""

            target_user_id = user_id or data.get("user_id")

            self.stdout.write(f"session_id: {session_id}")
            self.stdout.write(f"channel_id: {channel_id}")
            self.stdout.write(f"channel_title: {channel_title}")
            self.stdout.write(f"custom_url: {custom_url}")
            self.stdout.write(f"target_user_id: {target_user_id}")

            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"User {target_user_id} not found!"))
                return

            from users.models import YouTubeChannel
            yt_ch, created = YouTubeChannel.objects.update_or_create(
                channel_id=channel_id,
                defaults={
                    'user': user,
                    'channel_title': channel_title,
                    'custom_url': custom_url,
                    'access_token': data.get("access_token", ""),
                    'refresh_token': data.get("refresh_token", ""),
                    'is_active': True,
                }
            )
            self.stdout.write(self.style.SUCCESS(f"YouTubeChannel {'CREATED' if created else 'UPDATED'}: pk={yt_ch.pk}"))

            from aiAgent.models import AgentAI
            agent_name = f"{channel_title} ({custom_url})" if custom_url else f"{channel_title} ({channel_id})"
            agent, ag_created = AgentAI.objects.get_or_create(
                page_id=channel_id,
                platform='youtube',
                defaults={
                    'user': user,
                    'name': agent_name,
                    'access_token': data.get("access_token", ""),
                    'system_prompt': f"You are the AI assistant for {channel_title}.",
                    'is_active': True,
                }
            )
            self.stdout.write(self.style.SUCCESS(f"AgentAI {'CREATED' if ag_created else 'ALREADY EXISTS'}: pk={agent.pk}, name={agent.name}"))

        except Exception as e:
            import traceback
            self.stdout.write(self.style.ERROR(f"Simulation failed: {e}"))
            self.stdout.write(traceback.format_exc())
