# Misskey-Targeted APNG Emoji Generator Implementation Plan

## 1. Overview

This document describes an implementation plan for a Megamoji-like emoji generator targeted at **Misskey custom emoji workflows**, with a stronger focus on:

- High-quality transparent animation
- APNG-first export
- Better-than-GIF visual quality
- Smart character auto-scaling
- Google Fonts support
- Japanese-friendly typography
- Rich cosmetic effects
- Misskey-oriented preview and export presets

The core idea is to build a browser-based emoji/stamp generator that renders text and effects in full RGBA quality, exports animated APNG as the primary format, and optionally provides PNG, GIF, and animated WebP fallback formats.

> Note: Misskey instance limits and accepted file formats may vary by server configuration. The app should expose export presets and file-size warnings rather than assuming one universal limit.

---

## 2. Product Goals

### Primary Goal

Create a high-quality custom emoji generator for Misskey users that produces transparent animated emojis with better visual fidelity than GIF-based tools.

### Main Differentiators

1. **APNG-first animation**
   - Full alpha transparency
   - Better color depth than GIF
   - Cleaner edges for text, glow, shadow, and outlines

2. **Smart text auto-scaling**
   - Better handling of Japanese, Latin, mixed text, punctuation, emoji, and multi-line layouts
   - Uses real pixel bounds, not only `CanvasRenderingContext2D.measureText()`

3. **Google Fonts integration**
   - Searchable font picker
   - Japanese subset filtering
   - Variable font support where available
   - Live preview using the user’s actual text

4. **Rich cosmetic controls**
   - Outline, double outline, shadow, glow, gradient fill, sparkles, badges, borders, and animated effects

5. **Misskey-oriented export UX**
   - 128×128 and 256×256 presets
   - Actual-size preview
   - Dark/light background preview
   - File-size warnings
   - Loop preview

---

## 3. Target Export Formats

### Required

| Format | Purpose |
|---|---|
| PNG | Static emoji export |
| APNG | Primary animated transparent emoji export |

### Recommended

| Format | Purpose |
|---|---|
| GIF | Compatibility fallback only |
| Animated WebP | Optional high-quality alternative |
| ZIP | Batch export |

### APNG Positioning

APNG should be treated as the main animation format because it supports:

- Full or near-full color quality
- Alpha transparency
- Anti-aliased text edges
- Semi-transparent effects
- Cleaner glow and shadow effects

GIF should not be the internal animation target. It should be generated only as a fallback from the same high-quality RGBA frame source.

---

## 4. Recommended Tech Stack

### Frontend

- Nuxt 3
- Vue 3
- TypeScript
- Pinia for state management
- VueUse for utilities

### Rendering

- Canvas 2D for MVP
- OffscreenCanvas where supported
- Optional WebGL/WebGPU layer for advanced effects later

### Encoding

- `UPNG.js` for APNG export
- `gifenc` or equivalent for GIF fallback
- Optional animated WebP encoder in a later phase
- `JSZip` for batch export

### Performance

- Web Workers for frame rendering and encoding
- Font and layout measurement caching
- Static layer caching
- Partial rerendering when only cosmetic values change

---

## 5. High-Level Architecture

```txt
User Input
  ↓
Project State
  ↓
Font Loader
  ↓
Text Segmentation
  ↓
Layout Candidate Generator
  ↓
Auto-Fit Solver
  ↓
Frame Renderer
  ↓
Effects Pipeline
  ↓
Crop / Pad / Downscale
  ↓
Format Encoder
  ↓
PNG / APNG / GIF / WebP / ZIP
```

### Core Principle

Render internally in high resolution and downsample to the final emoji size.

Example:

```txt
Final emoji size: 128×128
Internal render size: 512×512 or 1024×1024
Render scale: 4× or 8×
```

This gives much cleaner text, outlines, and glow effects than rendering directly at 128×128.

---

## 6. Project Data Model

```ts
type EmojiProject = {
  version: 1;

  text: string;

  size: {
    width: number;
    height: number;
  };

  font: {
    family: string;
    weight: number;
    style: 'normal' | 'italic';
    letterSpacing: number;
    lineHeight: number;
    variableAxes?: Record<string, number>;
  };

  layout: {
    mode: 'fit' | 'fill' | 'safe' | 'compact' | 'jp-balanced' | 'impact';
    align: 'center' | 'left' | 'right';
    verticalAlign: 'middle' | 'top' | 'bottom';
    padding: number;
    autoLineBreak: boolean;
    manualLineBreaks: boolean;
  };

  style: {
    fill: FillSpec;
    strokes: StrokeSpec[];
    shadows: ShadowSpec[];
    glows: GlowSpec[];
    background: BackgroundSpec | null;
    decorations: DecorationSpec[];
  };

  animation: {
    enabled: boolean;
    preset: string;
    durationMs: number;
    fps: number;
    loop: boolean;
    params: Record<string, number | string | boolean>;
  };

  export: {
    format: 'png' | 'apng' | 'gif' | 'webp';
    finalWidth: number;
    finalHeight: number;
    renderScale: number;
    optimizeFor: 'quality' | 'size' | 'balanced';
  };
};
```

