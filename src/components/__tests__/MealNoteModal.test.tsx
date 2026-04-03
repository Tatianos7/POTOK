import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import MealNoteModal from '../MealNoteModal';

test('workout day note edit create textarea uses intended pale green translucent surface', () => {
  const html = renderToStaticMarkup(
    <MealNoteModal
      isOpen
      onClose={() => {}}
      onSave={() => {}}
      textareaVariant="paleGreen"
    />,
  );

  assert.match(html, /bg-emerald-50\/70/);
  assert.match(html, /border-emerald-100\/70/);
});
