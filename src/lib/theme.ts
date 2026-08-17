/**
 * The palette — one ground, and everything that follows from it.
 *
 * This site is light-only. That is a real constraint on the scenes rather than
 * a colour choice, because the thing that makes a WebGL scene work on a dark
 * ground is `AdditiveBlending`: it *adds* its colour to whatever is behind it,
 * which is how a cloud of points reads as luminous. On paper that is a no-op —
 * white plus anything is still white — so every glowing material here is
 * normal-blended and drawn as ink instead, and the numbers below are the
 * corrections that come with that.
 *
 * Deliberately free of `three`: the scenes translate `blending` at the point
 * of use, and nothing else in the app should have to import a renderer to know
 * what colour something is.
 */

export type ScenePalette = {
  /**
   * Coverage, not accumulation.
   *
   * Under additive blending, alpha is how much light a point contributes and
   * overlapping points build into brightness. Under normal blending they just
   * sit on each other — so the alpha and size figures below are higher and
   * lower respectively than the same scene would want on black.
   */
  blending: "normal";
  /** The canvas ground. Occluders and text halos must match it exactly. */
  ground: string;
  /** Particle colour before the module hues take over. */
  base: string;
  /** Background dust. */
  dust: string;
  /** Halo behind 3D labels — the ground colour, so it reads as a knockout. */
  outline: string;
  /** Unlit structure: the services blueprint, the about graticule. */
  draft: string;
  /** Quieter still — plates, route lines, anything that must recede. */
  muted: string;
  /**
   * Multiplier on each page's bloom setting, and it is zero.
   *
   * Bloom is a luminance threshold effect. On a bright ground the whole frame
   * clears the threshold, so it stops picking out the glowing parts and just
   * lays milk over everything.
   */
  bloom: 0;
  /** Multiplier on particle alpha, correcting for the blending above. */
  alpha: number;
  /** Multiplier on point size. Ink marks read heavier than glowing ones. */
  size: number;
  /** Emissive strength for the one lit thing on services. */
  emissive: number;
};

export const SCENE: ScenePalette = {
  blending: "normal",
  // Not pure white. #fff leaves the particles nowhere to go at the light end
  // and every soft edge terminates hard; a hair of blue keeps the field
  // sitting *in* the page rather than punched through it. Must stay in step
  // with `--ink` in globals.css — the canvas is transparent and sits over it,
  // so any drift shows up as a seam.
  ground: "#F4F5F9",
  base: "#4C5BA8",
  dust: "#9AA0BF",
  outline: "#F4F5F9",
  draft: "#6F63C0",
  muted: "#B7BACB",
  bloom: 0,
  alpha: 1.35,
  size: 0.88,
  emissive: 0.1,
};

/**
 * The ten module hues, in ring order.
 *
 * Deeper and more saturated than the pastels a dark ground wants — those are
 * what a *light source* looks like, and printed as ink on paper the same
 * values come out as barely-tinted grey. These are picked to hold their
 * identity against #F4F5F9, since hue is the only thing telling one cluster
 * from another once the field opens out.
 */
export const MODULE_HUES: Record<string, string> = {
  finance: "#6D28D9",
  crm: "#0369A1",
  inventory: "#047857",
  hr: "#A21CAF",
  payroll: "#A16207",
  projects: "#1D4ED8",
  manufacturing: "#BE123C",
  support: "#5B21B6",
  bi: "#0F766E",
  ai: "#7E22CE",
};

/** The five about values, as the satellites and the globe tint. */
export const FACET_COLORS = [
  "#6D28D9",
  "#4338CA",
  "#0E63A8",
  "#0E7490",
  "#6023C8",
];

/** The seven build stages — a violet→cyan traverse as the rig rises. */
export const STATION_COLORS = [
  "#6D28D9",
  "#5B33CE",
  "#4141C9",
  "#1D53B8",
  "#0F65A6",
  "#0B7394",
  "#0F7D86",
];

/** The two cities, on about and on contact. */
export const CITY_COLORS = {
  amman: "#6D28D9",
  riyadh: "#0E7490",
};

/** The one accent that lights and glows are tinted with. */
export const ACCENT = "#6D28D9";

/**
 * What a highlight moves *toward*.
 *
 * On a dark ground emphasis means lifting toward white. Here it is the
 * opposite: a pulse that travels toward white on a white page disappears
 * exactly at its peak, so anything meant to read as "brighter" deepens
 * instead.
 */
export const PEAK = "#141620";
