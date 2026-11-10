FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTOCLIP_HOME=/data/autoclip

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    fonts-dejavu-core \
    libass9 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# This image is intended for a remote cloud server/container only.
ENV CLIPFORGE_AGENT_MODE=cloud
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY agent.py .
RUN mkdir -p /data/autoclip

CMD ["python", "agent.py"]
