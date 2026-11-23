FROM python:3.11-slim

WORKDIR /app

# ffmpeg: pydub'ın webm/opus'u ham PCM'e decode etmesi için PATH'te gerekli.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Python bağımlılıklarını önce kur (ayrı katman) -- kod değişiklikleri
# bağımlılık cache'ini bozmasın; torch/speechbrain büyük ve kurulumu yavaş.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Önceden eğitilmiş konuşmacı-embedding modelini build zamanında indir;
# böylece ilk gerçek istek indirme maliyetine maruz kalmaz ve servis build
# edildikten sonra offline da çalışabilir.
COPY app.py .
RUN python -c "from app import _load_classifier; _load_classifier()"

# Model build zamanında zaten image içine gömüldü (yukarıdaki RUN) -- bu
# yüzden runtime'da Hugging Face'e hiçbir ağ çağrısı yapılmasına GEREK YOK.
# HF_HUB_OFFLINE=1, huggingface_hub'ın (speechbrain'in altında) runtime'da
# bir "güncelleme var mı" kontrolü için dahi dışa çıkmasını engeller --
# hastane ağının içinden hiçbir giden ağ çağrısı yapılmaması bu projenin
# veri-ikameti (data-residency) duruşu için önemlidir (final whole-branch
# review finding #8).
ENV HF_HUB_OFFLINE=1

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
