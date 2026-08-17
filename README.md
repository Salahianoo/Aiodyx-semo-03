# Eight apps, one system

A four-page scroll-driven 3D site for AIODYX, in **English and Arabic**, on a
paper ground. Each page gets its **own** spatial metaphor — repeating one
motion four times would read as a template, not a story.

| Page | Metaphor | Motion |
|---|---|---|
| `/` | One field of points, re-formed eight times | Transformation in place |
| `/services` | A system building itself, tier by tier | Ascent |
| `/about` | A dotted globe that settles on the region | Rotation |
| `/contact` | Amman ↔ Riyadh, an arc and a slow pulse | Almost still |

Copy on every page comes from the live AIODYX dictionary
(`src/content/en.json`, `src/content/ar.json`), read through
`src/lib/content.ts` — nothing is invented here.

## Why contact barely moves

A contact form is a functional surface people use deliberately: reading labels,
typing, checking what they typed. Motion competing with that is decoration that
costs comprehension. So `/contact` has no scroll choreography, bloom is switched
off entirely, and the panels are solid rather than glass — a translucent panel
over a moving scene is the classic legibility trap. The scene sits in the one
region the layout leaves empty — upper-*trailing*, which mirrors with the page
under Arabic.

That restraint is the design decision, not an omission.

---

```bash
npm run dev     # PORT=3001 npm run dev if 3000 is taken
npm run build
npm run lint
```

Routes live under `/en` and `/ar`; `src/proxy.ts` redirects `/` to one of them.

## Home: one field, re-formed eight times

Every other page here builds an object and moves a camera around it. Home has
no object. The same twelve thousand points are the scattered data, the
assembled core, the ten modules and the logotype, and the story is the
transitions between those states.

Nothing is created or destroyed the whole way down, which is the argument the
page is making: these are not separate tools that get replaced, it is the same
material organised.

| Beat | Formation |
|---|---|
| open | six ERP glyphs on a ring, copy in the hub |
| problems ×2 | the same six glyphs, flung apart and tumbling |
| flow | the six drawn inward on a twist, colours draining |
| assembly | the ring — all ten modules named at once |
| modules ×10 | a scene per module: four people, six objects |
| ai | every cluster wired through the middle |
| why | a lattice; six columns, because there are six reasons |
| close | the AIODYX logotype |

That also settles the motion problem. Home cannot converge-and-orbit without
repeating what it used to do, and it cannot climb or rotate without repeating
services and about. Transformation in place is nobody else's.

### One attribute per formation, not a morph target

Each point carries all nine of its positions at once (`aPos0`…`aPos8`) and the
vertex shader sums them against nine uniform weights. A frame costs one
multiply-add per formation, the CPU touches nothing but the weights, and there
is no per-frame buffer upload and no interpolation state anywhere.

The attribute list and the sum are **generated from `FORMS`**, not typed out.
They used to be eight hand-written terms with a standing warning in this file
to remember the shader when adding a formation; adding the ninth is what made
generating them cheaper than heeding the warning.

Which means the scene is a **pure function of scroll position**. Scrubbing
backwards is not a reversal that has to be computed, it is the same evaluation
at a smaller number — so the field cannot drift out of sync with the copy
however fast the timeline is dragged. This is the same interruptibility
principle as `damp()`, reached by removing the state instead of taming it.

Weights come from one anchor per beat at the centre of its *measured* range,
blended with `smooth()` between the two the scroll currently sits between. The
accumulation is `+=` rather than `=` because consecutive beats often share a
formation — all ten module beats rest on the ring — and the two halves have to
add back up to one.

## The opening is six ERP glyphs, not a haze

The page used to open on a wide faint haze, kept faint so the headline could
win — which it did, by saying nothing. The opening formation is now a pie
chart, a bar chart, a trend arrow, a calculator, an envelope and a pair of
cogs, arranged on a ring with the hero copy sitting in the hub.

The ring is the load-bearing decision. It is the shape every ERP diagram is
drawn as, but the reason it is here is that it is the only arrangement that
fills the frame without putting anything behind the copy — a grid or a scatter
would have to sit under it. It is an **ellipse**, 9.9 × 5.4: the copy block is
far wider than it is tall, and a circle big enough to clear it sideways runs
off the top of the frame. Six glyphs at 60° steps also means none of them lands
at twelve or six o'clock, which is exactly where the headline and the trust
line reach furthest.

### Bold, or it is a coloured blob

The first pass drew these the way you would draw an icon in a vector editor:
hairline strokes, a pie with a couple of degrees of slice separation, an axis
on the bar chart, small operator glyphs on the calculator. At ~170 screen
pixels with 2,000 points each, every one of them collapsed. Only the envelope
survived, because it was the only glyph that was *an outline plus one
unmistakable feature*.

Everything else is rebuilt to that rule — few elements, fat strokes, big gaps:

- The pie's slice is offset far enough to leave a visible wedge of empty space.
  At the original distance it read as a crack in a disc.
- The bar chart lost its vertical axis, whose arm sat close enough to the first
  bar to read as a fourth one. A baseline alone does the same job.
- The trend arrow lost its bars entirely. With them it was the bar chart with
  extra marks on it and the two were indistinguishable; the bare line is the
  one shape nothing else on the ring shares.
