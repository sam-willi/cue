# Cue Design System

> **Purpose:** Canonical visual and interaction design guidance for Cue. Product, brand, UI, marketing, industrial-design, and image-generation work should follow this file together with [`CUE_CONTEXT.md`](./CUE_CONTEXT.md).
>
> **Status:** Direction approved; production artwork remains to be drawn and validated.  
> **Last updated:** 2026-10-03 (haptic vocabulary, touch controls, and app tokens synced with `CUE_CONTEXT.md` §26; see §24)

## 1. Design idea

Cue helps people create space in conversation. The identity should communicate:

> **Two voices create a deliberate moment of space.**

The visual system is built around two interlocking conversational forms. They first read as an exchange between people; their shared negative space then reveals a subtle `C` and a pause. This second discovery makes the mark more memorable without requiring the logo to explain the whole product.

Cue should feel:

- Calm, not passive.
- Confident, not corrective.
- Young, not childish.
- Premium, not luxurious for its own sake.
- Human, not clinical.
- Technological, not futuristic theater.
- Supportive, not judgmental.

## 2. Decision-status legend

- **[APPROVED DIRECTION]** Preserve this unless a human owner explicitly changes it.
- **[PROVISIONAL]** Current recommendation that requires validation or production refinement.
- **[OPEN]** Unresolved; do not silently present it as final.

## 3. Primary logo

![Approved Cue logo direction](./assets/brand/cue-logo-concept.png)

### Approved construction

- **[APPROVED DIRECTION]** The primary lockup uses one compact symbol above a lowercase `cue` wordmark.
- **[APPROVED DIRECTION]** The symbol contains exactly two interlocking abstract conversation forms.
- **[APPROVED DIRECTION]** One form is near-black and one is warm gray.
- **[APPROVED DIRECTION]** The shared negative space should suggest both a `C` and an intentional pause.
- **[APPROVED DIRECTION]** The wordmark is lowercase, soft-geometric, and confident.
- **[APPROVED DIRECTION]** The core logo does not need radio waves, a microphone, an ear, a face, quotation marks, or an explicit pause-button glyph.

### Production-artwork warning

The included PNG is the **approved concept direction**, not production master artwork. Before commercial use, a designer must redraw it as precise vector geometry and complete:

1. Optical correction of both conversational forms.
2. Exact negative-space construction.
3. Custom wordmark drawing and kerning.
4. Small-size testing at 16, 24, and 32 pixels.
5. Single-color and reverse-color versions.
6. Engraving, embossing, and laser-marking tests.
7. Trademark similarity review.

Do not auto-trace the PNG and treat the result as final vector artwork.

## 4. Logo variants

The eventual production package should contain:

- `cue-lockup-stacked` — symbol above wordmark; primary brand lockup.
- `cue-lockup-horizontal` — symbol left of wordmark; wide layouts.
- `cue-symbol` — app icon, social avatar, product engraving, favicon.
- `cue-wordmark` — constrained spaces where the symbol is already present.
- `cue-logo-one-color-dark` — near-black on a light background.
- `cue-logo-one-color-light` — warm white on a dark background.

No variant should introduce new decorative elements.

## 5. Clear space and minimum size

### Clear space

**[PROVISIONAL]** Define `x` as the stroke/vertical thickness of the lowercase `u` in the final wordmark.

- Keep at least `1.5x` clear space around the full lockup.
- Keep at least `1x` around the standalone symbol.
- Product engraving may use reduced clear space only after physical testing.

### Minimum size

- Standalone symbol: **16 px** digital minimum, subject to final optical testing.
- Full horizontal lockup: **96 px** wide digital minimum.
- Full stacked lockup: **72 px** wide digital minimum.
- Physical symbol: **6 mm** wide minimum unless manufacturing tests prove a smaller size remains clear.

If the hidden `C` closes up or the conversational forms merge, use a simplified small-size master rather than adding outlines.

## 6. Logo misuse

Never:

- Stretch, skew, rotate, or redraw the logo casually.
- Separate or rearrange the two conversational forms.
- Add more speech bubbles or signal waves.
- Add gradients, bevels, chrome, glow, drop shadows, or glass effects to the core mark.
- Place the logo inside a generic chat bubble.
- Use the symbol as a repeating decorative pattern without explicit brand approval.
- Replace the wordmark with an arbitrary rounded font.
- Use low-contrast gray-on-gray combinations.
- Place the detailed lockup on visually busy photography.
- Describe the generated concept PNG as finished vector artwork.

## 7. Color system

### Core palette

