#!/usr/bin/env python3
"""
Deepgram 语音转录

用法: python deepgram_transcribe.py <audio_file> [language]
  audio_file  - 本地音频/视频文件 (mp3/wav/m4a/mp4)
  language    - 语言代码，如 "en" "zh" (默认 "en")

输出: deepgram_transcription.json

API Key: 在 videocut-skills/.env 中设置 DEEPGRAM_API_KEY=your_key
依赖: pip install requests
"""

import sys
import json
import os
import requests
from pathlib import Path


def load_env():
    """Load .env from repo root (two levels up from this script)."""
    env_file = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

load_env()
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".webm": "audio/webm",
    ".flac": "audio/flac",
}


def main():
    if len(sys.argv) < 2:
        print("❌ 用法: python deepgram_transcribe.py <audio_file> [language]")
        sys.exit(1)

    audio_file = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    if not os.path.exists(audio_file):
        print(f"❌ 找不到音频文件: {audio_file}")
        sys.exit(1)

    if not DEEPGRAM_API_KEY or DEEPGRAM_API_KEY == "your_deepgram_api_key_here":
        print("❌ 请在 videocut-skills/.env 中填入 DEEPGRAM_API_KEY:")
        print("   DEEPGRAM_API_KEY=your_actual_key_here")
        sys.exit(1)

    ext = os.path.splitext(audio_file)[1].lower()
    mime_type = MIME_TYPES.get(ext, "audio/mpeg")
    file_mb = os.path.getsize(audio_file) / 1024 / 1024
    print(f"🎤 上传并转录: {audio_file} ({file_mb:.1f} MB) [{language}]")

    with open(audio_file, "rb") as f:
        response = requests.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": mime_type,
            },
            params={
                "model": "nova-2",
                "language": language,
                "smart_format": "true",
                "punctuate": "true",
                "utterances": "true",
                "utt_split": "0.8",  # split utterances at ≥0.8s silence
            },
            data=f,
            timeout=600,
        )

    if response.status_code != 200:
        print(f"❌ API 错误 {response.status_code}:")
        print(response.text)
        sys.exit(1)

    data = response.json()

    # Save raw Deepgram JSON (native format)
    # Downstream scripts read: results.channels[0].alternatives[0].words[]
    # Each word has: word, punctuated_word, start, end, confidence
    output_file = "deepgram_transcription.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    words = data["results"]["channels"][0]["alternatives"][0].get("words", [])
    print(f"✅ Transcription complete — {len(words)} words, saved {output_file}")


if __name__ == "__main__":
    main()
