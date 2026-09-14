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

Rules: the accent never appears on a semantic surface and a semantic colour never appears on UI chrome, except as a 9% tint on a content cell. No gradients, no glow on UI elements. The hero object is the one thing that glows: hologram bodies (fresnel shader, bright at grazing angles, additive, #7cc0ff) with a faint wire overlay (#cfe9ff at 28%) and a soft blue halo; action surfaces are solid glowing bodies in their category colour; the two tire contacts also project a soft green ring on the floor. Since 2026-09-14 the hero is a 3D reconstruction of the Grok render (image-to-3D, then the engine's textured hologram material), opening in the render's pose so the page and the share image read as the same object; the hand scenes use the same engine.

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

One authored moment: the hero object orbits (40 s period, slight bob), the ten surfaces reveal in sequence 0.6 s apart on first paint, then pulse gently. Pointer parallax on fine pointers until the first drag; drag to orbit on all pointers with a short, capped inertia; hovering a surface brightens it and its tag. Everything else is a hover or press state. `prefers-reduced-motion`: static 3/4 view, all surfaces shown, no orbit, video does not autoplay.

## Section holograms

Two more hologram scenes reuse the hero's engine and vocabulary: a hand opening from a fist (layers section, right column) and a hand grasping a cup (two-standards section, left column). Same materials, same tag chips, same drag and hover. Contact surfaces on the grasp only light fully while the grip is engaged, so the animation itself carries the meaning of a contact.

## Fallbacks

WebGL or CDN unavailable: `assets/hero-fallback.svg` in the same stage box; copy and action unchanged. The page must read completely with the canvas gone.

## Direction contract (recorded before the first build)

```
  Chewi AI, coming-soon page. Direction contract:
  THESIS: the proof is the object. A live bicycle with its ten compiled action surfaces labelled is on
    screen before any sentence is read. Refuses the AI-image hero and the gradient-blob placeholder.
  OWN-WORLD: near-black ground, thin cool-white wire, four category colours used as data (green contact,
    cyan grip, violet support, amber rotation and hinge), mono tags that read as compiled ids, Space
    Grotesk headings, one blue accent reserved for the wordmark and the single action.
  STORY: "This company makes 3D objects legible to AI. The labels are the product. I will email GO."
  FIRST VIEWPORT: wordmark alone top-left; 5/12 copy on the left (Coming soon, headline, one sentence,
    one action); 7/12 live canvas on the right. Mobile stacks copy above the canvas.
  FORM: brief-pinned (GO's mockup plus Dave's three.js decision); no seed roll was run.
```