| Token | Hex | Use |
|---|---:|---|
| `ink-950` | `#111111` | Primary text, primary logo form, dark UI |
| `warm-gray-500` | `#9F9A93` | Secondary logo form, supporting neutral |
| `bone-50` | `#F7F4EE` | Primary light background |
| `white` | `#FFFFFF` | High-clarity surfaces and reverse space |

### Supporting neutrals

| Token | Hex | Use |
|---|---:|---|
| `stone-100` | `#EEEAE3` | Cards and subtle sections |
| `stone-300` | `#D5D0C8` | Borders and disabled surfaces |
| `stone-700` | `#5F5B56` | Secondary text on light backgrounds |
| `ink-800` | `#282725` | Elevated dark surfaces |

### Accent palette

**[PROVISIONAL]** Use only one primary accent family in a given composition.

| Token | Hex | Character | Recommended use |
|---|---:|---|---|
| `signal-cobalt` | `#2437D8` | Clear, capable, digital | Links, selected states, restrained campaign accent |
| `signal-oxblood` | `#7A1E2C` | Mature, editorial, assured | Special brand moments and premium packaging |
| `signal-chartreuse` | `#B7E533` | Energetic, visible, youthful | Tiny hardware/UI signal only; never large backgrounds |

Default recommendation: start with **cobalt** for product UI. Keep oxblood and chartreuse as controlled campaign or colorway accents until brand testing identifies a clear preference.

### Color rules

- The primary identity is neutral; accents support it rather than define it.
- Accent should normally occupy less than 10% of a composition.
- Never apply all three accents simultaneously.
- Do not use pastel rainbow gradients as shorthand for Gen Z.
- Meet WCAG contrast requirements for functional text and controls.
- **[PROVISIONAL]** In the product app, cobalt marks coaching cues and selected state only. Meters, touch-control confirmations, and corrections stay neutral (ink / stone / warm gray). In dark mode cobalt is lifted (`#8C9BFF`) to keep contrast on ink surfaces; validate with the brand team.
- Warm gray is not suitable for small text on bone without a contrast check.

## 8. Typography

### Wordmark

- **[APPROVED DIRECTION]** The wordmark is a custom lowercase `cue` drawing.
- It should have soft geometric construction without becoming bubbly.
- Counters should remain open at small sizes.
- The `c`, `u`, and `e` should share a clear stroke logic and rhythm.
- The wordmark should look calm and stable, not fast, italic, or kinetic.

### Product and marketing type

**[PROVISIONAL]** Use **Inter** as the initial UI and product typeface because it is highly legible, open source, and technically convenient. A more distinctive brand typeface can be evaluated later.

Recommended hierarchy:

- Display: Inter Tight, 500–600 weight, restrained tracking.
- UI/body: Inter, 400–500 weight.
- Data: Inter, tabular numerals where values align.
- Editorial emphasis: use scale and whitespace before using italics or decorative type.

### Typography rules

- Prefer sentence case.
- Use lowercase selectively in brand headlines, not as an inflexible system.
- Avoid excessive all-caps; reserve it for short labels.
- Avoid ultra-light weights that disappear on mobile screens.
- Avoid childish rounded fonts, tech-mono clichés, and high-fashion serifs in core UI.
- Keep line length near 45–75 characters for reading surfaces.
- Use no more than three type sizes in a compact interface region.

## 9. Spacing and layout

Cue’s layout should visually model good speaking: clear rhythm, intentional pauses, and room to breathe.

### Grid

- Use a base spacing unit of **4 px**.
- Primary spacing steps: `4, 8, 12, 16, 24, 32, 48, 64, 96`.
- Use 8 px increments for ordinary UI layout.
- Use generous 48–96 px pauses between major marketing sections.
- Align to a clear grid; avoid scattered “playful” placement.

### Shape language

- Corners are softly controlled, not pill-shaped by default.
- Suggested interface radii: 8 px for controls, 12–16 px for cards, full-circle only for compact status elements.
- Prefer large calm fields and a few deliberate overlaps.
- Use the logo’s interlocking idea sparingly in layouts; do not turn every card into a speech bubble.

## 10. Iconography

- Use simple, optically balanced line icons with rounded joins.
- Default icon grid: 24 px.
- Default stroke: 1.75–2 px depending on rendering.
- Icons should describe actions directly; do not make users learn a symbolic brand language for basic controls.
- Haptic, pace, pause, privacy, and self-caught icons should share one construction system.
- Avoid mixing filled emoji-like icons with technical outlines.
- Do not reuse the Cue symbol for unrelated functions.

## 11. Motion and haptics

Motion should feel like a breath or a gentle cue—not an alarm.

