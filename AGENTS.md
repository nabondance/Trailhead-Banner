# Agent Context - Trailhead Banner

## Quick Start

**IMPORTANT: This project uses `pnpm`, NOT `npm` or `yarn`.**

```bash
pnpm install # Install dependencies
pnpm dev     # Start dev server (uses turbopack)
pnpm build   # Production build
```

## Tech Stack

- **Framework**: Next.js 16 (App Router + Pages API hybrid)
- **React**: v19
- **Styling**: Tailwind CSS v4
- **Canvas**: @napi-rs/canvas (for image generation)
- **Deployment**: Vercel
- **Caching**: Upstash Redis (15min TTL for GraphQL, reset on hit up to 30min)
- **Asset Cache**: Vercel Blob (certification logo images cached server-side)
- **Analytics DB**: Supabase (tracks banner/rewind generations and errors)

## Project Purpose

Generates LinkedIn banner images from Trailhead user data (badges, certifications, rank, MVP status).

## Critical Files (Read These First)

| File                                     | Purpose                      |
| ---------------------------------------- | ---------------------------- |
| `src/banner/renderers/standardBanner.js` | Standard banner renderer     |
| `src/banner/api/shared.js`               | Shared API utilities         |
| `src/utils/graphqlUtils.js`              | Trailhead API integration    |
| `src/pages/api/banner/standard.js`       | Standard banner API endpoint |
| `src/data/banners.json`                  | Background image metadata    |
| `src/components/BannerForm.js`           | Main user interface          |

## Architecture Patterns

### Data Flow

```mermaid
graph TB
    A[User Input] --> B[BannerForm Component]
    B --> C[GET /api/validate-username]
    C --> D{Valid?}
    D -->|No| E[Show Error]
    D -->|Yes| F[POST /api/banner/standard]
    F --> G[Rate limit + validators.js]
    G --> H[queryBuilder.js → shared.js fetchUserData]
    H --> I{Redis Cache Hit?}
    I -->|Yes| J[Cached Data]
    I -->|No| K[Trailhead GraphQL API]
    K --> L[Cache in Redis<br/>15min TTL, max 30min]
    L --> J
    J --> M[renderers/standardBanner.js]
    M --> N[components: prepare in parallel,<br/>render in order]
    N --> O[PNG as base64 data URL]
    O --> P[Display in Browser]

    style I fill:#e1f5ff
    style L fill:#ffe1e1
    style N fill:#e1ffe1
```

**Key Points:**

- All GraphQL queries cached for 15min to reduce Trailhead API load; each cache hit resets the TTL, but an entry never lives past 30min from its first write
- Canvas rendering happens server-side using @napi-rs/canvas
- API responses (`/api/banner/**`) return the generated banner as base64 for direct browser display
- Vercel Blob is used internally as an asset cache for certification logo images (`src/utils/blobUtils.js`, `src/utils/cacheUtils.js`); it is not used to store or share generated banners

### GraphQL Queries

- All queries in `src/graphql/queries/`; `src/banner/api/queryBuilder.js` picks which ones a banner needs
- Cached via `redisCacheUtils.js`
- Error handling in `graphqlUtils.js`

### Image Generation

1. The API route (`src/pages/api/banner/*.js`) validates the request (`src/banner/api/validators.js`) and fetches the data (`src/banner/api/shared.js`)
2. A renderer (`src/banner/renderers/standardBanner.js` or `companyBanner.js`) prepares every component in parallel, then renders them in order on one canvas
3. Components (`src/banner/components/`) draw with helpers from `src/utils/drawUtils.js`; user-supplied image URLs go through `urlSafety.js`, `imageSafety.js` and `imageValidation.js`
4. The canvas is encoded to a base64 PNG and shown in the browser

The Rewind image is the exception: it is drawn by `src/utils/generateRewind.js`, not by a renderer.

### Directory Structure

```text
src/
├── app/              # Next.js App Router pages
├── pages/api/        # API routes (Pages Router)
├── banner/           # Banner generation: api/, components/, renderers/
├── components/       # React components
├── utils/            # Business logic & helpers
├── graphql/queries/  # GraphQL query definitions
└── data/             # Static data (banners.json)
```

