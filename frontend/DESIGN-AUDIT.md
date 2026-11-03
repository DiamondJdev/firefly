# Firefly design audit

Open http://127.0.0.1:3000 to inspect the production build.

Status: implementation and verification complete. Nine content sections, one footer, one Next.js route. No public deployment or backend integration was performed.

## Design direction

Firefly is a personal infrastructure workshop: charcoal surfaces, plain typography, square controls, and a raster ASCII firefly as the identifying image.

The installed tasteskill v2 is the sole design rule source. The selected direction is `one-motif`, seed `897965685`. On this page, the Firefly namesake becomes a large ASCII specimen, with its wing anatomy returning in the capabilities section. The live element switches among CLI, Git, and Dockerfile workflow examples.

| Dial | Value | Reason |
| --- | --- | --- |
| Design variance | 6/10 | Different compositions share one type system and a tight outer frame. |
| Motion intensity | 2/10 | Reading content stays still; controls provide brief feedback. |
| Visual density | 6/10 | Technical substance and large raster images carry the page. |

The first hero deal required a paper card, decorative stripes, and a room photograph. Those conflict with the approved charcoal ASCII direction and the available imagery. A hero redraw returned a folder stack, also incompatible with the ban on fake screenshot treatments. The implemented hero follows the direction's primary split composition and the approved ASCII read. The features slot was explicitly changed to `features-paragraph-with-picture-words` because no real product UI exists. The showcase slot was changed to `showcase-square-plate-spare-text` because an ornamental disc would violate the brief. The maker note uses the hardware study rather than an invented portrait. The CTA links to the actual local blueprint rather than collecting information for a nonexistent access service.

## Em-dash audit

Pass. A scan of 19 text files found zero U+2014 em-dashes and zero U+2013 en-dashes in the authored frontend source, public text, documentation, scripts, configuration, and the recorded QA text. The browser check also finds neither character in the rendered page at 1440, 768, 390, and 320 pixels.

Dependencies, generated Next.js internals, the pre-existing parent README, and font binary data are outside this authored-content audit.

## Pre-flight check

The installed `design-taste-frontend/SKILL.md` has no Section 14 or checklist titled Pre-Flight Check. This table maps every installed house rule and the user's explicit constraints. It does not claim to reproduce an unavailable checklist.

