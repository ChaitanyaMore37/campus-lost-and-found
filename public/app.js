const demoApi = document.querySelector('meta[name="app-mode"]')?.content === 'demo'
  ? import('./pages-store.js') : null;

const $ = selector => document.querySelector(selector);
const dialog = $('#item-dialog');
const form = $('#item-form');
let editingId = null;
let loadVersion = 0;

async function api(path, options = {}) {
  if (demoApi) return (await demoApi).request(path, options);
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' } });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function notify(text, isError = false) {
  $('#message').textContent = text;
  $('#message').className = isError ? 'error' : '';
  $('#message').hidden = false;
}
function openForm(item = null) {
  form.reset();
  editingId = item?._id || null;
  $('#form-error').hidden = true;
  $('#dialog-title').textContent = item ? 'Edit item report' : 'Report an item';
  $('#status-field').hidden = !item;
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const values = item || { type: 'Lost', status: 'Open', date: localDate };
  for (const key of ['type', 'title', 'description', 'location', 'contact', 'date', 'status']) form.elements[key].value = values[key] || '';
  dialog.showModal();
  form.elements.title.focus();
}
function renderItem(item) {
  const card = $('#item-template').content.firstElementChild.cloneNode(true);
  const badge = card.querySelector('.type-badge');
  badge.textContent = item.type;
  badge.classList.add(item.type.toLowerCase());
  card.querySelector('h3').textContent = item.title;
  for (const key of ['description', 'location', 'contact']) card.querySelector(`.${key}`).textContent = item[key];
  card.querySelector('.item-date').textContent = new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  card.querySelector('.status-label').textContent = item.status === 'Returned' ? '✓ Returned' : '• Open';
  card.querySelector('.status-label').classList.toggle('returned', item.status === 'Returned');
  card.querySelector('.edit-button').addEventListener('click', () => openForm(item));
  const returnButton = card.querySelector('.return-button');
  returnButton.hidden = item.status === 'Returned';
  returnButton.addEventListener('click', async () => {
    returnButton.disabled = true;
    try { await api(`/api/items/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Returned' }) }); notify('Item marked as returned.'); await loadItems(); }
    catch (error) { notify(error.message, true); }
    finally { returnButton.disabled = false; }
  });
  card.querySelector('.delete-button').addEventListener('click', async event => {
    if (!confirm(`Delete the report for “${item.title}”? This cannot be undone.`)) return;
    event.target.disabled = true;
    try { await api(`/api/items/${item._id}`, { method: 'DELETE' }); notify('Report deleted.'); await loadItems(); }
    catch (error) { notify(error.message, true); }
    finally { event.target.disabled = false; }
  });
  return card;
}
async function loadItems() {
  const version = ++loadVersion;
  try {
    const query = new URLSearchParams(new FormData($('#filters')));
    const [items, stats] = await Promise.all([api(`/api/items?${query}`), api('/api/stats')]);
    if (version !== loadVersion) return;
    for (const key of ['lost', 'found', 'returned']) $(`#${key}-count`).textContent = stats[key];
    $('#result-count').textContent = `${items.length} ${items.length === 1 ? 'report' : 'reports'}`;
    $('#items').replaceChildren(...items.map(renderItem));
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const title = document.createElement('h3'); title.textContent = 'No items here yet';
      const note = document.createElement('p'); note.textContent = 'Try a different search or report a lost or found item.';
      empty.append(title, note); $('#items').append(empty);
    }
  } catch (error) {
    if (version !== loadVersion) return;
    $('#items').replaceChildren();
    $('#result-count').textContent = 'Unable to load';
    for (const key of ['lost', 'found', 'returned']) $(`#${key}-count`).textContent = '—';
    notify(`Unable to load the noticeboard. ${error.message} Press Search to retry.`, true);
  }
}
$('#new-item').addEventListener('click', () => openForm());
for (const id of ['close-dialog', 'cancel-form']) $(`#${id}`).addEventListener('click', () => dialog.close());
form.addEventListener('submit', async event => {
  event.preventDefault();
  $('#save-item').disabled = true;
  $('#form-error').hidden = true;
  try {
    await api(editingId ? `/api/items/${editingId}` : '/api/items', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    dialog.close();
    $('#filters').reset();
    notify(editingId ? 'Report updated.' : 'Report added to the noticeboard.');
    await loadItems();
  } catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; }
  finally { $('#save-item').disabled = false; }
});
$('#filters').addEventListener('submit', event => { event.preventDefault(); $('#message').hidden = true; loadItems(); });
for (const id of ['type-filter', 'status-filter']) $(`#${id}`).addEventListener('change', () => { $('#message').hidden = true; loadItems(); });
$('#clear-filters').addEventListener('click', () => { $('#filters').reset(); $('#message').hidden = true; loadItems(); });
loadItems();
