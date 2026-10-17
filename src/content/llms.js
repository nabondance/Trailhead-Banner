// Source of /llms.txt and /llms-full.txt (served by route handlers in src/app/llms*.txt/).
// Edit the text here; `usageLine` injects the live banner count when available.

import bannerBackgrounds from '../data/banners.json';

const backgroundCount = bannerBackgrounds.length;

const getUsageLine = (formattedCount, prefix) =>
  formattedCount ? `${prefix}${formattedCount} banners generated so far\n` : '';

/** @param {{ formattedCount?: string|null }} options */
export const buildLlmsTxt = ({ formattedCount = null } = {}) => {
  const usageLine = getUsageLine(formattedCount, '- ');
  return `# Trailhead Banner

> A free, open-source web application that generates custom LinkedIn banner images
> from a Salesforce Trailhead user's profile data (badges, certifications, rank,
> MVP status, Agentblazer rank). Available at https://thb.nabondance.me.

## Site Purpose

Trailhead Banner lets Salesforce professionals showcase their Trailhead achievements
on LinkedIn by automatically generating a personalised banner image. Users enter
their Trailhead username and receive a downloadable PNG banner.

## Pages

- https://thb.nabondance.me — Home page. Enter a Trailhead username to generate a banner.
- https://thb.nabondance.me/how-to — Step-by-step instructions for using the tool and uploading the banner to LinkedIn, plus an FAQ.
- https://thb.nabondance.me/examples — Gallery of example banners showing different configurations.
- https://thb.nabondance.me/background-library — Browse the ${backgroundCount} available background images for the banner.
- https://thb.nabondance.me/rewind — Generate a year-in-review banner (active December–January).
- https://thb.nabondance.me/releases — Changelog and release history.
- https://thb.nabondance.me/sponsors — Sponsors and supporters who help keep the project running.
- https://thb.nabondance.me/legal — Terms of use and privacy information.

## Full Reference

A more detailed reference for AI agents (API docs, banner content, technical details) is available at:
https://thb.nabondance.me/llms-full.txt

## Key Facts

${usageLine}- Free and open-source (GitHub: nabondance/trailhead-banner)
- Data fetched live from Salesforce Trailhead GraphQL API, with optional verified sfdx-hardis training badges from Cloudity
- Banner generated server-side as a PNG, returned as base64
- No account required; only public Trailhead profile data is used (stored for anonymous usage analytics, deletion on request)
- Not an official Salesforce product — an independent community project
- Built with Next.js, deployed on Vercel
- Author: nabondance (https://nabondance.me)
`;
};

/** @param {{ formattedCount?: string|null }} options */
export const buildLlmsFullTxt = ({ formattedCount = null } = {}) => {
  const usageLine = getUsageLine(formattedCount, '- **Usage:** ');
  return `# Trailhead Banner — Full Reference for AI Agents

> A free, open-source web application that generates custom LinkedIn banner images
> from a Salesforce Trailhead user's profile data (badges, certifications, rank,
> MVP status, AgentBlazer rank). Available at https://thb.nabondance.me.

## Site Purpose

Trailhead Banner lets Salesforce professionals showcase their Trailhead achievements
on LinkedIn by automatically generating a personalised banner image (1584×396px PNG).
Users enter their Trailhead username and receive a downloadable banner image showing
their rank, certifications, superbadges, badge counts, and more.

## Pages

- https://thb.nabondance.me — Home page. Enter a Trailhead username to generate a banner.
- https://thb.nabondance.me/how-to — Step-by-step instructions for using the tool and uploading the banner to LinkedIn, plus an FAQ.
- https://thb.nabondance.me/examples — Gallery of example banners showing different configurations.
- https://thb.nabondance.me/background-library — Browse all ${backgroundCount} available background images for the banner.
- https://thb.nabondance.me/rewind — Generate a year-in-review banner (active December–January).
- https://thb.nabondance.me/releases — Changelog and release history.
- https://thb.nabondance.me/sponsors — Sponsors and supporters who help keep the project running.
- https://thb.nabondance.me/legal — Terms of use and privacy information.

## Banner Content

A generated banner (1584×396px) includes the following elements:

- **Rank logo** — Trailblazer rank (e.g. Ranger, Mountaineer, Expeditioner, Double Star Ranger)
- **Counters** — Badges, superbadges and certifications by default; optionally trails, points, stamps, event stamps, FDE level, Implementation Ready, and Trailblazer Community activity (best answers, answers, questions, followers, following, groups)
- **AgentBlazer rank** — AgentBlazer status if the user has one
- **Certifications** — Logos for all earned Salesforce certifications (expired shown in greyscale, retired at 50% opacity)
- **Superbadges** — Logos for earned superbadges
- **sfdx-hardis training badge** — Highest verified Cloudity course badge, when earned (not a certification)
- **MVP ribbon** — Top-right corner ribbon for Salesforce MVP/All-Star MVP holders
- **Background** — Chosen from a library of ${backgroundCount} Salesforce/Trailblazer themed backgrounds
- **Watermark** — Trailhead Banner branding (bottom-right corner)

## How To Use

1. Go to https://thb.nabondance.me
2. Enter a Trailhead username (e.g. \`nabondance\`) — not an email, not a full URL
3. Optionally customise: choose a background, adjust badge label colour, upload a custom background
4. Click Generate — the banner appears within ~1 second
5. Download the PNG and upload it to LinkedIn as your profile banner

### Username Rules

- Must be the plain username (e.g. \`nabondance\`), not a URL or email
- The Trailhead profile must be public
- Certifications must be set to public in Trailhead settings

## Background Library

${backgroundCount} backgrounds are available, themed around Salesforce events, locations, and Trailblazer.me imagery.
Examples: Australia, Japan, France, Highland Waterfalls, Tropical Beach, and more.
Full list visible at https://thb.nabondance.me/background-library.

Users can also provide a custom background via URL or image upload.

## Technical Details

${usageLine}- **Output format:** PNG, returned as base64 data URL
- **Canvas size:** 1584×396px (standard LinkedIn banner dimensions)
- **Data source:** Salesforce Trailhead GraphQL API (cached 15 minutes via Upstash Redis)
- **Rendering:** Server-side canvas via @napi-rs/canvas
- **Generation time:** ~300–800ms end-to-end
- **Framework:** Next.js 16, deployed on Vercel
- **No account required.** Only public Trailhead profile data is used; it is stored for anonymous usage analytics and can be deleted on request (contact@nabondance.me)
- **Open-source:** https://github.com/nabondance/trailhead-banner

## FAQ

**What size is the banner?** 1584×396px PNG, LinkedIn's recommended background photo size.

**Why are my certifications missing?** They must be public: Trailhead Academy profile → Certification Privacy → "Make my certifications public to all". See https://thb.nabondance.me/how-to#make-certifications-public

**Why does it say my profile is private?** The Trailhead profile must be public (Trailhead settings → Your Profile Privacy → Public), and the input must be the username, not an email. See https://thb.nabondance.me/how-to#make-profile-public

**How do I put it on LinkedIn?** Download the PNG → LinkedIn profile → pencil icon on the background photo → Change photo → upload → Save.

**Is it free / official?** Free, open source, no account needed. It is an independent community project, not an official Salesforce product.

## Author

nabondance — https://nabondance.me
`;
};
