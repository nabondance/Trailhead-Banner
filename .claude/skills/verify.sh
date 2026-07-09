#!/bin/bash
# Verify skill - End-to-end verification: production build + banner generation
# Usage: /verify [username ...]
# Stops any running dev server (build clobbers .next), runs a production build,
# starts a fresh dev server, tests banner generation per username, stops server.

SKILLS_DIR="$(cd "$(dirname "$0")" && pwd)"
USERNAMES=("$@")
[ ${#USERNAMES[@]} -eq 0 ] && USERNAMES=(nabondance)

# 1. Ensure no dev server is running (next build breaks a running dev server)
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "Dev server running — stopping it before build"
  bash "$SKILLS_DIR/dev-stop.sh"
fi

# 2. Production build
if ! bash "$SKILLS_DIR/build.sh"; then
  echo "Verify: FAIL (build)"
  exit 1
fi

# 3. Start dev server
if ! bash "$SKILLS_DIR/dev-start.sh"; then
  echo "Verify: FAIL (dev server did not start)"
  exit 1
fi

# 4. Banner generation per username
FAILURES=0
for U in "${USERNAMES[@]}"; do
  if ! bash "$SKILLS_DIR/img-test.sh" "$U"; then
    echo "img-test ($U): FAILED"
    FAILURES=$((FAILURES + 1))
  fi
done

# 5. Stop dev server
bash "$SKILLS_DIR/dev-stop.sh" > /dev/null 2>&1 || true
echo "Dev server: Stopped"

# Summary
if [ "$FAILURES" -eq 0 ]; then
  echo "Verify: PASS (build OK, ${#USERNAMES[@]} banner test(s) OK)"
else
  echo "Verify: FAIL ($FAILURES of ${#USERNAMES[@]} banner test(s) failed)"
  exit 1
fi
