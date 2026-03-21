import os
import boto3
from botocore.client import Config

def create_bucket():
    bucket_name = os.environ.get('MINIO_STORAGE_BUCKET_NAME')
    access_key = os.environ.get('MINIO_ROOT_USER')
    secret_key = os.environ.get('MINIO_ROOT_PASSWORD')
    endpoint = os.environ.get('MINIO_ENDPOINT')

    if not all([bucket_name, access_key, secret_key, endpoint]):
        print("Error: Missing environment variables for MinIO.")
        return

    s3 = boto3.resource('s3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

    try:
        if s3.Bucket(bucket_name).creation_date:
            print(f"Bucket '{bucket_name}' already exists.")
        else:
            s3.create_bucket(Bucket=bucket_name)
            print(f"Bucket '{bucket_name}' created successfully.")
            
            # Set public read policy
            bucket_policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "PublicRead",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                    }
                ]
            }
            import json
            s3.BucketPolicy(bucket_name).put(Policy=json.dumps(bucket_policy))
            print(f"Public read policy set for '{bucket_name}'.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_bucket()
