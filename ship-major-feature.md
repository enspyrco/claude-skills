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

2. **Bump required reviews to 2 for the cage match:**

```bash
PR_REVIEW_CONFIG=$(gh api repos/$REPO/branches/$BASE_BRANCH/protection/required_pull_request_reviews 2>/dev/null)
CURRENT_REVIEW_COUNT=$(echo "$PR_REVIEW_CONFIG" | jq '.required_approving_review_count')
```

If `CURRENT_REVIEW_COUNT` is not `2`, use the targeted PATCH endpoint (not the full PUT, which can fail on scoped tokens and risks clobbering other protection settings):

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $ENSPYR_ADMIN_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/branches/$BASE_BRANCH/protection/required_pull_request_reviews" \
  -d '{"required_approving_review_count":2,"dismiss_stale_reviews":true}'
```

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

## Post-Merge: Restore Branch Protection

After merging, restore required reviews back to 1 so normal `/ship` PRs aren't blocked:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $ENSPYR_ADMIN_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/branches/$BASE_BRANCH/protection/required_pull_request_reviews" \
  -d '{"required_approving_review_count":1,"dismiss_stale_reviews":true}'
```

**Important:** Always use the targeted `PATCH .../required_pull_request_reviews` endpoint, not the full `PUT .../protection`. The full PUT requires broader token scopes and risks clobbering other protection settings (status checks, restrictions, etc.).
