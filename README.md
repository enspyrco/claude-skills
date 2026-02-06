# Claude Skills

Claude Code skills for AI-assisted development.

## Team Member Setup

Three steps to get started:

```bash
# 1. Clone the repo
git clone git@github.com:enspyrco/claude-skills.git

# 2. Symlink skills to Claude Code
ln -s ~/path/to/claude-skills/*.md ~/.claude/commands/

# 3. Create .env with shared PATs (get from team lead)
mkdir -p ~/.enspyr-claude-skills
cat > ~/.enspyr-claude-skills/.env << 'EOF'
MAXWELL_PAT=ghp_...
KELVIN_PAT=ghp_...
EOF
```

That's it. Skills are now available as `/review`, `/ship`, `/cage-match`, etc.

**Why symlink?** Claude Code looks for skills in `~/.claude/commands/`. Symlinking means `git pull` updates skills instantly.

## Available Skills

| Skill | Description |
|-------|-------------|
| `/ship` | Commit, push, create PR, review, and merge |
| `/review <pr>` | Code review as MaxwellMergeSlam (Claude) |
| `/cage-match <pr>` | Adversarial review: Maxwell vs Kelvin (Gemini) |
| `/review-respond` | Address PR review comments |
| `/pm` | Project management (issues, boards) |
| `/research` | Deep research with web search |
| `/slides` | Generate Google Slides |

## Optional Setup

### `/pm` skill
Add `CLAUDE_PM_PAT` to your `.env` (PAT for claude-pm-enspyr account).

### `/slides` skill
Requires Google OAuth setup - see `.env.example` for details.

### Admin: Setting up new repos
If you have `ENSPYR_ADMIN_PAT`, `/ship` will automatically invite reviewers as collaborators on new repos. Team members don't need this.

## License

MIT