| Check | Result | Justification |
| --- | --- | --- |
| Next.js landing page | Pass | One App Router page at `/`, built successfully with Next.js 16.4.4. |
| At least eight sections | Pass | Nine semantic sections, excluding the footer. |
| At least four layout families | Pass | Split hero, editorial statement, interactive code stage, image field, specification rows, inset letter, disclosures, and typographic CTA. |
| Headings use at most two lines | Pass | Text-line checks pass for every h1, h2, and h3, in the initial state at the tested widths; all three selector states were also exercised. |
| Clear first-screen title | Pass | The headline and adjacent sentence identify a home-hosted personal PaaS. |
| One h1 and section headings | Pass | Exactly one h1; each of the nine sections has its own heading. |
| Equal outer margins | Pass | All sections use the same responsive `frame` gutter. |
| No accidental empty half-sections | Pass | Text is paired with an image, a statement, controls, or supporting content. |
| No excessive blank stretches | Pass | The production inspector reports no blank-gap or empty-screen findings. |
| Statements use paragraph markup | Pass | The introductory statement is a p at 24px desktop and 22px mobile. |
| No eyebrows | Pass | No label or badge above any section heading or hero title. |
| Monospace restricted to code | Pass | Only CLI, Git, and Dockerfile snippets use monospace. The surrounding page keeps its original face. |
| No section numbering | Pass | No numbered eyebrows or index markers; pipeline order is conveyed through position. |
| No thin decorative rules | Pass | Space and filled surfaces separate content; no decorative dividers or grid lines. |
| No gradients | Pass | Backgrounds, type, and controls use flat colors. |
| No resting shadows or glows | Pass | No box shadows, text shadows, or bloom effects. |
| No banned assistant palette | Pass | Charcoal ground, pale ink, and restrained chartreuse accents. |
| No tiny tracked uppercase labels | Pass | Interface labels use sentence case, without added tracking. |
| No icon feature cards or repeated card rows | Pass | Text, a continuous pipeline band, specification rows, and native disclosures carry the content. |
| No glass or floating pill navigation | Pass | A plain header sits in normal document flow. |
| No emoji or decorative shapes | Pass | No emoji, blobs, fake dashboards, or drawn interface illustrations. |
| No accent word in headings | Pass | Each heading uses a single face, weight, and color. |
| At most two typefaces | Pass | Self-hosted Geist for the page; browser monospace for real code. |
| Five type sizes maximum | Pass | Inspector measures five sizes at each required viewport. |
| Navigation at most 80px | Pass | Header is 80px on desktop/tablet and 72px on mobile. |
| Desktop navigation stays on one line | Pass | The 1440px and 768px screenshots show a single-row navigation. |
| One theme throughout | Pass | Every section remains in the same charcoal system. |
| Bento occupancy | Pass | No bento grid is used; the four-stage pipeline has exactly four populated positions. |
| Real raster images | Pass | Four local ImageGen raster assets; no div screenshots or hand-drawn SVG illustrations. |
| Image generation before fallback | Pass | Built-in ImageGen produced every required asset; Picsum fallback was unnecessary. |
| No decorative status devices | Pass | No status dots, locale strips, version labels, or scroll cues. |
| Motion matches the approved dial | Pass | Intensity remains 2; only controls move, with reduced-motion support. |
| Images load | Pass | Four raster assets decode successfully in Chrome and respond with HTTP 200. |
| No horizontal overflow | Pass | Browser assertions pass at 1440, 768, 390, and 320 pixels. |
| Contrast and readable type | Pass | Inspector reports no contrast, small-text, or body-size findings. |
| No clipping or text collisions | Pass | Inspector reports no covered-text or clipped-text findings; screenshots reviewed. |
| Working primary action | Pass | Hero CTA links to the workflow; blueprint links return a real text document. |
| Working interaction | Pass | Real pointer events switch each workflow example at all four widths. |
| Keyboard disclosure | Pass | Native summary elements open using an Enter key event in Chrome. |
| Reduced motion | Pass | Reduced-motion emulation disables transitions and smooth scrolling. |
| No-JavaScript fallback | Pass | Server-rendered CLI content and a noscript blueprint note remain readable. |
| Honest product claims | Pass | Capabilities are described as plans; no invented customers, uptime, deployment speed, or pricing. |
| Production build | Pass | `npm run build` exits successfully and prerenders `/`. |
| TypeScript | Pass | `npm run typecheck` completes without errors. |
| Smoke tests | Pass | Two Node tests verify structure, anchors, dash exclusions, and public assets. |
| Browser runtime | Pass | No JavaScript exceptions recorded during responsive inspection and interaction checks. |

The production inspector was run with `--allow still-page` because the user approved intensity 2 and still reading content. This is an explicit brief-driven exception, not an unmodified motion-gate pass. Final result: 0 FAIL, 1 WARN. The remaining `no-footage` warning is accepted: there is no supplied footage of the actual hardware or running platform, and a stock or invented demo clip would not prove this product. All static screenshots from the final inspection were opened and reviewed.

## Section-layout-repetition audit

| Section | Layout family | Claim and material |
| --- | --- | --- |
| A home for what you build | Asymmetric split hero | Personal PaaS introduction, large ASCII firefly, immediate action. |
| Small by intention | Editorial statement | Personal learning scope and the eventual audience. |
| From source to somewhere | Interactive code stage with process band | Switchable examples and the four planned deployment stages. |
| The useful parts | Picture essay | Planned app addresses, previews, persistence, logs, and a wing study. |
| A cloud with a street address | Wide image field with specification strip | Illustrative cluster photograph and the proposed hardware inventory. |
| Nothing hidden under the hood | Specification rows | Five named infrastructure choices and their responsibilities. |
| Built for the learning part | Inset illustrated letter | Maker context paired with a close hardware study. |
| Fair questions | Native disclosure list | Five complete answers about access, workload scope, learning, reliability, and pricing. |
| Come see how it is built | Typographic action block | A direct route to the blueprint. |
| Footer | Oversized wordmark | Project name, top link, image credit. |

