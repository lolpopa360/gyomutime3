#!/usr/bin/env bash
set -euo pipefail

# Create a public GitHub repo under a given owner using a Personal Access Token
# and push the current repository to it — fully non‑interactive.
#
# Requirements:
#   - env GH_TOKEN must be set (classic PAT with 'repo' scope, or fine‑grained with repo create + contents:write)
#
# Usage:
#   GH_TOKEN=xxxx bash scripts/publish-with-token.sh [owner] [repo]
# Defaults:
#   owner: lolpopa360
#   repo:  cp-sat

owner="${1:-lolpopa360}"
repo="${2:-cp-sat}"

RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo -e "${RED}GH_TOKEN is not set. Export a GitHub Personal Access Token first.${NC}" >&2
  exit 1
fi

api="https://api.github.com"
authH=( -H "Authorization: token ${GH_TOKEN}" -H "Accept: application/vnd.github+json" )

echo -e "${YELLOW}Ensuring git repo and clean worktree...${NC}"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A && git commit -m "chore: snapshot before publish"
fi

# Create repository via API if it doesn't exist
echo -e "${YELLOW}Creating repo ${owner}/${repo} (public) if missing...${NC}"
status=$(curl -sS -o /dev/null -w "%{http_code}" "${api}/repos/${owner}/${repo}" -H "Authorization: token ${GH_TOKEN}") || status=000
if [[ "$status" == "404" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing jq is recommended, falling back to raw JSON string...${NC}"
    body="{\"name\":\"${repo}\",\"private\":false}"
  else
    body=$(jq -n --arg name "$repo" '{ name: $name, private: false }')
  fi
  curl -sS "${api}/user/repos" "${authH[@]}" -d "${body}" >/dev/null
  echo -e "${GREEN}Repository created.${NC}"
else
  echo -e "${YELLOW}Repository already exists or cannot be checked (HTTP ${status}). Proceeding...${NC}"
fi

# Push using a temporary remote with token in URL, then scrub
echo -e "${YELLOW}Pushing code to ${owner}/${repo}...${NC}"
branch=$(git rev-parse --abbrev-ref HEAD || echo main)
tmpremote="tmp-publish-origin"
git remote remove "$tmpremote" 2>/dev/null || true
git remote add "$tmpremote" "https://x-access-token:${GH_TOKEN}@github.com/${owner}/${repo}.git"
git push -u "$tmpremote" "$branch":main

# Replace temp remote URL with clean URL and rename if no origin
git remote set-url "$tmpremote" "https://github.com/${owner}/${repo}.git"
if ! git remote | grep -qx "origin"; then
  git remote rename "$tmpremote" origin
  echo -e "${GREEN}Remote 'origin' set to https://github.com/${owner}/${repo}.git${NC}"
else
  echo -e "${YELLOW}Temp remote kept as '${tmpremote}'. You can rename if desired:${NC}"
  echo "  git remote rename ${tmpremote} origin"
fi

echo -e "${GREEN}Done. Repo: https://github.com/${owner}/${repo}${NC}"

