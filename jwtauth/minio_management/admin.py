import os
import boto3
import json
from django.contrib import admin, messages
from django.utils.html import format_html
from .models import MinioBucket
from botocore.client import Config

def get_s3_client():
    return boto3.client('s3',
        endpoint_url=os.environ.get('MINIO_ENDPOINT'),
        aws_access_key_id=os.environ.get('MINIO_ROOT_USER'),
        aws_secret_access_key=os.environ.get('MINIO_ROOT_PASSWORD'),
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

def get_s3_resource():
    return boto3.resource('s3',
        endpoint_url=os.environ.get('MINIO_ENDPOINT'),
        aws_access_key_id=os.environ.get('MINIO_ROOT_USER'),
        aws_secret_access_key=os.environ.get('MINIO_ROOT_PASSWORD'),
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

@admin.register(MinioBucket)
class MinioBucketAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_public', 'last_sync', 'status_tag')
    search_fields = ('name',)
    readonly_fields = ('last_sync',)
    fields = ('name', 'custom_policy', 'is_public', 'last_sync')

    def status_tag(self, obj):
        if obj.is_public:
            return format_html('<span style="color: green;">{}</span>', 'Public')
        return format_html('<span style="color: red;">{}</span>', 'Private')
    status_tag.short_description = "Policy Status"

    def save_model(self, request, obj, form, change):
        s3 = get_s3_client()
        s3_resource = get_s3_resource()
        
        # 1. Create bucket if it doesn't exist
        try:
            s3.head_bucket(Bucket=obj.name)
        except:
            try:
                s3.create_bucket(Bucket=obj.name)
                messages.success(request, f"Bucket '{obj.name}' created in MinIO.")
            except Exception as e:
                messages.error(request, f"Error creating bucket in MinIO: {e}")
                return

        # 2. Handle Policy
        try:
            if obj.custom_policy:
                # Validate JSON
                policy_json = json.loads(obj.custom_policy)
                s3_resource.BucketPolicy(obj.name).put(Policy=json.dumps(policy_json))
                messages.success(request, f"Custom policy applied to '{obj.name}'.")
            elif obj.is_public:
                # Default Public Read Policy
                public_policy = {
                    "Version": "2012-10-17",
                    "Statement": [{
                        "Sid": "PublicRead",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{obj.name}/*"]
                    }]
                }
                s3_resource.BucketPolicy(obj.name).put(Policy=json.dumps(public_policy))
                messages.success(request, f"Default public policy applied to '{obj.name}'.")
            else:
                # Make Private
                s3_resource.BucketPolicy(obj.name).delete()
                messages.success(request, f"Bucket '{obj.name}' is now private.")
        except json.JSONDecodeError:
            messages.error(request, "Invalid JSON in Custom Policy field.")
        except Exception as e:
            messages.error(request, f"Error applying policy: {e}")

        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        s3 = get_s3_client()
        try:
            s3.delete_bucket(Bucket=obj.name)
            messages.success(request, f"Bucket '{obj.name}' deleted from MinIO.")
        except Exception as e:
            messages.error(request, f"Error deleting bucket from MinIO: {e}")
        super().delete_model(request, obj)

    # Actions
    actions = ['sync_from_minio']

    @admin.action(description="Sync existing buckets from MinIO to Database")
    def sync_from_minio(self, request, queryset):
        s3 = get_s3_client()
        try:
            response = s3.list_buckets()
            count = 0
            for b in response['Buckets']:
                name = b['Name']
                is_public = False
                try:
                    policy_status = s3.get_bucket_policy_status(Bucket=name)
                    is_public = policy_status.get('PolicyStatus', {}).get('IsPublic', False)
                except:
                    pass
                
                MinioBucket.objects.update_or_create(
                    name=name,
                    defaults={'is_public': is_public}
                )
                count += 1
            messages.success(request, f"Synced {count} buckets from MinIO.")
        except Exception as e:
            messages.error(request, f"Sync error: {e}")