Pass. Nine content sections, more than four families, and no adjacent sections repeat the same composition. The hero, capabilities essay, and maker letter all pair text and imagery, but differ in scale, alignment, framing, and information density.

## Hero discipline audit

Headline: `A home for` / `what you build.`

Supporting sentence: `A personal PaaS, built to learn and host small projects on hardware I own.`

| Viewport | Headline lines | Subtext words | CTA visible without scrolling | Header height |
| --- | --- | --- | --- | --- |
| 1440 × 900 | 2 | 14 | Pass | 80px |
| 768 × 1024 | 2 | 14 | Pass | 80px |
| 390 × 844 | 2 | 14 | Pass | 72px |
| 320 × 740 | 2 | 14 | Pass | 72px |

Pass. The subtext is directly below the headline; the CTA is visible on every checked first screen.

## Visual critique

ROUND 1

Seen in one second: a fine ASCII firefly beside a large, plain headline.

Idea (one sentence): the Firefly namesake becomes the identifying specimen of a personal infrastructure workshop.

Live thing: the CLI, Git, and Dockerfile example selector.

Layout words by section: hero=split / intent=statement / workflow=interactive stage / capabilities=picture essay / hardware=image field / architecture=rows / about=letter / questions=disclosures / invitation=typographic action / footer=wordmark.

Scores: design 7.5; usability 8; creativity 7.5; content 8; overall 7.7.

Caps applied: default still-page design cap of 7, because content intentionally stays still. Capped design 7; capped overall 7.5.

Top three problems, most visible first:

1. `mobile-page-01.jpg`: the four pipeline stages read as another card grid. Fix: use a single continuous filled band.
2. `desktop-page-01.jpg`: too many size steps weaken the type hierarchy. Fix: consolidate to five measured sizes.
3. `mobile-page-01.jpg`: removing hard breaks concatenates pipeline words. Fix: use ordinary wrapping sentences.

ROUND 2

Seen in one second: the ASCII insect and the two-line headline, with one pale green action.

Idea (one sentence): Firefly's name and home-scale hardware establish the page's identity without invented product screenshots.

Live thing: the three workflow examples switch through real button interactions, with a static fallback.

Layout words by section: hero=split / intent=statement / workflow=interactive stage / capabilities=picture essay / hardware=image field / architecture=rows / about=letter / questions=disclosures / invitation=typographic action / footer=wordmark.

Scores: design 8; usability 8; creativity 7.5; content 8; overall 7.9.

Caps applied: default still-page design cap of 7 is retained in the skill score, despite the brief-driven motion allowance. Capped overall 7.5. The quiet motion is intentional and is not hidden by the higher raw score.

Top three remaining limits:

1. Hardware pictures are generated studies, not photographs of the owner's machines. Replace them when actual photography is available.
2. There is no live platform UI to demonstrate. The selector explains planned workflows and makes no claim to deploy an app.
3. Mobile navigation keeps the blueprint action rather than a full menu. Every section remains reachable by scrolling.

## Image assets and prompts

All assets were created with the built-in ImageGen tool and copied into `frontend/public/images`. The original generated files remain in the default generated-images directory. No external stock images were used. The footer credits the studies as ImageGen artwork.

| File | Use | Medium |
| --- | --- | --- |
| `public/images/firefly.png` | Hero | Raster ASCII insect with a pale chartreuse lantern. |
| `public/images/wing.png` | Capabilities | Raster ASCII wing specimen. |
| `public/images/cluster.png` | Hardware | Generated monochrome hardware photograph. |
| `public/images/board.png` | Maker note | Generated monochrome circuit-board photograph. |

The generation prompts are recorded in `.taste-skill/asset-prompts.md`. Self-hosted Geist is distributed with its OFL license in `public/fonts/OFL.txt`.

## Verification artifacts

The production inspector output and final screenshot sheets are in `.taste-skill/inspect`. The interaction measurements are in `.taste-skill/browser-check.json`. The browser self-check source is `.taste-skill/check-browser.mjs` and depends on the installed tasteskill CDP helper; the regular HTTP smoke tests in `frontend/scripts/page.test.mjs` use only Node's standard library.

