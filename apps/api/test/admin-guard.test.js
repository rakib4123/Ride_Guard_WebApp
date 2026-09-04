/**
 * The guard on the bulk trip-read endpoints. It must fail closed: an unset
 * ADMIN_TOKEN disables the endpoints rather than opening them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { AdminGuard } = require('../dist/trips/admin.guard');

/** Minimal ExecutionContext exposing one request header. */
const ctxWith = (token) => ({
  switchToHttp: () => ({
    getRequest: () => ({ header: (n) => (n === 'x-admin-token' && token != null ? token : undefined) }),
  }),
});

test('refuses when ADMIN_TOKEN is unset, even with a token supplied', () => {
  delete process.env.ADMIN_TOKEN;
  const g = new AdminGuard();
  assert.throws(() => g.canActivate(ctxWith('anything')), /disabled/i);
  assert.throws(() => g.canActivate(ctxWith(undefined)), /disabled/i);
});

test('refuses a missing, empty, or wrong token', () => {
  process.env.ADMIN_TOKEN = 'correct-horse';
  const g = new AdminGuard();
  assert.throws(() => g.canActivate(ctxWith(undefined)), /invalid or missing/i);
  assert.throws(() => g.canActivate(ctxWith('')), /invalid or missing/i);
  assert.throws(() => g.canActivate(ctxWith('wrong')), /invalid or missing/i);
});

test('refuses a token that is merely a prefix of the real one', () => {
  process.env.ADMIN_TOKEN = 'correct-horse';
  const g = new AdminGuard();
  assert.throws(() => g.canActivate(ctxWith('correct')), /invalid or missing/i);
  assert.throws(() => g.canActivate(ctxWith('correct-horse-extra')), /invalid or missing/i);
});

test('admits the exact token', () => {
  process.env.ADMIN_TOKEN = 'correct-horse';
  assert.equal(new AdminGuard().canActivate(ctxWith('correct-horse')), true);
});
