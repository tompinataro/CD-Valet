import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileRoot = join(repoRoot, 'mobile');
const exportDir = join(mobileRoot, 'dist-gh-pages');
const docsDir = join(repoRoot, 'docs');
const basePath = '/CD-Valet';

if (!existsSync(exportDir)) {
  throw new Error(`Missing web export at ${exportDir}. Run npm run export:gh-pages from mobile/.`);
}

mkdirSync(docsDir, { recursive: true });

for (const entry of readdirSync(exportDir)) {
  cpSync(join(exportDir, entry), join(docsDir, entry), { recursive: true });
}

function patchFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  content = content
    .replaceAll('href="/favicon.ico"', `href="${basePath}/favicon.ico"`)
    .replaceAll('src="/_expo/', `src="${basePath}/_expo/`)
    .replaceAll('"/_expo/', `"${basePath}/_expo/`)
    .replaceAll('"/assets/', `"${basePath}/assets/`);
  writeFileSync(filePath, content);
}

patchFile(join(docsDir, 'index.html'));

function patchGeneratedJs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      patchGeneratedJs(path);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      patchFile(path);
    }
  }
}

patchGeneratedJs(join(docsDir, '_expo'));
cpSync(join(docsDir, 'index.html'), join(docsDir, '404.html'));

console.log(`Prepared GitHub Pages web app in ${docsDir}`);