## Code Style & Conventions

- **Formatting**: Prettier + Stylelint (enforced by husky pre-commit)
- **Commits**: Conventional commits `type(scope): description`
  - Common types: `feat, fix, docs, style, refactor, perf, build, chore`
  - Common scopes: `core, deps, ui, config, util, release`
- **Format Code**: Run `bash scripts/agent/format.sh` to check or `bash scripts/agent/format-fix.sh` to auto-fix
- **Claude Code output style**: the repo sets `Lean` (`.claude/output-styles/lean.md`) as the default; set `outputStyle` in `.claude/settings.local.json` to use your own

## Common Tasks

### Create or Edit a Page

When creating a new page or editing an existing one, always add or update the `export const metadata` block at the top of the `page.js` file. Every page must have:

- `title` — unique, descriptive, under 60 characters
- `description` — unique, 1–2 sentences summarising the page content
- `alternates.canonical` — absolute URL of the page
- `openGraph` — title, description, url, siteName (`'Trailhead Banner'`), type (`'website'`), images (always include `{ url: '/og-image.png', width: 1200, height: 630, alt: '...' }`)
- `twitter` — card (`'summary_large_image'`), title, description, images (`['/og-image.png']`)

**OG images:** most pages use `/og-image.png` (default, 1200×630px). Exceptions:

- `/rewind` uses `/og-image-rewind.png` — distinct seasonal identity

> **Important:** page-level `openGraph` replaces (not merges) the layout default — always repeat the `images` array or the OG image will be lost.

See any existing page (e.g. `src/app/examples/page.js`) as a reference.

When **adding** a new page, also update:

1. `src/app/sitemap.js` — add an entry with appropriate `priority` and `changeFrequency`
2. `src/content/llms.js` → `buildLlmsTxt` (serves `/llms.txt`) — add a line under `## Pages` with the URL and a one-line description
3. `src/content/llms.js` → `buildLlmsFullTxt` (serves `/llms-full.txt`) — add the page under `## Pages` and update any relevant sections (API, features, etc.)

When **removing** a page, remove it from both files as well.

### Add New Background Image

1. Add to `public/assets/background-library/`
2. Update `src/data/banners.json` with metadata (`src`, `alt`, `credit`), plus `focusY` when the subject isn't centered
   - `focusY` sets the vertical crop on the company banner (0 = keep top, 0.5 = center (default), 1 = keep bottom)
3. Verify in background library page, and in the company form's Background Preview

### Modify Banner Layout

- Edit the component in `src/banner/components/` for one element's position and look
- Edit the renderer in `src/banner/renderers/` for overall layout and layering
- Shared drawing helpers live in `src/utils/drawUtils.js`
- Read `docs/banner-components.md` first

### Update Trailhead Data Fetching

- Queries: `src/graphql/queries/`, selected per banner by `src/banner/api/queryBuilder.js`
- Fetching: `src/banner/api/shared.js` → `src/utils/graphqlUtils.js`
- Caching: `src/utils/redisCacheUtils.js` (15min TTL, reset on hit, 30min max)

## Key External Dependencies

