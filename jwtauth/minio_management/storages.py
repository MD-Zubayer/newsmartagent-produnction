from storages.backends.s3boto3 import S3Boto3Storage
import os

class BaseMinioStorage(S3Boto3Storage):
    access_key = os.environ.get('MINIO_ROOT_USER')
    secret_key = os.environ.get('MINIO_ROOT_PASSWORD')
    endpoint_url = os.environ.get('MINIO_ENDPOINT')
    file_overwrite = False
    querystring_auth = False
    addressing_style = 'path'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def url(self, name, parameters=None, expire=900, http_method=None):
        # Generate a signed URL if querystring_auth is True
        if self.querystring_auth:
            import boto3
            from botocore.config import Config
            
            # We must use the EXTERNAL endpoint for the signature so the client can reach it
            ext_endpoint = os.environ.get('MINIO_EXTERNAL_ENDPOINT', 'https://s3.newsmartagent.com')
            
            s3_client = boto3.client(
                's3',
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                endpoint_url=ext_endpoint,
                config=Config(signature_version='s3v4'),
                region_name='us-east-1' # MinIO usually doesn't care about region but boto3 needs it
            )
            
            return s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': name},
                ExpiresIn=expire
            )
            
        # Fallback to simple absolute URL for public buckets
        ext_endpoint = os.environ.get('MINIO_EXTERNAL_ENDPOINT', '').rstrip('/')
        if ext_endpoint:
            return f"{ext_endpoint}/{self.bucket_name}/{name}"
        return super().url(name, parameters, expire, http_method)

class MediaStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_STORAGE_BUCKET_NAME', 'newsmartagent-media')

class BlogStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_BLOG_BUCKET_NAME', 'blogs')

class ProfileStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_PROFILE_BUCKET_NAME', 'newsmartagent-profile')
    querystring_auth = True

class ContactProfileStorage(BaseMinioStorage):
    """
    Contact avatars are shown inside the dashboard list; long-lived, non-expiring
    URLs are more convenient there. Keep them public (no signed querystring).
    """
    bucket_name = os.environ.get('MINIO_PROFILE_BUCKET_NAME', 'newsmartagent-profile')
    querystring_auth = False
