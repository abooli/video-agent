# Migration Plan

This is a forked repo, and we can see it was designed to access a very specific use case (1 single sit-down videos) specifically in Chinese. It also originally used volcengine, which is an API that requires Chinese ID to access.

As part of the migration plan, we have a couple milestones. In the end product, I envision a fully functioning agent that:

1) Handles batch rough cut of videos (for vlogs)
2) Identifies A Roll vs B Roll footages
3. Incorporates storyboarding and theme analysis by default (tailored to my channel, April's Rambles)
4. (Hopefully) make it into something that other people who's interested in.

## Priority Order

| # | Task | Status |
|---|------|--------|
| 1 | Translate the skill 安装 to "Installation", no need to edit the scripts. (Delete WhisperX section — migrated to Deepgram) | ✅ Done |
| 2 | Fill out SKILL.md in vlog-asset-manager, make it safe so it doesn't accidentally delete files | ✅ Done |
| 3 | Create vlog-storyboard skill (batch transcribe + story beats + Notion upload) | ✅ Done |
| 4 | Refactor 剪口播 → `podcast-rough-cut/` (translate to English, swap WhisperX → Deepgram, add detection rules, flatten output paths) | ✅ Done |
| 5 | Build `vlog-rough-cut/` — batch rough-cut orchestrator with tabbed review dashboard per chapter | ✅ Done |
| 6 | Clean up output path for batch editing | 🔲 Todo |
| 7 | Paste over brand visualization and vlog checklist | 🔲 Todo |
| 8 | Translate 字幕 → `subtitles/` (translate SKILL.md + README, swap WhisperX → Deepgram, keep Chinese correction table) | 🔲 Todo |
| 9 | Translate 自进化 → `self-evolution/` (translate to English, adapt CLAUDE.md refs → Kiro steering files) | 🔲 Todo |