---

## 7. Smart Character Auto-Scaling

### Problem

Simple text scaling is not enough for emoji generation. It often fails with:

- Japanese text without spaces
- Mixed Japanese and Latin text
- Long phrases
- Emoji glyphs
- Decorative fonts
- Outlines and shadows
- Vertical visual imbalance
- Punctuation at bad line breaks

### Solution

Use a layout solver instead of a simple scale-to-fit loop.

---

### 7.1 Text Segmentation

Use grapheme clusters, not raw JavaScript string indexes.

Recommended approach:

1. Use `Intl.Segmenter` if available.
2. Fall back to a grapheme-splitting library.
3. Preserve emoji sequences, variation selectors, dakuten, skin tone modifiers, flags, and ZWJ sequences.

```ts
function segmentGraphemes(text: string): string[] {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });

    return Array.from(segmenter.segment(text), item => item.segment);
  }

  return fallbackGraphemeSplit(text);
}
```

---

### 7.2 Layout Candidate Generation

Generate multiple layout candidates instead of committing to one.

Candidate examples:

- One-line layout
- Two-line balanced layout
- Three-line layout
- Manual line breaks
- Japanese-friendly breakpoints
- Compact mode
- Impact mode

For Japanese text, avoid placing these at the start of a line when possible:

```txt
。 、 ！ ？ , . ! ? ) ] } 」 』 ）
```

Also avoid awkward isolated trailing characters where possible.

---

### 7.3 Fit Solver

For each layout candidate:

1. Pick a min and max font size.
2. Binary-search the largest size that fits.
3. Include visual margins for:
   - Stroke width
   - Shadow blur
   - Shadow offset
   - Glow radius
   - Rotation
   - Animation overshoot
4. Render to a temporary high-resolution canvas.
5. Calculate real pixel bounds.
6. Confirm that the result fits inside the safe box.

```ts
type FitResult = {
  candidate: LayoutCandidate;
  fontSize: number;
  pixelBounds: Bounds;
  score: number;
  warnings: string[];
};
```

---

### 7.4 Scoring Function

Score each candidate and choose the best one.

```ts
score =
  fontSize * 10
  - overflowPenalty * 1000
  - emptySpacePenalty * 5
  - lineImbalancePenalty * 3
  - badBreakPenalty * 50
  - tinyLinePenalty * 30
  - readabilityPenalty * 40;
```

### Recommended Layout Modes

| Mode | Behavior |
|---|---|
| Fit | Balanced default fitting |
| Fill | Aggressively fills the square |
| Safe | Leaves room for outline, shadow, and glow |
| Compact | Better for longer text |
| JP Balanced | Japanese-friendly line breaking |
| Impact | Large bold short-text layout |

---

## 8. Font System

### Google Fonts Integration

The app should support:

- Search by font family name
- Category filter
- Language/subset filter
- Japanese font filter
- Variable font axis controls
- Favorites
- Recently used fonts
- Live preview using the current emoji text

### Font Loading Strategy

1. Fetch and cache font metadata.
2. Load only selected font families.
3. Use `font-display: swap` or similar.
4. Use Google Fonts `text=` subsetting where practical.
5. Re-run layout after font load completes.
6. Detect missing glyphs and warn the user.

### Font Picker UX

Recommended groups:

- Recommended for emoji
- Japanese rounded
- Japanese display
- Latin bold
- Latin condensed
- Handwritten
- Pixel / retro
- Recently used
- Favorites

### Optional Font Upload

Later phase:

- Allow `.ttf`, `.otf`, `.woff`, `.woff2`
- Use `FontFace` API
- Keep uploaded font local to the browser session unless the user explicitly saves it

---

## 9. Rendering Pipeline

### Frame Render Steps

```txt
1. Clear transparent canvas
2. Draw background layer, if any
3. Draw decorative shapes
4. Draw text shadow layers
5. Draw glow layers
6. Draw text stroke layers
7. Draw text fill layer
8. Draw highlights / sparkles / overlays
9. Apply optional final filter pass
10. Extract RGBA frame
```

### High-Resolution Rendering

Render at 4× or 8× the final size:

