// ContentHub frontend: vanilla JS single-page app with hash routing.
// All text is inserted with textContent (via h()), never innerHTML, to prevent XSS.
// Role checks here only hide UI; the server enforces every permission.
const $main = document.getElementById('main');
const $nav = document.getElementById('nav');
const RANK = { reader: 0, author: 1, editor: 2, admin: 3 };
const state = { user: null, token: localStorage.getItem('token') };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const can = (role) => state.user && RANK[state.user.role] >= RANK[role];
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');
const render = (...nodes) => { $main.replaceChildren(...nodes.flat()); $main.focus({ preventScroll: true }); };

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(true);
    const detail = data.details ? ': ' + data.details.map((d) => d.message).join('; ') : '';
    throw new Error((data.error || 'Request failed') + detail);
  }
  return data;
}

function setSession(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('token', token);
  drawNav();
}
function logout(silent) {
  state.token = null; state.user = null; localStorage.removeItem('token');
  drawNav();
  if (!silent) toast('Signed out');
  location.hash = '#/login';
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('theme', root.dataset.theme);
}
if (localStorage.getItem('theme')) document.documentElement.dataset.theme = localStorage.getItem('theme');

function drawNav() {
  const items = [h('a', { href: '#/' }, 'Articles')];
  if (can('author')) items.push(h('a', { href: '#/dashboard' }, 'Dashboard'));
  if (can('admin')) items.push(h('a', { href: '#/admin' }, 'Users'));
  items.push(h('button', { type: 'button', onclick: toggleTheme, 'aria-label': 'Toggle dark mode' }, 'Theme'));
  if (state.user) items.push(h('span', { class: 'meta' }, `${state.user.name} (${state.user.role})`), h('button', { type: 'button', onclick: () => logout() }, 'Sign out'));
  else items.push(h('a', { href: '#/login' }, 'Sign in'), h('a', { href: '#/register' }, 'Register'));
  $nav.replaceChildren(...items);
}

const field = (label, input) => { input.id = input.id || 'f-' + label.replace(/\W/g, ''); return [h('label', { for: input.id }, label), input]; };
const errBox = () => h('p', { class: 'error', role: 'alert' });

// ---------- Public pages ----------
async function homePage(params) {
  const cats = (await api('/categories')).categories;
  const q = h('input', { type: 'search', placeholder: 'Search articles', value: params.get('q') || '', 'aria-label': 'Search' });
  const cat = h('select', { 'aria-label': 'Category' }, h('option', { value: '' }, 'All categories'),
    cats.map((c) => h('option', { value: c.slug, selected: params.get('category') === c.slug }, c.name)));
  const sort = h('select', { 'aria-label': 'Sort' }, h('option', { value: '' }, 'Newest'),
    h('option', { value: 'popular', selected: params.get('sort') === 'popular' }, 'Most viewed'));
  const go = (extra = {}) => {
    const p = new URLSearchParams();
    if (q.value) p.set('q', q.value);
    if (cat.value) p.set('category', cat.value);
    if (sort.value) p.set('sort', sort.value);
    if (params.get('tag')) p.set('tag', params.get('tag'));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    location.hash = '#/?' + p.toString();
  };
  const form = h('form', { class: 'filters', onsubmit: (e) => { e.preventDefault(); go(); } }, q, cat, sort, h('button', { class: 'btn primary' }, 'Search'));
  const list = await api('/articles?' + params.toString());
  const cards = list.articles.map((a) => h('article', { class: 'card' },
    a.coverImage ? h('img', { src: a.coverImage, alt: '' }) : null,
    h('h3', {}, h('a', { href: '#/article/' + a.slug }, a.title)),
    h('p', { class: 'meta' }, `${a.author?.name || 'Unknown'} · ${fmt(a.publishedAt)}${a.category ? ' · ' + a.category.name : ''}`),
    h('p', {}, a.excerpt),
    h('div', {}, a.tags.map((t) => h('a', { class: 'tag', href: '#/?tag=' + encodeURIComponent(t) }, '#' + t)))));
  const page = Number(list.page);
  render(h('h1', {}, 'Articles'), form,
    params.get('tag') ? h('p', {}, 'Tag: #' + params.get('tag') + ' ', h('a', { href: '#/' }, 'clear')) : null,
    cards.length ? h('div', { class: 'grid' }, cards) : h('p', { class: 'empty' }, 'No articles match. Try a different search or clear the filters.'),
    list.pages > 1 ? h('div', { class: 'row' },
      page > 1 ? h('button', { class: 'btn', onclick: () => go({ page: page - 1 }) }, 'Previous') : null,
      h('span', { class: 'meta' }, `Page ${page} of ${list.pages}`),
      page < list.pages ? h('button', { class: 'btn', onclick: () => go({ page: page + 1 }) }, 'Next') : null) : null);
}

