---
name: frontend-design
description: Design system and change rules for this portfolio site (mthportfolio.chronocraftstudios.com). Use before editing any HTML, CSS or JS that affects how the site looks — tokens, fonts, colours, spacing, labels, radii, new sections or case-study pages.
---

# Portfolio design system: "Neon Noir Cinema"

The art direction is a sci-fi film still: ink-black space, saturated neon used sparingly, light cutting through haze, camera-like framing. High contrast, confident type, motion that feels like a film cut rather than a bounce.

Static site, no build step. Every page loads, in this order:

1. Google Fonts (Unbounded + Manrope + JetBrains Mono) — the `<link>` tags in each page's `<head>`
2. `tokens.css` — all design tokens (CSS custom properties on `:root`)
3. `styles.css` — all component styles, ordered by section
4. Homepage only: `world-mode.css` (atmosphere, scroll reveal, card tilt/glow) and `scroll-exploration.css` (optional 3D "journey" mode), plus `home-fx.js` (cursor spotlight, magnetic controls)

`tokens.css` is the single source of truth. To change the look, change a token; to add a look, add a token.

## Rules for every change

1. **Tokens only.** Colours, fonts, radii, label sizes and section spacing come from `var(--token)`. If no token fits, add one to `tokens.css` (in the right group, with a clear name) and use it — don't inline the value.
2. **No hard-coded colours in new or edited rules.** No `#hex`, `rgb()`, `rgba()` or `hsl()` outside `tokens.css`. Older rules still contain literals (mostly shadows, glows and section gradients); when you edit one of those rules, move its colours into tokens as part of the change. Don't add new ones.
3. **No `!important`.** `styles.css` has none. Win specificity by scoping (`body.home …`, a modifier class like `.project-scene--poster`) or by fixing the conflicting rule. A few `!important`s remain in `scroll-exploration.css`/`world-mode.css`; don't add more, and remove them when you touch those rules.
4. **Never touch `CNAME`.** Don't edit, move, rename or delete it, and don't stage changes to it. It holds the custom domain for GitHub Pages.
5. **One place per property.** Edit the existing rule instead of appending an override further down. No dated "fix" blocks at the end of the file.
6. **Keep sections in order.** `styles.css` sections: Base → Homepage backgrounds → Top bar → Hero → Section headings → Projects → Profile → Experience & education → Publications → Footer → Case-study pages. Put new rules in their section, with media queries right after the rules they adjust.
7. **Homepage-only rules are scoped to `body.home`**; case-study rules live under "Case-study pages". Effects (motion, glow, tilt) belong in `world-mode.css`, not `styles.css`.
8. **Verify in the browser** at desktop (1440px) and phone (375px) widths before calling a visual change done: no horizontal scroll, and fonts actually loaded (`document.fonts`).
9. **Bump the `?v=` query** on any CSS/JS file you change, in every page that links it, so browsers don't serve a stale copy.

## Tokens (`tokens.css`)

### Surfaces
| Token | Value | Use |
|---|---|---|
| `--bg`, `--bg-home` | `#07070c` | Ink-black page background, every page |
| `--surface` | `#0d0d16` | Cards, raised panels |
| `--surface-poster` | `#07070c` | Behind full-poster artwork |
| `--surface-raised` / `--surface-raised-hover` | dark gradients | Experience cards |

### Text (brightest → faintest)
| Token | Value | Use |
|---|---|---|
| `--text-1` (= `--fg`) | `#f2f4ff` | Headings, primary text, button text |
| `--text-2` | `#c5c9dc` | Lead paragraphs, nav links, org names, case-study body |
| `--text-3` | `#9a9fb8` | Body copy, descriptions, tags, meta |
| `--text-4` | `#7d8199` | Kickers, venues, captions, years, frame marks |

Use only these four. Pure `#fff` is reserved for hover states.

### Lines
`--line` `#1a1a26` (section dividers) · `--line-soft` `rgba(255,255,255,.1)` (card borders) · `--line-faint` `rgba(255,255,255,.07)` (top bar, thumbnail edges)

