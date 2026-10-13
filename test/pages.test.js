import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../scripts/pages-store.js';
const memory = new Map();
beforeEach(() => {
  memory.clear();
  globalThis.localStorage = { getItem: key => memory.has(key) ? memory.get(key) : null, setItem: (key, value) => memory.set(key, value) };
});
const sample = { title: 'Red notebook', description: 'Programming notes', location: 'Room A-204', contact: 'IT office', type: 'Lost', status: 'Open', date: '2026-10-13' };
const change = (method, body) => ({ method, body: JSON.stringify(body) });
test('demo seeds once and supports create, search, edit, return and delete', async () => {
  assert.equal((await request('/api/items')).length, 3);
  assert.equal((await request('/api/items')).length, 3);
  const item = await request('/api/items', change('POST', sample));
  assert.equal((await request('/api/items?q=A-204&type=Lost&status=Open'))[0]._id, item._id);
  await request(`/api/items/${item._id}`, change('PUT', { ...sample, title: 'Edited notebook' }));
  assert.equal((await request('/api/items?q=Edited'))[0].title, 'Edited notebook');
  await request(`/api/items/${item._id}/status`, change('PATCH', { status: 'Returned' }));
  assert.deepEqual(await request('/api/stats'), { lost: 1, found: 1, returned: 2 });
  await request(`/api/items/${item._id}`, { method: 'DELETE' });
  assert.equal((await request('/api/items?q=Edited')).length, 0);
  await assert.rejects(request(`/api/items/${item._id}`, { method: 'DELETE' }), /not found/);
});
test('demo reads persisted data and does not reseed an intentionally empty list', async () => {
  const items = await request('/api/items');
  for (const item of items) await request(`/api/items/${item._id}`, { method: 'DELETE' });
  assert.deepEqual(await request('/api/items'), []);
  const freshModule = await import('../scripts/pages-store.js?reload');
  assert.deepEqual(await freshModule.request('/api/items'), []);
});
test('invalid input and unavailable or corrupt storage produce visible errors', async () => {
  await assert.rejects(request('/api/items', change('POST', { ...sample, date: '2026-02-30' })), /calendar date/);
  await assert.rejects(request('/api/items', change('POST', { ...sample, title: ' ' })), /title is required/);
  memory.set('campus-lost-and-found-pages-v1', 'not json');
  await assert.rejects(request('/api/items'), /cannot be read/);
  memory.clear();
  globalThis.localStorage.setItem = () => { throw new Error('blocked'); };
  await assert.rejects(request('/api/items'), /storage is unavailable/);
});