async function articlePage(slug) {
  const { article: a } = await api('/articles/' + encodeURIComponent(slug));
  document.title = (a.seo?.metaTitle || a.title) + ' · ContentHub';
  render(h('article', { class: 'article' },
    h('h1', {}, a.title),
    h('p', { class: 'meta' }, `By ${a.author?.name || 'Unknown'} · ${fmt(a.publishedAt || a.createdAt)} · ${a.views} views`,
      a.status !== 'published' ? h('span', { class: 'status ' + a.status }, ' ' + a.status) : null),
    a.coverImage ? h('img', { class: 'cover', src: a.coverImage, alt: '' }) : null,
    h('div', { class: 'prose' }, a.body.split(/\n{2,}/).map((p) => h('p', {}, p))),
    h('div', {}, a.tags.map((t) => h('a', { class: 'tag', href: '#/?tag=' + encodeURIComponent(t) }, '#' + t))),
    h('p', {}, h('a', { href: '#/' }, 'Back to articles'))));
}

// ---------- Auth ----------
function authPage(mode) {
  const reg = mode === 'register';
  const name = h('input', { autocomplete: 'name', required: true });
  const email = h('input', { type: 'email', autocomplete: 'email', required: true });
  const pw = h('input', { type: 'password', autocomplete: reg ? 'new-password' : 'current-password', required: true, minlength: 8 });
  const err = errBox();
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      const data = await api(`/auth/${mode}`, { method: 'POST', body: { ...(reg ? { name: name.value } : {}), email: email.value, password: pw.value } });
      setSession(data.token, data.user);
      location.hash = can('author') ? '#/dashboard' : '#/';
    } catch (ex) { err.textContent = ex.message; }
  } }, reg ? field('Name', name) : null, field('Email', email), field('Password', pw), err,
    h('div', { class: 'row' }, h('button', { class: 'btn primary' }, reg ? 'Create account' : 'Sign in')),
    reg ? h('p', { class: 'meta' }, 'New accounts are readers. An admin can grant author access.') : null);
  render(h('div', { class: 'panel' }, h('h1', {}, reg ? 'Create account' : 'Sign in'), form));
}

