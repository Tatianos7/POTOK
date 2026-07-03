/* eslint-env node */

import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createGithubPagesFallback(options = {}) {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const distDir = resolve(projectRoot, options.distDir ?? 'dist');
  const indexPath = resolve(distDir, 'index.html');
  const fallbackPath = resolve(distDir, '404.html');

  if (!existsSync(indexPath)) {
    throw new Error(`GitHub Pages fallback source missing: ${indexPath}`);
  }

  const indexStats = statSync(indexPath);
  if (!indexStats.isFile()) {
    throw new Error(`GitHub Pages fallback source is not a file: ${indexPath}`);
  }

  mkdirSync(dirname(fallbackPath), { recursive: true });
  copyFileSync(indexPath, fallbackPath);

  return {
    indexPath,
    fallbackPath,
  };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  const result = createGithubPagesFallback();
  console.log(`Created GitHub Pages SPA fallback: ${result.fallbackPath}`);
}
