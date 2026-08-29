import React, { type ReactElement } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import {
  catalogEmptyArray,
  catalogReadFailed,
  catalogSuccess,
  catalogUnavailable,
  createPremiumReadOnlyServiceFixture,
  type PremiumReadOnlyServiceMock,
} from './premiumReadOnlyFixtures';

export interface MountedAsyncRenderResult {
  container: HTMLElement;
  root: Root;
  cleanup: () => void;
  text: () => string;
}

export function createReadModeController(initialValue = false) {
  let enabled = initialValue;

  return {
    isEnabled: () => enabled,
    enable: () => {
      enabled = true;
    },
    disable: () => {
      enabled = false;
    },
    set: (nextValue: boolean) => {
      enabled = nextValue;
    },
  };
}

export function createMockPremiumCatalogService(overrides: Partial<PremiumReadOnlyServiceMock> = {}) {
  return createPremiumReadOnlyServiceFixture(overrides);
}

export async function flushPromises(cycles = 2): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

export async function renderMountedWithRouter(
  element: ReactElement,
  route = '/'
): Promise<MountedAsyncRenderResult> {
  if (typeof document === 'undefined') {
    throw new Error('mounted async test harness requires a DOM environment');
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: [route] }, element));
    await flushPromises();
  });

  return {
    container,
    root,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    text: () => container.textContent ?? '',
  };
}

export async function cleanupMounted(result: MountedAsyncRenderResult | null | undefined): Promise<void> {
  if (!result) return;

  await act(async () => {
    result.root.unmount();
    await flushPromises();
  });
  result.container.remove();
}

export const premiumCatalogMockResults = {
  success: catalogSuccess,
  unavailable: catalogUnavailable,
  readFailed: catalogReadFailed,
  emptyArray: catalogEmptyArray,
};