// ---------- Dashboard ----------
async function dashboardPage() {
  if (!can('author')) return render(h('p', { class: 'empty' }, 'Author access is required. Ask an admin to upgrade your account.'));
  const mine = (await api('/articles/mine')).articles;
  const act = (path, msg, body) => async () => {
    try { await api(path, { method: 'POST', body }); toast(msg); route(); } catch (e) { toast(e.message); }
  };
  const row = (a, queue) => h('li', {},
    h('div', {}, h('strong', {}, a.title), ' ', h('span', { class: 'status ' + a.status }, a.status.replace('_', ' ')),
      queue ? h('div', { class: 'meta' }, 'by ' + (a.author?.name || '')) : null,
      a.reviewNote ? h('div', { class: 'notice' }, 'Editor note: ' + a.reviewNote) : null),
    h('div', { class: 'row', style: 'margin:0' },
      h('a', { class: 'btn', href: '#/edit/' + a._id }, 'Edit'),
      a.status === 'draft' && !queue ? h('button', { class: 'btn', onclick: act(`/articles/${a._id}/submit`, 'Submitted for review') }, 'Submit for review') : null,
      can('editor') && a.status !== 'published' ? h('button', { class: 'btn primary', onclick: act(`/articles/${a._id}/publish`, 'Published') }, 'Publish') : null,
      can('editor') && a.status === 'in_review' ? h('button', { class: 'btn', onclick: () => { const note = prompt('Feedback for the author:'); if (note) act(`/articles/${a._id}/reject`, 'Sent back to author', { note })(); } }, 'Request changes') : null,
      can('editor') && a.status === 'published' ? h('button', { class: 'btn', onclick: act(`/articles/${a._id}/archive`, 'Archived') }, 'Archive') : null,
      h('a', { class: 'btn', href: '#/article/' + (a.slug) }, 'View')));
  const nodes = [h('h1', {}, 'Dashboard'), h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/edit/new' }, 'New article'))];
  if (can('editor')) {
    const queue = (await api('/articles/review-queue')).articles;
    nodes.push(h('h2', {}, 'Review queue'), queue.length ? h('ul', { class: 'list' }, queue.map((a) => row(a, true))) : h('p', { class: 'empty' }, 'Nothing is waiting for review.'));
  }
  nodes.push(h('h2', {}, 'My articles'), mine.length ? h('ul', { class: 'list' }, mine.map((a) => row(a))) : h('p', { class: 'empty' }, 'You have no articles yet. Create your first draft.'));
  render(nodes);
}

// ---------- Editor ----------
async function editorPage(idParam) {
  if (!can('author')) return render(h('p', { class: 'empty' }, 'Author access is required.'));
  const isNew = idParam === 'new';
  const [cats, existing] = await Promise.all([api('/categories'), isNew ? null : api('/articles/manage/' + idParam)]);
  const a = existing?.article || { title: '', excerpt: '', body: '', tags: [], seo: {} };
  const title = h('input', { value: a.title, maxlength: 160, required: true });
  const excerpt = h('input', { value: a.excerpt || '', maxlength: 300 });
  const body = h('textarea', {}); body.value = a.body;
  const cat = h('select', {}, h('option', { value: '' }, 'No category'), cats.categories.map((c) => h('option', { value: c._id, selected: a.category?._id === c._id }, c.name)));
  const tags = h('input', { value: (a.tags || []).join(', '), placeholder: 'comma, separated' });
  const metaDesc = h('input', { value: a.seo?.metaDescription || '', maxlength: 160 });
  let cover = a.coverImage || '';
  const coverNote = h('span', { class: 'meta' }, cover ? 'Cover image set' : 'No cover image');
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async () => {
    const fd = new FormData(); fd.append('image', file.files[0]);
    const res = await fetch('/api/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token }, body: fd });
    const data = await res.json();
    if (res.ok) { cover = data.url; coverNote.textContent = 'Cover uploaded'; } else toast(data.error);
  } });
  const aiOut = h('div');
  const askAI = (task) => async () => {
    try {
      const r = await api('/ai/suggest', { method: 'POST', body: { task, text: body.value || title.value } });
      aiOut.replaceChildren(h('div', { class: 'notice' }, `Suggestion (${r.provider}): `, r.suggestion,
        h('div', { class: 'row' },
          task === 'summarize' ? h('button', { type: 'button', class: 'btn', onclick: () => { excerpt.value = r.suggestion.slice(0, 300); aiOut.replaceChildren(); } }, 'Use as excerpt') : null,
          task === 'titles' ? h('button', { type: 'button', class: 'btn', onclick: () => { title.value = r.suggestion.slice(0, 160); aiOut.replaceChildren(); } }, 'Use as title') : null,
          h('button', { type: 'button', class: 'btn', onclick: () => aiOut.replaceChildren() }, 'Dismiss'))));
    } catch (e) { aiOut.replaceChildren(h('p', { class: 'error' }, e.message)); }
  };
  const err = errBox();
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    const payload = { title: title.value, excerpt: excerpt.value, body: body.value, category: cat.value || undefined,
      tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean), coverImage: cover || undefined, seo: { metaDescription: metaDesc.value } };
    try {
      const r = await api(isNew ? '/articles' : '/articles/' + idParam, { method: isNew ? 'POST' : 'PUT', body: payload });
      toast('Saved'); location.hash = '#/dashboard';
    } catch (ex) { err.textContent = ex.message; }
  } }, field('Title', title), field('Excerpt', excerpt), field('Body (blank line between paragraphs)', body),
    field('Category', cat), field('Tags', tags), field('Meta description (SEO)', metaDesc),
    h('label', {}, 'Cover image (PNG, JPEG or WebP, max 2 MB)'), file, coverNote,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: askAI('summarize') }, 'Suggest excerpt'),
      h('button', { type: 'button', class: 'btn', onclick: askAI('titles') }, 'Suggest title')),
    aiOut, err,
    h('div', { class: 'row' }, h('button', { class: 'btn primary' }, 'Save draft'), h('a', { class: 'btn', href: '#/dashboard' }, 'Cancel'),
      !isNew && a.status === 'draft' ? h('button', { type: 'button', class: 'btn danger', onclick: async () => {
        if (!confirm('Delete this draft?')) return;
        try { await api('/articles/' + idParam, { method: 'DELETE' }); location.hash = '#/dashboard'; } catch (ex) { toast(ex.message); }
      } }, 'Delete draft') : null));
  render(h('div', { class: 'wide' }, h('h1', {}, isNew ? 'New article' : 'Edit article'), a.reviewNote ? h('div', { class: 'notice' }, 'Editor note: ' + a.reviewNote) : null, form));
}

