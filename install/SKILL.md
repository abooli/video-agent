---
name: install
description: "Environment setup. Install dependencies, configure API keys, verify environment. Trigger words: install, setup, initialize, installation"
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
| Notion Client | Upload storyboard to Notion | `pip install notion-client` |

## Setup Flow

```
1. Install Node.js + FFmpeg
       ↓
2. Install Python SDKs (Deepgram + Notion)
       ↓
3. Configure API keys (Deepgram + Notion)
       ↓
4. Verify environment
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

### 2. Install Python SDKs

```bash
pip install deepgram-sdk notion-client

# Verify
python -c "from deepgram import DeepgramClient; print('Deepgram SDK OK')"
python -c "from notion_client import Client; print('Notion SDK OK')"
```

### 3. Configure API Keys

```bash
# Copy the example env file
cp .env.example .env
# Edit .env and set:
#   DEEPGRAM_API_KEY=your_key_here
#   NOTION_API_KEY=your_notion_secret_here
```

**Getting your Notion API key:**
1. Go to https://www.notion.so/profile/integrations
2. Click **"New integration"** (the simple internal one — no website/tagline needed)
3. Name it (e.g. "Video Skills"), pick your workspace, submit
4. Copy the **Internal Integration Secret** → paste into `.env`
5. For each Notion video page: open it → `...` menu → **Connect to** → select your integration

### 4. Verify Environment

```bash
node -v
ffmpeg -version
python -c "from deepgram import DeepgramClient; print('Deepgram SDK OK')"
python -c "from notion_client import Client; print('Notion SDK OK')"
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
