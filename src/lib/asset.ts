/**
 * Prefix a `public/` path with the base the site is served from.
 *
 * Next rewrites its own asset URLs for `basePath`, and rewrites `next/image`
 * sources too — but not an image marked `unoptimized`, which is passed through
 * verbatim, and not a URL we hand to a third-party loader like troika's font
 * fetch. Both of those are absolute paths written by hand, and on GitHub Pages
 * the site lives in a repository subdirectory, so both 404'd: the Odoo mark in
 * the trust line went missing, and every Arabic 3D label fell back to a font
 * with no Arabic glyphs in it.
 *
 * Empty in dev and on any host serving from a domain root, so this is a no-op
 * everywhere except the Pages build.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** `asset("/odoo-logo.svg")` → `/Aiodyx-semo-03/odoo-logo.svg` on Pages. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
