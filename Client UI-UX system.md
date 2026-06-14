# Client UI/UX system

## Purpose
This document defines the UI/UX system for the client-facing dashboard in Space.inc.

The goal of the redesign is to create a dashboard people want to return to because it feels:
- calm
- premium
- informative
- status-driven
- effortless to scan

The design direction intentionally blends:
- Apple Human Interface Guidelines principles around hierarchy, harmony, and consistency
- Dieter Rams's "less, but better" approach to reduction and clarity
- modern product-tool density inspired by Linear's calm operational UI

References:
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility/
- Dieter Rams / Vitsœ, Ten principles for good design: https://www.vitsoe.com/us/about/good-design
- Linear product as a comparative interaction reference: https://linear.app/

## Design intent
The dashboard is built around four emotional jobs:
- orientation: immediately tell the user what is happening
- momentum: show whether the workspace is moving
- bragging rights: surface client and growth information that feels share-worthy
- action: reduce friction between insight and next step

## Dashboard architecture
### 1. Hero
The hero is the first "working" surface, not a marketing banner.

It contains:
- a personal greeting
- a one-line operating summary
- three primary route actions
- a four-card metrics mosaic
- a single brag line

Why:
- it gives emotional entry plus operational context in one glance
- it makes the first viewport feel premium and alive

### 2. Meeting Momentum
This is the lead analytics card.

It exists to answer:
- are conversations increasing?
- what period is strongest?
- how much active coordination is happening?

Why:
- meetings are one of the clearest momentum signals in a service or collaboration workspace
- a large graph creates a "control room" feeling and makes the product feel serious

### 3. Relationship Board
This is the bragging-rights component.

It contains:
- client or staff toggle
- ranked rows
- strong labels and status chips

Why:
- people remember people faster than abstract metrics
- ranked views feel prestigious and socially legible

### 4. Calendar Rhythm
This is the operational memory card.

It contains:
- current month grid
- selected-day detail
- combined meetings/tasks relevance

Why:
- scheduling is one of the core daily behaviors in the product
- the calendar adds stability and cadence beside the more emotional or strategic cards

### 5. Capacity & Prestige
This is the compact insight rail.

It contains:
- storage donut
- client energy donut
- upcoming meetings

Why:
- pie and donut charts help summarize "state"
- the right rail complements the line chart with compact health signals

## Visual language
### Shape system
- Primary card radius: `28px` via `--radius-card`
- Standard surface/control radius: `8px` via `--radius-md`
- Compact control radius: `4px` to `6px`
- Controls and pills: `999px` via `--radius-pill`
- Continuous soft geometry goal: rounded, quiet, product-tool surfaces rather than rigid blocks

### Spacing and sizing system
Source of truth:
- executable tokens live in `src/index.css`
- documentation lives in this section
- shared primitives should consume semantic tokens first, raw scale tokens second, and one-off pixel values only when there is a measured exception

The system is not "everything is a multiple of 4px." The goal is to make adjacent choices feel meaningfully different. Small values stay close together because 2px to 4px matters inside controls. Large values spread out because 512px to 520px is not a useful design decision.

Base:
- base value: `16px`
- micro grid: `4px`
- primary rhythm: `8px`
- large scale rule: adjacent large values should usually differ by about `25%` or more

Canonical scale:

| Token | Value | Factor | Primary use |
| --- | ---: | ---: | --- |
| `--space-0` | `0px` | `0` | reset |
| `--space-1` | `4px` | `0.25x` | hairline gaps, icon nudges |
| `--space-2` | `8px` | `0.5x` | tight control gaps |
| `--space-3` | `12px` | `0.75x` | compact row gaps, small stacks |
| `--space-4` | `16px` | `1x` | default gap, compact card inset |
| `--space-6` | `24px` | `1.5x` | comfortable card inset, panel gap |
| `--space-8` | `32px` | `2x` | large card inset, dashboard group gap |
| `--space-12` | `48px` | `3x` | section gap, modal rhythm |
| `--space-16` | `64px` | `4x` | major vertical grouping |
| `--space-24` | `96px` | `6x` | compact page section |
| `--space-32` | `128px` | `8x` | generous page section |
| `--space-48` | `192px` | `12x` | hero/landing spacing |
| `--space-64` | `256px` | `16x` | compact panel width/height |
| `--space-96` | `384px` | `24x` | narrow content/panel |
| `--space-128` | `512px` | `32x` | modal/content width |
| `--space-160` | `640px` | `40x` | standard content width |
| `--space-192` | `768px` | `48x` | wide content width |