- The cogs went from eight fine teeth to six chunky ones. Eight fine teeth on a
  170px circle is a fuzzy edge, which is a circle.

### Point size is per-formation now

`gl_PointSize` falls off as `42 / -mv.z`, and this ring sits further back than
anything else on the page — at 20 units its points land at barely two pixels,
which turns a drawn glyph into speckle. There is a `SIZE` table alongside
`DISTANCE`, `HEIGHT` and `ALPHA`, blended by the same weights, so a formation
that has to be *read* rather than felt can pay for its own legibility instead
of dragging the camera in and breaking the composition.

Each glyph takes one of the module hues, so the opening and the module tour are
visibly the same set of colours. It is the only formation where colour arrives
before the copy that explains it.


### The close is a signed page, and had to be given room

The finale sits *under* the tallest copy block on the site — headline,
subtitle, two buttons, two office cards and the working week. A `min-h-screen`
beat centres that block, which at 900px tall left exactly 161px of air above it
and 161px below. The logotype is 133px of that lower band, so it ended up flush
against the bottom edge with five pixels to spare and its top overlapping the
working-week line, while 161px sat unused at the top.

`<StoryPage signed>` gives the last beat some bottom padding, which pushes the
centred block up and hands the difference to the mark — 237px of band instead
of 161. The mark itself came up from −4.1 to −3.5 to sit in it.

The rule keys off a `data-last` attribute rather than the beat id, because
"close" is the id on three different pages and only home has a logotype
resolving beneath it.


## Ten module scenes, in a texture

Every module beat used to be the same ring with a different cluster lit. Each
one is now its own image — and **only four of the ten are people**. A figure is
right for the modules that are about someone doing something (finance, sales,
HR, support) and wrong for the ones about things: a person standing next to a
warehouse says less about inventory than the warehouse does, and ten
silhouettes in a row would flatten the tour into one repeated shape.

| module | scene |
|---|---|
| Finance & Accounting | an accountant reading an Odoo report |
| CRM & Sales | a salesperson beside a pipeline funnel |
| Inventory & Procurement | racking, cartons, a barcode |
| Human Resources | three people, the middle one forward |
| Attendance & Payroll | a clock and a payslip |
| Projects & Tasks | a kanban board, mid-sprint |
| Manufacturing | two meshed cogs over a conveyor |
| Customer Support | an agent on a headset, mid-conversation |
| Business Intelligence | an Odoo dashboard |
| AI Automation | a network with one node deciding |

### Why they are not attributes

Every other formation is a `vec3` attribute the vertex shader sums. Ten more
would put the geometry at **23 vertex attributes**, and WebGL only guarantees
16 — the page would render on the machine it was built on and fail on a good
share of the ones it ships to.

They live in a `DataTexture` instead, laid out a whole number of rows per
module so locating a point is two cheap operations. `w` carries a palette slot
rather than an alpha, so one fetch does position *and* colour. The scene stays
a pure function of scroll, the upload happens once, and an eleventh module
costs a row rather than an attribute.

Two module records are fetched per vertex and cross-faded, so scrolling from
one module to the next morphs one image into the other. Which two cannot come
from the formation weights — all ten beats share one formation, so
`uW[MODULE]` is their *total* and says nothing about which. The anchor table
carries a module index alongside the beat id, and the pair is written in place
next to the weights.

### Scenes do not know which module they are

They return a palette **slot**, not a colour, and slot 1 resolves to
`uCluster[m]` in the shader — the module's own hue, the one the ring and the
copy already use. So ten scenes share one palette, none of them names a colour,
and re-hueing a module is a one-line change in `theme.ts`.

### The ring got its job back

