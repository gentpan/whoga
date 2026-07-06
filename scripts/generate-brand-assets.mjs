#!/usr/bin/env node
/**
 * Generate Whoga logo SVG (superellipse frame + original W mark) and raster favicon set.
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

// Original potrace W only (inner path from logo.svg, without the outer rounded-rect frame).
const W_PATH = `M1566 3949 c84 -26 144 -81 189 -172 49 -100 65 -173 72 -313 10 -210 -16 -382 -146 -960 -75 -337 -97 -474 -88 -562 6 -74 23 -108 59 -123 25 -10 35 -9 66 5 104 50 212 163 347 366 101 153 160 260 219 406 l45 111 -10 157 c-17 253 6 502 62 676 60 184 170 313 292 340 45 11 62 10 112 -5 49 -14 70 -28 125 -83 104 -106 146 -215 157 -403 13 -229 -59 -497 -197 -741 l-50 -88 0 -112 c1 -191 28 -334 91 -464 101 -213 241 -227 416 -42 136 144 253 415 298 688 39 234 12 621 -65 933 -32 132 -30 156 19 224 41 57 106 107 187 145 58 27 81 32 144 33 133 0 223 -64 291 -209 56 -120 79 -244 86 -467 15 -480 -77 -921 -278 -1321 -216 -430 -535 -737 -836 -804 -100 -22 -245 -15 -325 15 -103 40 -201 130 -277 256 -67 110 -140 344 -171 544 l-13 83 -76 -154 c-195 -396 -431 -644 -696 -734 -105 -35 -231 -37 -317 -4 -123 46 -234 159 -291 295 -41 98 -57 199 -57 357 0 202 24 354 130 837 89 408 112 581 90 685 -18 89 -59 118 -139 96 -56 -15 -123 -81 -146 -145 -10 -27 -19 -51 -20 -53 -1 -1 -10 0 -19 4 -21 8 -21 80 -1 200 31 176 97 309 198 400 80 72 158 106 297 128 45 7 164 -6 226 -25z`;

const W_TRANSFORM = "translate(-0.500000,511.863300) scale(0.100000,-0.100000)";

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

const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#1A1A1C" d="${squircle}"/>
  <g transform="${W_TRANSFORM}">
    <path fill="#22C55E" d="${W_PATH}"/>
  </g>
</svg>
`;

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#22C55E" d="${squircle}"/>
  <g transform="${W_TRANSFORM}">
    <path fill="#1A1A1C" d="${W_PATH}"/>
  </g>
</svg>
`;

const maskSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Whoga">
  <title>Whoga</title>
  <path fill="#000000" d="${squircle}"/>
  <g transform="${W_TRANSFORM}">
    <path fill="#000000" d="${W_PATH}"/>
  </g>
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
  `magick "${join(publicDir, "favicon-16x16.png")}" "${join(publicDir, "favicon-32x32.png")}" "${join(publicDir, "favicon.ico")}"`
);

console.log("Generated logo.svg, logo-mark.svg, logo-mask.svg, and favicon set in public/");