### Neon
| Token | Value |
|---|---|
| `--accent` | `#3ef0ff` electric cyan — kickers, active states, focus ring |
| `--accent-2` | `#8b5cff` violet |
| `--accent-2-light` | `#b49cff` — secondary labels |
| `--accent-3` | `#ff3d9a` hot magenta — hover borders, the "record" dot, end of the gradient |
| `--accent-warm` | `#ffb547` amber — rare warm highlight; at most one per screen |
| `--grad-neon` | cyan → violet → magenta (100°) — hero accent line, big display moments |
| `--grad-accent` | cyan → violet (horizontal) — underlines, tag dashes |
| `--grad-spectrum` | cyan → violet → magenta (vertical) — card edge stripes |
| `--glow-accent`, `--glow-accent-2`, `--glow-accent-3` | translucent cyan / violet / magenta | Glows: `box-shadow`, `drop-shadow`, haze |
| `--spotlight` | faint cyan | Cursor spotlight |
| `--grid-line` | faint cyan | Neon grid floor lines |

Neon is the accent, not the background: most of every screen stays ink-black, and saturated colour is kept to a few elements so it hits hard.

### Buttons and focus
`--pill-border`, `--pill-border-hover`, `--pill-bg`, `--pill-bg-hover` style every pill control (`.project-actions a`, `.social-links a`, `.scene-link`, `.scroll-cue`, `#archipelago-toggle`): cyan edge at rest, magenta on hover. `--focus-ring` (cyan) is the only focus outline colour: `outline:2px solid var(--focus-ring)`.

## Fonts

| Token | Family | Use |
|---|---|---|
| `--font-display` | **Unbounded** (wide geometric) | Hero headline, section headings, project titles, case-study `h1`, brand name |
| `--font-body` | **Manrope** | Body copy, descriptions, buttons that read as sentences |
| `--font-mono` | **JetBrains Mono** | HUD-style labels: kickers, nav, pills, meta, counters |

Weights loaded: Unbounded 500/700/800, Manrope 400/500/600/700, JetBrains Mono 400/500. Don't use a weight that isn't loaded; add it to the Google Fonts URL in every page first if you really need it.

Display type is uppercase, tight (`letter-spacing:-.02em` to `-.025em`, `line-height` about `.98`) and big. Every heading is real text — no letter images. Markup for a section title:

```html
<h2 class="section-title"><span class="title-line"><span>Enter the</span></span> <span class="title-line"><span><span class="grad">Worlds</span></span></span></h2>
```

Each `.title-line` rises on scroll-in; wrap the one or two words that should glow in `.grad` (neon gradient + glow). Use `.grad` once per heading.

Exception: the 3D journey canvas (`scroll-exploration.js`) draws its labels with canvas fonts.

## Label style (uppercase small text)

Kickers, nav, tags, buttons, meta and section labels read like a camera HUD:

```css
font-family: var(--font-mono);
font-size: var(--text-label);          /* .72rem */
font-weight: 500;
letter-spacing: var(--tracking-label); /* .14em; the hero kicker uses .24em */
text-transform: uppercase;
```

Kickers are cyan (`--accent`) with a short leading hairline (the hero kicker has one on each side). Keep labels short; the big display type does the shouting.

## Motion

Cinematic, not bouncy. Use the easing tokens: `--ease-out` for entrances and hover returns, `--ease-cinema` for sweeps and cuts.