Losing the ring would have cost the page the only moment that says *here is
everything in it*, with all ten names legible at once. It is the `assembly`
beat now — the overview, before the tour — which is what its copy ("every
module is built and connected to the others") was describing all along. The
dense core it replaced was the one formation the funnel already delivers.

**Interpolate formation indices into the shader; never type them.** The module
hues keyed off literal `uW[4] + uW[5] + uW[6]`, and renumbering the formations
silently pointed them at the wrong three — the ring went grey while its labels
stayed coloured, which looks like a palette decision rather than a bug.


### The scatter is the same six glyphs, still in colour

The scatter beat's copy is "Your Business Runs on Separate Tools — Not One
System". It used to be seven anonymous gaussian clumps, which said "some stuff
is scattered" and nothing more specific. It is now the six glyphs from the
opening, keeping their hues, flung to their own corners of a volume and each
rolling on its own axis — the sentence, drawn.

Their colour then holds through the funnel and drains only as the field reaches
the core, which is what makes the flow beat read as *many becoming one* rather
than as one cloud fading into another.

**This is the one formation that is not a baked attribute.** A rotation driven
by scroll cannot be stored in a buffer, so `SCATTER` has no `aPos` of its own:
the vertex shader rebuilds it every frame from `aLocal` — the point's place
inside its own glyph — against `uSpin`, `uSpread` and `uShift`. `STATIC_FORMS`
exists so that everything walking the formation list for *geometry* skips it,
rather than uploading an attribute the shader never declares.

All three uniforms are plain functions of scroll position, undamped. Damping
would make the tumble a state machine and break the property the whole scene
rests on: scrubbing backwards is the same evaluation at a smaller number, not a
reversal that has to be computed.

### Three things the tumble got wrong first

- **Tumbling about X or Y makes a glyph vanish.** These are flat drawings, and
  edge-on they are a line — the same trap the logotype and the figure dodge by
  suppressing rotation outright. The axes are weighted toward Z, so a glyph
  rolls face-on with a wobble and never disappears.
- **The cloud sat on the copy, whichever side it picked.** Both scatter beats
  share the formation but `<StoryOverlay>` alternates their column — `problems`
  reads right, `problems-2` reads left. Rather than compromise, the cloud
  *crosses the frame*: clear on one side while the first list is read, clear on
  the other by the second. Spread over both beats it was already a third of the
  way over too early, so the crossing is timed to the boundary between them,
  as a fraction of their own measured span.
- **The funnel inherited the sweep and landed on the flow copy.** Continuity
  with where the scatter parked the glyphs was the obvious thing to want and
  was wrong: `flow` reads right too. The glyphs have to cross back regardless,
  so the crossing became the transition, and the funnel gathers from the empty
  half.

The scatter's placement and the funnel both mirror under Arabic, via the same
`sideSign()` rule the module tour follows. The glyphs themselves never mirror —
the calculator and the trend arrow would read backwards.


### The figure is the one formation that depicts something

### The ledger became an Odoo screen

The figure was holding a blank report with a chart on it, which said
"accounting" but not *whose*. The site's own hero says the system is built on
Odoo, so the page they are reading now carries the real Odoo wordmark — the
leading "o" in Odoo's magenta, "doo" neutral, exactly as the source file
colours it. It is rasterised from `public/odoo-logo.svg` through the same
`rasterize()` the AIODYX finale uses, which was pulled out of `home-scene.tsx`
into `lib/raster.ts` so both could share it.

The mark is laid out in the ledger's **own plane**, so it tilts with the page.
A logo that stayed square to camera while the page leaned back would read as a
sticker floating in front of the figure rather than as something printed on it.
The chart got demoted to a strip along the bottom: with the page branded, the
mark is the thing worth reading, and the two were competing for the same 130
pixels.

`aFig` also stopped being a 0→1 blend. Two colours covered a body and a chart;
the mark needs a magenta and a neutral that are nowhere on that line, so it is
a palette index into `uFigPal` now.

### The idle breath was wider than the letterforms

The mark still came out as a smear after all of that, and the cause was
nothing to do with the mark. Every held formation breathes — `uTurb`, ±0.12
world units — so that a beat you dwell on does not become a photograph. The
strokes of the Odoo wordmark are about **0.09 units thick**. The idle animation
was wider than the thing it was animating.

There is a `TURB` table now, blended by the same weights as `DISTANCE`,
`HEIGHT`, `ALPHA` and `SIZE`: formations made of clouds keep their full breath,
formations made of drawing get almost none. It sharpened the icon ring and the
closing logotype as much as it did the Odoo mark — both had been quietly paying
the same cost.

**Damp toward the scaled target, not scale after damping.** Multiplying
`uTurb` by the blend *after* its `damp()` feeds the damp its own output, and
the breath winds itself down to zero over a few frames.


Every other formation is an abstraction — clumps, a shell, a ring, a lattice —
and an abstraction reads at any density from any angle. A person does not: it
is recognisable or it is noise, and what decides that is the silhouette.

Three things followed from that, and each was a visible failure first:

- **Volumes, not a cut-out.** Sampling a silhouette image is how the logotype
  finale works and would have been far less code, but the field carries a free
  Y-spin between beats and a flat figure turning even slightly goes edge-on and
  collapses into a line. The spin is suppressed while this formation holds the
  frame — the same rule the logotype already needed — and the volumes mean the
  mid-blend state degrades to a three-quarter view instead of a smear.
- **The chart was drawn over the face.** It began as bars standing above the
  held ledger, which put them at head height. A figure with no head does not
  read as a person at all. The bars live on the ledger's own face now, in its
  plane, so they tilt with it and cannot collide with anything.
- **A filled page is a lozenge.** Ledger and bars are the same violet, so
  density was supposed to separate them — but 2,500 points over 138×86 screen
  pixels is solid whatever the ratio. The page is drawn as a **rim**, which
  costs a third of the points and states the rectangle outright, and the bars
  get a baseline so they stand on something instead of floating.

The body wears the field's own ink and only the ledger and chart take the
module hue, through a per-point `aFig` weight. Tinting the whole figure violet
made it a mascot; the split keeps it reading as the same twelve thousand
records, arranged this time into a person.

**The part table is normalised, not trusted.** Shares that sum to 0.96 do not
fail loudly — they quietly dump the last 4% of the field into whichever part
happens to be last in the table, and the bars came out a fifth heavier than the
numbers claimed.


### The logotype is rasterised, not traced

The finale fills the mark's outlines onto a canvas and samples the opaque
pixels. Rasterising is the only way to get a *fill*: walking the path data
gives the outline, and the logotype would come out hollow.

Both axes come back normalised to ±0.5 against their **own** dimension, so
scaling them by the same number squares up a mark that is nearly five times
wider than it is tall. The first version filled the entire frame with what
looked like vertical columns.

### Three things that were wrong on the first pass

- **Points at 2.6 against a 300-unit scale** put ~46px sprites on screen.
  Twelve thousand of those, additive, is twenty million fragments a frame: it
  saturated to flat white and dropped the framerate far enough to be visible in
  a screenshot script.
- **Boosting colour, alpha and size together** blew the focused cluster into a
  solid white disc. It lost its hue, which is the only thing identifying it,
  and the grain that makes it read as a cloud of records rather than a blob.
- **A ring at radius 5.5** fitted the frame's width and was cropped top and
  bottom — the corridor mistake in a different shape. Anything ring-shaped has
  to fit the frustum's *short* axis.

During the tour the ring turns to bring the active cluster to twelve o'clock,
so every module gets the same composed presentation. Twelve o'clock and not
the side away from the copy, which was the first instinct: `<StoryOverlay>`
alternates the column every beat, so "opposite the copy" would have flipped the
ring 180° ten times.

## No AI video, and almost no asset pipeline

Everything on screen is generated in code, including the ERP mockups. The only
binary assets in the repo are two SVG logos — the AIODYX wordmark and Odoo's —
and both are vector, inline-able and a few KB.

For the 3D pages that was deliberate. Scroll-driven means **the visitor owns the
timeline**, so the visual has to be scrubbable in both directions at arbitrary
speed. AI video generators produce a fixed clip that is temporally unstable —
the "Inventory" panel would morph and flicker between frames, which destroys the
entire premise that these are the *same modules* throughout. Real-time WebGL is
scrubbable, resolution-independent, relabelable without re-rendering, and ships
in ~150KB rather than tens of megabytes of frames.

### Two things about the logos

**The wordmark is inlined, not an `<img>`.** The source hard-codes its fills in
a `<style>` block, which an `<img>` tag seals off — and the mark has to sit on
one white page and three near-black ones. Inlined, "ODYX" takes `currentColor`
and only the "AI" monogram keeps a fixed colour — fed `var(--brand-mark)`, so
the mark follows the palette without the SVG being re-rendered. Now that the
whole site is paper, that variable is the real brand navy `#13308a`; the tint
existed because navy is invisible on black.

**Crop a logo's viewBox with `getBBox()`, not by reading its path data.** Both
files float their artwork inside a much larger canvas — Odoo's wordmark uses
about a third of its 800×600 — so sized by height they render tiny. Estimating
the bounds from the coordinates in the `d` attributes cut the glyphs off: the
extremes of a curve are not among its control points.

## Two languages, and what RTL actually costs

Locale lives in the **path** (`/en/services`, `/ar/services`), not in state.
That is what makes the Arabic page a real address — shareable, indexable, and
served with its own `<title>` and `hreflang` — rather than a flag inside an
English one. `src/proxy.ts` redirects `/` by `Accept-Language`, with a cookie
from the switch outranking it, because someone who chose Arabic on an
English-configured laptop meant it.

**Beats had to stop being module constants.** `BEATS`, `MODULES` and the
contact page's office list were all built from `t()` at import time, which
froze them in whichever language loaded first. They are `buildBeats(locale)`
now, memoised per locale — and the memo is not an optimisation:
`<StoryOverlay>` keys its measuring effect on the beat array, so a fresh array
each render would re-measure the page continuously and the scenes read those
measurements.

Module *geometry* stayed put. Ring positions, cluster count and ids have
nothing to do with language, so `MODULES` still holds those and copy is looked
up separately.

### Direction is not free in world space

`dir="rtl"` is on `<html>`, so flexbox, `text-align: start` and every logical
property mirror themselves. The scenes do not: the copy column alternates
left/right via `flex-start`/`flex-end`, and all three scene pages park their 3D
*opposite* that column. Under Arabic "start" is the right-hand side, so every
one of those offsets points the wrong way and the field lands on the copy it
was placed to avoid.

There is no logical coordinate system in WebGL, so the sign is applied by hand:
`sideSign()` inside frame loops, and `isRtl(locale)` where the value is read
during render. **Those two are not interchangeable** — `scroll.rtl` is
published by an effect, so on the first render, which is the one that decides a
caption's side, it is still stale.

Contact was the case that only showed up in a screenshot. Its scene is pinned
to the upper-right, "the one region the copy and the panels leave empty" — and
under Arabic that is exactly where the headline is. Its markers mirror on X.

### Arabic type is not Latin type reversed

- **Inter has no Arabic glyphs at all**, so `/ar` in Inter is not unstyled, it
  is missing. IBM Plex Sans Arabic is loaded alongside it and selected by
  `:root:lang(ar)`.
- **troika needs its own font file.** It parses a TTF and builds an SDF atlas,
  so it cannot use a CSS `@font-face` the browser already has, and its default
  face is Latin-only — every ring label, tier caption and city name came out as
  empty boxes. `public/fonts/` holds the face; troika 0.52 supplies the bidi
  and Arabic joining itself.
- **All-caps tracking is destructive.** Arabic has no capitals, so
  `text-transform: uppercase` is a no-op — but the letter-spacing that goes
  with a Latin caps label pulls apart joins that are supposed to connect.
  Zeroed everywhere, in CSS and in the 3D labels.
- Negative display tracking and Latin line-heights get the same treatment;
  Arabic runs taller and already sits tight.
- Phone numbers are forced `dir="ltr"`. The digits reorder correctly on their
  own, but a leading `+` is neutral and gets thrown to the far end.

**The honeypot was the sharpest bug here.** `.form__trap` hid itself at
`left: -9999px`, which under RTL is on-screen — a real person can tab into the
field and fail the spam check by filling it in. It is `inset-inline-start` now.
Worth knowing: a physical property declared *after* a logical one wins, so
adding `left: auto` beside it silently put the trap back in the layout.

## One ground

The site is light-only. That is a constraint on the scenes rather than a colour
choice, and it is worth being explicit about why, because the obvious change —
repaint the CSS — would have shipped four blank pages.

Every glowing thing in a dark WebGL scene is `AdditiveBlending`: it *adds* its
colour to whatever is behind it, which is what makes a cloud of points read as
luminous. On paper that is a no-op. White plus anything is white. So the nine
additive materials here are normal-blended and drawn as ink, and three things
follow from that:

- **Alpha means something different.** Additive alpha is how much light a point
  contributes, and overlapping points accumulate into brightness. Normal alpha
  is coverage, and overlapping points just sit on each other — so the same
  numbers that read as a luminous cloud read as flat grey. `SCENE.alpha` is
  1.35 and `SCENE.size` is 0.88 to correct for it.
- **Bloom is off entirely**, not turned down. It is a luminance threshold
  effect; on a bright ground the whole frame clears the threshold, so it stops
  picking out the glowing parts and lays milk over everything.
- **Emphasis inverts.** Highlighting means moving *away from the ground*, which
  here is deepening, not lifting. The focused cluster mixing toward white would
  fade out at exactly the moment it is being talked about.

The hues changed with it. The dark palette's pastels are what a light source
looks like; as ink on paper they are barely-tinted grey. `theme.ts` carries a
deeper set picked to hold against `#F4F5F9` — which matters because hue is the
only thing telling one of the ten clusters from another.

Two places that had to follow the ground exactly rather than approximately: the
about globe's **occluder**, an opaque sphere at `0.97R` that stops the far-side
dots showing through, which as a hardcoded near-black was a black ball in the
middle of a white page; and troika's `outlineColor`, which is a knockout halo
and only works if it is the page's own colour.

`--ink` in `globals.css` and `SCENE.ground` in `theme.ts` are the same value in
two places. They have to be — the canvas is transparent and sits over the page,
so drift shows up as a seam.


## Stack

| | |
|---|---|
| `three` + `@react-three/fiber` | real-time scene |
| `@react-three/drei` | `RoundedBox`, `Text`, `AdaptiveDpr` |
| `@react-three/postprocessing` | bloom on the wiring |
| `lenis` | smooth scroll |
| `next` 16.3 / React 19 | app shell, `[lang]` routing, `proxy.ts` |
| `next/font` | Inter (Latin) + IBM Plex Sans Arabic |

## How the scroll drive works

The single most important decision is in `src/lib/scroll.ts`:

```ts
export const scroll = { progress: 0, velocity: 0 };
```

Progress lives in a **module-level mutable object, not React state**. Scroll
fires at display rate; `setState` there would re-render the tree ~120×/second
and the animation would stutter under its own weight. The scene reads
`scroll.progress` inside `useFrame`, which is already on the render loop —
**zero React renders while scrolling**.

Every animated value goes through `damp()`:

```ts
damp(current, target, lambda, dt)   // frame-rate independent
```

Because damping reads the *current on-screen value* each frame, scrubbing
backwards reverses the motion continuously instead of snapping to a keyframe.
That is the interruptibility principle applied to a scroll timeline, and it's
what separates this from a scroll gimmick.

Beat helpers: `range()` clamps to a window, `smooth()` removes the velocity
discontinuity at both ends, `beat()` combines them.

**Watch out:** `beat()` clamps to 1 and *stays* there. A one-sided ramp leaves
the camera parked forever — the dive needs
`beat(p, .64, .75) * (1 - beat(p, .8, .9))` to release again. That bug cost a
cropped finale during the build.

## The retired ring

Home was once ten module cards scattered in space, converging into a wired ring
with the camera diving to each in turn. `scene/modules.tsx`, `connections.tsx`
and `rig.tsx` were its parts and are deleted; `git log` has them.

Two ideas from it are worth keeping. Convergence deliberately ran *under* the
wiring beat, so the "become one system" line landed on a finished image rather
than describing something still in motion — the field inherits that, arriving
at each formation before its copy is fully on screen. And the rig parked the
focused card in the half the copy column had left empty, which is the same
problem the ring's twelve-o'clock rule solves differently.

## Copy layer

DOM text, not 3D text — it's selectable, translatable and readable before (and
without) WebGL.

