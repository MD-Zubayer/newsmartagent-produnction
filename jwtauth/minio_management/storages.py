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
        ext_endpoint = os.environ.get('MINIO_EXTERNAL_ENDPOINT', '')
        if ext_endpoint:
            self.custom_domain = ext_endpoint.replace('https://', '').replace('http://', '').rstrip('/')
            self.url_protocol = 'https' if ext_endpoint.startswith('https') else 'http'
        super().__init__(*args, **kwargs)

class MediaStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_STORAGE_BUCKET_NAME', 'newsmartagent-media')

class BlogStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_BLOG_BUCKET_NAME', 'blogs')
