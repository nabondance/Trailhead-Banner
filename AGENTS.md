# AI Coding Assistant Instructions for Trailhead-Banner

This document guides AI coding assistants on the key patterns and practices of the Trailhead-Banner project.

## Project Overview

Trailhead-Banner is a Next.js web application that generates LinkedIn banner images using Trailhead user data. The app fetches user statistics, certifications, and badges from Trailhead and creates customizable banner images for LinkedIn profiles.

## Architecture & Components

### Core Components

- `src/app/page.js` - Main entry point using Next.js App Router
- `src/components/BannerForm.js` - Core form for banner customization
- `src/components/BannerCount.js` - Handles badge/certification count displays
- `src/utils/generateImage.js` - Core image generation logic

### Data Flow

1. User inputs Trailhead username (`BannerForm.js`)
2. App fetches user data through GraphQL queries (`src/graphql/queries/`)
3. Data is processed and validated (`src/utils/dataUtils.js`)
4. Image is generated with canvas (`src/utils/drawUtils.js`, `src/utils/imageUtils.js`)

## Development Workflow

### Setup & Running

```bash
pnpm install
pnpm dev  # Runs with turbopack for faster development
```

### Key Commands

- `pnpm build` - Production build
- `pnpm format:all:fix` - Fix formatting issues
- Pre-commit hooks automatically run formatting (see husky config)

### Testing & Validation

- Username validation in `src/utils/usernameValidation.js`
- Image validation in `src/utils/imageValidation.js`
- Background library at `/background-library` for testing different designs

## Project Conventions

### Component Structure

- Components are function-based React components with Props validation
- UI components are placed in `src/components/`
- Utility functions are organized by domain in `src/utils/`

### Asset Management

- Background images stored in `public/assets/background-library/`
- Logos and brand assets in `public/assets/logos/`
- Font files in `public/assets/fonts/`

### State Management

- Form state managed through React state hooks
- No global state management - data flows through props
- Cache utilities (`src/utils/cacheUtils.js`) for performance optimization

## Common Tasks

### Adding New Background Images

1. Add image to `public/assets/background-library/`
2. Update `src/data/banners.json` with new image metadata
3. Validate in `BackgroundLibraryPage.js`

### Modifying Banner Generation

Core logic is in `src/utils/generateImage.js` and supporting utilities in `src/utils/drawUtils.js`

## External Dependencies

- Vercel for deployment
- Next.js 13+ with App Router
- TailwindCSS for styling
- FontAwesome for icons
