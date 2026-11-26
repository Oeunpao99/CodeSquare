"""File storage for uploaded class materials.

Two backends behind one tiny interface (save / read / delete), picked at import:

* **Azure Blob Storage** when `AZURE_STORAGE_CONNECTION_STRING` is set
  (container from `AZURE_STORAGE_CONTAINER`, default "class-files").
  Needs the `azure-storage-blob` package.
* **Local disk** otherwise: files under `backend/uploads/` (git-ignored). Fine
  for development and a single server; use Azure in production.

Keys are opaque, generated server-side ("classes/<class>/<uuid>-<safe-name>"), so
a user can never choose or guess a path. Files are only ever served through the
API after a membership check; nothing is publicly reachable.
"""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_CONN = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "class-files").strip() or "class-files"
_LOCAL_ROOT = Path(__file__).resolve().parent / "uploads"

MAX_UPLOAD_BYTES = int(os.getenv("CLASS_UPLOAD_MAX_MB", "50")) * 1024 * 1024

BACKEND = "azure" if _CONN else "local"


def make_key(scope: str, filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", filename or "file").strip("-.")[:80] or "file"
    return f"{scope}/{uuid.uuid4().hex}-{safe}"


# ----------------------------------------------------------------- azure
def _container():
    from azure.storage.blob import BlobServiceClient  # lazy: only when configured

    client = BlobServiceClient.from_connection_string(_CONN)
    container = client.get_container_client(_CONTAINER)
    try:
        container.create_container()
    except Exception:  # already exists
        pass
    return container


# ----------------------------------------------------------------- local
def _local_path(key: str) -> Path:
    path = (_LOCAL_ROOT / key).resolve()
    if _LOCAL_ROOT.resolve() not in path.parents:
        raise ValueError("invalid storage key")
    return path


# ----------------------------------------------------------------- api
def save(key: str, data: bytes, content_type: str | None = None) -> None:
    if BACKEND == "azure":
        from azure.storage.blob import ContentSettings

        _container().upload_blob(
            key, data, overwrite=True,
            content_settings=ContentSettings(content_type=content_type or "application/octet-stream"),
        )
        return
    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read(key: str) -> bytes:
    if BACKEND == "azure":
        return _container().download_blob(key).readall()
    return _local_path(key).read_bytes()


def delete(key: str) -> None:
    try:
        if BACKEND == "azure":
            _container().delete_blob(key)
        else:
            _local_path(key).unlink(missing_ok=True)
    except Exception:
        pass  # best effort; the DB row is the source of truth
