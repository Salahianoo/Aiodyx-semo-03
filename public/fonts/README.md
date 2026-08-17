# Bundled fonts

## `ibm-plex-sans-arabic-600.ttf`

IBM Plex Sans Arabic, SemiBold. Copyright © 2017 IBM Corp., licensed under the
SIL Open Font License 1.1 — see `LICENSE.txt`, which the OFL requires to be
distributed alongside the font.

It is checked in rather than loaded from a CDN because **troika-three-text
parses the font file itself** to build an SDF atlas for the 3D labels. It
cannot use a `@font-face` the browser has already downloaded, and its built-in
face has no Arabic glyphs at all — without this, every ring label, tier caption
and city name on `/ar` renders as empty boxes.

The DOM's copy of the same family is loaded separately through `next/font`;
this file serves only the WebGL layer.
