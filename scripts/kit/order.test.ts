import { test, expect } from 'bun:test';
import { readiness, reconcile, type Order } from './order';
const order: Order = { id: 'TEST-001', contractVersion: 'DRAFT-NOT-FOR-SALE', release: 'test-release', quote: { totalJpy: 30000, runningCost: '未契約・テスト条件', scope: '3 photos', cancellation: 'テスト合意', support: 'テスト合意', agreedAt: '2026-09-28' }, payment: { state: 'pending', reference: null, amountJpy: null, verifiedBy: null }, materialsApproved: true, publicApproval: true, deliveredAt: null, ownerUpdateConfirmed: false };
const paid = { state: 'paid' as const, reference: 'TEST-NO-PAYMENT', amountJpy: 30000, verifiedBy: 'test-fixture' };
test('success, duplicate and interrupted browser do not invent delivery or owner verification', () => {
  const done = reconcile(order, paid);
  expect(readiness(done).canDeliver).toBe(true);
  expect(reconcile(done, paid)).toEqual(done);
  expect(readiness(order).canDeliver).toBe(false);
  expect(readiness(done).ownerConfirmed).toBe(false);
});
test('failed, cancelled, refunded, missing agreement, amount mismatch and missing verification block delivery', () => {
  for (const state of ['failed', 'cancelled', 'refunded', 'pending'] as const) expect(readiness({ ...order, payment: { ...paid, state } }).canDeliver).toBe(false);
  expect(readiness({ ...order, payment: paid, publicApproval: false }).canDeliver).toBe(false);
  expect(readiness({ ...order, payment: paid, quote: { ...order.quote, agreedAt: null } }).canDeliver).toBe(false);
  expect(() => reconcile(order, { ...paid, amountJpy: 1 })).toThrow();
  expect(() => reconcile(order, { ...paid, verifiedBy: null })).toThrow();
});
test('late failed notice and different receipt cannot overwrite confirmed payment', () => {
  const done = reconcile(order, paid);
  expect(() => reconcile(done, { ...paid, state: 'failed' })).toThrow();
  expect(() => reconcile(done, { ...paid, reference: 'OTHER' })).toThrow();
});
