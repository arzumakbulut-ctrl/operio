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

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
