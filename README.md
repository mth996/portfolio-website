# Portfolio Website

My personal portfolio: **[mthportfolio.chronocraftstudios.com](https://mthportfolio.chronocraftstudios.com)**

A hand-built static site that presents my Unity, XR and game-development work. It has 11 project case-study pages, each with an embedded gameplay video, my role, the tech stack and a link to the project's GitHub repository.

## Highlights

- **Optional 3D "journey" mode** built with **three.js**: the visitor explores a stylised city while the projects are introduced along the route. It uses GLB models with WebP textures, reduced for the web, and falls back gracefully if a model cannot load.
- **"Neon Noir Cinema" design system**: every colour, font, radius and spacing value comes from tokens in `tokens.css`, with component styles in `styles.css` ordered by section.
- **Case-study pages** for each project, with responsive YouTube embeds and a link to each repository.
- **Mobile-first behaviour**: short project cards with a clear "Enter project" button instead of hover-only video previews, so the site works the same on phones.
- **No build step**: plain HTML, CSS and JavaScript (ES modules) hosted on **GitHub Pages** with a custom domain.

## Tech Stack

HTML · CSS (custom properties / design tokens) · JavaScript (ES modules) · three.js · GLB/glTF models · GitHub Pages

## How It Was Built: AI-Assisted Development

I built this site together with **Claude Code**. I set the direction, content and design decisions and reviewed and tested every change. Claude Code helped with implementation, refactoring and documentation.

The working rules I gave the AI are kept in the repository at [`.claude/skills/frontend-design/SKILL.md`](.claude/skills/frontend-design/SKILL.md). They define the design system and the change rules: tokens only, no hard-coded colours, no `!important`, never touch `CNAME`, keep styles in section order, check every visual change at desktop and phone widths, and bump cache-busting versions. This keeps AI-generated changes consistent and reviewable.

## Structure

```text
portfolio-website/
├── index.html                 # Homepage: projects, profile, experience, publications
├── *.html                     # One case-study page per project
├── tokens.css                 # Design tokens (single source of truth)
├── styles.css                 # Component styles, ordered by section
├── world-mode.css / .js       # Atmosphere and motion effects (homepage)
├── scroll-exploration.css/.js # Optional 3D journey mode
├── journey-*.js               # 3D journey: city, explorer, travel, audio
├── home-fx.js                 # Cursor spotlight and magnetic controls
├── models/                    # Web-optimised GLB models and textures
├── images/ · fonts/           # Media and font files
├── .claude/skills/            # AI working rules for this codebase
├── CREDITS.md                 # Third-party asset licences and changes
└── CNAME                      # Custom domain for GitHub Pages
```

## Running Locally

There is no build step. Serve the folder with any static server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Credits

Third-party models and their licences are listed in [CREDITS.md](CREDITS.md).