```ts
const renderWidth = finalWidth * renderScale;
const renderHeight = finalHeight * renderScale;
```

Then downsample to final size.

### Pixel-Bounds Crop

Use alpha thresholding to detect the actual visible content bounds:

```ts
function getAlphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 1
): Bounds {
  // scan pixels and return minX, minY, maxX, maxY
}
```

This improves centering and avoids unnecessary empty padding.

---

## 10. Animation System

### Internal Animation Model

Each animation is evaluated from time `t`, where:

```ts
const progress = frameIndex / frameCount;
```

Each layer can animate:

- Position
- Scale
- Rotation
- Opacity
- Blur
- Glow intensity
- Stroke width
- Gradient offset
- Per-character offset
- Decoration position

### Frame Type

```ts
type RenderFrame = {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  delayMs: number;
};
```

---

## 11. Recommended Animation Presets

### Whole Emoji Motion

| Preset | Description |
|---|---|
| Bounce | Up/down elastic bounce |
| Pop | Scale-in pulse loop |
| Pulse | Subtle breathing scale |
| Wiggle | Small rotational wiggle |
| Shake | Fast impact shake |
| Float | Smooth drifting motion |
| Spin Lite | Gentle rotation loop |

### Text-Specific Motion

| Preset | Description |
|---|---|
| Wave | Per-character vertical wave |
| Stagger Pop | Characters pop sequentially |
| Shine Sweep | Highlight passes across text |
| Glow Pulse | Glow intensity loops |
| Outline Pulse | Stroke thickness or color pulses |
| Chroma Shake | Slight RGB split effect |

### Japanese Expressive Presets

| Preset | Feel |
|---|---|
| Kira | Sparkle animation |
| Dokidoki | Heartbeat pulse |
| Gangan | Strong shake |
| Yurayura | Gentle sway |
| Poyon | Squash and stretch |
| Nobi | Stretchy expansion |

---

## 12. APNG Export Pipeline

### APNG Flow

```txt
Project
  ↓
Resolve layout
  ↓
Generate animation frame states
  ↓
Render each frame to RGBA
  ↓
Downscale frame
  ↓
Optimize frame data
  ↓
Encode APNG
  ↓
Download .png APNG file
```

### APNG Defaults

| Setting | Default |
|---|---|
| Final size | 128×128 |
| Internal render size | 512×512 |
| Render scale | 4× |
| FPS | 12 |
| Duration | 1000 ms |
| Frame count | 12 |
| Background | Transparent |
| Loop | Infinite |

### Rich Preset

| Setting | Value |
|---|---|
| Final size | 256×256 or 128×128 |
| Render scale | 4× or 8× |
| FPS | 15–20 |
| Duration | 1000–1500 ms |
| Frame count | 15–30 |

### Size Optimization

Implement:

- Duplicate frame removal
- Frame delta bounding boxes
- Palette reduction option
- Optional color quantization
- Frame count reduction
- FPS reduction
- Effect simplification suggestions

---

## 13. GIF Fallback Pipeline

GIF should be a fallback export, not the main renderer.

```txt
Same RGBA frame source
  ↓
Transparent-safe palette generation
  ↓
Dither option
  ↓
GIF encode
  ↓
File-size warning
```

### GIF Warnings

Warn the user that GIF may cause:

- Jagged edges
- Poor semi-transparent shadows
- Banding
- Color loss
- Flickering transparency
- Larger size for some animations

---

## 14. Optional Animated WebP Export

The export pipeline should be format-agnostic so animated WebP can be added later.

```txt
renderFrames()
  → optimizeFrames()
  → encodeApng()
  → encodeGif()
  → encodeWebp()
```

Animated WebP can be useful for modern web use, but APNG remains the main target for transparent high-quality emoji generation in this plan.

---

## 15. Cosmetic Features

### MVP Cosmetic Features

- Fill color
- Linear gradient fill
- Stroke / outline
- Double outline
- Shadow
- Glow
- Transparent background
- Solid background
- Rounded blob background
- Sparkles
- Border

### Advanced Cosmetic Features

- Radial gradients
- Texture fill
- Halftone pattern
- Speed lines
- Sticker border
- Speech bubble
- Burst shape
- Per-character color
- Per-character animation
- Fake bevel/highlight
- Chromatic aberration
- Blur trail
- Orbiting decorations

---

## 16. Misskey-Focused UX

### Required Preview Modes

- Transparent checkerboard
- Dark mode preview
- Light mode preview
- Actual display size preview
- 24px preview
- 48px preview
- 72px preview
- Full 128px/256px preview

### Export Presets