// ---------- Admin ----------
async function adminPage() {
  if (!can('admin')) return render(h('p', { class: 'empty' }, 'Admin access is required.'));
  const { users } = await api('/admin/users');
  render(h('h1', {}, 'Users'), h('ul', { class: 'list' }, users.map((u) => {
    const sel = h('select', { 'aria-label': 'Role for ' + u.name, disabled: u._id === state.user.id },
      ['reader', 'author', 'editor', 'admin'].map((r) => h('option', { value: r, selected: r === u.role }, r)));
    sel.addEventListener('change', async () => {
      try { await api(`/admin/users/${u._id}/role`, { method: 'PATCH', body: { role: sel.value } }); toast('Role updated'); } catch (e) { toast(e.message); route(); }
    });
    return h('li', {}, h('div', {}, h('strong', {}, u.name), h('div', { class: 'meta' }, u.email)), sel);
  })));
}

// ---------- Router ----------
async function route() {
  document.title = 'ContentHub';
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const parts = path.split('/').filter(Boolean);
  try {
    if (!parts.length) await homePage(new URLSearchParams(qs || ''));
    else if (parts[0] === 'article') await articlePage(parts[1]);
    else if (parts[0] === 'login' || parts[0] === 'register') authPage(parts[0]);
    else if (parts[0] === 'dashboard') await dashboardPage();
    else if (parts[0] === 'edit') await editorPage(parts[1]);
    else if (parts[0] === 'admin') await adminPage();
    else render(h('p', { class: 'empty' }, 'Page not found.'));
  } catch (e) { render(h('p', { class: 'error', role: 'alert' }, e.message)); }
}

(async () => {
  if (state.token) { try { state.user = (await api('/auth/me')).user; } catch { /* token invalid */ } }
  drawNav();
  addEventListener('hashchange', route);
  route();
})();
