// Generates the PWA icons in public/ (committed): a white house on the app's primary colour.
//   node scripts/generate-pwa-icons.ts
// Dependency-free on purpose: shapes are rasterised here (4x4 supersampling) and written as PNG with zlib.
// Replace with real artwork later (Phase 5 polish); keep the file names, they are referenced in nuxt.config.ts.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --primary in app/assets/css/tailwind.css: oklch(0.205 0 0) ≈ #171717.
const BACKGROUND = [0x17, 0x17, 0x17];
const FOREGROUND = [0xff, 0xff, 0xff];
const SAMPLES = 4;

type Point = [number, number];

interface IconSpec {
	file: string;
	size: number;
	// Share of the icon (0..1) the house spans. Maskable icons keep it inside the 80% safe zone.
	glyph: number;
}

const ICONS: IconSpec[] = [
	{
		file: 'pwa-192x192.png',
		size: 192,
		glyph: 0.6,
	},
	{
		file: 'pwa-512x512.png',
		size: 512,
		glyph: 0.6,
	},
	{
		file: 'maskable-icon-512x512.png',
		size: 512,
		glyph: 0.46,
	},
	{
		file: 'apple-touch-icon-180x180.png',
		size: 180,
		glyph: 0.56,
	},
];

// House in a unit square (0..1): roof triangle, body, and a door cut out of the body.
const ROOF: Point[] = [
	[0.5, 0],
	[1, 0.45],
	[0, 0.45],
];
const BODY = {
	x0: 0.14,
	y0: 0.4,
	x1: 0.86,
	y1: 1,
};
const DOOR = {
	x0: 0.4,
	y0: 0.62,
	x1: 0.6,
	y1: 1,
};

function inTriangle([px, py]: Point, [a, b, c]: Point[]): boolean {
	const side = (p: Point, q: Point) => (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0]);
	const d1 = side(a!, b!);
	const d2 = side(b!, c!);
	const d3 = side(c!, a!);
	const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNegative && hasPositive);
}

function inRect([px, py]: Point, r: typeof BODY): boolean {
	return px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1;
}

function inHouse(p: Point): boolean {
	if (inRect(p, DOOR)) {
		return false;
	}
	return inTriangle(p, ROOF) || inRect(p, BODY);
}

function render({ size, glyph }: IconSpec): Buffer {
	const offset = (1 - glyph) / 2;
	const stride = size * 3 + 1;
	const raw = Buffer.alloc(stride * size);
	for (let y = 0; y < size; y++) {
		raw[y * stride] = 0; // PNG filter type: none
		for (let x = 0; x < size; x++) {
			let hits = 0;
			for (let sy = 0; sy < SAMPLES; sy++) {
				for (let sx = 0; sx < SAMPLES; sx++) {
					const u = ((x + (sx + 0.5) / SAMPLES) / size - offset) / glyph;
					const v = ((y + (sy + 0.5) / SAMPLES) / size - offset) / glyph;
					if (inHouse([u, v])) {
						hits++;
					}
				}
			}
			const coverage = hits / (SAMPLES * SAMPLES);
			for (let channel = 0; channel < 3; channel++) {
				const value = BACKGROUND[channel]! + (FOREGROUND[channel]! - BACKGROUND[channel]!) * coverage;
				raw[y * stride + 1 + x * 3 + channel] = Math.round(value);
			}
		}
	}
	return encodePng(size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(data: Buffer): number {
	let c = 0xffffffff;
	for (const byte of data) {
		c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function encodePng(size: number, raw: Buffer): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // colour type: RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

for (const icon of ICONS) {
	writeFileSync(resolve(root, 'public', icon.file), render(icon));
	console.log(`public/${icon.file}`);
}