| Preset | Use |
|---|---|
| Misskey Static 128 | Default static emoji |
| Misskey Static 256 | Higher-resolution static |
| Misskey APNG Lite | Small animated transparent emoji |
| Misskey APNG Rich | Higher-quality animation |
| Misskey Experimental | More frames/effects, with file-size warning |

### Quality Warnings

Warn when:

- Text is too small
- Contrast is too low
- Outline is too thick
- Glow makes text unreadable
- File size is too large
- Animation has too many frames
- Loop is too fast
- Font lacks required glyphs

---

## 17. UI Layout

### Left Panel: Content

- Text input
- Manual line breaks
- Layout mode
- Font picker
- Font weight/style
- Letter spacing
- Line height
- Alignment

### Center: Preview

- Main live preview
- Animation playback controls
- Zoom
- Background preview toggle
- Actual-size preview strip

### Right Panel: Style and Export

- Fill
- Stroke
- Shadow
- Glow
- Background
- Decorations
- Animation preset
- Export format
- Export size
- Optimization mode

### Bottom Panel

- Templates
- Recent projects
- Undo/redo
- Randomize
- Save project JSON
- Load project JSON
- Batch export

---

## 18. Performance Plan

### Use Web Workers For

- Frame rendering
- APNG encoding
- GIF encoding
- Pixel bounds analysis
- Batch export

### Cache

- Font metadata
- Loaded fonts
- Text measurement results
- Layout candidates
- Static layers
- Gradient assets
- Decoration assets

### Partial Rerender Rules

Avoid full recomputation when possible.

| User Change | Required Recompute |
|---|---|
| Text changed | layout + render |
| Font changed | layout + render |
| Fill changed | render only |
| Glow changed | render only |
| Animation changed | frame render only |
| Export format changed | encode only |
| FPS changed | frame render + encode |
| Final size changed | layout + render + encode |

---

## 19. Suggested Folder Structure

```txt
src/
  app/
    main.ts
    App.vue

  core/
    project/
      schema.ts
      defaults.ts
      migrate.ts

    fonts/
      googleFontsApi.ts
      loadFont.ts
      fontCache.ts
      glyphCheck.ts

    text/
      segmentGraphemes.ts
      lineBreakCandidates.ts
      japaneseRules.ts

    layout/
      measureText.ts
      fitText.ts
      scoreLayout.ts
      pixelBounds.ts

    render/
      renderProject.ts
      renderFrame.ts
      renderTextLayer.ts
      renderDecorations.ts
      downscale.ts

    effects/
      stroke.ts
      shadow.ts
      glow.ts
      gradient.ts
      sparkle.ts
      chroma.ts

    animation/
      presets.ts
      easing.ts
      keyframes.ts
      sampleAnimation.ts

    export/
      encodePng.ts
      encodeApng.ts
      encodeGif.ts
      encodeWebp.ts
      encodeZip.ts

  workers/
    render.worker.ts
    encode.worker.ts

  ui/
    panels/
      TextPanel.vue
      FontPanel.vue
      StylePanel.vue
      AnimationPanel.vue
      ExportPanel.vue

    components/
      PreviewCanvas.vue
      FontPicker.vue
      ColorPicker.vue
      PresetGallery.vue
      SizePreview.vue
```

---

## 20. Development Milestones

### Phase 1: Static PNG MVP

Deliver:

- Nuxt 3 project setup
- Text input
- Google Fonts loading
- Smart multiline auto-scaling
- PNG export
- Transparent background
- Stroke, shadow, glow
- 128×128 and 256×256 previews

### Phase 2: APNG MVP

Deliver:

- Animation frame model
- 5–8 animation presets
- APNG export
- Loop preview
- Web Worker encoding
- Basic file-size warning

### Phase 3: Misskey Quality Layer

Deliver:

- Misskey export presets
- Actual-size preview
- Dark/light preview
- Readability scoring
- Japanese-friendly line breaking
- Export optimization suggestions

### Phase 4: Rich Cosmetics

Deliver:

- Double outline
- Sparkles
- Shine sweep
- Animated glow
- Sticker borders
- Decorative backgrounds
- Preset style packs

### Phase 5: Advanced Export and Workflow

Deliver:

- GIF fallback
- Optional animated WebP
- ZIP batch export
- Save/load project JSON
- Template gallery
- User font upload
- Batch text generation

### Phase 6: Advanced Typography

Deliver:

- Vertical Japanese text
- Per-character color
- Per-character animation
- Better kinsoku handling
- Variable font axis UI
- Missing glyph diagnostics

---

## 21. MVP Scope Recommendation

The best MVP should include:

