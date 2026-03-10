---
name: vlog-asset-manager
description: reads through all video files in vlog folder and runs renaming based on timestamp and sorts into folders
---

<!--
input: 无
output: 环境就绪
pos: 前置 skill，首次使用前运行

架构守护者：一旦我被修改，请同步更新：
1. ../README.md 的 Skill 清单
2. /CLAUDE.md 路由表
-->

# 安装

> 首次使用前的环境准备

## 快速使用

```
用户: 安装环境
用户: 初始化
```

## 依赖清单

| 依赖 | 用途 | 安装命令 |
|------|------|----------|
| Node.js | 运行脚本 | `brew install node` |
| FFmpeg | 视频剪辑 | `brew install ffmpeg` |
| Python 3.8+ | 运行 WhisperX | 系统自带或 `brew install python` |
| WhisperX | 本地语音转录 | `pip install whisperx` |

## 安装流程

```
1. 安装 Node.js + FFmpeg
       ↓
2. 安装 WhisperX
       ↓
3. 验证环境
```

## 执行步骤

### 1. 安装系统依赖

```bash
# macOS
brew install node ffmpeg

# 验证
node -v
ffmpeg -version
```

### 2. 安装 WhisperX

```bash
pip install whisperx

# 验证
python -c "import whisperx; print('WhisperX OK')"
```

首次转录时会自动下载模型：
- `large-v2` 约 3GB（转录用，自动缓存到 ~/.cache/whisper）
- 对齐模型按语言单独下载（英语约 400MB）

**GPU 加速（可选）**：安装 CUDA 版 PyTorch 后 WhisperX 会自动使用 GPU，速度提升 5-10x。

### 3. 验证环境

```bash
# 检查 Node.js
node -v

# 检查 FFmpeg
ffmpeg -version

# 检查 WhisperX
python -c "import whisperx; print('WhisperX OK')"
```

## 常见问题

### Q1: WhisperX 安装失败

```bash
# 如果 pip install whisperx 报错，尝试：
pip install whisperx --no-deps
pip install torch torchaudio  # 单独安装 PyTorch
```

### Q2: ffmpeg 命令找不到

```bash
which ffmpeg  # 应该输出路径
# 如果没有，重新安装：brew install ffmpeg
```

### Q3: 文件名含冒号报错

FFmpeg 命令需加 `file:` 前缀：

```bash
ffmpeg -i "file:2026:01:26 task.mp4" ...
```

### Q4: 转录速度慢

无 GPU 时 CPU 转录约 5-8 分钟（19 分钟视频）。可降低模型规格：

```bash
# 在 whisperx_transcribe.py 中将 "large-v2" 改为 "medium" 或 "small"
# 速度提升 2-4x，精度略降
```