Visibility is driven from scroll position on the render loop, against cached
section offsets, so the copy and the scene read the exact same value and cannot
disagree. An earlier version used `IntersectionObserver`, and a second
independent mechanism was exactly what let the two drift. Cost is one
comparison per frame and a single attribute write when the active beat actually
changes — no layout reads inside the loop.

## Accessibility

`prefers-reduced-motion` is honoured throughout, and it means *gentler*, not
*off*:

- Lenis smooth scrolling disabled entirely (native scroll instead)
- Module drift, core rotation, halo breathing and pointer parallax all stop
- Copy keeps its fade, loses the travel and blur
- The scene still renders and still tells the story via scroll position

## Content

All copy is the real AIODYX dictionary (`src/content/en.json`), read via
`src/lib/content.ts`. Home carries the actual home-page content:

- 7 problem cards (title + description) across two beats
- **all 10 real modules** — Finance & Accounting, CRM & Sales, Inventory &
  Procurement, HR, Attendance & Payroll, Projects & Tasks, Manufacturing,
  Customer Support, Business Intelligence, AI Automation
- one screen per module, with its description and all 5 features
- the AI assistant section, and 6 "why AIODYX" cards

The ten module hues in `story.ts` still do real work: they are the colours of
the ten clusters, and the only thing telling one apart from another once the
field has opened out.