- Text-only emoji generation
- Google Fonts
- Smart multiline auto-scaling
- Transparent PNG export
- Transparent APNG export
- 5–8 animation presets
- Fill, stroke, shadow, glow
- Misskey 128×128 and 256×256 presets
- Actual-size preview
- Dark/light preview
- Basic readability warnings

Avoid starting with image uploads, complex decorations, or animated WebP. Those are valuable, but they are not necessary to prove the main product advantage.

---

## 22. Implementation Priority

### Must-Have

1. Text layout solver
2. High-resolution rendering and downsampling
3. APNG export
4. Google Fonts loading
5. Transparent animation
6. Misskey preview presets

### Should-Have

1. GIF fallback
2. Rich animation presets
3. Style presets
4. File-size optimization
5. Project JSON save/load

### Nice-to-Have

1. Animated WebP
2. User font upload
3. Per-character animation
4. Template sharing
5. Batch generation

---

## 23. Risks and Mitigations

### Risk: APNG file size becomes too large

Mitigation:

- Lower FPS
- Reduce frame count
- Use frame delta optimization
- Add APNG Lite preset
- Add file-size warnings

### Risk: Font rendering varies by browser

Mitigation:

- Wait for font load completion
- Recalculate layout after font load
- Use pixel-bounds validation
- Offer project export but not pixel-perfect cross-browser guarantees

### Risk: Japanese text layout looks awkward

Mitigation:

- Add Japanese-friendly line breaking
- Score line balance
- Avoid punctuation at line start
- Add manual line break override

### Risk: GIF fallback looks poor

Mitigation:

- Make APNG the default
- Warn clearly when exporting GIF
- Use palette optimization
- Provide preview before download

### Risk: Encoding blocks UI

Mitigation:

- Use Web Workers
- Show progress
- Cache frames
- Allow canceling export

---

## 24. Testing Plan

### Unit Tests

- Grapheme segmentation
- Japanese line-break rules
- Layout scoring
- Pixel bounds detection
- Animation sampling
- Export option validation

### Visual Regression Tests

- Static text rendering
- Outlined text
- Glow effects
- Japanese multi-line layouts
- Latin/Japanese mixed layouts
- Transparent backgrounds
- Animation frame snapshots

### Browser Tests

- Chrome
- Firefox
- Safari
- Edge
- Mobile Safari
- Android Chrome

### Export Tests

- PNG opens correctly
- APNG animates correctly
- APNG keeps transparency
- GIF fallback exports
- ZIP batch export works
- Large export does not freeze UI

---

## 25. Suggested First Implementation Sprint

### Sprint Goal

Build a working static + APNG prototype that proves the quality advantage.

### Tasks

1. Create Nuxt 3 + TypeScript project.
2. Implement project state schema.
3. Implement Canvas preview.
4. Implement Google Font loading for one selected font.
5. Implement grapheme segmentation.
6. Implement simple layout candidates.
7. Implement binary-search font fitting.
8. Implement pixel-bounds detection.
9. Implement fill, stroke, shadow, and glow rendering.
10. Implement one animation preset: pulse.
11. Render frames to RGBA.
12. Encode APNG.
13. Add 128×128 and 256×256 export options.
14. Add actual-size preview.
15. Add basic file-size warning.

### Sprint Output

A user can type text, choose a font, apply outline/glow, preview animation, and download a transparent APNG.

---

## 26. Clean-Room and Licensing Notes

If this is inspired by Megamoji, avoid copying its assets or implementation details directly unless you intentionally comply with all relevant licenses.

Recommended approach:

- Implement a clean-room renderer.
- Use original UI and original presets.
- Load Google Fonts dynamically.
- Use open-source libraries according to their licenses.
- Keep asset licenses documented.
- Avoid bundling fonts unless their license allows redistribution.

---

## 27. References to Check During Implementation

These are useful topics and resources to verify while implementing:

- Misskey custom emoji behavior and instance-specific upload limits
- APNG browser support
- UPNG.js APNG encoding
- Google Fonts Developer API
- Google Fonts CSS API
- Canvas `FontFace` API
- `Intl.Segmenter`
- OffscreenCanvas support
- GIF palette optimization
- Animated WebP encoding options

---

## 28. Final Recommendation

Build the product around this principle:

> **Render like a motion-graphics tool, export like an emoji tool.**

The biggest quality improvements will come from:

1. High-resolution RGBA rendering
2. APNG-first export
3. Real layout solving instead of naive text scaling
4. Japanese-aware line breaking
5. Actual-size preview and readability scoring

That combination should make the tool feel clearly better than a basic Megamoji-style generator, especially for Misskey users who want expressive transparent animated emojis.
