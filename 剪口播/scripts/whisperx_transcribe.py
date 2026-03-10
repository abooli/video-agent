#!/usr/bin/env python3
"""
WhisperX 本地语音转录

用法: python whisperx_transcribe.py <audio_file> [language] [dict_file]
  audio_file  - 本地音频文件路径（mp3/wav/m4a 等）
  language    - 语言代码，如 "en" "zh" "auto"（默认自动检测）
  dict_file   - 词典文件路径，用于提升专业词汇识别率（可选）

输出: whisperx_result.json
"""

import sys
import json
import os


def interpolate_missing_timestamps(words, seg_start, seg_end):
    """对缺少时间戳的词进行线性插值"""
    result = [dict(w) for w in words]
    i = 0
    while i < len(result):
        if result[i].get("start") is None:
            j = i + 1
            while j < len(result) and result[j].get("start") is None:
                j += 1
            range_start = result[i - 1]["end"] if i > 0 else seg_start
            range_end = result[j]["start"] if j < len(result) else seg_end
            count = j - i
            step = (range_end - range_start) / count if count > 0 else 0
            for k in range(count):
                result[i + k]["start"] = round(range_start + k * step, 3)
                result[i + k]["end"] = round(range_start + (k + 1) * step, 3)
            i = j
        else:
            i += 1
    return result


def main():
    if len(sys.argv) < 2:
        print("❌ 用法: python whisperx_transcribe.py <audio_file> [language] [dict_file]")
        sys.exit(1)

    audio_file = sys.argv[1]
    language_arg = sys.argv[2] if len(sys.argv) > 2 else "auto"
    dict_file = sys.argv[3] if len(sys.argv) > 3 else None

    language = None if language_arg == "auto" else language_arg

    if not os.path.exists(audio_file):
        print(f"❌ 找不到音频文件: {audio_file}")
        sys.exit(1)

    # 读取词典作为 initial_prompt（提升专业词汇识别率）
    initial_prompt = None
    if dict_file and os.path.exists(dict_file):
        with open(dict_file, encoding="utf-8") as f:
            words = [line.strip() for line in f if line.strip()]
        initial_prompt = ", ".join(words)
        print(f"📖 加载词典: {len(words)} 个词")

    try:
        import whisperx
        import torch
    except ImportError:
        print("❌ 请先安装 WhisperX: pip install whisperx")
        print("   详见: https://github.com/m-bain/whisperX")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    batch_size = 16 if device == "cuda" else 4
    print(f"🖥️  使用设备: {device} | batch_size={batch_size}")

    print("📥 加载模型 large-v2 ...")
    model = whisperx.load_model("large-v2", device, compute_type=compute_type)

    print(f"🎤 转录: {audio_file}")
    audio = whisperx.load_audio(audio_file)

    transcribe_kwargs = {"batch_size": batch_size}
    if language:
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    result = model.transcribe(audio, **transcribe_kwargs)
    detected_lang = result.get("language", "unknown")
    print(f"🌐 检测到语言: {detected_lang}")

    print("🔗 对齐字级别时间戳 ...")
    try:
        model_a, metadata = whisperx.load_align_model(
            language_code=detected_lang, device=device
        )
        result = whisperx.align(
            result["segments"], model_a, metadata, audio, device,
            return_char_alignments=False
        )
    except Exception as e:
        print(f"⚠️  对齐失败 ({e})，使用句子级时间戳（精度较低）")

    # 补全缺失时间戳
    for seg in result.get("segments", []):
        if seg.get("words"):
            seg["words"] = interpolate_missing_timestamps(
                seg["words"], seg["start"], seg["end"]
            )

    output_file = "whisperx_result.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    seg_count = len(result.get("segments", []))
    word_count = sum(len(s.get("words", [])) for s in result.get("segments", []))
    print(f"✅ 转录完成 — {seg_count} 句段 / {word_count} 个词，已保存 {output_file}")


if __name__ == "__main__":
    main()
