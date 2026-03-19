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

    def url(self, name, parameters=None, expire=None, http_method=None):
        # Robust URL generation to avoid the 'missing colon' issue
        ext_endpoint = os.environ.get('MINIO_EXTERNAL_ENDPOINT', '').rstrip('/')
        if ext_endpoint:
            return f"{ext_endpoint}/{self.bucket_name}/{name}"
        return super().url(name, parameters, expire, http_method)

class MediaStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_STORAGE_BUCKET_NAME', 'newsmartagent-media')

class BlogStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_BLOG_BUCKET_NAME', 'blogs')
