---
name: frontend-design
description: Design system and change rules for this portfolio site (mthportfolio.chronocraftstudios.com). Use before editing any HTML, CSS or JS that affects how the site looks — tokens, fonts, colours, spacing, labels, radii, new sections or case-study pages.
---

# Portfolio design system

Static site, no build step. Every page loads, in this order:

1. Google Fonts (Inter + Space Grotesk) — the `<link>` tags in each page's `<head>`
2. `tokens.css` — all design tokens (CSS custom properties on `:root`)
3. `styles.css` — all component styles, ordered by section
4. Homepage only: `world-mode.css` (atmosphere, scroll reveal, card tilt/glow) and `scroll-exploration.css` (optional 3D "journey" mode)

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
| `--bg` | `#050608` | Page background (case studies) |
| `--bg-home` | `#0a1425` | Homepage background (navy) |
| `--surface` | `#080a0d` | Project cards, poster card copy |
| `--surface-poster` | `#050608` | Behind full-poster artwork |
| `--surface-raised` / `--surface-raised-hover` | dark gradients | Experience cards |

### Text (brightest → faintest)
| Token | Value | Use |
|---|---|---|
| `--text-1` (= `--fg`) | `#f4f7fb` | Headings, primary text, button text |
| `--text-2` | `#c9d0d8` | Lead paragraphs, nav links, org names, case-study body |
| `--text-3` | `#a3acb6` | Body copy, descriptions, tags, meta |
| `--text-4` | `#8b97a5` | Kickers, venues, captions, years |

Use only these four. Pure `#fff` is reserved for hover states.

### Lines
`--line` `#20252c` (section dividers) · `--line-soft` `rgba(255,255,255,.1)` (card borders) · `--line-faint` `rgba(255,255,255,.08)` (top bar, thumbnail edges)

### Brand
| Token | Value |
|---|---|
| `--accent` | `#72ddff` cyan — kickers on hero/case studies, links on hover, active states |
| `--accent-2` | `#9d7bff` violet |
| `--accent-2-light` | `#b49cff` — hover borders, secondary labels |
| `--accent-3` | `#e269b5` pink — end of the brand gradient |
| `--grad-accent` | cyan → violet (horizontal) — small rules, tag dashes |
| `--grad-spectrum` | cyan → violet → lilac (vertical) — card edge stripes |

### Buttons and focus
`--pill-border`, `--pill-border-hover`, `--pill-bg`, `--pill-bg-hover` style every pill link (`.project-actions a`, `.social-links a`, `.scene-link`). `--focus-ring` (`#c4b5fd`) is the only focus outline colour: `outline:2px solid var(--focus-ring)`.

## Fonts

| Token | Stack | Use |
|---|---|---|
| `--font-body` | Inter, then system fallbacks | Everything by default: body, nav, labels, buttons, paper titles |
| `--font-display` | Space Grotesk, then Inter | Project titles, case-study `h1`, job titles, project numbers, years, brand name |

Weights loaded: Inter 400/500/600/700, Space Grotesk 500/600/700. Don't use a weight that isn't loaded (no 800/900); add it to the Google Fonts URL in every page first if you really need it.

Exceptions:
- The hero headline and big section headings are currently block-letter **images** (`images/hero-glyphs/`), placed by the script in `index.html`; their `font-size` sets the glyph height. The `&` in those headings deliberately uses Arial Black to match the glyphs.
- The 3D journey canvas (`scroll-exploration.js`) draws its labels with canvas fonts.

## Label style (uppercase small text)

Kickers, nav, tags, buttons, meta and section labels share one style:

```css
font-size: var(--text-label);       /* .72rem */
font-weight: 600;                   /* 500 for nav and meta */
letter-spacing: var(--tracking-label); /* .14em; kickers use .18em */
text-transform: uppercase;
```

Keep labels short, and don't make them larger or more widely spaced. The calmer type is deliberate.

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
