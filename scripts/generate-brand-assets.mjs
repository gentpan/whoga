#!/usr/bin/env node
/**
 * Generate Whoga logo SVG (superellipse + geometric W) and raster favicon set.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 236;
const N = 4.8;

function superellipsePath(cx, cy, a, b, n, steps = 72) {
  const parts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + a * Math.sign(cos) * Math.abs(cos) ** (2 / n);
    const y = cy + b * Math.sign(sin) * Math.abs(sin) ** (2 / n);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

const squircle = superellipsePath(CX, CY, RADIUS, RADIUS, N);

const wStroke =
  "M 116 360 L 176 152 L 236 272 L 256 184 L 276 272 L 336 152 L 396 360";

const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#1A1A1C" d="${squircle}"/>
  <path
    fill="none"
    stroke="#22C55E"
    stroke-width="52"
    stroke-linecap="square"
    stroke-linejoin="miter"
    d="${wStroke}"
  />
</svg>
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#22C55E" d="${squircle}"/>
  <path
    fill="none"
    stroke="#1A1A1C"
    stroke-width="52"
    stroke-linecap="square"
    stroke-linejoin="miter"
    d="${wStroke}"
  />
</svg>
`;

const maskSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#000000" d="${squircle}"/>
  <path
    fill="none"
    stroke="#000000"
    stroke-width="52"
    stroke-linecap="square"
    stroke-linejoin="miter"
    d="${wStroke}"
  />
</svg>
`;

writeFileSync(join(publicDir, "logo.svg"), logoSvg, "utf8");
writeFileSync(join(publicDir, "logo-mark.svg"), markSvg, "utf8");
writeFileSync(join(publicDir, "logo-mask.svg"), maskSvg, "utf8");

const sizes = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512]
];

for (const [name, px] of sizes) {
  const out = join(publicDir, name);
  execSync(`rsvg-convert -w ${px} -h ${px} "${join(publicDir, "logo.svg")}" -o "${out}"`);
}

execSync(
  `convert "${join(publicDir, "favicon-16x16.png")}" "${join(publicDir, "favicon-32x32.png")}" "${join(publicDir, "favicon.ico")}"`
);

console.log("Generated logo.svg, logo-mark.svg, logo-mask.svg, and favicon set in public/");
