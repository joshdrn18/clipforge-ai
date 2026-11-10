FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTOCLIP_HOME=/data/autoclip

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    fonts-dejavu-core \
    libass9 \
    libgl1 \
    libglib2.0-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# This image is intended for a remote cloud server/container only.
# python:3.12-slim and the pinned MediaPipe wheel support linux/arm64.
ENV CLIPFORGE_AGENT_MODE=cloud
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY agent.py .
RUN mkdir -p /data/autoclip /data/worker-state

CMD ["python", "agent.py"]
