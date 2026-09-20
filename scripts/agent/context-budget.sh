#!/bin/bash
# Audit token costs of the repository agent setup
# Token estimates: chars / 4

echo "=== Agent Context Budget ==="
echo ""

# AGENTS.md
if [ -f "AGENTS.md" ]; then
  SIZE=$(wc -c < AGENTS.md)
  echo "ALWAYS LOADED"
  printf "  %-30s ~%d tokens\n" "AGENTS.md" "$((SIZE / 4))"
fi

# Hooks (output varies, estimate script size as proxy)
for f in scripts/agent/hooks/*.sh; do
  [ -f "$f" ] || continue
  SIZE=$(wc -c < "$f")
  printf "  %-30s ~%d tokens (hook script)\n" "$(basename $f)" "$((SIZE / 4))"
done

echo ""
echo "ON INVOCATION (skills)"
for dir in .claude/skills/*/; do
  SKILL_MD="$dir/SKILL.md"
  [ -f "$SKILL_MD" ] || continue
  SIZE=$(wc -c < "$SKILL_MD")
  NAME=$(basename "$dir")
  printf "  %-30s ~%d tokens\n" "/$NAME" "$((SIZE / 4))"
done

echo ""
echo "ON AGENT SPAWN"
for f in .claude/agents/*.md; do
  [ -f "$f" ] || continue
  SIZE=$(wc -c < "$f")
  NAME=$(basename "$f" .md)
  printf "  %-30s ~%d tokens\n" "$NAME" "$((SIZE / 4))"
done

echo ""
# Total always-loaded
TOTAL=0
[ -f "AGENTS.md" ] && TOTAL=$((TOTAL + $(wc -c < AGENTS.md) / 4))
for f in scripts/agent/hooks/*.sh; do
  [ -f "$f" ] && TOTAL=$((TOTAL + $(wc -c < "$f") / 4))
done
echo "TOTAL AT REST: ~$TOTAL tokens"