- **Entrances**: text lines rise out of a clip mask (`translate`, never `transform`, so it doesn't fight magnetic offsets), then a highlight sweeps once across gradient text.
- **Magnetic controls**: add `data-magnetic` to a button or pill. `home-fx.js` sets `--mag-x/--mag-y` and the shared `[data-magnetic]` rule turns them into `transform`. Don't put other `transform` hovers on magnetic elements.
- **Cursor glow**: `home-fx.js` writes `--cx/--cy` on `<html>` and adds `.has-cursor-glow`; the fixed `.cursor-glow` layer lights the background under the pointer.
- **Card edge light**: `.project-scene`, `.journey-card` and `.paper-card` get a neon border that follows the cursor (`::after` with a masked radial gradient at `--card-x/--card-y`, set by `home-fx.js`). New card types: add them to both the CSS selector and the `home-fx.js` list. Hover lift uses `translate`, not `transform`.
- **Scroll reveal**: `world-mode.js` adds `.world-reveal` to section heads and cards and toggles `.world-entered`; blocks fade/slide in and `.title-line`s rise. To reveal a new block, add its selector to `revealItems` in `world-mode.js`.
- **Reduced motion**: every animation lives inside `@media(prefers-reduced-motion:no-preference)`, so content is fully visible with no motion by default. `home-fx.js` does nothing for reduced motion or touch-only devices.

## 3D journey (`scroll-exploration.js` / `.css`)

An optional cinematic tour of the projects, opened by "Enter 3D journey". It must stay optional and lazy:

- **Loading**: Three.js r186 and its addons load from jsDelivr only when the button is clicked, through the import map in `index.html` (`"three"`, `"three/addons/"`). Bump the version in the import map, never in individual imports.
- **Content comes from the page**: stops are built from the `.project-scene` cards (title, tags, description, image, link), then Profile (lead paragraph + `.skill-line` chips), Experience & Education (`.journey-card`s) and Publications (`.paper-card`s), bracketed by an intro and a contact stop. Edit content in `index.html` only, and the journey follows.
- **Stations**: projects are floating screens; Profile is a glowing core with the skills orbiting as chips; Experience is a curved holographic wall of role cards (education on the lower row); Publications are tall floating pages with neon-outlined years. Card and chip art is drawn on canvas with the token colours and fonts.
- **Guide character** (`journey-explorer.js`, assets in `models/`): two photo-scans of Tahmidul, one holding a VR headset and one wearing it (optimised from Meshy exports; no skeleton). The headset was cut out of the holding scan as its own mesh. The module animates them itself: a procedural walk in the vertex shader (cadence tied to ground speed), turning, and headset put-on/take-off (the headset arcs from hand to face, then a scan-line dissolve swaps scans). Far jumps become a teleport dissolve. If the scans fail, the CC0 RobotExpressive robot is the fallback.
- **VR or not**: each project card carries `data-experience="vr"` or `"non-vr"` in `index.html`. The guide wears the headset at VR stops and holds it everywhere else (sections, start, contact). Set it on every new project card.
- **Sound** (`journey-audio.js`): a generative synthwave loop made with the Web Audio API (no audio files): pads, sub bass, a soft heartbeat kick, a delayed arpeggio and air noise. Travelling opens the filter and adds a whoosh; arriving plays a chime. The `.journey-ui__sound` toggle (or M) mutes it, and the choice is saved in `localStorage` (`journey-sound`).
- **Colours come from tokens**: the scene reads `--bg`, `--accent`, `--accent-2`, `--accent-3`, `--accent-warm`, `--font-display` and `--font-mono` with `getComputedStyle`. Don't hard-code colours in the JS; change the tokens.
- **Look**: neon-grid floor with a travelling pulse, fog, sky haze, light beams, dust, wireframe sculptures, portals at the start and end, project screens with neon frames, halos and floor reflections. Post-processing: bloom, then a single "film finish" pass (edge soft-focus, slight colour fringing, vignette, grain).
- **Camera**: one shot per stop, cycling dolly / low angle / crane / side angle. The camera holds near each stop and travels mid-segment with a smootherstep ease. Wheel, touch and arrow keys move a virtual position that snaps to the nearest stop.
- **Overlay UI** (`.journey-ui`): count, title card, progress ticks (buttons, one per stop) and hint. Keyboard: arrows/PageUp/PageDown/Space/Home/End travel, Enter opens the current project, Esc exits.
- **Performance tiers**: phones and touch get a lighter scene (pixel ratio 1, fewer particles and sculptures, no reflections, edge blur or fringing). On desktop an adaptive step sheds edge blur, then resolution, then bloom if frames stay above about 22 ms.
- **Reduced motion**: no drift, bob, grain or character animation (the guide holds its idle pose). Travel is whole-stop cuts with a short canvas fade (`.is-cutting`).
- **Return links**: project links carry `?returnIsland=<index>`; `archipelago-return.js` on case studies shows "Back to 3D journey", which reopens the journey at that project. `?returnIsland=profile|career|research|contact` opens at those stations. The section panels' "Open …" buttons exit to that section of the page.

## Shape and spacing

| Token | Value | Use |
|---|---|---|
| `--wrap` | `min(1180px, 92vw)` | Content width (`.wrap`) |
| `--radius-card` | `16px` | All cards: projects, experience, publications |
| `--radius-feature` | `20px` | The featured project card only |
| `--radius-pill` | `999px` | Buttons, tags, number badges |
| `--space-section` | `clamp(78px, 9vw, 120px)` | Top/bottom padding of every homepage section |

Smaller values (9px on inline stills, 12px on the video frame) are component-specific. Promote one to a token if a second component needs it.

Breakpoints: `760px` (phone layout), `900px` (top bar tightens), `980px` (hero lead goes to one line), `600px` (case-study stills stack), `380px` (smallest phones). Reuse these; don't invent new ones without a reason.

## Local preview

The preview server is in `.claude/launch.json`: a no-cache static server on http://localhost:8000. Reload after edits, no build needed.
