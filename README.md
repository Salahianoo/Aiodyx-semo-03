# Eight apps, one system

A four-page scroll-driven 3D site for AIODYX. Each page gets its **own** spatial
metaphor — repeating one motion three times would read as a template, not a
story.

| Page | Metaphor | Motion |
|---|---|---|
| `/` | Eight Odoo apps assembling into a wired ring | Convergence + orbit |
| `/services` | A system building itself, tier by tier | Ascent |
| `/about` | A dotted globe that settles on the region | Rotation |
| `/contact` | Amman ↔ Riyadh, an arc and a slow pulse | Almost still |

Copy on every page comes from the live AIODYX dictionary (`src/content/en.json`),
read through `src/lib/content.ts` — nothing is invented here.

## Why contact barely moves

A contact form is a functional surface people use deliberately: reading labels,
typing, checking what they typed. Motion competing with that is decoration that
costs comprehension. So `/contact` has no scroll choreography, bloom is switched
off entirely, and the panels are solid rather than glass — a translucent panel
over a moving scene is the classic legibility trap. The scene sits in the one
region the layout leaves empty, upper-right.

That restraint is the design decision, not an omission.

---

The home story: your Odoo apps — Sales, Purchases, Inventory, Manufacturing,
Accounting, CRM, HR, Projects — start as scattered islands and assemble into one
wired system as you scroll.

```bash
npm run dev     # PORT=3001 npm run dev if 3000 is taken
npm run build
npm run lint
```

## No AI video, and no asset pipeline

Everything on screen is generated in code. There is no `.glb`, no image
sequence, no rendered frames, no external texture.

That was deliberate. Scroll-driven means **the visitor owns the timeline**, so
the visual has to be scrubbable in both directions at arbitrary speed. AI video
generators produce a fixed clip that is temporally unstable — the "Inventory"
panel would morph and flicker between frames, which destroys the entire premise
that these are the *same eight modules* throughout. Real-time WebGL is
scrubbable, resolution-independent, relabelable without re-rendering, and ships
in ~150KB rather than tens of megabytes of frames.

## Stack

| | |
|---|---|
| `three` + `@react-three/fiber` | real-time scene |
| `@react-three/drei` | `RoundedBox`, `Text`, `AdaptiveDpr` |
| `@react-three/postprocessing` | bloom on the wiring |
| `lenis` | smooth scroll |
| `next` 16.3 / React 19 | app shell |

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

## The eight beats

Ranges are 0 → 1 across the document, defined in `src/lib/story.ts`.

| Range | Beat | Scene |
|---|---|---|
| .00–.10 | Cold open | black, one panel |
| .12–.24 | Eight islands | scatter revealed |
| .26–.36 | The gap | camera drifts between them |
| .38–.50 | The wiring | modules converge (.36–.54), lines draw (.44–.60) |
| .52–.64 | One system | ring seated and lit |
| .66–.76 | Sales, in focus | camera dives, others dim |
| .78–.88 | One order travels | pulse runs the chain |
| .90–1.0 | CTA | pull out, ring recedes |

Convergence deliberately runs *under* the wiring beat so the "eight become one
system" line lands on a finished image rather than describing something still
in motion.

## Copy layer

DOM text, not 3D text — it's selectable, translatable and readable before (and
without) WebGL. Visibility is toggled by `IntersectionObserver` on the middle
third of the viewport, so a handful of events fire for the whole page instead of
one per frame. The fade itself is a CSS transition on `opacity`/`transform`/
`filter` only.

The `.beat__inner::before` scrim is doing real work — the copy sits over lit,
saturated panels and needs a dense pool of ground to win the contrast fight.

## Accessibility

`prefers-reduced-motion` is honoured throughout, and it means *gentler*, not
*off*:

- Lenis smooth scrolling disabled entirely (native scroll instead)
- Module drift, core rotation, halo breathing and pointer parallax all stop
- Copy keeps its fade, loses the travel and blur
- The scene still renders and still tells the story via scroll position

## Content

All copy is the real AIODYX dictionary (`src/content/en.json`), read via
`src/lib/content.ts`. The home story now carries the actual home-page content:

- 7 problem cards (title + description) across two beats
- **all 10 real modules** — Finance & Accounting, CRM & Sales, Inventory &
  Procurement, HR, Attendance & Payroll, Projects & Tasks, Manufacturing,
  Customer Support, Business Intelligence, AI Automation
- one screen per module, with its description and all 5 features
- the AI assistant section, and 6 "why AIODYX" cards

**The 3D cards carry their own copy.** Each card renders its real name, and the
focused card also renders its description. Only the focused card's description
is populated — an empty troika `Text` generates no glyphs, so the other nine
cost nothing.

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
read as a black smudge drifting across the scene, swallowing the 3D cards
behind it. A tight `text-shadow` does the same work only where it's needed.

Anything with its own box — feature pills, content cards — is filled rather
than outlined. A transparent pill over a lit 3D card is unreadable whatever
colour the text is.

## The bold variant

`<StoryPage bold>` adds `.story--bold` to the copy layer. Services uses it.

Its scene is thin bright lines on black, so the default weight left the copy
floating and weak against the rig. Bold pushes the title to **800 / 92px**
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
luminance — Amman's lavender against Riyadh's teal — so any body tint bright
enough to see washed one city into plastic while the other looked right. The
windows carry the colour; concrete at night is close to black, and that reads
the same whatever the accent.

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

- **Mobile is unverified.** The scene is responsive in principle but has not
  been checked on a real narrow viewport or a mid-range phone GPU. Consider
  dropping bloom and lowering `dpr` below a width threshold.
- **Beat 6 doesn't render module internals.** The copy says "Sales, in focus"
  rather than "from the inside" for exactly that reason. Adding a few interior
  rows to the focused panel would let the stronger line come back.
- **CTAs point at `#top`** — wire them to a real destination.
- No favicon, OG image, or analytics.
- The chain pulse (beat 7) travels all eight spokes, not only
  Sales → Purchases → Inventory. Restricting it per-spoke needs a per-line
  index attribute in the shader.
#   A i o d y x - s e m o - 0 3  
 