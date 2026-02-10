---
argument-hint: <question>
description: Live Q&A - research a question and update a Google Slide in real-time
---

# Live Q&A

Answer audience questions in real-time by updating a Google Slide visible in presenter mode.

## Your Task

Research and answer this question: $ARGUMENTS

## Local Configuration

**Required:** Read `.claude/live-qa-config.md` for:

```markdown
## Live QA Config

presentation-id: <google-slides-presentation-id>
```

If the config doesn't exist, ask the user for the presentation ID and create the config file.

## Workflow

### Phase 1: Show Progress

Immediately push a "Researching..." indicator to the last slide so the audience sees activity:

1. Create a temporary config JSON at `/tmp/live-qa-progress.json`:
   ```json
   {
     "title": "Q&A",
     "presentationId": "<from config>",
     "updateSlide": "last",
     "slides": [{
       "background": "darkBlue",
       "elements": [
         { "text": "Q: <the question>", "x": 40, "y": 30, "w": 640, "h": 60, "size": 24, "color": "white", "bold": true },
         { "text": "Researching...", "x": 40, "y": 120, "w": 640, "h": 250, "size": 20, "color": "accentBlue" }
       ]
     }]
   }
   ```
2. Push it:
   ```bash
   npx claude-slides --config /tmp/live-qa-progress.json --presentation-id <id> --update-slide last
   ```

### Phase 2: Research

Use web search and your knowledge to research the question thoroughly. Gather:
- Key facts and data points
- Relevant context
- Sources for speaker notes

### Phase 3: Push Final Answer

1. Format the answer for slide readability:
   - Question as title (bold, 24pt)
   - Answer as bullet points using `\u2022` prefix
   - 3-5 key points maximum
   - Each point should be readable from the back of the room
   - Keep text concise — slides are for the audience, details go in speaker notes

2. Create the final config at `/tmp/live-qa-answer.json`:
   ```json
   {
     "title": "Q&A",
     "presentationId": "<from config>",
     "updateSlide": "last",
     "slides": [{
       "background": "darkBlue",
       "elements": [
         { "text": "Q: <question>", "x": 40, "y": 30, "w": 640, "h": 60, "size": 24, "color": "white", "bold": true },
         { "text": "\u2022 Point one\n\u2022 Point two\n\u2022 Point three", "x": 40, "y": 120, "w": 640, "h": 250, "size": 20, "color": "white" }
       ],
       "notes": "Detailed answer with sources, nuance, and follow-up points for the presenter"
     }]
   }
   ```
3. Push it:
   ```bash
   npx claude-slides --config /tmp/live-qa-answer.json --presentation-id <id> --update-slide last
   ```

## How It Works

Google Slides updates are visible in real-time to anyone viewing the presentation (including presenter mode). The `--update-slide last` flag modifies the last slide in-place — no clicking required.

## iOS Shortcut Setup (Optional)

For hands-free operation from an iPhone/Apple Watch:

1. **Record Audio** → Whisper API transcription
2. **SSH to Mac** running Claude Code
3. **Run** `/live-qa <transcribed question>`

The slide updates automatically within seconds.

## Output

Report what you did:
- Question received
- Progress indicator pushed
- Research completed
- Final answer pushed
- Sources used
