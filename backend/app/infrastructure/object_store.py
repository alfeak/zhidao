import hashlib
import mimetypes
import os
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Iterable
import boto3
from botocore.config import Config

class ObjectStoreError(Exception):
    pass

@dataclass(frozen=True)
class StoredObject:
    archive_path: str
    object_key: str
    content_type: str
    byte_size: int
    sha256: str

class R2ObjectStore:
    def __init__(self):
        account_id = os.getenv("R2_ACCOUNT_ID", "").strip()
        self.bucket = os.getenv("R2_BUCKET", "").strip()
        self.prefix = os.getenv("R2_PREFIX", "mineru").strip("/")
        access_key = os.getenv("R2_ACCESS_KEY_ID", "").strip()
        secret_key = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
        endpoint = os.getenv("R2_ENDPOINT_URL", "").strip() or (f"https://{account_id}.r2.cloudflarestorage.com" if account_id else "")
        if not all((self.bucket, access_key, secret_key, endpoint)):
            raise ObjectStoreError("R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ENDPOINT_URL (or R2_ACCOUNT_ID) are required.")
        self.client = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name="auto", config=Config(signature_version="s3v4"))

    def key_for(self, document_id: str, archive_path: str) -> str:
        return "/".join(part for part in (self.prefix, document_id, archive_path) if part)

    def put_archive(self, document_id: str, files: dict[str, bytes]) -> list[StoredObject]:
        stored = []
        for archive_path, payload in files.items():
            key = self.key_for(document_id, archive_path)
            content_type = mimetypes.guess_type(archive_path)[0] or "application/octet-stream"
            self.client.put_object(Bucket=self.bucket, Key=key, Body=payload, ContentType=content_type)
            stored.append(StoredObject(archive_path, key, content_type, len(payload), hashlib.sha256(payload).hexdigest()))
        return stored

    def read(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def stream(self, key: str):
        result = self.client.get_object(Bucket=self.bucket, Key=key)
        return result["Body"], result.get("ContentType", "application/octet-stream")

    def list_cached_artifacts(self, document_id: str) -> list[StoredObject]:
        prefix_key = self.key_for(document_id, "").rstrip("/") + "/"
        paginator = self.client.get_paginator("list_objects_v2")
        stored = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix_key):
            for item in page.get("Contents", []):
                key = item["Key"]
                archive_path = key[len(prefix_key):]
                if not archive_path: continue
                content_type = mimetypes.guess_type(archive_path)[0] or "application/octet-stream"
                etag = item.get("ETag", "").strip('"')
                stored.append(StoredObject(archive_path, key, content_type, item.get("Size", 0), etag))
        return stored

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            entries = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if entries: self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": entries, "Quiet": True})