- Use short ease-out transitions for immediate state changes: approximately 160–220 ms.
- Use slower 300–450 ms transitions for expanding reflections or progress views.
- Avoid bouncing, shaking, flashing, or celebratory confetti for filler reduction.
- Respect reduced-motion settings.
- Visual feedback for a cue may use one subtle outward movement or brief pause in motion. On screen, each coaching rhythm is drawn as outward rings: **one** ring, **two** quick rings, or **one slow, wide** ring. No shaking, jitter, or flashing.
- **[PROVISIONAL — owner decision 2026-10-03, see `CUE_CONTEXT.md` §5 and §26]** Haptic meaning stays small and learnable: three coaching rhythms distinguished by rhythm, not strength.

  | Rhythm | Behavior | Meaning |
  |---|---|---|
  | One tap | Filler word | Pause |
  | Two quick taps | Speaking too fast | Slow down |
  | One long pulse | Speaking too quietly | Speak up |

  A single-tap mode ("make space" for everything) remains a setting and the comparison condition for user testing.
- **Touch-control confirmations** (long press = Cue on/off, double tap = Conversation/Presentation mode) are **ramps**: a vibration that swells or fades, shown on screen as a neutral swell, never as rings or taps, so they can't be mistaken for coaching. Rising = on / Conversation, falling = off, two swells = Presentation.
- Do not add vibration patterns beyond these without user testing.

## 12. UI design principles

1. **Awareness, not punishment.** Never make a user feel scolded for speaking naturally.
2. **No-screen live use.** The wearable coaches; the app supports setup and reflection.
3. **Progress over mistakes.** Lead with improvement, self-awareness, and retained learning.
4. **Precision before density.** Show fewer trustworthy metrics instead of a dashboard full of weak estimates.
5. **Personal baseline.** Compare users primarily with themselves.
6. **Explain uncertainty.** Distinguish detected, estimated, and user-confirmed events.
7. **Quiet confidence.** One clear primary action per screen.
8. **Privacy in the interface.** Recording state and data retention must be unmistakable.

## 13. Data visualization