- **Trailhead GraphQL API**: Source of user data (cached)
- **@napi-rs/canvas**: Server-side canvas rendering
- **Upstash Redis**: Query result caching, and per-IP rate limits on the API routes (`src/utils/rateLimit.js`, fails open if Redis is down)
- **Vercel Blob**: Server-side asset cache for certification logo images (not used for generated banners)
- **Supabase**: Analytics database — tracks every banner/rewind generation (`banners`, `rewinds` tables) and errors (`errors` table); implemented in `src/utils/supabaseUtils.js`.
  The server writes with `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`);
  the browser uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` only for the `announcement` table and the `generation_count` database function behind the generation counters.
  The anon key cannot read or write the analytics tables

## Debugging Quick Tips

- **Canvas errors**: Check `@napi-rs/canvas` compatibility
- **GraphQL failures**: Check cache TTL and Trailhead API status
- **Validation errors**: See `src/utils/usernameValidation.js` rules
- **Build errors**: Ensure using `pnpm`, not `npm`

## Agent Skills and Workflows

Reusable skills and their direct commands:

- **`format`** — `bash scripts/agent/format.sh`; check formatting without modifying files
- **`format-fix`** — `bash scripts/agent/format-fix.sh`; run Prettier and Stylelint fixes
- **`build`** — `bash scripts/agent/build.sh`; validate the production build
- **`dev-start`** — `bash scripts/agent/dev-start.sh`; start the dev server in the background
- **`dev-stop`** — `bash scripts/agent/dev-stop.sh`; stop the background dev server
- **`img-test [username]`** — `bash scripts/agent/img-test.sh [username]`; test image generation
- **`verify [username...]`** — `bash scripts/agent/verify.sh [username...]`; run the full verification workflow
- **`cold-review [pr]`** — zero-context review of a PR or the current branch by the `code-goldfish` agent, which sees only the diff, the code and the linked issue
- **`full-review [pr]`** — `cold-review` in the background, a review with full project context, and `security-reviewer` when API or URL code changes, merged into one report

### Design work (EGM plugin)

The [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) plugin (`egm@egm`) is enabled in `.claude/settings.json`. Codex users install it once: `codex plugin marketplace add google/elephant-goldfish-model && codex plugin add egm@egm`. Its skills are user-only, so the repo wraps them in skills agents can pick on their own: `design-brainstorm` (rough idea → brief), `design-draft` (brief → design doc), `design-review` (zero-context review of a design doc), `design-drift` (design docs vs code). Typing `/egm:egm-brainstorm` etc. still works.

EGM artifact directory: docs/egm

## Verifying Changes

Before committing non-trivial changes, run `bash scripts/agent/verify.sh`. It stops any running dev server (a production build breaks it), runs `pnpm build`, starts a fresh dev server, generates a banner via `POST /api/banner/standard` for each username, stops the server, and prints `Verify: PASS` or `FAIL`. For a quick iteration loop, use `bash scripts/agent/dev-start.sh` followed by `bash scripts/agent/img-test.sh`.

## Token-Saving References

Instead of asking for details, read these directly:

- Username validation rules → `src/utils/usernameValidation.js`
- Image validation logic → `src/utils/imageValidation.js`
- API endpoint patterns → `src/pages/api/*.js`
- Component structure → `src/components/BannerForm.js`
- Background configs → `src/data/banners.json`

## Working Docs

The `docs/` folder contains two kinds of documents:

- **Feature notes** — plans, open questions, and migration steps for features currently in progress
- **Reference guides** — e.g. `docs/banner-components.md`, the full guide for banner components

Before starting work on an ongoing feature, look in `docs/` for an existing note about it.

---

## Banner Component Architecture

Banner code lives in `src/banner/`: `components/` holds reusable parts (background, counters, certifications, superbadges, stamps, company and sfdx-hardis parts…; list the folder for the full set), `renderers/` holds banner implementations (standardBanner.js, companyBanner.js).

Every component exports 4 functions: `prepare*` (async — load assets, compute layout), `render*` (draw to canvas), `get*Warnings`, `get*Timings`. Renderers follow 3 phases: **prepare** (components in parallel via `Promise.all`) → **render** (sequential, for correct layering) → **collect** warnings and encode to base64.

> **Before writing banner code, read `docs/banner-components.md`** — full templates for new banner types and components, canvas best practices, and layout patterns.

### Common Pitfalls

1. **Always use default parameters**: `options = {}` prevents undefined errors
2. **Null-safe access**: `prepared?.width ?? 0` when reading dimensions
3. **Validate URLs**: Block private IPs, check protocols (SSRF protection)
4. **Check edge cases**: Division by zero when only 1 item exists
5. **Visual semantics**: expired certifications → grayscale; retired → 50% opacity
6. **Canvas**: ES6 modules throughout; canvas objects draw directly via `drawImage`; use CSS filters (`ctx.filter`), not `putImageData`

<!-- markdownlint-disable MD025 -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- markdownlint-enable MD025 -->
