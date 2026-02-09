---
argument-hint: [commit-message]
description: Ship major features with adversarial dual review (cage match)
---

# Ship Major Feature

Follow the `/ship` workflow (see ship.md) with the following overrides:

## Override: Branch Protection (Step 0)

Require **2 approving reviews** instead of 1. Both `MaxwellMergeSlam` and `KelvinBitBrawler` must be required reviewers. In ship.md Step 0, replace the `required_approving_review_count` value:

```bash
-f "required_pull_request_reviews[required_approving_review_count]=2"  # instead of =1
```

Update the initialization marker to reflect dual review:

```bash
echo "reviewer=maxwell+kelvin" >> .claude/ship-initialized
```

## Override: Review Step (Step 5)

Instead of `/pr-review`, run the cage match:

```
/cage-match $PR_NUMBER
```

This sends the PR through both Maxwell (Claude) and Kelvin (Gemini) for independent reviews, cross-critiques, and dual GitHub review postings.

## Override: Merge Requirement (Step 7)

**Both reviewers must APPROVE** before merging. If either reviewer returns REQUEST_CHANGES, follow the Step 6 feedback handling flow and then re-run `/cage-match` (not just `/pr-review`).
