<!--
架构守护者：一旦本文件夹有任何变化（新增/删除/重命名文件），请更新此文件
-->

# User Preferences

Personal editing preferences, read by AI before every review session.

## File index

| File | Type | Content |
|------|------|---------|
| 1-核心原则.md | Principle | Keep the later version |
| 2-语气词检测.md | Preference | um/uh/ah + deletion boundary |
| 3-静音段处理.md | Threshold | ≤0.5s ignore, 0.5-1s optional, >1s suggest delete |
| 4-重复句检测.md | Preference | Adjacent sentences with ≥5 matching words at start → delete shorter |
| 5-卡顿词.md | Preference | "and and", "like like", repeated fillers |
| 6-句内重复检测.md | Preference | A + middle + A pattern |
| 7-连续语气词.md | Preference | Consecutive fillers (um ah, uh er) |
| 8-重说纠正.md | Preference | Partial repeat, negation correction, interrupted word |
| 9-残句检测.md | Preference | Sentence started but abandoned |

## AI review order (by priority)

1. **Silence >1s** → suggest delete (split into 1s chunks)
2. **Fragments** → delete (sentence abandoned + silence)
3. **Repeated sentences** → delete the shorter one (≥5 word overlap at start)
4. **Intra-sentence repeat** → delete front part (A + middle + A pattern)
5. **Stutter words** → delete front repetitions ("and and" → keep last "and")
6. **Self-corrections** → delete front (partial repeat, negation, interrupted word)
7. **Filler words** → flag for human review (um, uh — don't auto-delete all)

## Core principle

**Keep the later version**: the second attempt is usually more complete — delete the earlier, keep the later.