- Use simple lines, dots, and interval bands.
- Default to direct labels instead of legends when space permits.
- Use accent color for the active or meaningful series, not every series.
- Show measurement coverage or confidence when data is incomplete.
- Do not use red to represent filler words as failures.
- Do not gamify “perfect speech” or reward zero fillers.
- Appropriate progress stories include:
  - Device interventions decreasing.
  - Self-caught moments increasing (once self-correction can be reliably inferred from speech; the cuff's touch surface is reserved for controls, so there is no self-catch tap).
  - Pause duration becoming steadier.
  - Retention improving during no-feedback periods.

## 14. Product and industrial-design language

- Cue is always depicted as a **single outer-ear cuff**, never an earbud.
- It must not enter or block the ear canal.
- The form should appear small, elegant, discreet, and physically plausible.
- It should resemble jewelry/premium consumer hardware rather than a hearing aid.
- Favor metallic silver, graphite, champagne, or controlled enamel finishes.
- Product geometry must remain consistent across every angle and colorway.
- The case holds one cuff and must not resemble a two-earbud case with one device missing.
- Renders must preserve consistent seams, sensors, openings, contacts, thickness, and scale.
- Do not invent impossible fit, floating devices, or unsupported miniaturization claims.

## 15. Photography and art direction

### People

- Show natural conversation, preparation, interviews, class discussion, presentations, and everyday social settings.
- Casting should be inclusive without looking tokenized.
- Expressions should feel present and self-assured, not euphoric stock-photo happiness.
- Avoid exaggerated pointing at the ear or staged “technology amazement.”

### Product photography

- Favor warm natural light or restrained studio lighting.
- Show correct outer-ear placement clearly in at least one image per product story.
- Use close detail selectively; maintain truthful scale.
- Pair metallic surfaces with warm, tactile backgrounds rather than sci-fi environments.

### Avoid

- Uncanny AI faces or hands.
- Beauty-campaign posing unrelated to the product.
- Loud neon cyberpunk lighting.
- Floating UI holograms.
- Medical-office settings unless a future clinical product requires them.
- Generic microphone, waveform, and podcast imagery.

## 16. Illustration and graphic elements

- Use abstract conversational overlap, controlled line breaks, and intentional negative space.
- Graphic elements should reinforce rhythm and pauses rather than depict literal filler words repeatedly.
- One strong composition is preferable to a collage of trendy stickers.
- Do not add sparkles, hearts, smiley faces, or doodles merely to signal youth.
- Do not create repeating speech-bubble wallpaper from the logo.

## 17. Brand voice

Cue speaks like a thoughtful, socially aware coach: direct, calm, encouraging, and never patronizing.

### Prefer

- “Make space.”
- “Speak with intention.”
- “You caught yourself.”
- “Your pauses felt steadier today.”
- “Keep your voice. Lose the habits that get in its way.”

### Avoid

- “Bad word detected.”
- “You failed.”
- “Fix your speech.”
- “Sound smarter.”
- “Never say um again.”
- Claims that fillers make someone incompetent, unintelligent, or untrustworthy.

### Writing rules

- Use plain language and short sentences.
- State what Cue observed without pretending certainty.
- Make the recommended action constructive.
- Avoid excessive exclamation points, slang, and forced Gen Z vocabulary.
- Never personify Cue as listening secretly.

## 18. Accessibility

- Meet WCAG 2.2 AA for product interfaces.
- Do not rely on color alone to communicate state.
- Provide text alternatives for logo and product imagery.
- Support Dynamic Type or platform text scaling.
- Respect reduced motion and increased contrast settings.
- Ensure tap targets meet platform guidance, normally at least 44×44 pt on iOS.
- Caption all instructional video.
- Make charts readable by screen readers and summarize their conclusion in text.
- Let users change or disable haptic intensity and categories.
- Avoid feedback patterns that can amplify anxiety or disrupt speech.

## 19. Dark mode

- Use `ink-950`/`ink-800` surfaces rather than pure black everywhere.
- Use `bone-50` or white for primary text depending on contrast.
- Adjust warm gray upward in luminance so the secondary logo form remains visible.
- Use a dedicated reverse logo; do not invert the raster concept automatically.
- Generated design-review images must use an explicit opaque background so they remain visible in both light and dark chat interfaces.

## 20. Asset-generation rules for agents

When generating or commissioning Cue visuals:

1. State whether the output is exploration or production-ready.
2. Use an opaque specified background for review sheets.
3. Depict one consistent single ear cuff, never a pair of earbuds.
4. Preserve geometry across angles and colorways.
5. Spell `Cue` or `cue` exactly; do not accept garbled brand text.
6. Avoid stock messaging-app symbols, microphones, multiple radio waves, and generic equalizers.
7. Do not equate “Gen Z” with pastel gradients, stickers, or childish typography.
8. Favor restraint, cultural fluency, and one clear visual idea.
9. Do not claim generated hardware is manufacturable.
10. Do not use raster-generated logos as final masters; redraw approved work in vector form.

## 21. Design review checklist

Before approving an asset, ask:

- Is the idea understandable in five seconds?
- Is there one memorable concept rather than several effects?
- Does it feel like Cue rather than a generic messaging, podcast, or wellness brand?
- Does it remain clear at small size and in one color?
- Can it be engraved or printed reliably?
- Is the ear-cuff form physically plausible and consistent?
- Does the work feel calm, confident, youthful, and premium?
- Does it avoid punishment, shame, and medicalized language?
- Does it meet accessibility and contrast requirements?
- Are assumptions clearly distinguished from validated decisions?

## 22. Open design work

- Redraw and approve the production vector logo.
- Perform trademark and similarity screening.
- Select or license the long-term brand typeface.
- Test cobalt, oxblood, chartreuse, and monochrome treatments with target users.
- Create horizontal, symbol-only, one-color, reversed, and small-size masters.
- Define exact app component tokens after the first product prototype exists.
- Validate industrial-design materials, finishes, dimensions, and colorways.
- Conduct usability and accessibility testing with real users.

## 23. Agent handoff

Cue’s identity is built around **two interlocking voices creating space**. Use the approved two-form symbol and lowercase wordmark direction, but treat the included PNG as concept art pending a professional vector redraw. Keep the system warm-neutral, restrained, calm, and highly legible. Gen Z relevance should come from taste and confidence—not trend clichés. Always depict a single, elegant outer-ear cuff; prioritize one clear idea, supportive language, accessible contrast, consistent geometry, and honest technical representation.

## 24. Change log

### 2026-10-03

- §11: replaced the single "make space" tap with the three-rhythm coaching vocabulary and ramp confirmations for touch controls, matching owner decisions recorded in `CUE_CONTEXT.md` §26. Cue animations are now outward rings only (no shaking).
- §13: self-caught progress depends on inferring self-correction from speech.
- §7: how the product app applies the single-accent rule (cobalt for cues; neutrals elsewhere) and the dark-mode cobalt lift.
- The software MVP (`src/app`) now uses these tokens: bone/ink neutrals, cobalt cues, Inter / Inter Tight, 8 px controls and 16 px cards, no red error states. The concept PNG is not used as a logo in the app; the header shows the product name as plain text until the vector redraw exists.
