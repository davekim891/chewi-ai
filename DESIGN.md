# Design

Durable visual rules for chewi.ai. Product truth lives in PRODUCT.md.

## World

Dark, quiet, technical. The page is a lit object in a dark room: a wireframe asset with its compiled action surfaces glowing, and very little else. Restraint is the brand signal; the only thing allowed to glow is the product.

## Colour

One theme (dark), no light mode. Strategy: restrained neutrals plus one accent, plus four data colours that only ever mean a surface category.

| Token | Value | Role |
|---|---|---|
| `--bg` | #0b0d10 | page ground |
| `--bg-elevated` | #12161b | frames, cells |
| `--hairline` | #1c2229 | borders |
| `--fg` | #e9edf1 | text |
| `--fg-muted` | #8b95a1 | secondary text |
| `--accent` | #4da3ff | wordmark "AI", the single action, focus ring |
| `--c-contact` | #4ade80 | CONTACT surfaces |
| `--c-grip` | #38d6e0 | GRIP surfaces |
| `--c-support` | #a78bfa | SUPPORT surfaces |
| `--c-rotation` | #f5b544 | ROTATION and HINGE |

Rules: the accent never appears on a semantic surface and a semantic colour never appears on UI chrome, except as a 9% tint on a content cell. No gradients, no glow on UI elements. Wire colour is cool white (#bfe6ff) with a faint blue halo (#3a9bff at 8.5%).

## Type

Space Grotesk (400, 700) for everything readable; JetBrains Mono (400, 600) for compiled ids, the eyebrow and metadata lines. Both self-hosted in `fonts/`. Headline tracking -0.03em, line-height 1.05. Body 17px, line-height 1.5, measure under 62ch. Display max 3.6rem.

## Shape and space

One radius: 6px on interactive and framed elements, 4px on tag chips. Hairline borders (1px, `--hairline`) instead of shadows. Section padding 96px desktop, 64px under 900px. Gutter `clamp(20px, 5vw, 64px)`.

## Components

- Wordmark: `CHEWI AI`, 15px, 0.22em tracking, "AI" in accent. Alone in the top bar.
- Eyebrow: mono, 12px, 0.18em, uppercase, accent. Used once (hero).
- Action: solid accent button, dark ink, 14px x 22px padding, arrow glyph. One label for the contact intent site-wide: "Curious? Get in touch".
- Tag: mono chip, 1px border in the surface colour, kind in caps 11px + id 10px muted. Leader line 1px in the same colour to the projected anchor.
- Layer cell: elevated background, hairline border, h3 + one line. Two cells carry a 9% semantic tint.

## Motion

One authored moment: the hero object orbits (40 s period, slight bob), the ten surfaces reveal in sequence 0.6 s apart on first paint, then pulse gently. Pointer parallax on fine pointers only. Everything else is a hover or press state. `prefers-reduced-motion`: static 3/4 view, all surfaces shown, no orbit, video does not autoplay.

## Fallbacks

WebGL or CDN unavailable: `assets/hero-fallback.jpg` in the same stage box; copy and action unchanged. The page must read completely with the canvas gone.
