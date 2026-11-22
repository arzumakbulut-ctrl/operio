"""Konuşmacı-embedding mikroservisi.

Base64 ile kodlanmış kısa bir webm/opus ses kaydını, SpeechBrain'in önceden
eğitilmiş ECAPA-TDNN modelini (spkrec-ecapa-voxceleb) kullanarak sabit
boyutlu bir konuşmacı-embedding vektörüne çevirir. Bu, Node API tarafından
kullanılan bağımsız bir HTTP servisidir -- Operio'nun domain modeli hakkında
hiçbir bilgisi yoktur, sadece ses girer / embedding çıkar.
"""

import base64
import binascii
import io
import os

import numpy as np
import torch
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError
from speechbrain.inference.classifiers import EncoderClassifier

MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_SAVEDIR = os.environ.get(
    "SPEAKER_ID_MODEL_DIR", "pretrained_models/spkrec-ecapa-voxceleb"
)

# ECAPA-TDNN / VoxCeleb embedding'leri 16kHz mono ses üzerinde eğitilmiştir.
TARGET_SAMPLE_RATE = 16000

# [-1, 1] aralığına normalize edilmiş ses üzerinde hesaplanan RMS enerji eşiği;
# bunun altındaki bir kayıt gerçek konuşma değil sessizlik/arka plan gürültüsü
# olarak işaretlenir. Tipik bir tarayıcı mikrofonunun oda-gürültü-tabanı RMS'i
# 0.01'in epey altındayken normal konuşma RMS'i kabaca 0.02-0.2 aralığındadır;
# bu varsayılan, belirli bir mikrofona özel ayar yapılmadan iki tarafta da
# makul bir pay bırakır.
VOICE_ENERGY_THRESHOLD = 0.01

_classifier: EncoderClassifier | None = None


def _load_classifier() -> EncoderClassifier:
    """Önceden eğitilmiş konuşmacı-embedding modelini yükler (ya da zaten
    yüklenmişse mevcut örneği döndürür).

    Bu fonksiyon modül import edilirken bir kez çağrılır -- her istekte değil
    -- böylece (nispeten yavaş olan) model yükleme işlemi sadece süreç
    başlangıcında gerçekleşir. Ayrıca Docker build zamanında Dockerfile
    içinden de doğrudan çağrılır; böylece önceden eğitilmiş ağırlıklar image
    içine gömülür, ilk isteğe kadar indirme beklenmez.
    """
    global _classifier
    if _classifier is None:
        _classifier = EncoderClassifier.from_hparams(
            source=MODEL_SOURCE,
            savedir=MODEL_SAVEDIR,
        )
    return _classifier


app = FastAPI(title="Operio Speaker-ID Service")

# Import zamanında yükle (bkz. _load_classifier docstring'i), route içinde değil.
_load_classifier()


class EmbedRequest(BaseModel):
    audio_base64: str
    mime_type: str


def _decode_audio(audio_base64: str) -> AudioSegment:
    """Base64 ses verisini decode eder ve bir pydub AudioSegment'e çevirir.

    Herhangi bir hata durumunda (bozuk base64 veya ffmpeg/pydub'ın ses olarak
    ayrıştıramadığı byte'lar) ValueError fırlatır; böylece çağıran taraf her
    iki durumu da tek bir `decode_failed` sözleşme yanıtına eşleyebilir.
    """
    try:
        raw_bytes = base64.b64decode(audio_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid base64") from exc

    try:
        return AudioSegment.from_file(io.BytesIO(raw_bytes), format="webm")
    except CouldntDecodeError as exc:
        raise ValueError("undecodable audio") from exc


def _waveform_tensor(segment: AudioSegment) -> torch.Tensor:
    """Bir pydub AudioSegment'i mono, 16kHz, float32 [-1, 1] tensöre çevirir."""
    segment = segment.set_channels(1).set_frame_rate(TARGET_SAMPLE_RATE)
    samples = np.array(segment.get_array_of_samples(), dtype=np.float32)
    if samples.size == 0:
        return torch.zeros(0, dtype=torch.float32)
    max_value = float(1 << (8 * segment.sample_width - 1))
    return torch.from_numpy(samples / max_value)


def _rms_energy(waveform: torch.Tensor) -> float:
    if waveform.numel() == 0:
        return 0.0
    return float(torch.sqrt(torch.mean(torch.square(waveform))))


@app.post("/embed")
def embed(request: EmbedRequest):
    try:
        segment = _decode_audio(request.audio_base64)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "decode_failed"})

    waveform = _waveform_tensor(segment)

    if _rms_energy(waveform) < VOICE_ENERGY_THRESHOLD:
        return {"voice_detected": False}

    classifier = _load_classifier()
    embedding = classifier.encode_batch(waveform.unsqueeze(0))
    embedding_list = embedding.squeeze().tolist()
    # Tek elemanlı bir embedding (dejenere girdi) squeeze sonrası liste değil
    # skaler olur; sözleşme her durumda liste istiyor.
    if not isinstance(embedding_list, list):
        embedding_list = [embedding_list]

    return {"voice_detected": True, "embedding": embedding_list}
