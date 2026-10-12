#!/bin/bash
# SessionStart hook for Trailhead-Banner

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules missing — run: pnpm install"
fi

# MegaLinter plugin — cloud sessions never install the plugins that
# .claude/settings.json enables, so install it here (user scope, so the
# tracked settings file is not rewritten). Local sessions get it through
# the workspace trust prompt instead.
if [ "$CLAUDE_CODE_REMOTE" = "true" ] && command -v claude > /dev/null 2>&1; then
  if grep -q '"megalinter@megalinter"' ~/.claude/plugins/installed_plugins.json 2> /dev/null; then
    echo "Plugin: megalinter installed"
  elif timeout 60 claude plugin marketplace add oxsecurity/megalinter > /dev/null 2>&1 \
    && timeout 60 claude plugin install megalinter@megalinter --scope user > /dev/null 2>&1; then
    echo "Plugin: megalinter installed now — run /reload-plugins to load its skills"
  else
    echo "WARNING: megalinter plugin install failed — run: claude plugin install megalinter@megalinter"
  fi
fi

# Environment
NODE=$(node --version 2> /dev/null || echo 'not found')
PNPM=$(pnpm --version 2> /dev/null || echo 'not installed')
echo "Env: node $NODE | pnpm $PNPM"

# Git status
BRANCH=$(git branch --show-current 2> /dev/null || echo 'unknown')
CHANGES=$(git status --short 2> /dev/null | wc -l)
if [ "$CHANGES" -gt 0 ]; then
  echo "Git: $BRANCH ($CHANGES uncommitted files)"
else
  echo "Git: $BRANCH (clean)"
fi
