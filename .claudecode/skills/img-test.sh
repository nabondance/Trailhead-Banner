#!/bin/bash
# Image generation test skill - Test banner generation with minimal output
# Usage: /img-test [username]
# Requires: Dev server running on localhost:3000

set -e

USERNAME="${1:-nabondance}"

echo "Testing image generation for: $USERNAME"

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "ERROR: No server running on localhost:3000"
  echo "Start with: pnpm dev"
  exit 1
fi

# Build minimal request payload with required options
PAYLOAD=$(
  cat << EOF
{
  "username": "$USERNAME",
  "backgroundColor": "#5badd6",
  "displayBadgeCount": true,
  "displaySuperbadgeCount": true,
  "displayCertificationCount": true,
  "displayTrailCount": false,
  "displayPointCount": false,
  "displayStampCount": false,
  "displayRankLogo": true,
  "displaySuperbadges": false,
  "includeExpiredCertifications": false,
  "includeRetiredCertifications": false,
  "textColor": "#000000",
  "badgeLabelColor": "#555555",
  "badgeMessageColor": "#1F80C0",
  "backgroundKind": "color",
  "backgroundImageUrl": ""
}
EOF
)

# Call the API and capture response
START=$(date +%s)
RESPONSE=$(curl -s -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
END=$(date +%s)
DURATION=$((END - START))

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 | head -1)
  echo "FAILED: $ERROR"
  exit 1
fi

# Parse timings from response
TOTAL_MS=$(echo "$RESPONSE" | grep -o '"total_ms":[0-9]*' | grep -o '[0-9]*' | head -1)
GRAPHQL_MS=$(echo "$RESPONSE" | grep -o '"graphql_queries_ms":[0-9]*' | grep -o '[0-9]*' | head -1)
IMAGE_MS=$(echo "$RESPONSE" | grep -o '"image_generation_ms":[0-9]*' | grep -o '[0-9]*' | head -1)

# Check for imageUrl in response
if echo "$RESPONSE" | grep -q '"imageUrl"'; then
  IMAGE_URL=$(echo "$RESPONSE" | grep -o '"imageUrl":"[^"]*"' | cut -d'"' -f4)

  # Get image size if it's a blob URL
  if [[ "$IMAGE_URL" == http* ]]; then
    SIZE=$(curl -sI "$IMAGE_URL" 2> /dev/null | grep -i content-length | awk '{print $2}' | tr -d '\r')
    SIZE_KB=$((SIZE / 1024))
    echo "Image: ${SIZE_KB}KB | API: ${TOTAL_MS}ms (GraphQL: ${GRAPHQL_MS}ms, Canvas: ${IMAGE_MS}ms)"
  else
    # Base64 image
    echo "Image: base64 | API: ${TOTAL_MS}ms (GraphQL: ${GRAPHQL_MS}ms, Canvas: ${IMAGE_MS}ms)"
  fi

  echo "Status: OK"
else
  echo "WARNING: No imageUrl in response"
  echo "$RESPONSE" | head -5
  exit 1
fi