Optical exceptions:
- `--space-px`, `--space-0-5`, `--space-1-5`, `--space-2-5`, `--space-5`, and `--space-10` exist for alignment, legacy compatibility, and fine control ergonomics
- do not use optical exceptions to choose major layout spacing
- when in doubt, step to the next canonical value instead of inventing a middle value

Semantic spacing aliases:

| Role | Tokens | Use |
| --- | --- | --- |
| Gaps | `--space-gap-2xs` to `--space-gap-3xl` | horizontal/vertical distance between related peers |
| Stacks | `--space-stack-tight` to `--space-stack-xl` | vertical rhythm inside a component |
| Insets | `--space-inset-control-*`, `--space-inset-card-*` | internal padding |
| Sections | `--space-section-sm` to `--space-section-lg` | page-level separation |
| Page padding | `--space-inset-page-x`, `--space-inset-page-y` | responsive page shell breathing room |

Decision rules:
- Choose the role first: gap, stack, inset, section, width, height, icon, control, avatar, or row.
- Use semantic tokens when the role is obvious.
- Use canonical raw scale tokens when composing a new pattern that does not yet have a semantic alias.
- Avoid adjacent values that are visually too close at the large end. If `512px` is too small, try `640px`, not `528px`.
- Inside controls, horizontal padding should usually be about double vertical padding.
- Related elements use smaller gaps; unrelated groups use section or large stack gaps.
- If a value repeats three times, promote it to a semantic token.

Sizing scale:

| Role | Tokens | Values |
| --- | --- | --- |
| Icons | `--size-icon-xs` to `--size-icon-xl` | `12`, `16`, `20`, `24`, `32px` |
| Controls | `--size-control-xs` to `--size-control-xl` | `28`, `32`, `40`, `44`, `48px` |
| Touch target | `--size-touch-target` | `44px` |
| Avatars | `--size-avatar-xs` to `--size-avatar-xl` | `24`, `32`, `40`, `48`, `64px` |
| Rows | `--size-list-row-*` | `32`, `44`, `64px` |
| Panels | `--size-panel-xs` to `--size-panel-xl` | `256`, `384`, `512`, `640`, `768px` |
| Content | `--size-content-narrow` to `--size-content-2xl` | `384`, `512`, `640`, `800`, `1024`, `1280px` |
| Dashboard cards | `--size-dashboard-card-*` | compact, current default, standard |

Implementation helpers:
- `.ui-stack-tight`, `.ui-stack-sm`, `.ui-stack-md`, `.ui-stack-lg`, `.ui-stack-xl`
- `.ui-cluster-tight`, `.ui-cluster-sm`, `.ui-cluster-md`, `.ui-cluster-lg`
- `.ui-inset-card-sm`, `.ui-inset-card-md`, `.ui-inset-card-lg`
- `.ui-container-narrow`, `.ui-container-sm`, `.ui-container-md`, `.ui-container-lg`, `.ui-container-xl`

## Typography system
Typeface:
- Primary UI font: `Geist Sans`
- Fallbacks: `"Segoe UI", system-ui, sans-serif`

Philosophy:
- all dashboard typography is sans-serif
- headings use tighter tracking and stronger contrast
- body copy uses slightly looser line-height for calm legibility

### Heading scale
- `H1`: `clamp(2.4rem, 4vw, 4rem)` -> `28.8px` to `48px`
  - weight: `700`
  - letter spacing: `-0.08em`
  - line height: `0.92`
- `H2`: `32px` desktop / `24px` mobile equivalent
  - weight: `600`
  - tracking: `-0.06em`
- `H3`: `15.36px`
  - weight: `600`
  - tracking: `-0.06em`
- `H4`: `18px`
  - weight: `600`
- `H5`: `16px`
  - weight: `600`
- `H6`: `14px`
  - weight: `600`

### Body scale
- Large paragraph / lead: `12px`
  - line height: `1.55`
- Standard paragraph: `10px`
  - line height: `1.5`
- Small supporting text: `8.64px`
  - line height: `1.45`
