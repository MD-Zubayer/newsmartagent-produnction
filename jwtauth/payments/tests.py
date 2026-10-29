from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User, Profile, Payment

class AutomaticPaymentVerifyTests(APITestCase):
    def setUp(self):
        from users.models import UniqueIDPool
        UniqueIDPool.objects.bulk_create([
            UniqueIDPool(uid=f"TESTID_{i}", is_used=False) for i in range(10)
        ])
        self.user = User.objects.create_user(
            email='testmerchant@example.com',
            password='testpassword123'
        )
        # Note: Profile is automatically created on register by django signals. Let's retrieve it.
        self.profile = self.user.profile
        self.profile.acount_balance = 0
        self.profile.save()
        self.url = reverse('payment_automatic')
        self.client.force_authenticate(user=self.user)

    @patch('aiAgent.payment_verification.verify_payment_screenshot')
    def test_automatic_verify_success(self, mock_verify):
        mock_verify.return_value = {
            'status': 'success',
            'amount': 1500.0,
            'transaction_id': 'TEST_TRX_ID_123',
            'payment_method': 'bkash',
            'reason': None
        }

        from django.core.files.uploadedfile import SimpleUploadedFile
        mock_file = SimpleUploadedFile("screenshot.jpg", b"mock_file_content", content_type="image/jpeg")

        response = self.client.post(self.url, {'screenshot': mock_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['success'], True)
        self.assertEqual(float(response.data['amount']), 1500.0)
        self.assertEqual(response.data['transaction_id'], 'TEST_TRX_ID_123')

        self.assertTrue(Payment.objects.filter(transaction_id='TEST_TRX_ID_123').exists())
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.acount_balance, 1500)

    @patch('aiAgent.payment_verification.verify_payment_screenshot')
    def test_automatic_verify_duplicate_trx(self, mock_verify):
        Payment.objects.create(
            profile=self.profile,
            amount=1000.00,
            transaction_id='DUP_TRX_999',
            payment_type='balance',
            status='paid'
        )

        mock_verify.return_value = {
            'status': 'success',
            'amount': 1000.0,
            'transaction_id': 'DUP_TRX_999',
            'payment_method': 'bkash',
            'reason': None
        }

        from django.core.files.uploadedfile import SimpleUploadedFile
        mock_file = SimpleUploadedFile("screenshot.jpg", b"mock_file_content", content_type="image/jpeg")

        response = self.client.post(self.url, {'screenshot': mock_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been verified', response.data['error'])

    @patch('aiAgent.payment_verification.verify_payment_screenshot')
    def test_automatic_verify_failed_ai(self, mock_verify):
        mock_verify.return_value = {
            'status': 'failed',
            'amount': None,
            'transaction_id': None,
            'payment_method': 'unknown',
            'reason': 'Receipt is blur or not a success receipt.'
        }

        from django.core.files.uploadedfile import SimpleUploadedFile
        mock_file = SimpleUploadedFile("screenshot.jpg", b"mock_file_content", content_type="image/jpeg")

        response = self.client.post(self.url, {'screenshot': mock_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Receipt is blur or not a success receipt.')

    @patch('aiAgent.payment_verification.verify_payment_screenshot')
    def test_automatic_verify_above_threshold(self, mock_verify):
        mock_verify.return_value = {
            'status': 'success',
            'amount': 2500.0,
            'transaction_id': 'TEST_TRX_ABOVE_THRESHOLD',
            'payment_method': 'bkash',
            'reason': None
        }

        from django.core.files.uploadedfile import SimpleUploadedFile
        mock_file = SimpleUploadedFile("screenshot.jpg", b"mock_file_content", content_type="image/jpeg")

        response = self.client.post(self.url, {'screenshot': mock_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['success'], True)
        self.assertEqual(response.data['status'], 'pending')

        # Check that payment was created as pending and profile balance was NOT credited
        self.assertTrue(Payment.objects.filter(transaction_id='TEST_TRX_ABOVE_THRESHOLD', status='pending').exists())
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.acount_balance, 0)
