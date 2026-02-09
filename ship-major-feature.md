---
argument-hint: [commit-message]
description: Ship major features with adversarial dual review (cage match)
---

# Ship Major Feature

Follow the `/ship` workflow (see ship.md) with the following overrides:

## Pre-Step: Ensure Dual Review Setup

**Always run this before Step 0**, regardless of whether `.claude/ship-initialized` exists.

1. **Check both reviewers are collaborators:**

```bash
source ~/.enspyr-claude-skills/.env 2>/dev/null || source .env 2>/dev/null
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
BASE_BRANCH=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name')

MAXWELL_IS_COLLAB=$(gh api repos/$REPO/collaborators/MaxwellMergeSlam 2>/dev/null && echo "yes" || echo "no")
KELVIN_IS_COLLAB=$(gh api repos/$REPO/collaborators/KelvinBitBrawler 2>/dev/null && echo "yes" || echo "no")
```

If either is missing and `ENSPYR_ADMIN_PAT` is available, invite and accept (same as ship.md Step 0). If no admin PAT, warn the user.

2. **Check branch protection requires 2 reviews:**

```bash
CURRENT_REVIEW_COUNT=$(gh api repos/$REPO/branches/$BASE_BRANCH/protection/required_pull_request_reviews 2>/dev/null | jq '.required_approving_review_count')
```

If `CURRENT_REVIEW_COUNT` is not `2`, update branch protection:

```bash
gh api repos/$REPO/branches/$BASE_BRANCH/protection -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f "required_pull_request_reviews[required_approving_review_count]=2" \
  -f "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -f "enforce_admins=false" \
  -f "restrictions=null"
```

Note: preserve any existing `required_status_checks` from the current protection rules when updating.

3. **Update initialization marker:**

```bash
mkdir -p .claude
grep -q "reviewer=maxwell+kelvin" .claude/ship-initialized 2>/dev/null || echo "reviewer=maxwell+kelvin" >> .claude/ship-initialized
```

Then continue with the `/ship` workflow (Step 0 will be skipped if already initialized, which is fine — we've handled what it would miss).

## Override: Review Step (Step 5)

Instead of `/pr-review`, run the cage match:

```
/cage-match $PR_NUMBER
```

This sends the PR through both Maxwell (Claude) and Kelvin (Gemini) for independent reviews, cross-critiques, and dual GitHub review postings.

## Override: Merge Requirement (Step 7)

**Both reviewers must APPROVE** before merging. If either reviewer returns REQUEST_CHANGES, follow the Step 6 feedback handling flow and then re-run `/cage-match` (not just `/pr-review`).
