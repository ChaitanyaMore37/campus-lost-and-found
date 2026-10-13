// A browser-only adapter for GitHub Pages. The full-stack app uses Express instead.
const KEY = 'campus-lost-and-found-pages-v1';
function examples() {
  const date = new Date().toISOString().slice(0, 10);
  return [
    { _id: 'sample-bottle', title: 'Blue water bottle', type: 'Lost', location: 'Library, second floor', description: 'Steel bottle with a blue lid. Last seen near the reading tables.', contact: 'Library help desk', status: 'Open' },
    { _id: 'sample-calculator', title: 'Scientific calculator', type: 'Found', location: 'Computer lab 2', description: 'Black calculator in a grey cover. Identify the model to collect it.', contact: 'IT department office', status: 'Open' },
    { _id: 'sample-keys', title: 'Silver keychain', type: 'Found', location: 'Canteen', description: 'Two keys on a silver ring. Returned after the owner identified them.', contact: 'Canteen counter', status: 'Returned' }
  ].map(item => ({ ...item, date, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
}
function save(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch { throw new Error('Browser storage is unavailable or full. Enable site storage to use this demo.'); }
}
function read() {
  let raw;
  try { raw = localStorage.getItem(KEY); }
  catch { throw new Error('Browser storage is unavailable. Enable site storage to use this demo.'); }
  if (raw === null) { const items = examples(); save(items); return items; }
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error();
    for (const item of items) {
      validate(item);
      if (typeof item._id !== 'string' || typeof item.createdAt !== 'string') throw new Error();
    }
    return items;
  } catch { throw new Error('Saved demo data cannot be read. Clear this site’s browser storage to reset the demo.'); }
}
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter valid item details.');
  const item = {};
  for (const [key, max] of Object.entries({ title: 80, description: 500, location: 100, contact: 120 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) throw new Error(`${key} is required and must be at most ${max} characters.`);
    item[key] = body[key].trim();
  }
  if (!['Lost', 'Found'].includes(body.type)) throw new Error('Choose Lost or Found.');
  if (!['Open', 'Returned'].includes(body.status)) throw new Error('Choose Open or Returned.');
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error('Enter a valid date.');
  const date = new Date(`${body.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) throw new Error('Enter a valid calendar date.');
  return { ...item, type: body.type, status: body.status, date: body.date };
}
export async function request(path, options = {}) {
  const url = new URL(path, 'https://demo.invalid');
  const method = options.method || 'GET';
  const items = read();
  if (method === 'GET' && url.pathname === '/api/stats') {
    return { lost: items.filter(i => i.type === 'Lost' && i.status === 'Open').length, found: items.filter(i => i.type === 'Found' && i.status === 'Open').length, returned: items.filter(i => i.status === 'Returned').length };
  }
  if (method === 'GET' && url.pathname === '/api/items') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    return items.filter(item => {
      for (const field of ['type', 'status']) {
        const value = url.searchParams.get(field);
        if (value && value !== 'all' && item[field] !== value) return false;
      }
      return [item.title, item.description, item.location].some(value => value.toLowerCase().includes(query));
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const body = options.body ? JSON.parse(options.body) : {};
  if (method === 'POST' && url.pathname === '/api/items') {
    const now = new Date().toISOString();
    const item = { ...validate(body), _id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    items.unshift(item); save(items); return item;
  }
  const match = url.pathname.match(/^\/api\/items\/([^/]+)(\/status)?$/);
  if (!match) throw new Error('Unknown demo action.');
  const index = items.findIndex(item => item._id === match[1]);
  if (index === -1) throw new Error('Item not found. It may have been deleted.');
  if (method === 'PUT' && !match[2]) items[index] = { ...items[index], ...validate(body), updatedAt: new Date().toISOString() };
  else if (method === 'PATCH' && match[2]) {
    if (!['Open', 'Returned'].includes(body.status)) throw new Error('Choose Open or Returned.');
    items[index] = { ...items[index], status: body.status, updatedAt: new Date().toISOString() };
  } else if (method === 'DELETE' && !match[2]) { items.splice(index, 1); save(items); return null; }
  else throw new Error('Unknown demo action.');
  save(items); return items[index];
}
