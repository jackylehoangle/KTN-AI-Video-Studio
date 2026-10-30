import hashlib
import hmac

from app.asgi import is_valid_task_download_signature


def _signature(path: str, expires: int, key: str) -> str:
    return hmac.new(
        key.encode("utf-8"),
        f"{path}\n{expires}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def test_task_download_signature_accepts_matching_unexpired_url():
    path = "/tasks/task-123/final-1.mp4"
    key = "render-secret"
    expires = 4_600

    assert is_valid_task_download_signature(
        path,
        str(expires),
        _signature(path, expires, key),
        key,
        now=1_000,
    )


def test_task_download_signature_rejects_expired_tampered_and_overlong_urls():
    path = "/tasks/task-123/final-1.mp4"
    key = "render-secret"

    assert not is_valid_task_download_signature(
        path, "999", _signature(path, 999, key), key, now=1_000
    )
    assert not is_valid_task_download_signature(
        path, "4600", "0" * 64, key, now=1_000
    )
    assert not is_valid_task_download_signature(
        path, "4601", _signature(path, 4601, key), key, now=1_000
    )
    assert not is_valid_task_download_signature(
        path, "4600", _signature(path, 4600, key), "", now=1_000
    )
