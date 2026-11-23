// Generates types/database.types.ts from the local Supabase database.
//   node scripts/generate-database-types.ts          write the file
//   node scripts/generate-database-types.ts --check  fail if the committed file is out of date (used by CI)
// Requires the local stack (`npm run db:start`). Writes only on success, so a failed
// run never leaves an empty file behind.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'types/database.types.ts');
const check = process.argv.includes('--check');

let generated;
try {
	generated = execFileSync(
		'npx',
		['supabase', 'gen', 'types', 'typescript', '--schema', 'public'],
		{ cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
	);
} catch {
	console.error('Could not generate types. Is the local stack running? (npm run db:start)');
	process.exit(1);
}

const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
if (check) {
	if (current !== generated) {
		console.error(
			'types/database.types.ts is out of date. Run `npm run db:types` and commit the result.',
		);
		process.exit(1);
	}
	console.log('types/database.types.ts is up to date.');
} else {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, generated);
	console.log('Wrote types/database.types.ts');
}