## Credibility markers

A scroll story can be beautiful and still leave a visitor unsure whether there
is a company behind it. Three answers to "who is this and can they actually
build my system", added without breaking the story:

- **The ten module names, on the ring.** Without them the tour is ten anonymous
  coloured clouds — the copy column names one module at a time, so nothing on
  screen ever says *this is an ERP and here is everything in it*. All ten stay
  legible at once and the active one lifts, which is the one thing the DOM
  cannot show.
- **A marker line under the hero**: built on Odoo, with the real mark; both
  countries; both languages. `<StoryOverlay>` grew an `intro` slot for it, the
  mirror of the `children` slot that has always fed the closing beat.
- **The two offices at the close**, with their real addresses and dialable
  numbers, and the working week.

Every one of these is a fact already in the dictionary. **Nothing here is
invented** — no client logos, no headcount, no project count, no
years-in-business, no testimonials. A marker that cannot be checked is worse
than no marker, because the visitor who checks it stops believing the rest of
the page too.

There are no photographs anywhere on the site, of anything. That is not a
stylistic rule so much as an honest one: there are no real photographs of this
company to use, and generated or stock imagery of a "team" would be a claim
about people who do not exist.

### troika opacity is not material opacity

The cluster labels fade with `fillOpacity` and `outlineOpacity` on the `Text`
object, not `material.opacity`. troika's material is derived and its uniforms
are rewritten from those properties in `onBeforeRender`, so assigning to the
material is overwritten before it reaches the screen — all ten labels hung
there at full strength through the opening beat. The outline is a second
material and needs telling separately.

