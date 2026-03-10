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
| 3 | Clean up 剪口播 and refactor into "Rough Cut" skill | 🔲 Todo |
| 4 | Create a new skill that allows for batch editing | 🔲 Todo |
| 5 | Clean up output path for batch editing | 🔲 Todo |
| 6 | Paste over brand visualization and vlog checklist | 🔲 Todo |

