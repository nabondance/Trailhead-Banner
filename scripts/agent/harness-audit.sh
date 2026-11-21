#!/bin/bash
# Check the agent setup for broken skills, agents and paths (problems only)
# Usage: bash scripts/agent/harness-audit.sh
exec node "$(dirname "$0")/harness-audit.mjs"