Run `npm start` before `npm test`, or set `TEST_URL` to an already running instance. No actual deploy, authentication service, signup queue, backend test suite, physical hardware, or availability behavior was tested.

## CLI code reference update

The original workflow layout is restored: standard CLI, Git, and Dockerfile buttons above a two-column code and explanation panel. Only the CLI code uses the supplied reference's muted welcome text, green command values, yellow tree, and segmented progress line. There is no terminal window frame, connection metadata, or replacement section styling. The example remains illustrative and does not connect to a shell.

The corrected code-only update passes the production build, both HTTP smoke tests, and focused browser checks at 1440, 768, 390, and 320 pixels. The original tabs and explanation column are restored. Desktop and phone screenshots were reviewed; the code block has no horizontal overflow.

## Centered animated hero update

The hero now follows the supplied composition: centered headline, supporting sentence, and CTA in front of the existing raster ASCII firefly artwork. The background runs a 12-second transform-and-opacity loop. A pause/resume button controls the loop without moving the reading content. Reduced-motion mode removes the animation and hides the unnecessary pause control. This request supersedes the earlier still-hero direction; other sections retain their existing layouts.

The artwork is an enlarged, intentionally cropped backdrop, rather than a new particle simulation. The generated raster asset is reused; no additional image or animation dependency was added. The animated figure is decorative, excluded from the accessibility tree, and cannot intercept pointer input.

Production build, TypeScript, both HTTP smoke tests, and the source design lint pass. Browser checks at 1440, 768, 390, and 320 pixels verify a centered two-line headline, an above-fold CTA, no page overflow, a changing animation transform, and a stable transform while paused. Resume and reduced-motion behavior also pass. Desktop and mobile screenshots were opened for visual review. These are focused checks for the new hero; the original full-page inspection predates this update.

## Abstract ASCII vortex hero

The hero now uses `public/images/vortex.png`, a new ImageGen raster character study. It replaces the insect artwork without changing the centered headline, subtext, CTA, or pause control. The abstract ring rotates on a 48-second transform-and-opacity loop; reduced-motion mode displays a still frame. This replaces the previous name-based visual concept at the user's request.

Two luminous drafts were rejected. The selected render uses crisp monochrome punctuation on charcoal, without glow. Its exact final prompt is recorded in `.taste-skill/asset-prompts.md`. The original generated files remain in the default generated-images directory.

Verification: production build, TypeScript, and both HTTP smoke tests pass. The smoke test checks that the rendered page references the vortex and does not reference the old firefly image. Focused Chrome checks at 1440, 768, 390, and 320 pixels confirm a centered two-line headline, a visible CTA, no page overflow, changing animation transforms, working pause/resume, and the static reduced-motion fallback. Desktop and mobile screenshots were opened and reviewed. These are focused hero checks; the historical whole-page inspector report above was not rerun for this asset replacement.

## Halftone street map hero

The hero is now a left-aligned split. The headline, sentence, CTA, and footnote sit on the left, and a canvas map fills the right 56%. Land is drawn as ordered dither in the glyph shades, streets are gaps in the dots, and the coastline is traced in the brightest shade. The map pans along its coast at 9px per second, so the shoreline stays in frame while the streets move. Every 6.2 seconds a chartreuse route is drawn through the streets and ends at a blinking square. The map illustrates the "cloud with a street address" idea without a raster asset. On phones the map becomes a 320px band below the copy.

The map logic is in `app/halftone-map.ts`; `app/hero-artwork.tsx` only draws it. The canvas, pause control, 30fps cap, off-screen pause, and reduced-motion still frame work as before. `vortex-reference.png` is no longer loaded, and the footer credit now says the hero map is drawn in code.

Verification: `npm run typecheck` passes. `npm test` passes all 7 tests against a production build, including four new map tests covering land classification, coastline stability while panning, routes that follow the street grid, and trail growth. Browser checks at 1440, 768, and 375 pixels show a two-line headline, no horizontal overflow, no console errors, a moving map, and a frozen map while paused.
