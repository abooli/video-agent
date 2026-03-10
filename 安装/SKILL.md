---
name: install
description: Environment setup. Install dependencies, configure API keys, verify environment. Trigger words: install, setup, initialize, installation
---

<!--
input: none
output: environment ready
pos: prerequisite skill, run before first use

To Claude Agents: If this file gets updated, please update:
1. The Skills list in ../READ.md
2. /CLAUDE.md list
-->

# Installation

> First-time environment setup

## Quick Start

```
User: install environment
User: setup
User: initialize
```

## Dependencies

| Dependency | Purpose | Install Command |
|------------|---------|-----------------|
| Node.js | Run scripts | `brew install node` |
| FFmpeg | Video processing | `brew install ffmpeg` |
| Python 3.8+ | Run transcription scripts | System default or `brew install python` |
| Deepgram SDK | Cloud transcription | `pip install deepgram-sdk` |

## Setup Flow

```
1. Install Node.js + FFmpeg
       ↓
2. Install Deepgram SDK + configure API key
       ↓
3. Verify environment
```

## Steps

### 1. Install System Dependencies

```bash
# macOS
brew install node ffmpeg

# Verify
node -v
ffmpeg -version
```

### 2. Install Deepgram SDK

```bash
pip install deepgram-sdk

# Verify
python -c "from deepgram import DeepgramClient; print('Deepgram SDK OK')"
```

### 3. Configure API Key

```bash
# Copy the example env file and fill in your Deepgram API key
cp .env.example .env
# Edit .env and set DEEPGRAM_API_KEY=your_key_here
```

### 4. Verify Environment

```bash
node -v
ffmpeg -version
python -c "from deepgram import DeepgramClient; print('Deepgram SDK OK')"
```

## FAQ

### Q1: Deepgram SDK install fails

```bash
# Try upgrading pip first
pip install --upgrade pip
pip install deepgram-sdk
```

### Q2: ffmpeg command not found

```bash
which ffmpeg  # Should output a path
# If not, reinstall: brew install ffmpeg
```

### Q3: Filenames with colons cause errors

FFmpeg requires the `file:` prefix for paths with colons:

```bash
ffmpeg -i "file:2026:01:26 task.mp4" ...
```
