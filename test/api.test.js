import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { once } from 'node:events';
import { createApp } from '../app.js';

const client = new MongoClient(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028', { serverSelectionTimeoutMS: 5000 });
const dbName = `campus_test_${process.pid}_${Date.now()}`;
let db, server, base, id;
const sample = { title: 'Test bottle', description: 'Blue steel bottle', type: 'Lost', location: 'Library', contact: 'Library help desk', date: '2026-10-12', status: 'Open' };
async function request(path = '/api/items', method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
before(async () => { await client.connect(); db = client.db(dbName); server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (db) await db.dropDatabase(); await client.close(); });

test('empty database has no items and zero counters', async () => {
  assert.deepEqual((await request()).data, []);
  assert.deepEqual((await request('/api/stats')).data, { lost: 0, found: 0, returned: 0 });
});
test('create stores a complete record in MongoDB', async () => {
  const result = await request('/api/items', 'POST', sample); assert.equal(result.status, 201); id = result.data._id;
  assert.equal(result.data.title, sample.title); assert.ok(result.data.createdAt);
  assert.equal(await db.collection('items').countDocuments(), 1);
});
test('read and case-insensitive location search find the item', async () => {
  assert.equal((await request()).data.length, 1);
  assert.equal((await request('/api/items?q=LIBRARY')).data[0]._id, id);
  assert.equal((await request('/api/items?q=absent')).data.length, 0);
  assert.equal((await request('/api/items?q=%5B')).data.length, 0);
});
test('type and status filters work together', async () => {
  assert.equal((await request('/api/items?type=Lost&status=Open')).data.length, 1);
  assert.equal((await request('/api/items?type=Found')).data.length, 0);
  assert.equal((await request('/api/items?status=Returned')).data.length, 0);
});
test('update changes editable fields and keeps createdAt', async () => {
  const original = (await request()).data[0];
  const result = await request(`/api/items/${id}`, 'PUT', { ...sample, title: 'Updated bottle' });
  assert.equal(result.status, 200); assert.equal(result.data.title, 'Updated bottle'); assert.equal(result.data.createdAt, original.createdAt);
});
test('mark returned updates the dashboard counters', async () => {
  assert.equal((await request(`/api/items/${id}/status`, 'PATCH', { status: 'Returned' })).status, 200);
  assert.deepEqual((await request('/api/stats')).data, { lost: 0, found: 0, returned: 1 });
});
test('records persist across web server restart and a new database connection', async () => {
  await new Promise(resolve => server.close(resolve));
  const fresh = new MongoClient(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028');
  try {
    await fresh.connect(); server = createApp(fresh.db(dbName)).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await request()).data[0].title, 'Updated bottle');
    await new Promise(resolve => server.close(resolve));
  } finally { await fresh.close(); }
  server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
test('rejects empty, oversized and invalid fields without writing', async () => {
  for (const change of [{ title: ' ' }, { title: 'x'.repeat(81) }, { date: '2026-02-30' }, { type: 'Other' }, { status: 'Unknown' }, { contact: { $ne: null } }]) {
    assert.equal((await request('/api/items', 'POST', { ...sample, ...change })).status, 400);
  }
  assert.equal(await db.collection('items').countDocuments(), 1);
});
test('rejects malformed IDs, unknown IDs and invalid filters', async () => {
  assert.equal((await request('/api/items/nope', 'DELETE')).status, 400);
  assert.equal((await request('/api/items/ffffffffffffffffffffffff', 'PUT', sample)).status, 404);
  assert.equal((await request('/api/items?status=unknown')).status, 400);
  assert.equal((await request('/api/items?q=' + 'a'.repeat(81))).status, 400);
  assert.equal((await request(`/api/items/${id}/status`, 'PATCH', { status: 'Invalid' })).status, 400);
});
test('malformed JSON and cross-origin mutation return controlled errors', async () => {
  const bad = await fetch(base + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(bad.status, 400);
  const cross = await fetch(base + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.org' }, body: JSON.stringify(sample) }); assert.equal(cross.status, 403);
});
test('delete removes only the selected record and detects repeat deletion', async () => {
  assert.equal((await request(`/api/items/${id}`, 'DELETE')).status, 204);
  assert.deepEqual((await request()).data, []);
  assert.equal((await request(`/api/items/${id}`, 'DELETE')).status, 404);
});
