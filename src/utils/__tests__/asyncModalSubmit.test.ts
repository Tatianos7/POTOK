import test from 'node:test';
import assert from 'node:assert/strict';

import { submitModalAction } from '../asyncModalSubmit';

test('add modal waits for save before close success callback', async () => {
  const lock = { current: false };
  const calls: string[] = [];
  let release!: () => void;

  const pending = submitModalAction(
    lock,
    async () => {
      calls.push('save:start');
      await new Promise<void>((resolve) => {
        release = () => {
          calls.push('save:done');
          resolve();
        };
      });
    },
    () => {
      calls.push('close');
    }
  );

  assert.deepEqual(calls, ['save:start']);
  release();
  const result = await pending;

  assert.equal(result, true);
  assert.deepEqual(calls, ['save:start', 'save:done', 'close']);
});

test('failed save does not look like success', async () => {
  const lock = { current: false };
  const calls: string[] = [];

  await assert.rejects(() =>
    submitModalAction(
      lock,
      async () => {
        calls.push('save:start');
        throw new Error('failed');
      },
      () => {
        calls.push('close');
      }
    )
  );

  assert.deepEqual(calls, ['save:start']);
  assert.equal(lock.current, false);
});

test('repeated clicks do not trigger duplicate submits', async () => {
  const lock = { current: false };
  let runCount = 0;
  let release!: () => void;

  const first = submitModalAction(
    lock,
    async () => {
      runCount += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    () => {}
  );

  const second = await submitModalAction(lock, async () => {
    runCount += 1;
  }, () => {});

  assert.equal(second, false);
  assert.equal(runCount, 1);

  release();
  assert.equal(await first, true);
  assert.equal(runCount, 1);
});


test('delete waits for persistence before success UI callback', async () => {
  const lock = { current: false };
  const calls: string[] = [];
  let release!: () => void;

  const pending = submitModalAction(
    lock,
    async () => {
      calls.push('delete:start');
      await new Promise<void>((resolve) => {
        release = () => {
          calls.push('delete:done');
          resolve();
        };
      });
    },
    () => {
      calls.push('close');
    }
  );

  assert.deepEqual(calls, ['delete:start']);
  release();
  const result = await pending;

  assert.equal(result, true);
  assert.deepEqual(calls, ['delete:start', 'delete:done', 'close']);
});

test('repeated destructive clicks do not trigger duplicate requests', async () => {
  const lock = { current: false };
  let runCount = 0;
  let release!: () => void;

  const first = submitModalAction(
    lock,
    async () => {
      runCount += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    () => {}
  );

  const second = await submitModalAction(
    lock,
    async () => {
      runCount += 1;
    },
    () => {}
  );

  assert.equal(second, false);
  assert.equal(runCount, 1);

  release();
  assert.equal(await first, true);
  assert.equal(runCount, 1);
});


test('entry note save/delete waits for completion via shared async submit contract', async () => {
  const lock = { current: false };
  const calls: string[] = [];
  let release!: () => void;

  const pending = submitModalAction(
    lock,
    async () => {
      calls.push('note:start');
      await new Promise<void>((resolve) => {
        release = () => {
          calls.push('note:done');
          resolve();
        };
      });
    },
    () => {
      calls.push('modal:close');
    }
  );

  assert.deepEqual(calls, ['note:start']);
  release();
  await pending;
  assert.deepEqual(calls, ['note:start', 'note:done', 'modal:close']);
});

test('recipe note failed action does not look like success', async () => {
  const lock = { current: false };
  const calls: string[] = [];

  await assert.rejects(() =>
    submitModalAction(
      lock,
      async () => {
        calls.push('recipe-note:start');
        throw new Error('recipe note failed');
      },
      () => {
        calls.push('modal:close');
      }
    )
  );

  assert.deepEqual(calls, ['recipe-note:start']);
});

test('meal note local-only path remains consistent and synchronous', async () => {
  const lock = { current: false };
  const calls: string[] = [];

  const result = await submitModalAction(
    lock,
    () => {
      calls.push('meal-note:save');
    },
    () => {
      calls.push('modal:close');
    }
  );

  assert.equal(result, true);
  assert.deepEqual(calls, ['meal-note:save', 'modal:close']);
});
