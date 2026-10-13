import express from 'express';
import { ObjectId } from 'mongodb';
import { fileURLToPath } from 'node:url';

// Validate only the fields that this small application needs.
export function validateItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter valid item details.');
  const item = {};
  for (const [key, max] of Object.entries({ title: 80, description: 500, location: 100, contact: 120 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) {
      throw new Error(`${key} is required and must be at most ${max} characters.`);
    }
    item[key] = body[key].trim();
  }
  if (!['Lost', 'Found'].includes(body.type)) throw new Error('Choose Lost or Found.');
  if (!['Open', 'Returned'].includes(body.status)) throw new Error('Choose Open or Returned.');
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error('Enter a valid date.');
  const date = new Date(`${body.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) throw new Error('Enter a valid calendar date.');
  return { ...item, type: body.type, status: body.status, date: body.date };
}

export function createApp(db) {
  const app = express();
  const items = db.collection('items');
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    // This local demo has no login. Reject cross-origin browser mutations.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) {
      return res.status(403).json({ error: 'Cross-origin changes are not allowed.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/items', async (req, res) => {
    const filter = {};
    for (const [key, allowed] of Object.entries({ type: ['Lost', 'Found'], status: ['Open', 'Returned'] })) {
      const value = req.query[key];
      if (value !== undefined && value !== 'all' && value !== '') {
        if (!allowed.includes(value)) return res.status(400).json({ error: `Invalid ${key} filter.` });
        filter[key] = value;
      }
    }
    if (req.query.q !== undefined) {
      if (typeof req.query.q !== 'string' || req.query.q.length > 80) return res.status(400).json({ error: 'Search must be at most 80 characters.' });
      const query = req.query.q.trim();
      if (query) {
        // Escape regex characters so search input is treated as ordinary text.
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = ['title', 'description', 'location'].map(key => ({ [key]: { $regex: escaped, $options: 'i' } }));
      }
    }
    res.json(await items.find(filter).sort({ createdAt: -1, _id: -1 }).toArray());
  });
  app.get('/api/stats', async (_req, res) => {
    const [lost, found, returned] = await Promise.all([
      items.countDocuments({ type: 'Lost', status: 'Open' }),
      items.countDocuments({ type: 'Found', status: 'Open' }),
      items.countDocuments({ status: 'Returned' })
    ]);
    res.json({ lost, found, returned });
  });
  app.post('/api/items', async (req, res) => {
    let item;
    try { item = validateItem(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
    const now = new Date();
    item = { ...item, createdAt: now, updatedAt: now };
    const result = await items.insertOne(item);
    res.status(201).json({ ...item, _id: result.insertedId });
  });
  app.param('id', (req, res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid item ID.' });
    req.itemId = new ObjectId(id);
    next();
  });
  app.put('/api/items/:id', async (req, res) => {
    let item;
    try { item = validateItem(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
    const updated = await items.findOneAndUpdate({ _id: req.itemId }, { $set: { ...item, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ error: 'Item not found. It may have been deleted.' });
    res.json(updated);
  });
  app.patch('/api/items/:id/status', async (req, res) => {
    if (!['Open', 'Returned'].includes(req.body?.status)) return res.status(400).json({ error: 'Choose Open or Returned.' });
    const updated = await items.findOneAndUpdate({ _id: req.itemId }, { $set: { status: req.body.status, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ error: 'Item not found. It may have been deleted.' });
    res.json(updated);
  });
  app.delete('/api/items/:id', async (req, res) => {
    const result = await items.deleteOne({ _id: req.itemId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Item not found. It may have been deleted.' });
    res.status(204).end();
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  });
  return app;
}
