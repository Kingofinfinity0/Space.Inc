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
- Primary card radius: `24px`
- Continuous soft geometry goal: squircle-like rounded rectangles rather than rigid geometric blocks
- Controls and pills: `999px` radius
- Inner tiles: `18px` to `20px`

### Grid and spacing
Base rhythm:
- 4px micro grid
- 8px primary rhythm

Rule of thumb:
- horizontal padding should be approximately double vertical padding for dashboard controls and chrome

Examples in the implemented system:
- header bar padding: `6px vertical / 12px horizontal`
- meeting range pills: `2.88px vertical / 5.76px horizontal`
- directory tabs: `4.56px vertical / 9.12px horizontal`
- quick action button padding: `6.24px vertical / 12.48px horizontal`

Card spacing:
- card gap: `16px`
- compact inner gap: `8px`
- standard inner gap: `12px`

## Typography system
Typeface:
- Primary UI font: `Inter`
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
- move the typography scale and card tokens into a dedicated theme file
- create a custom icon wrapper component to standardize size, stroke, and optical alignment
- replace ad hoc utility text colors in JSX with semantic classes or token-driven components
- introduce motion tokens shared across cards, modals, and dock interactions
