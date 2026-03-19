from storages.backends.s3boto3 import S3Boto3Storage
import os

class BaseMinioStorage(S3Boto3Storage):
    access_key = os.environ.get('MINIO_ROOT_USER')
    secret_key = os.environ.get('MINIO_ROOT_PASSWORD')
    endpoint_url = os.environ.get('MINIO_ENDPOINT')
    custom_domain = os.environ.get('MINIO_EXTERNAL_ENDPOINT', '').replace('https://', '').replace('http://', '')
    url_protocol = 'https' if os.environ.get('MINIO_EXTERNAL_ENDPOINT', '').startswith('https') else 'http'
    use_ssl = url_protocol == 'https'
    file_overwrite = False
    querystring_auth = False

class MediaStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_STORAGE_BUCKET_NAME', 'newsmartagent-media')

class BlogStorage(BaseMinioStorage):
    bucket_name = os.environ.get('MINIO_BLOG_BUCKET_NAME', 'blogs')
