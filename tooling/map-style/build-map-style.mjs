#!/usr/bin/env node
// Builds the warm-dark Mapbox style from Mapbox dark-v11 plus our tokens.
//
//   node tooling/map-style/build-map-style.mjs           write mights-dark.json, print the report
//   node tooling/map-style/build-map-style.mjs --check   exit 1 if the committed JSON is stale
//
// Input: source/dark-v11.json, a snapshot of GET styles/v1/mapbox/dark-v11
// (fetched 2026-10-07). Output keeps dark-v11's sources, sprite and glyphs, so
// tiles, fonts and attribution are unchanged; only paint and visibility move.
// The live maps keep using mapbox/dark-v11 until this file is uploaded to the
// Mapbox account (docs/adr/0003-explore-map-style-and-markers.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette, semantic } from '../../packages/theme/tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, 'source/dark-v11.json');
const OUT = join(here, 'mights-dark.json');

// ---- colour maths (WCAG 2.x relative luminance) ------------------------------

function parse(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const hsl = /^hsla?\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%/i.exec(color);
  if (hsl) {
    const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100];
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  }
  throw new Error(`Unparsed colour ${color}`);
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** `top` over `bottom` at `alpha`, or a straight mix from `bottom` toward `top`. */
const mix = (bottom, top, alpha) => toHex(parse(bottom).map((b, i) => b + (parse(top)[i] - b) * alpha));
const lum = (color) => {
  const [r, g, b] = parse(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---- token palette for the map ------------------------------------------------

const t = {
  ground: semantic.surface.dark,
  landuse: semantic.paper.dark,
  building: semantic['surface-raised'].dark,
  buildingEdge: semantic.border.dark,
  minorRoad: semantic.border.dark,
  // Avenues sit a quarter of the way from border to border-strong. border-strong
  // itself would drop a gold pin on an avenue to 3.32:1; this keeps it above 5.
  majorRoad: mix(semantic.border.dark, semantic['border-strong'].dark, 0.25),
  water: palette.mights.night,
  // Parks: verdigris at 10% over the ground, the only hue the map keeps
  // besides our gold pins.
  park: mix(semantic.surface.dark, semantic.verdigris.dark, 0.1),
  label: semantic['text-muted'].dark,
  halo: semantic.surface.dark,
  pin: semantic.primary.dark,
};

const MAJOR = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link'];
const GREEN = ['park', 'grass', 'wood', 'scrub', 'pitch'];
const HIDE = ['poi-label', 'airport-label', 'natural-point-label'];
const LABELS = [
  'road-label-simple', 'waterway-label', 'natural-line-label', 'water-line-label', 'water-point-label',
  'settlement-subdivision-label', 'settlement-minor-label', 'settlement-major-label',
  'state-label', 'country-label', 'continent-label',
];

// ---- build --------------------------------------------------------------------

const source = JSON.parse(readFileSync(SOURCE, 'utf8'));
const style = structuredClone(source);
const layer = (id) => {
  const l = style.layers.find((x) => x.id === id);
  if (!l) throw new Error(`dark-v11 has no layer ${id}; re-check the snapshot`);
  return l;
};
const paint = (id, key, value) => ((layer(id).paint ??= {})[key] = value);

paint('land', 'background-color', t.ground);
paint('land-structure-polygon', 'fill-color', t.ground);
paint('land-structure-line', 'line-color', t.ground);
paint('landuse', 'fill-color', ['match', ['get', 'class'], GREEN, t.park, t.landuse]);
paint('national-park', 'fill-color', t.park);
paint('water', 'fill-color', t.water);
paint('waterway', 'line-color', t.water);
paint('aeroway-polygon', 'fill-color', t.minorRoad);
paint('aeroway-line', 'line-color', t.minorRoad);
paint('building', 'fill-color', t.building);
paint('building', 'fill-outline-color', t.buildingEdge);
for (const l of style.layers) {
  if (l.type !== 'line' || !/^(road|bridge|tunnel)-/.test(l.id)) continue;
  // *-simple carries every street class in one layer; dark-v11 only varies
  // line-width by class, so line-color needs its own match to split avenues out.
  if (/-simple$/.test(l.id) && l.id !== 'bridge-case-simple')
    paint(l.id, 'line-color', ['match', ['get', 'class'], MAJOR, t.majorRoad, t.minorRoad]);
  else if (l.id === 'bridge-case-simple') paint(l.id, 'line-color', t.ground);
  else paint(l.id, 'line-color', t.minorRoad);
}
for (const l of style.layers) if (/^admin-/.test(l.id)) paint(l.id, 'line-color', /-bg$/.test(l.id) ? t.ground : t.buildingEdge);
for (const id of LABELS) {
  paint(id, 'text-color', t.label);
  paint(id, 'text-halo-color', t.halo);
  paint(id, 'text-halo-width', 1.5);
}
for (const id of HIDE) (layer(id).layout ??= {}).visibility = 'none';

style.name = 'Harlem Might dark';
for (const k of ['created', 'modified', 'owner', 'id', 'draft']) delete style[k];

const json = `${JSON.stringify(style, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== json) {
    console.error('mights-dark.json is stale: run node tooling/map-style/build-map-style.mjs');
    process.exit(1);
  }
  console.log('mights-dark.json is up to date');
  process.exit(0);
}
writeFileSync(OUT, json);

// ---- report ---------------------------------------------------------------------

// dark-v11 values at street zoom (z15-17), read from the snapshot's paint.
const v11 = (id, key) => {
  const v = source.layers.find((x) => x.id === id).paint[key];
  return typeof v === 'string' ? v : v.at(-1); // interpolate/step: last stop
};
const base = {
  ground: v11('land', 'background-color'),
  landuse: v11('landuse', 'fill-color'),
  building: v11('building', 'fill-color'),
  minorRoad: v11('road-simple', 'line-color'),
  majorRoad: v11('road-simple', 'line-color'),
  water: v11('water', 'fill-color'),
  park: v11('landuse', 'fill-color'),
  label: v11('road-label-simple', 'text-color'),
  halo: v11('road-label-simple', 'text-halo-color'),
  poi: v11('poi-label', 'text-color'),
  pin: t.pin,
};
const rows = [
  ['Road label on its halo', (s) => ratio(s.label, s.halo), 4.5],
  ['Road label on avenue fill (halo antialiased away)', (s) => ratio(s.label, s.majorRoad), 4.5],
  ['Road label on ground', (s) => ratio(s.label, s.ground), 4.5],
  ['POI label on ground', (s) => (s.poi ? ratio(s.poi, s.ground) : null), 4.5],
  ['Gold pin on ground', (s) => ratio(s.pin, s.ground), 3],
  ['Gold pin on avenue', (s) => ratio(s.pin, s.majorRoad), 3],
  ['Gold pin on street', (s) => ratio(s.pin, s.minorRoad), 3],
  ['Gold pin on building', (s) => ratio(s.pin, s.building), 3],
  ['Gold pin on water', (s) => ratio(s.pin, s.water), 3],
  ['Gold pin on park', (s) => ratio(s.pin, s.park), 3],
  ['Avenue vs ground (road legibility)', (s) => ratio(s.majorRoad, s.ground), null],
];
const fmt = (n) => (n == null ? 'hidden' : `${n.toFixed(2)}:1`);
console.log('| Pair | dark-v11 | Harlem Might dark | Floor |');
console.log('|---|---|---|---|');
for (const [name, f, floor] of rows) console.log(`| ${name} | ${fmt(f(base))} | ${fmt(f(t))} | ${floor ? `${floor}:1` : '—'} |`);
console.log();
console.log('| Colour | dark-v11 | Harlem Might dark |');
console.log('|---|---|---|');
for (const k of ['ground', 'building', 'minorRoad', 'majorRoad', 'water', 'park', 'label', 'halo']) console.log(`| ${k} | ${toHex(parse(base[k]))} | ${t[k]} |`);
const size = (s) => {
  const min = JSON.stringify(s);
  return `${(min.length / 1024).toFixed(1)} KB raw, ${(gzipSync(min, { level: 9 }).length / 1024).toFixed(1)} KB gzip`;
};
console.log();
console.log(`dark-v11 style: ${size(source)}, ${source.layers.length} layers`);
console.log(`Harlem Might dark style: ${size(style)}, ${style.layers.length} layers, ${HIDE.length} hidden`);