## Beat ranges are measured, not hardcoded

The scene used to key off literal fractions (`beat(p, 0.4, 0.8)`). That silently
desyncs the moment a section grows past 100vh, which any beat with content cards
does. `<StoryOverlay>` now measures each section and publishes its real scroll
range to `scroll.ranges`; the scene reads the same table via `rangeOf(id)` and
`owns(p, id)`.

Check `scroll.measured` before deriving per-beat state — while the table is
empty every id resolves to the same fallback window, so every card would think
it was the focused one simultaneously.

## Two troika `<Text>` rules

1. **Never pass a material element as a child of `<Text>`.** troika treats
   children as the text content, so `<Text color="x"><meshBasicMaterial/></Text>`
   is a bug. Grab the ref and mutate `ref.current.material.opacity` instead.
2. **Never `setState` from inside `useFrame` to change text.** That re-renders
   the R3F tree mid-frame and makes troika rebuild its glyph atlas. Mutate
   `ref.current.text` and call `.sync()` — gated so it runs once per change.

## Copy legibility over the scene

Two rules the copy layer follows, both learned the hard way:

**Never blur text as an entrance effect.** The reveal used
`filter: blur(6px) → 0`. Whenever that transition hadn't finished — and it is a
transition, so it never runs in a background tab — every headline and pill sat
there genuinely unreadable. Entrances are `opacity` + a 22px translate, nothing
else.

**Legibility comes from a shadow on the glyphs, not a pool behind the column.**
The earlier approach was a radial gradient inset `-55% -70%` behind each beat.
To win the contrast fight it had to be enormous and dense, and at that size it
read as a smudge drifting across the scene, swallowing the 3D cards behind it.
A tight `text-shadow` does the same work only where it's needed.

On paper that shadow is *light*. A dark halo under dark text does not separate
the glyphs from the particles behind them, it just smears the letterforms —
what the copy needs is the ground pushed up, not down. `--scrim` carries it.

Anything with its own box — feature pills, content cards — is filled rather
than outlined. A transparent pill over a lit 3D card is unreadable whatever
colour the text is.

## The bold variant

`<StoryPage bold>` adds `.story--bold` to the copy layer. Services uses it.

Its scene is a thin line drawing, so the default weight left the copy floating
and weak against the rig. Bold pushes the title to **800 / 92px**
with `-0.045em` tracking, the body to 500 at near-full contrast, and the pills
to 600.

Two things that matter:

- **Inter is loaded at 400–800.** Without the real 700/800 the browser
  synthesises a fake bold, which smears the letterforms.
- **Tracking tightens as size grows.** At 5.75rem the body's letter-spacing
  reads far too loose.

