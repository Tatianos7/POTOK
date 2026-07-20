/* eslint-env node */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createGithubPagesFallback } from './create-github-pages-fallback.mjs';

function withTempProject(callback) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'potok-pages-fallback-'));

  try {
    return callback(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

test('fails when dist/index.html is missing', () => {
  withTempProject((projectRoot) => {
    assert.throws(
      () => createGithubPagesFallback({ projectRoot }),
      /fallback source missing/,
    );
  });
});

test('copies dist/index.html to dist/404.html', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const indexPath = join(distDir, 'index.html');
    const fallbackPath = join(distDir, '404.html');
    const html = '<script type="module" src="/POTOK/assets/main.js"></script>';

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(indexPath, html, { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(readFileSync(fallbackPath, 'utf8'), html);
  });
});

test('does not modify other dist files', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const indexPath = join(distDir, 'index.html');
    const assetPath = join(distDir, 'assets.txt');
    const assetContent = 'asset sentinel';

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(indexPath, '<div id="root"></div>', { flag: 'wx' });
    writeFileSync(assetPath, assetContent, { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(readFileSync(assetPath, 'utf8'), assetContent);
  });
});

test('writes only inside dist', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const indexPath = join(distDir, 'index.html');
    const outsidePath = join(projectRoot, '404.html');

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(indexPath, '<div id="root"></div>', { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(existsSync(outsidePath), false);
    assert.equal(existsSync(join(distDir, '404.html')), true);
  });
});

test('preserves production asset base in copied fallback', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const indexPath = join(distDir, 'index.html');
    const html = '<script type="module" src="/POTOK/assets/main.js"></script>';

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    writeFileSync(indexPath, html, { flag: 'wx' });

    const { fallbackPath } = createGithubPagesFallback({ projectRoot });

    assert.match(readFileSync(fallbackPath, 'utf8'), /\/POTOK\/assets\//);
  });
});
