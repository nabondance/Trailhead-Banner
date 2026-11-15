---
name: gallery-refresh
description: Regenerate the /gallery example banners from src/data/examples.json (optional example ids, default all)
---

# Gallery Refresh

Regenerate the example banners shown on `/gallery`.

1. Requires the dev server (`bash scripts/agent/dev-start.sh`)
2. Renders each example in `src/data/examples.json` through `POST /api/banner/standard`
3. Saves them as WebP in `public/assets/examples/<id>.webp`
4. Review the images afterwards: profiles change, so check each banner still looks good

Execute from the repository root: `bash scripts/agent/gallery-refresh.sh "$@"`
