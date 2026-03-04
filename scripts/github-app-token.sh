#!/usr/bin/env bash
# github-app-token.sh — Generate a short-lived GitHub App installation token.
#
# Usage:
#   github-app-token.sh <app-id> <private-key-base64> <owner/repo>
#
# Outputs the installation access token to stdout (1-hour TTL).
# Exit codes:
#   0 — success
#   1 — missing arguments or dependencies
#   2 — JWT generation failed
#   3 — App not installed on the target repo
#   4 — Token exchange failed

set -euo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
if [ $# -lt 3 ]; then
  echo "Usage: github-app-token.sh <app-id> <private-key-base64> <owner/repo>" >&2
  exit 1
fi

APP_ID="$1"
PRIVATE_KEY_B64="$2"
REPO="$3"

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
for cmd in openssl jq curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Decode private key
# ---------------------------------------------------------------------------
PRIVATE_KEY=$(echo "$PRIVATE_KEY_B64" | base64 -d 2>/dev/null)
if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: Failed to decode base64 private key." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Helper: base64url encode (no padding, URL-safe)
# ---------------------------------------------------------------------------
b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# ---------------------------------------------------------------------------
# Build JWT (RS256, 10-minute TTL)
# ---------------------------------------------------------------------------
NOW=$(date +%s)
IAT=$((NOW - 60))        # issued 60s ago to account for clock drift
EXP=$((NOW + 600))       # expires in 10 minutes

HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$IAT" "$EXP" "$APP_ID" | b64url)

UNSIGNED="${HEADER}.${PAYLOAD}"
SIGNATURE=$(printf '%s' "$UNSIGNED" \
  | openssl dgst -sha256 -sign <(echo "$PRIVATE_KEY") \
  | b64url)

JWT="${UNSIGNED}.${SIGNATURE}"

# ---------------------------------------------------------------------------
# Look up installation ID for the target repo
# ---------------------------------------------------------------------------
INSTALL_RESPONSE=$(curl -sf \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/installation" 2>&1) || {
  echo "Error: App is not installed on ${REPO}." >&2
  echo "Install it at: https://github.com/apps/$(echo "$APP_ID" | tr '[:upper:]' '[:lower:]')/installations/new" >&2
  exit 3
}

INSTALLATION_ID=$(echo "$INSTALL_RESPONSE" | jq -r '.id')
if [ -z "$INSTALLATION_ID" ] || [ "$INSTALLATION_ID" = "null" ]; then
  echo "Error: Could not determine installation ID for ${REPO}." >&2
  echo "Response: $INSTALL_RESPONSE" >&2
  exit 3
fi

# ---------------------------------------------------------------------------
# Exchange JWT for an installation access token (1-hour TTL)
# ---------------------------------------------------------------------------
TOKEN_RESPONSE=$(curl -sf \
  -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens" 2>&1) || {
  echo "Error: Failed to create installation access token." >&2
  exit 4
}

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Token exchange returned empty token." >&2
  echo "Response: $TOKEN_RESPONSE" >&2
  exit 4
fi

echo "$TOKEN"
