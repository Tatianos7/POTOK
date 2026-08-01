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
    const publicDir = join(projectRoot, 'public');
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(publicDir, '404.html'), '<script></script>', { flag: 'wx' });

    assert.throws(
      () => createGithubPagesFallback({ projectRoot }),
      /fallback source missing/,
    );
  });
});

test('fails when public fallback template is missing', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<div id="root"></div>', { flag: 'wx' });

    assert.throws(
      () => createGithubPagesFallback({ projectRoot }),
      /fallback template missing/,
    );
  });
});

test('copies public redirect fallback template to dist/404.html', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const publicDir = join(projectRoot, 'public');
    const indexPath = join(distDir, 'index.html');
    const templatePath = join(publicDir, '404.html');
    const fallbackPath = join(distDir, '404.html');
    const indexHtml = '<script type="module" src="/POTOK/assets/main.js"></script>';
    const fallbackHtml = '<script>window.location.replace("/POTOK/?p=nutrition")</script>';

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(indexPath, indexHtml, { flag: 'wx' });
    writeFileSync(templatePath, fallbackHtml, { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(readFileSync(fallbackPath, 'utf8'), fallbackHtml);
  });
});

test('does not modify other dist files', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const publicDir = join(projectRoot, 'public');
    const indexPath = join(distDir, 'index.html');
    const assetPath = join(distDir, 'assets.txt');
    const assetContent = 'asset sentinel';

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(indexPath, '<div id="root"></div>', { flag: 'wx' });
    writeFileSync(join(publicDir, '404.html'), '<script></script>', { flag: 'wx' });
    writeFileSync(assetPath, assetContent, { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(readFileSync(assetPath, 'utf8'), assetContent);
  });
});

test('writes only inside dist', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const publicDir = join(projectRoot, 'public');
    const indexPath = join(distDir, 'index.html');
    const outsidePath = join(projectRoot, '404.html');

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(indexPath, '<div id="root"></div>', { flag: 'wx' });
    writeFileSync(join(publicDir, '404.html'), '<script></script>', { flag: 'wx' });

    createGithubPagesFallback({ projectRoot });

    assert.equal(existsSync(outsidePath), false);
    assert.equal(existsSync(join(distDir, '404.html')), true);
  });
});

test('writes redirect fallback with GitHub Pages route preservation', () => {
  withTempProject((projectRoot) => {
    const distDir = join(projectRoot, 'dist');
    const publicDir = join(projectRoot, 'public');
    const indexPath = join(distDir, 'index.html');
    const templatePath = join(publicDir, '404.html');
    const indexHtml = '<script type="module" src="/POTOK/assets/main.js"></script>';
    const fallbackHtml = [
      '<script>',
      "var repoBase = '/POTOK/';",
      "window.location.replace(repoBase + '?p=nutrition');",
      '</script>',
    ].join('');

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(indexPath, indexHtml, { flag: 'wx' });
    writeFileSync(templatePath, fallbackHtml, { flag: 'wx' });

    const { fallbackPath } = createGithubPagesFallback({ projectRoot });

    const fallback = readFileSync(fallbackPath, 'utf8');
    assert.match(fallback, /repoBase = '\/POTOK\/'/);
    assert.match(fallback, /\?p=/);
  });
});
