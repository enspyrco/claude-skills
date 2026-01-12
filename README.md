# Claude Skills

Claude Code skills and tools for AI-assisted development.

## Skills

Markdown-based skills that extend Claude Code with custom commands:

| Skill | Command | Description |
|-------|---------|-------------|
| **Project Management** | `/pm` | Manage GitHub project boards, issues, and priorities |
| **Research** | `/research` | Deep research with web search and source synthesis |
| **Review** | `/review` | Comprehensive PR reviews with optional slide generation |
| **Slides** | `/slides` | Generate Google Slides with AI-created content |

### Installation

Skills are installed by symlinking to `~/.claude/commands/`:

```bash
ln -s ~/git/individuals/nickmeinhold/claude-skills/*.md ~/.claude/commands/
```

### Usage

Once installed, use skills as slash commands in Claude Code:

```bash
/pm list                           # Show project board status
/research "topic" --depth thorough # Research a topic
/review                            # Review current PR
/slides 5 pitch deck for my app    # Generate 5-slide presentation
```

## Claude Slides CLI

Node.js tool for generating Google Slides presentations.

### Setup

```bash
npm install
npm run build

# Authenticate with Google (first time only)
npm run auth
```

Required: Create `.env` with Google OAuth credentials:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Usage

```bash
# From config file (static content)
npx claude-slides --config slides.json

# From template with data (dynamic content)
npx claude-slides --template review.json --data pr-data.json

# Update existing presentation
npx claude-slides --config slides.json --presentation-id EXISTING_ID
```

### Config Format

```json
{
  "title": "Presentation Title",
  "theme": {
    "colors": {
      "primary": { "red": 0.1, "green": 0.2, "blue": 0.4 },
      "accent": { "red": 0.2, "green": 0.5, "blue": 0.8 }
    }
  },
  "slides": [
    {
      "background": "primary",
      "elements": [
        {
          "text": "Title",
          "x": 50, "y": 150, "w": 620, "h": 80,
          "size": 48, "color": "white", "bold": true
        }
      ],
      "notes": "Speaker notes here"
    }
  ]
}
```

## Project Structure

```
claude-skills/
├── pm.md              # Project management skill
├── research.md        # Research skill
├── review.md          # PR review skill
├── slides.md          # Slides generation skill
├── src/
│   ├── cli.ts         # CLI entry point
│   ├── auth/          # Google OAuth handling
│   └── slides/        # Slides generation logic
└── dist/              # Compiled output
```

## License

MIT
