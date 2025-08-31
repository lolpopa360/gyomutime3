#!/usr/bin/env bash
set -euo pipefail

# Create a brand-new GitHub repository for this project and push current code.
# Usage:
#   bash scripts/new-github-repo.sh [repo-name] [--public|--private]
# Defaults:
#   repo-name: gyomutime-YYYYMMDDHHMMSS
#   visibility: --private

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

vis="--private"
name=""
if [[ ${1-} != "" && ${1-} != "--public" && ${1-} != "--private" ]]; then
  name="$1"; shift || true
fi
if [[ ${1-} == "--public" || ${1-} == "--private" ]]; then
  vis="$1"; shift || true
fi

if ! command -v gh >/dev/null 2>&1; then
  echo -e "${RED}GitHub CLI (gh) is not installed. Please install gh first.${NC}" >&2
  exit 1
fi

# Pick a unique default name when not provided
if [[ -z "$name" ]]; then
  stamp=$(date +%Y%m%d%H%M%S)
  name="gyomutime-${stamp}"
fi

echo -e "${YELLOW}Preparing repository for '${name}' (${vis#--}).${NC}"

# Ensure we are inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${YELLOW}Initializing git repository...${NC}"
  git init
fi

# Commit any pending changes
if [[ -n "$(git status --porcelain)" ]]; then
  echo -e "${YELLOW}Committing pending changes...${NC}"
  git add -A
  git commit -m "chore: snapshot for new GitHub repo"
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" == "HEAD" ]]; then
  current_branch="main"
  git branch -M "$current_branch"
fi

echo -e "${YELLOW}Checking GitHub authentication...${NC}"
if ! gh auth status >/dev/null 2>&1; then
  echo -e "${YELLOW}Launching GitHub web login...${NC}"
  gh auth login --hostname github.com --git-protocol https --web
fi

remote_name="new-origin"

# Create repo and push
echo -e "${YELLOW}Creating GitHub repository '${name}'...${NC}"
gh repo create "$name" $vis --source=. --remote="$remote_name" --push

echo -e "${GREEN}Repository created and pushed successfully.${NC}"
echo
echo -e "Remotes:" && git remote -v
echo
echo -e "${YELLOW}If you want to make '${remote_name}' your default 'origin':${NC}"
echo -e "  git remote rename origin origin-old 2>/dev/null || true"
echo -e "  git remote rename ${remote_name} origin"
echo
echo -e "${GREEN}Done.${NC}"

