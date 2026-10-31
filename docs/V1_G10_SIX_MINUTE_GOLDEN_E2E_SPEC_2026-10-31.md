# V1-G10 - SIX-MINUTE GOLDEN BRIEF E2E SPEC

**Date:** 2026-10-31 (GMT+7)
**Branch:** `release/v1-rc1`
**Status:** READY FOR EXECUTION / NOT YET PASS

The `5-7m` product profile and its 750-1,050-word script target passed focused
regression. The complete local suite passed 1,338 tests with 19 skipped and no
failures before execution of this spec.

## Golden Brief

- Project name: `G10 Golden 6M - Tuoi tho thieu vang yeu thuong`.
- Topic: `Mot tuoi tho du day nhung thieu vang yeu thuong`.
- Audience: Vietnamese grade-6 students and families.
- Platform: YouTube Long.
- Aspect: 16:9.
- Target duration profile: `5-7m`.
- Target decoded duration: 345-375 seconds.
- Script target: 750-1,050 Vietnamese words.
- Structure: 16 principal narration sections/scenes, with scene splitting allowed
  when visual continuity requires it.
- Style: age-appropriate, reflective, empathetic, no invented statistics and no
  accusatory diagnosis.

## Required workflow

1. Create the Brief using the production UI.
2. Generate or import the complete Vietnamese script.
3. Run scene analysis and approve every scene after visual/continuity review.
4. Generate or attach one valid 16:9 image for every scene.
5. Generate narration and verify audio duration for every scene.
6. Generate/edit SRT and pass the structural validator.
7. Save, reload and run the persistence diagnostic before render.
8. Start one render task and preserve its task ID across reload.
9. Reach 100%, download the complete MP4 and retain the render manifest.
10. Run automated media QA and owner visual acceptance.

## Automated acceptance

| Check | PASS condition |
|---|---|
| Container | Valid MP4 readable by ffprobe |
| Video codec | H.264/AVC |
| Audio codec | AAC or another browser-supported codec approved by the product |
| Resolution | 1920x1080 or an explicitly approved equivalent 16:9 output |
| Duration | 345-375 seconds |
| Download | Local file size equals the complete server/proxy byte count |
| Timeline | Audio and video durations differ by no more than 1.0 second |
| Subtitle | SRT passes validation and sampled cues appear at the expected times |
| Black frames | No unexplained black interval longer than 2 seconds |
| Silence | No unexplained silent interval longer than 3 seconds |
| Persistence | Reload restores project, assets and active/completed render identity |
| Recovery | Retry/download does not create a duplicate paid render task |

## Owner acceptance

Owner must confirm:

- the story is coherent and suitable for the intended audience;
- images match the narration and do not show obvious generation defects;
- narration is intelligible and emotionally appropriate;
- subtitles are readable and synchronized;
- pacing feels like a six-minute video rather than a stretched short;
- the downloaded MP4 plays from beginning to end.

## Gate rule

G10 is PASS only when the artifact, manifest, task ID, ffprobe report, byte-size
verification and owner acceptance are all recorded. A shorter smoke video cannot
substitute for this acceptance.
