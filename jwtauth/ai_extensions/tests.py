from django.contrib.auth import get_user_model
from django.test import TestCase

from aiAgent.models import AgentAI
from .models import Extension, ExtensionAssignment, ExtensionVersion
from .resolver import resolve
from .serializers import ExtensionAssignmentSerializer
from .views import ExtensionAssignmentViewSet


class ExtensionResolverTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="extension-user", password="test")
        self.agent = AgentAI.objects.create(
            user=self.user, name="Test agent", platform="web_widget",
            system_prompt="Base prompt", page_id="extension-test-agent",
        )
        self.extension = Extension.objects.create(
            key="test-prompt", name="Test prompt", category="prompt",
            is_installed=True, is_enabled=True,
        )
        self.version = ExtensionVersion.objects.create(
            extension=self.extension, version="1.0.0", target="prompt",
            entry_point="ai_extensions.builtins:StrictGroundedPrompt", status="stable",
        )

    def test_disabled_catalog_extension_is_not_resolved(self):
        self.extension.is_enabled = False
        self.extension.save(update_fields=["is_enabled"])
        ExtensionAssignment.objects.create(
            extension=self.extension, version=self.version, scope="agent",
            agent=self.agent,
        )
        assignment, factory = resolve("test-prompt", "prompt", agent=self.agent, user=self.user)
        self.assertIsNone(assignment)
        self.assertIsNone(factory)

    def test_user_scope_has_priority_over_agent_and_global(self):
        global_assignment = ExtensionAssignment.objects.create(
            extension=self.extension, version=self.version, scope="global", priority=1,
        )
        agent_assignment = ExtensionAssignment.objects.create(
            extension=self.extension, version=self.version, scope="agent",
            agent=self.agent, priority=1,
        )
        user_assignment = ExtensionAssignment.objects.create(
            extension=self.extension, version=self.version, scope="user",
            user=self.user, priority=999,
        )
        assignment, factory = resolve("test-prompt", "prompt", agent=self.agent, user=self.user)
        self.assertIsNotNone(factory)
        self.assertEqual(assignment.pk, user_assignment.pk)
        self.assertNotEqual(assignment.pk, agent_assignment.pk)
        self.assertNotEqual(assignment.pk, global_assignment.pk)

    def test_new_version_disables_previous_version_in_same_scope(self):
        first = ExtensionAssignment.objects.create(
            extension=self.extension, version=self.version, scope="agent",
            agent=self.agent, is_enabled=True,
        )
        second_version = ExtensionVersion.objects.create(
            extension=self.extension, version="2.0.0", target="prompt",
            entry_point="ai_extensions.builtins:StrictGroundedPrompt", status="stable",
        )
        serializer = ExtensionAssignmentSerializer(data={
            "extension": self.extension.pk, "version": second_version.pk,
            "scope": "agent", "agent": self.agent.pk, "is_enabled": True,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ExtensionAssignmentViewSet()._save_assignment(serializer)
        first.refresh_from_db()
        self.assertFalse(first.is_enabled)
        self.assertTrue(ExtensionAssignment.objects.get(version=second_version).is_enabled)