The 3D station labels get a thin `outlineWidth` in their own colour rather than
a heavier weight — troika can't synthesise one from the default face, so the
outline is what gives them presence to match.

## Services: the build line

The copy on this page is "Seven Stages — From Idea to a Working System … clear
building, no surprises". That is a story about something being *made*, so the
scene makes it. The whole seven-tier blueprint stands from the first frame, and
each tier turns from drawing into structure as its stage takes the frame. You
are always at the frontier: finished, lit structure below you, drawing above.
The camera climbs it.

**This replaced a corridor of rings the camera flew through.** Flying past
seven near-identical gates showed the *count* of the stages and nothing else —
stage two and stage six looked the same, and the screen at the end of the page
looked like the screen at the start. Nothing was ever built. Ascent also keeps
this page distinct from the other three: home converges, about rotates, contact
barely moves.

**`beat()` latching is the whole mechanism here.** Everywhere else in this
codebase a one-sided ramp is the bug that parks a camera forever. A build wants
exactly that: a stage that is finished does not un-finish as you scroll past
it, so `buildOf()` is deliberately one-sided and the structure below you stays
standing. Summing all seven gives a continuous 0→7 frontier that drives the
tiers, the spine's live height, and the camera in one value — they cannot drift
apart because they are the same number.

Three things that were wrong on the first pass, all of them about a scene
competing with its own page rather than about the geometry:

- **The cold open was gated on scroll and the hero rendered black.** Fading the
  blueprint up over the first 5% threw away the one image that makes the page's
  argument — the shape of the finished thing, drawn, before any of it exists.
  The plan is up from the first frame; the damp from zero is the entrance.
- **The ground grid became the loudest thing on the page.** The camera looks
  along the ground for most of the climb, so any grid with reach fills the
  lower half of the frame. It is a reference for the ascent, not scenery:
  faint, and faded out by radius 15.
- **The close is centred copy with pills and buttons**, so the rig steps out of
  the middle rather than standing behind it, and the seven tier captions fade.
  Aiming left of the axis is what puts the axis right of frame — and since
  `lookAt` hasn't run yet, the camera's right vector has to come from the orbit
  angle: looking inward from angle `a`, right is `(sin a, 0, −cos a)`.

Tier captions stand opposite their own copy column, by the same rule the about
callouts follow — tier `i` is beat `i + 1`, so odd beats put their copy right.

The modules are the one part of the rig that is *lit* rather than drawn. A flat
basic material made them read as cardboard pinned to the frame; they are the
solid thing the drawing turns into, so they get a real material and a key
light. Emissive stays low for the same reason it does on the about skyline.

## About: three acts, not one spinning globe

A sphere turning for eleven straight beats is one idea stretched too thin, so
the page changes what it's doing as you go:

1. **Arrival** — the globe tilts up out of frame bottom and the dotted surface
   resolves.
2. **Values** — five satellites ride a tilted orbit outside the globe, one per
   value. The active one swings forward, scales up and brightens while the
   others recede. The globe's dots, graticule and atmosphere all tint to that
   value's colour.
3. **Locations** — the globe settles with the region facing camera and two
   **city skylines rise out of the surface** at Amman and Riyadh, with the
   route arc pulsing between them.

The skylines are eighteen towers each on deterministic footprints, oriented by
a quaternion from `(0,1,0)` to the surface normal so "up" for a building is the
globe's normal. They scale on **Y only**, so the cities grow out of the ground
rather than ballooning into existence.

### What makes a box read as a building

The first version was boxes with an emissive tint, and they read as exactly
that — coloured slabs. Three things fixed it, and only one of them is geometry:

**The window grid is a physical size, not a UV fraction.** `BoxGeometry` gives
every face UV 0→1 regardless of how big the face is, so a UV-space grid puts
the same window count on a squat block and a 30-storey tower — which destroys
the sense of scale instead of creating it. The facade shader derives its
coordinates from *local position* instead (`aDim` carries each section's own
dimensions), so `WINDOW_PITCH` is a floor height every tower shares. That
shared floor height is what tells you how big the cluster is.

**The body has to stay nearly black.** The two accents differ a lot in
luminance, so any body tint bright enough to see washed one city into plastic
while the other looked right. The windows carry the colour; concrete at night
is close to black, and that reads the same whatever the accent.

On the paper ground this is unchanged and still correct — the cities read as
dark clusters standing on a bright globe, which is what a night skyline against
a lit sky looks like. The one thing that had to flip is the beacons: a white
warning light is invisible on paper, so they are dark points instead.

**A beacon is a point, not a sphere.** At radius 0.0034 the warning lights were
balls on sticks. Bloom is what gives a light its size on screen, so the mesh
wants to be small (0.0015) and bright, with its blink floored well above zero —
a beacon that spends most of its cycle dim reads as a grey bead.

Silhouette does the rest: setbacks that restart the window grid at their own
base, masts on the tall ones, and low blocks at the edges so the cluster meets
the ground instead of ending in a cliff. Deriving the facade from position also
means the window pattern is seeded per building (`aSeed`), so no two towers
light the same rooms, and it survives the Y-only rise — the grid squashes with
the tower as it grows.

