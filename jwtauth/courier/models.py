from django.db import models
from django.contrib.auth import get_user_model
from users.models import CustomerOrder

User = get_user_model()

class PathaoCourierConfig(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='pathao_config')
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(max_length=255)
    username = models.CharField(max_length=255, help_text="Pathao Merchant Registered Email/Username")
    password = models.CharField(max_length=255, help_text="Pathao Merchant Password")
    store_id = models.CharField(max_length=100, blank=True, null=True, help_text="Default Store ID to book orders")
    is_sandbox = models.BooleanField(default=True, help_text="Check to use Pathao Sandbox environment")
    is_active = models.BooleanField(default=True)
    
    # Credentials Cache
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Pathao Config for {self.user.email} (Active: {self.is_active})"


class PathaoBookingLog(models.Model):
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name='pathao_bookings')
    consignment_id = models.CharField(max_length=100, unique=True, help_text="Consignment ID returned by Pathao")
    merchant_order_id = models.CharField(max_length=100)
    status = models.CharField(max_length=100, default='pending')
    response_data = models.JSONField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Booking {self.consignment_id} for Order #{self.order.id}"

class PathaoCity(models.Model):
    city_id = models.IntegerField(unique=True)
    city_name = models.CharField(max_length=255)
    
    def __str__(self):
        return self.city_name

class PathaoZone(models.Model):
    zone_id = models.IntegerField(unique=True)
    zone_name = models.CharField(max_length=255)
    city = models.ForeignKey(PathaoCity, on_delete=models.CASCADE, related_name='zones', to_field='city_id')
    
    def __str__(self):
        return self.zone_name

class PathaoArea(models.Model):
    area_id = models.IntegerField(unique=True)
    area_name = models.CharField(max_length=255)
    zone = models.ForeignKey(PathaoZone, on_delete=models.CASCADE, related_name='areas', to_field='zone_id')
    
    def __str__(self):
        return self.area_name


class PathaoZonePrice(models.Model):
    store_id = models.CharField(max_length=100)
    city_id = models.IntegerField()
    zone_id = models.IntegerField()
    weight = models.FloatField(default=0.5)
    
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    cod_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('store_id', 'city_id', 'zone_id', 'weight')
        indexes = [
            models.Index(fields=['store_id', 'city_id', 'zone_id', 'weight']),
        ]

    def __str__(self):
        return f"Store {self.store_id} - Zone {self.zone_id} ({self.weight}kg): {self.total_amount} BDT"