- Micro / metadata / labels: `7.44px`
  - uppercase when used as UI labels

### Labels
- size: `0.62rem` -> `7.44px`
- weight: `600`
- tracking: `0.18em`
- uppercase

### Metric values
- major stat: `1.8rem` -> `21.6px`
- compact insight value: `1.15rem` -> `13.8px`

### Button text
- primary dashboard buttons: inherited from shared button sizes
- style target:
  - `sm`: `12px`
  - `md`: `14px`
  - `lg`: `15px`
- weight: `500`
- tracking: `-0.01em`

## Color system
### Core palette
Light mode:
- page background: `#FFFFFF`
- surface background: `#FFFFFF`
- hover / secondary surface: `#F5F5F7`
- border: `#E6E6EB`
- primary text: `#0D0D0D`
- secondary text: `#6E6E80`
- accent: `#0A84FF`

Dark mode:
- page background: `#000000`
- card background: `#0A0A0A`
- hover / inner surface: `#101010`
- border: `#171717`
- primary text: `#FFFFFF`
- secondary text: `#A1A1AA`
- accent: `#0A84FF`

Principle:
- background must be darker than cards
- cards must always separate from the page
- accent should be rare and meaningful

## Iconography system
Icon family:
- Lucide for now, standardized through `currentColor`

Rules:
- icons inherit text color via `currentColor`
- stroke weight should remain visually consistent in pills, cards, and dock controls
- icons inside utility pills must never introduce a second visual language
- icon containers should be soft-squared or circular depending on action importance

Light mode:
- icons default to primary text or muted text

Dark mode:
- icons shift with the control they live in
- no icon should remain hard-black on a dark surface

## Components
### Hero card
Why it exists:
- replaces a flat dashboard opening with a strong, emotional and informational first impression

### Metrics mosaic
Why it exists:
- converts key numbers into a collectible-looking dashboard system
- each tile is compact enough to scan fast, but polished enough to feel premium

### Quick action card
Why it exists:
- keeps the product feeling operational
- avoids hiding major actions in navigation

### Meeting analytics card
Why it exists:
- creates a visual centerpiece
- gives the dashboard an "instrument panel" identity

### Relationship board
Why it exists:
- client data is emotionally sticky
- ranked or highlighted client views create social proof and bragging value

### Calendar card
Why it exists:
- time anchors the rest of the dashboard
- users need one dependable scheduling surface

### Capacity card
Why it exists:
- transforms abstract health data into fast summaries
- balances the large line chart with compact state indicators

## Motion system
Philosophy:
- subtle and intentional
- no decorative motion that delays work

Constraints:
- spring-inspired entrance feel
- fade + translate up by roughly `20px` on entry
- short transitions for pills, controls, and hover states
- avoid exaggerated bounce

Targets:
- standard transition duration: `100ms` to `180ms`
- surface hover lift: `1px` to `2px`
- reduced motion must preserve readability and control clarity

## Visual density
Density target:
- medium-low

Principles:
- enough information to feel powerful
- enough negative space to feel composed

Avoid:
- giant empty regions without purpose
- repeated card stacks that all look alike
- decorative gradients and fake metrics

## UX flow
The intended daily flow is:
1. land on the hero and understand today's state
2. glance at relationship board for social and client context
3. check meeting momentum for growth or slowdown
4. review calendar rhythm and upcoming commitments
5. act using quick actions

## What changed from the previous dashboard
- stronger first viewport
- more deliberate visual hierarchy
- less arbitrary card treatment
- shared sans-serif type system
- more brag-worthy client surface
- more meaningful analytics composition
- clearer dark mode separation between page and cards

## Implementation notes
Files most responsible for this system:
- `src/components/views/OwnerDashboardView.tsx`
- `src/index.css`
- `src/components/UI/Heading.tsx`
- `src/components/UI/Text.tsx`
- `src/components/UI/Button.tsx`

## Future recommendations
- keep migrating shared components from raw Tailwind values to semantic spacing and sizing tokens
- move the token map into a dedicated theme file once enough components depend on it
- create a custom icon wrapper component to standardize size, stroke, and optical alignment
- replace ad hoc utility text colors in JSX with semantic classes or token-driven components
- add linting or review checks for new arbitrary spacing, sizing, and radius values
