import test from 'node:test';
import assert from 'node:assert/strict';

type QueryResult = { data: any; error: any };

const buildClient = (results: QueryResult[], columns: string[]) => ({
  from(table: string) {
    assert.equal(table, 'user_profiles');
    return {
      select(columnsToSelect: string) {
        assert.equal(columnsToSelect, 'is_admin');
        return this;
      },
      eq(column: string, value: string) {
        columns.push(`${column}:${value}`);
        return this;
      },
      async maybeSingle() {
        return results.shift() ?? { data: null, error: null };
      },
    };
  },
});

test('verifyCurrentUserIsAdmin reads production id_user admin flag', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const columns: string[] = [];
  const service = new AdminAccessService(
    buildClient([{ data: { is_admin: true }, error: null }], columns) as any
  );

  const isAdmin = await service.verifyCurrentUserIsAdmin('admin-1');

  assert.equal(isAdmin, true);
  assert.deepEqual(columns, ['id_user:admin-1']);
});

test('verifyCurrentUserIsAdmin falls back to user_id only for schema compatibility', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const columns: string[] = [];
  const service = new AdminAccessService(
    buildClient(
      [
        { data: null, error: { code: '42703', message: 'column user_profiles.id_user does not exist' } },
        { data: { is_admin: true }, error: null },
      ],
      columns
    ) as any
  );

  const isAdmin = await service.verifyCurrentUserIsAdmin('admin-1');

  assert.equal(isAdmin, true);
  assert.deepEqual(columns, ['id_user:admin-1', 'user_id:admin-1']);
});

test('verifyCurrentUserIsAdmin returns false for non-admin, blank user, and read errors', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');

  assert.equal(await new AdminAccessService(null).verifyCurrentUserIsAdmin('admin-1'), false);
  assert.equal(await new AdminAccessService(buildClient([], []) as any).verifyCurrentUserIsAdmin(' '), false);

  const service = new AdminAccessService(
    buildClient([{ data: null, error: { code: '42501', message: 'permission denied' } }], []) as any
  );
  assert.equal(await service.verifyCurrentUserIsAdmin('user-1'), false);

  const nonAdminService = new AdminAccessService(
    buildClient([{ data: { is_admin: false }, error: null }], []) as any
  );
  assert.equal(await nonAdminService.verifyCurrentUserIsAdmin('user-1'), false);
});
