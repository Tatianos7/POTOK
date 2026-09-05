import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

test('active search can render results as overlay dropdown above basket content', async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });

  const { default: ProductSearch } = await import('../ProductSearch');

  const html = renderToStaticMarkup(
    <ProductSearch
      onSelect={() => {}}
      onAddToBasket={() => {}}
      isInBasket={() => false}
      value="овсянка"
      onChangeQuery={() => {}}
      hideInput
      variant="overlay"
    />
  );

  assert.match(html, /data-search-results-variant="overlay"/);
  assert.match(html, /absolute left-0 right-0 top-full z-40/);
  assert.match(html, /max-h-\[340px\] overflow-y-auto overflow-x-hidden/);
});
