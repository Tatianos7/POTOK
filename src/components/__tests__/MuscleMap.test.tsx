import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import MuscleMap from '../muscle-map/MuscleMap';

test('MuscleMap renders front-only view for abs with front obliques', () => {
  const html = renderToStaticMarkup(
    <MuscleMap
      primaryMuscles={['abs']}
      secondaryMuscles={['obliques']}
      size="compact"
    />,
  );

  assert.match(html, /data-muscle-map-view="front"/);
  assert.doesNotMatch(html, /Вид сзади/);
});

test('MuscleMap renders front-only view for core with obliques', () => {
  const html = renderToStaticMarkup(
    <MuscleMap
      primaryMuscles={['core']}
      secondaryMuscles={['obliques']}
      size="compact"
    />,
  );

  assert.match(html, /data-muscle-map-view="front"/);
  assert.doesNotMatch(html, /Вид сзади/);
});

test('MuscleMap renders back view for back-only muscles', () => {
  const html = renderToStaticMarkup(
    <MuscleMap
      primaryMuscles={['lats']}
      size="compact"
    />,
  );

  assert.match(html, /data-muscle-map-view="back"/);
  assert.match(html, /Вид сзади/);
  assert.doesNotMatch(html, /Вид спереди/);
});

test('MuscleMap renders split view when front and back muscles coexist', () => {
  const html = renderToStaticMarkup(
    <MuscleMap
      primaryMuscles={['quads']}
      secondaryMuscles={['glutes']}
      size="compact"
    />,
  );

  assert.match(html, /data-muscle-map-view="split"/);
  assert.match(html, /Вид спереди/);
  assert.match(html, /Вид сзади/);
});