The marker dot fades out on approach. It exists to find the city from orbit; at
street level it is a solid ball three towers wide parked in the middle of
downtown. It fades on the **material**, not the group, because the group scale
also carries the city callout, which is still wanted.

### The city callout

`AMMAN` and `RIYADH` used to sit straight up at 0.62, directly over the
roofline, and the street-level camera cropped them off the top of frame every
time. They are now callouts standing off to one side at skyline height, with a
leader line back to a node on the tallest tower.

**Which way is "right" is only knowable at render time.** The marker is a child
of the spinning globe, so the offset is rebuilt each frame from the camera's
own right vector, brought into the marker's frame and flattened onto the local
ground plane — without the flatten, the callout rides the camera's roll up and
down instead of holding its height beside the city.

**The label holds a constant screen size, not a constant world size.** No
single world size works: the camera is ~1 unit from the city at street level
and ~5.4 out at orbit, so text big enough to read from orbit is wider than the
whole frame up close — which is the only reason the old label could survive
centred over the skyline. Scaling by camera distance makes it an annotation
rather than an object. The scale divides out the *globe's* scale but never the
reveal's, so the reveal still shrinks the callout away to nothing, which is
what hides it.

**Each callout stands opposite its own copy column.** `<StoryOverlay>`
alternates the text by beat index — amman is odd so its copy sits right, riyadh
is even so its copy sits left — and a callout on the same side lands straight
on the headline. They both stand down for the `close` beat, which is centred
copy over the whole globe and already names both offices in its own text.

The leader line is module scope rather than `useMemo`, keyed per city: its
three vertices are rewritten every frame, and a memoised value is not allowed
to be mutated after render. Binding it to a local in the render body trips the
same rule, so the frame loop fetches it from the table by key.

**Set hidden initial state in JSX, not in the frame loop.** The skylines and
markers first shipped at the default scale of 1 and damped *down* toward zero,
which meant both were briefly full-size on load and during every beat before
the finale. They now mount at `scale={[0.35, 0.001, 0.35]}` and grow.

The satellites live outside `<Globe>` so their orbit doesn't inherit the
planet's spin.

## The About globe

`about-scene.tsx` builds the sphere procedurally — no texture, no model:

- **Surface** — 1,400 points on a Fibonacci sphere. Deterministic, so no RNG
  and identical on server and client.
- **Structure** — latitude rings and meridians every 30°.
- **Occluder** — an opaque sphere at `0.97R` under the surface. Without it the
  far-side dots show through and the globe flattens into a disc.
- **Markers** — Amman (31.95°N, 35.93°E) and Riyadh (24.71°N, 46.68°E) at their
  real coordinates, with a lifted great-circle arc between them.
- **Rotation** — spins two full turns through the story, then settles with the
  region facing the camera via `faceLon()`.
- **Colour** — the active value tints dots, graticule and atmosphere. A sphere
  has no facets to light, so colour is what gives each value its own moment.

Deliberately uniform dots rather than fabricated coastlines: inventing
continent shapes for a real company's site would be worse than an honest
abstraction. Swap in a land mask if you want real geography.

**Billboard anything parented to a rotating object.** The city labels are
children of the globe, so they turned with it and rendered back-to-front —
"AMMAN" came out mirrored once the sphere settled. `<Billboard>` fixes it.

## Three geometry traps worth knowing

Each cost real debugging time and none are obvious from the API:

1. **`CylinderGeometry` makes only three material groups** — side, top cap,
   bottom cap — *not* one per radial segment. Assigning `material-0…4` to
   "light the active facet" silently lit a cap while the visible face stayed
   black. The About prism uses separate plates instead.
2. **`<line>` in JSX resolves to the SVG element**, not R3F's. Build a
   `THREE.Line` and mount it with `<primitive object={...} />`.
3. **Anything ring-shaped around the camera must fit inside the frustum at
   reading distance.** The corridor this page used to be put its gates at
   radius 3.1 with fov 58, which sat entirely off-screen: it rendered
   perfectly and was invisible.

Plus: `beat()` clamps to 1 and stays there, so any one-sided ramp parks a
camera forever. Releases need `beat(a,b) * (1 - beat(c,d))`.

## Known gaps

- **Mobile is unverified**, on every page. The scenes are responsive in
  principle but have not been checked on a real narrow viewport or a mid-range
  phone GPU; consider lowering `dpr` below a width threshold. Home's field is
  twelve thousand points — that is the first thing to cut.
- The ten module scenes are hand-authored geometry. Adding an eleventh module
  means writing its scene; without one it falls back to its cluster on the
  ring, which is plain rather than broken.
- **The Arabic dictionary is machine-translated** and has not had a native
  speaker's pass. It is complete and structurally correct — 796 keys, same
  shape as English — but the register of marketing copy is exactly the thing
  that survives translation worst. Read it before launch.
- The contact API (`src/app/api/contact/route.ts`) is still a stub: it
  validates, honeypots, and logs. It delivers nothing.
- No OG image or analytics.
- **`.story--bold` is dead CSS.** This file documents a `<StoryPage bold>`
  variant for the services page, and the rules for it exist in `globals.css`,
  but no page passes the prop and `StoryPage` never accepted one. Services is
  running the default weight against a scene of thin bright lines, which is the
  case the variant was written for. Either wire it or delete the rules.
