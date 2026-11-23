from fastapi.testclient import TestClient
from app import app
import base64, pathlib

client = TestClient(app)


def _sample_b64():
    path = pathlib.Path(__file__).parent / "fixtures" / "sample.webm"
    return base64.b64encode(path.read_bytes()).decode()


def _silence_b64():
    path = pathlib.Path(__file__).parent / "fixtures" / "silence.webm"
    return base64.b64encode(path.read_bytes()).decode()


def test_embed_returns_vector_for_valid_audio():
    resp = client.post("/embed", json={"audio_base64": _sample_b64(), "mime_type": "audio/webm"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["voice_detected"] is True
    assert isinstance(body["embedding"], list)
    assert len(body["embedding"]) > 0


def test_embed_rejects_invalid_base64():
    resp = client.post("/embed", json={"audio_base64": "not-valid-base64!!", "mime_type": "audio/webm"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "decode_failed"


def test_embed_returns_no_voice_for_silence():
    resp = client.post("/embed", json={"audio_base64": _silence_b64(), "mime_type": "audio/webm"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["voice_detected"] is False
    assert "embedding" not in body


def test_embed_rejects_valid_base64_that_is_not_audio():
    garbage_b64 = base64.b64encode(b"this is not an audio file at all").decode()
    resp = client.post("/embed", json={"audio_base64": garbage_b64, "mime_type": "audio/webm"})
    assert resp.status_code == 400
    assert resp.json()["error"] == "decode_failed"


def test_health_returns_ok_once_model_loaded():
    # Modül import zamanında _load_classifier() zaten çağrıldığı için (bkz.
    # app.py), test ortamında bu endpoint'e gelindiğinde model zaten yüklü
    # olmalı (final whole-branch review finding #3 — docker-compose
    # healthcheck'in dayandığı sözleşme).
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
