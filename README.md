# Video Agent

> AI-powered video editing skills for vlog and talking-head video production

## What is this?

A collection of AI agent skills that automate common video editing tasks:
- Rough-cut editing (silence removal, stumble detection, repeat detection)
- Vlog asset management (rename and sort clips by timestamp)
- Subtitle generation with custom dictionary support

Originally built for Chinese talking-head videos, now being migrated to English with broader vlog support.

## Skills

| Skill | Description | Input | Output |
|-------|-------------|-------|--------|
| `install` | Environment setup (Node.js, FFmpeg, Deepgram) | None | Ready environment |
| `vlog-asset-manager` | Rename clips by timestamp, sort into day folders | Folder path | Organized clips |
| `剪口播` | Transcription + AI stumble detection + rough cut | Video file | Cut video |
| `字幕` | Subtitle generation + dictionary correction + burn-in | Video file | Subtitled video |
| `自进化` | Records user feedback, updates rules over time | User feedback | Updated rule files |

## Quick Start

### 1. Clone

```bash
git clone https://github.com/Ceeon/videocut-skills.git
```

### 2. Configure API Key

```bash
cp .env.example .env
# Edit .env and set DEEPGRAM_API_KEY=your_key_here
```

### 3. Install Dependencies

See `install/SKILL.md` for the full setup flow. You'll need Node.js, FFmpeg, Python 3.8+, and the Deepgram SDK.

## Directory Structure

```
video-agent/
├── README.md
├── PLAN.md              # Migration plan and task tracking
├── .env.example         # API key template
├── install/             # Environment setup skill
│   ├── SKILL.md
│   └── README.md
├── vlog-asset-manager/  # Clip renaming and sorting
│   ├── SKILL.md
│   └── scripts/
│       ├── rename-video-assets.py
│       ├── sort-video-into-folders.py
│       └── reset.py
├── 剪口播/              # Rough cut (transcription + AI analysis)
│   ├── SKILL.md
│   └── scripts/
├── 字幕/                # Subtitle generation + burn-in
│   ├── SKILL.md
│   ├── README.md
│   └── 词典.txt         # Custom dictionary
└── 自进化/              # Self-evolution (learns from feedback)
    ├── SKILL.md
    └── README.md
```

## Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| Node.js 18+ | Run scripts | `brew install node` |
| FFmpeg | Audio/video processing | `brew install ffmpeg` |
| Python 3.8+ | Transcription scripts | System default |
| Deepgram API | Cloud transcription | [Get API key](https://deepgram.com/) |

## License

MIT