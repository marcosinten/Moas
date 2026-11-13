'use strict';
/* ═════════ Utilidades ═════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(.23,1,.32,1)';
const RM = matchMedia('(prefers-reduced-motion: reduce)');

const icon = (name, cls = '') => {
  const s = document.createElementNS(SVGNS, 'svg'), u = document.createElementNS(SVGNS, 'use');
  s.setAttribute('class', ('ic ' + cls).trim()); s.setAttribute('aria-hidden', 'true');
  u.setAttribute('href', '/icons.svg#i-' + name); s.append(u); return s;
};
// h('div',{class:'x',onclick:fn},hijos...) — siempre texto seguro (sin innerHTML)
const h = (tag, props, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat(9).filter(x => x != null && x !== false));
  return e;
};
const api = async (method, url, body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && S.me && !url.startsWith('/api/auth/login')) { enter(null, 'Tu sesión terminó. Entra de nuevo.'); }
    const e = new Error(j.error || 'Algo salió mal. Inténtalo otra vez.'); e.status = r.status; throw e;
  }
  return j;
};
const plural = (n, a, b) => n === 1 ? a : b;
const pd = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const fd = s => s ? s.split('-').reverse().join('/') : '';
const fdl = s => { if (!s) return ''; const { y, m, d } = pd(s); return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
const TODAY = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const age = s => { if (!s) return null; const { y, m, d } = pd(s), n = new Date(); let a = n.getFullYear() - y; if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--; return a; };
const HUES = [330, 300, 268, 190, 350, 215, 20, 160];
const hue = str => { let x = 0; for (const c of str) x = (x * 31 + c.codePointAt(0)) >>> 0; return HUES[x % HUES.length]; };
const avatar = (name, sm) => h('span', { class: 'avatar' + (sm ? ' sm' : ''), style: `--h:${hue(name)}`, 'aria-hidden': 'true' }, [...name.trim()][0]?.toUpperCase() || '?');
const put = (el, ...kids) => el.append(...kids.flat(9).filter(x => x != null && x !== false));
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(9).filter(x => x != null && x !== false));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, kind = 'ok') {
  const t = h('div', { class: 'toast ' + kind }, icon(kind === 'err' ? 'triangle-alert' : kind === 'info' ? 'info' : 'circle-check'), h('span', {}, msg));
  const box = $('#toasts'); while (box.children.length >= 3) box.firstChild.remove(); box.append(t);
  if (!RM.matches) t.animate([{ opacity: 0, transform: 'translateY(-10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
  setTimeout(async () => {
    if (!RM.matches) await t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 180, easing: EASE, fill: 'forwards' }).finished;
    t.remove();
  }, kind === 'err' ? 5200 : 3600);
}

// FLIP: los elementos que se quedan se deslizan a su nuevo sitio al cambiar la lista
function flip(grid, mutate) {
  const before = new Map([...grid.children].map(c => [c.dataset.key, c.getBoundingClientRect()]));
  mutate();
  if (RM.matches || grid.children.length > 80) return;
  for (const c of grid.children) {
    const f = before.get(c.dataset.key); if (!f) continue;
    const l = c.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
    if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 280, easing: EASE });
  }
}
async function exitCards(ids) {
  if (RM.matches) return;
  const els = ids.map(id => $(`#view [data-sid="${id}"]`)).filter(Boolean);
  await Promise.all(els.map(e => e.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 170, easing: EASE, fill: 'forwards' }).finished));
}

/* ═════════ Diálogos ═════════ */
$$('dialog').forEach(d => {
  d.addEventListener('mousedown', e => { if (e.target === d && !d.hasAttribute('data-lock')) d.close(); });
  d.addEventListener('cancel', e => { if (d.hasAttribute('data-lock')) e.preventDefault(); });
  $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
});
const errOf = d => $('.form-err', d);
async function submitting(form, fn) {
  const btn = $('button[type=submit]', form), err = $('.form-err', form);
  err.textContent = ''; btn.disabled = true;
  try { await fn(); } catch (x) { err.textContent = x.message; } finally { btn.disabled = false; }
}
function ask({ title, body, ok = 'Confirmar', danger = false, ic = 'triangle-alert' }) {
  return new Promise(res => {
    const d = $('#cdlg');
    d.querySelector('.dlg').classList.toggle('danger', danger);
    $('#c_ic').replaceChildren(icon(ic)); $('#c_t').textContent = title;
    $('#c_b').replaceChildren(...[].concat(body).map(b => typeof b === 'string' ? h('p', {}, b) : b));
    const okb = $('#c_ok'); okb.textContent = ok; okb.className = 'btn ' + (danger ? 'danger solid' : 'primary');
    d.returnValue = ''; d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
    d.showModal(); (danger ? $('button[value=cancel]', d) : okb).focus();
  });
}

/* ═════════ Selección múltiple ═════════ */
const sel = { on: false, ids: new Set(), cfg: null };
function selStart(cfg) {
  selStop(); sel.on = true; sel.cfg = cfg; cfg.btn?.setAttribute('aria-pressed', 'true');
  document.body.classList.add('selecting');
  $('#selacts').replaceChildren(...cfg.actions.map((a, i) => h('button', { class: 'btn ' + (a.danger ? 'danger' : ''), type: 'button', 'data-i': i, onclick: () => selRun(a) }, icon(a.icon), a.label)));
  selSync(); $('#selbar').classList.add('show'); $('#selbar').inert = false;
}
function selStop() {
  if (!sel.on) return;
  sel.cfg?.btn?.setAttribute('aria-pressed', 'false');
  sel.on = false; sel.ids.clear(); document.body.classList.remove('selecting');
  $('#selbar').classList.remove('show'); $('#selbar').inert = true; selSync(true);
}
function selToggle(id) {
  if (!sel.on || !sel.cfg.selectable(id)) return;
  sel.ids.has(id) ? sel.ids.delete(id) : sel.ids.add(id); selSync();
}
function selSync(off) {
  $$('[data-sid]').forEach(el => {
    const on = !off && sel.ids.has(el.dataset.sid);
    el.classList.toggle('is-selected', on);
    if (off) { el.removeAttribute('role'); el.removeAttribute('aria-checked'); }
    else if (!el.classList.contains('locked')) { el.setAttribute('role', 'checkbox'); el.setAttribute('aria-checked', on); }
  });
  if (off || !sel.cfg) return;
  const n = sel.ids.size, all = sel.cfg.ids(), full = all.length > 0 && all.every(i => sel.ids.has(i)), [one, many] = sel.cfg.noun, [s1, s2] = sel.cfg.fem ? ['seleccionada', 'seleccionadas'] : ['seleccionado', 'seleccionados'];
  fill($('#selcount'), n ? [`${n} `, h('span', { class: 'noun' }, `${plural(n, one, many)} `), plural(n, s1, s2)] : `Elige ${many}`);
  const sa = $('#selall'); sa.replaceChildren(icon('check-check'), h('span', { class: 'lbl' }, full ? 'Quitar todo' : 'Seleccionar todo')); sa.setAttribute('aria-label', full ? 'Quitar todo' : 'Seleccionar todo'); sa.disabled = !all.length;
  sa.onclick = () => { full ? sel.ids.clear() : all.forEach(i => sel.ids.add(i)); selSync(); };
  $$('#selacts .btn').forEach(b => b.disabled = !n);
}
async function selRun(a) {
  const ids = [...sel.ids]; if (!ids.length) return;
  $$('#selbar .btn').forEach(b => b.disabled = true);
  try { await a.run(ids); } catch (x) { toast(x.message, 'err'); if (sel.on) selSync(); }
}
$('#selx').onclick = selStop;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel.on && !$('dialog[open]')) selStop(); });
// Hace que una card participe en la selección (clic, Espacio/Enter)
function selectable(el, id, ok = true) {
  el.dataset.sid = String(id); el.dataset.key = String(id);
  put(el,h('span', { class: 'pick', 'aria-hidden': 'true' }, icon('check')));
  if (!ok) { el.classList.add('locked'); el.title = 'No puedes seleccionar este elemento'; return el; }
  el.addEventListener('click', () => { if (sel.on) selToggle(String(id)); });
  return el;
}
const selToggleBtn = (cfg) => {
  const b = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: () => sel.on && sel.cfg === cfg ? selStop() : selStart(cfg) }, icon('list-checks'), 'Seleccionar varios');
  cfg.btn = b; return b;
};

/* ═════════ Estado y navegación ═════════ */
const S = { me: null, view: 'home', kind: 'dynamic', hist: false, evId: null, intro: true };
const KIND = {
  dynamic: { one: 'dinámica', many: 'Dinámicas', ic: 'party-popper', nuevo: 'Nueva dinámica', editar: 'Editar dinámica' },
  voting: { one: 'votación', many: 'Votaciones', ic: 'vote', nuevo: 'Nueva votación', editar: 'Editar votación' },
};
const TABS = [
  { id: 'home', label: 'Inicio', ic: 'layout-grid' }, { id: 'members', label: 'Integrantes', ic: 'users' },
  { id: 'dynamic', label: 'Dinámicas', ic: 'party-popper' }, { id: 'voting', label: 'Votaciones', ic: 'vote' },
  { id: 'admins', label: 'Administradoras', ic: 'shield-check', su: true },
];
const tabOf = () => S.view === 'home' ? 'home' : S.view === 'members' ? 'members' : S.view === 'admins' ? 'admins' : S.kind;
function syncTabs() { $$('.tab').forEach(t => t.dataset.tab === tabOf() ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')); }
const VIEWS = { home: renderHome, members: renderMembers, events: renderEvents, evd: renderEvDetail, admins: renderAdmins };
async function go(view, opts = {}) {
  selStop(); closeNotes(); Object.assign(S, { view }, opts); syncTabs();
  const el = h('div', { class: 'view-in' }); $('#view').replaceChildren(el); window.scrollTo(0, 0);
  try { await VIEWS[view](el); } catch (x) { if (S.me) el.replaceChildren(emptyState('triangle-alert', 'No se pudo cargar', x.message)); }
  syncTabs(); document.title = ({ home: 'Inicio', members: 'Integrantes', events: KIND[S.kind].many, evd: 'Detalle', admins: 'Administradoras' })[view] + ' · Panel del fandom';
}
function emptyState(ic, title, text, cta) {
  return h('div', { class: 'empty glass' }, h('span', { class: 'tile-ic' }, icon(ic)), h('h3', {}, title), text ? h('p', {}, text) : null, cta);
}

/* ═════════ Acceso ═════════ */
function enter(a, msg) {
  S.me = a; clearInterval(S.poll); selStop(); closeNotes();
  $('#login').hidden = !!a; $('#app').hidden = !a;
  if (!a) { $('#view').replaceChildren(); $('#lerr').textContent = msg || ''; $('#lu').focus(); return; }
  $('#me').replaceChildren(avatar(a.display_name, true), h('span', {}, a.display_name));
  $('#me').title = 'Mi perfil';
  loadOwnProfile(a);
  $('#tabs').replaceChildren(...TABS.filter(t => !t.su || a.role === 'superadmin').map(t =>
    h('button', { class: 'tab', 'data-tab': t.id, onclick: () => t.id === 'home' ? go('home') : t.id === 'members' ? go('members') : t.id === 'admins' ? go('admins') : go('events', { kind: t.id, hist: false }) }, icon(t.ic), h('span', {}, t.label))));
  S.intro = true; go('home'); loadNotes(); S.poll = setInterval(loadNotes, 30000);
  if (a.must_change_password) $('#pdlg').showModal();
}
$('#lform').addEventListener('submit', async e => {
  e.preventDefault(); const b = $('#lgo'); b.disabled = true; $('#lerr').textContent = '';
  try { const a = await api('POST', '/api/auth/login', { username: $('#lu').value, password: $('#lp').value }); $('#lp').value = ''; enter(a); }
  catch (x) { $('#lerr').textContent = x.message; } finally { b.disabled = false; }
});
$('#lpeek').onclick = () => { const p = $('#lp'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#lpeek').replaceChildren(icon(show ? 'eye-off' : 'eye')); $('#lpeek').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); };
$('#out').onclick = async () => { try { await api('POST', '/api/auth/logout'); } catch {} enter(null); };
$('#home').onclick = () => go('home');
$('#pform').addEventListener('submit', e => { e.preventDefault(); submitting($('#pform'), async () => {
  await api('POST', '/api/auth/change-password', { current_password: $('#p_c').value, new_password: $('#p_n').value });
  S.me.must_change_password = false; $('#pdlg').removeAttribute('data-lock'); $('#pdlg').close(); $('#pform').reset(); toast('Contraseña actualizada');
}); });

/* ═════════ Notificaciones ═════════ */
let notesData = { unread: 0, items: [] };
function closeNotes() { $('#notes').classList.remove('open'); $('#notes').inert = true; $('#bell').setAttribute('aria-expanded', 'false'); }
async function loadNotes() {
  try { notesData = await api('GET', '/api/notifications'); } catch { return; }
  const c = $('#bellc'); c.hidden = !notesData.unread; c.textContent = notesData.unread;
  $('#notes').replaceChildren(h('h2', {}, 'Notificaciones'), ...(notesData.items.length ? notesData.items.map(i =>
    h('div', { class: 'nt' + (i.read_at ? '' : ' un') }, h('span', { class: 'tile-ic' }, icon(i.type === 'invite' ? 'mail-open' : 'user-check')),
      h('div', {}, h('p', {}, i.message),
        i.can_respond || i.event_id ? h('div', { class: 'acts' },
          i.can_respond ? [h('button', { class: 'btn primary', onclick: () => respond(i.event_id, true) }, icon('check'), 'Aceptar'), h('button', { class: 'btn', onclick: () => respond(i.event_id, false) }, icon('x'), 'Rechazar')] : null,
          i.event_id ? h('button', { class: 'btn ghost', onclick: () => go('evd', { evId: i.event_id }) }, 'Ver') : null) : null))
  ) : [h('div', { class: 'empty' }, h('span', { class: 'tile-ic' }, icon('inbox')), h('p', {}, 'No tienes notificaciones.'))]));
}
$('#bell').onclick = async e => {
  e.stopPropagation(); const n = $('#notes');
  if (n.classList.contains('open')) return closeNotes();
  await loadNotes(); n.inert = false; n.classList.add('open'); $('#bell').setAttribute('aria-expanded', 'true');
  try { await api('POST', '/api/notifications/read-all'); setTimeout(loadNotes, 1800); } catch {}
};
document.addEventListener('click', e => { if ($('#notes').classList.contains('open') && !e.target.closest('#notes,#bell')) closeNotes(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#notes').classList.contains('open')) { closeNotes(); $('#bell').focus(); } });
async function respond(id, ok) {
  try { await api('POST', `/api/events/${id}/respond`, { accept: ok }); toast(ok ? 'Aceptaste colaborar' : 'Rechazaste la invitación'); await loadNotes();
    if (S.view === 'evd' && S.evId === id) go('evd', { evId: id }); } catch (x) { toast(x.message, 'err'); }
}

/* ═════════ Inicio ═════════ */
async function renderHome(el) {
  const su = S.me.role === 'superadmin';
  const [mem, dyn, vot, adm, nt] = await Promise.all([
    api('GET', '/api/members'), api('GET', '/api/events?kind=dynamic'), api('GET', '/api/events?kind=voting'),
    su ? api('GET', '/api/admins?manage=1') : null, api('GET', '/api/notifications').catch(() => ({ items: [] })),
  ]);
  const pend = nt.items.filter(i => i.can_respond).length;
  const stat = (ic, t) => h('p', { class: 'stat' }, icon(ic), t);
  const tiles = [
    { ic: 'users', t: 'Integrantes', d: 'Registra, edita y organiza a quienes forman el grupo.', s: stat('user-check', `${mem.length} ${plural(mem.length, 'activo', 'activos')}`), go: () => go('members') },
    { ic: 'party-popper', t: 'Dinámicas', d: 'Crea dinámicas y marca quién participó.', s: stat('calendar-days', `${dyn.length} ${plural(dyn.length, 'programada', 'programadas')}`), go: () => go('events', { kind: 'dynamic', hist: false }) },
    { ic: 'vote', t: 'Votaciones', d: 'Registra los votos de cada integrante y cierra resultados.', s: stat('calendar-days', `${vot.length} ${plural(vot.length, 'programada', 'programadas')}`), go: () => go('events', { kind: 'voting', hist: false }) },
    su ? { ic: 'shield-check', t: 'Administradoras', d: 'Decide quién puede entrar al panel y con qué rol.', s: stat('badge-check', `${adm.filter(a => a.active).length} ${plural(adm.filter(a => a.active).length, 'cuenta activa', 'cuentas activas')}`), go: () => go('admins') } : null,
  ].filter(Boolean);
  if (S.intro) { el.classList.add('intro'); S.intro = false; }
  put(el,
    h('section', { class: 'hero' }, h('h1', {}, `Hola, ${S.me.display_name}`, h('span', { class: 'heart' }, icon('heart', 'fill'))),
      h('p', { class: 'lede' }, pend ? [`Tienes ${pend} ${plural(pend, 'invitación', 'invitaciones')} por responder.`, h('button', { class: 'btn primary', onclick: e => { e.stopPropagation(); $('#bell').click(); } }, icon('bell'), 'Ver invitaciones')] : 'Todo al día. ¿Qué quieres gestionar hoy?')),
    h('div', { class: 'grid tiles' }, tiles.map((t, i) => h('button', { class: 'card link tile', style: `--i:${i}`, onclick: t.go }, h('span', { class: 'tile-ic' }, icon(t.ic)), h('h3', {}, t.t), h('p', {}, t.d), t.s))));
}

/* ═════════ Integrantes ═════════ */
const M = { q: '', country: '', inactive: false, list: [] };
async function renderMembers(el) {
  const grid = h('div', { class: 'grid', style: '--min:270px' });
  const cfg = {
    noun: ['integrante', 'integrantes'], ids: () => M.list.map(m => String(m.id)), selectable: () => true,
    actions: [{ label: 'Eliminar', icon: 'trash-2', danger: true, run: delMembers }],
  };
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por apodo', 'aria-label': 'Buscar integrante', value: M.q, autocomplete: 'off' });
  const fc = h('select', { class: 'input', 'aria-label': 'Filtrar por país', style: 'width:auto;min-width:160px' });
  const fi = h('input', { type: 'checkbox', checked: M.inactive });
  const count = h('span', { class: 'count-pill' });
  async function load() {
    const [list, cs] = await Promise.all([api('GET', `/api/members?q=${encodeURIComponent(M.q)}&country=${encodeURIComponent(M.country)}&inactive=${M.inactive ? 1 : 0}`), api('GET', '/api/members/countries')]);
    M.list = list;
    fc.replaceChildren(new Option('Todos los países', ''), ...cs.map(x => new Option(x, x))); fc.value = M.country;
    $('#countries').replaceChildren(...cs.map(x => new Option(x)));
    count.textContent = list.length;
    const cards = list.map(memberCard);
    flip(grid, () => grid.replaceChildren(...(cards.length ? cards : [])));
    if (!cards.length) grid.replaceChildren(h('div', { style: 'grid-column:1/-1' }, M.q || M.country
      ? emptyState('search', 'Sin resultados', 'Prueba con otro apodo o quita el filtro de país.')
      : emptyState('users', 'Aún no hay integrantes', 'Agrega a la primera persona del grupo.', h('button', { class: 'btn primary', onclick: () => openMember() }, icon('plus'), 'Nuevo integrante'))));
    if (sel.on && sel.cfg === cfg) { for (const id of [...sel.ids]) if (!cfg.ids().includes(id)) sel.ids.delete(id); selSync(); }
  }
  M.reload = load;
  q.oninput = debounce(() => { M.q = q.value; load(); }, 220);
  fc.onchange = () => { M.country = fc.value; load(); };
  fi.onchange = () => { M.inactive = fi.checked; load(); };
  put(el,
    h('div', { class: 'head' }, h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon('users')), h('h1', {}, 'Integrantes', count))),
    h('div', { class: 'toolbar glass' }, h('label', { class: 'input-ic grow' }, icon('search'), q), fc,
      h('label', { class: 'switch' }, fi, h('span', { class: 'track' }), 'Incluir bajas'), h('span', { class: 'sp' }), selToggleBtn(cfg),
      h('button', { class: 'btn primary', onclick: () => openMember() }, icon('plus'), 'Nuevo integrante')),
    grid);
  await load();
}
function memberCard(m) {
  const a = age(m.birth_date), bday = m.birth_date && pd(m.birth_date).m === new Date().getMonth() + 1;
  const c = h('article', { class: 'card member' + (m.active ? '' : ' off'), tabindex: 0 }, avatar(m.nickname),
    h('div', { class: 'who' }, h('h3', { title: m.nickname }, m.nickname),
      (m.country || m.birth_date) ? h('div', { class: 'meta' }, m.country ? h('span', {}, icon('globe'), m.country) : null, m.birth_date ? h('span', {}, icon('cake'), `${fd(m.birth_date)}${a != null ? ` (${a} años)` : ''}`) : null) : null,
      m.bias ? h('div', { class: 'meta' }, 'Bias: ' + m.bias) : null,
      m.creator_name ? h('div', { class: 'meta' }, h('span', {}, icon('user'), `Agregado por: ${m.creator_name}`)) : null,
      h('div', { class: 'badges' }, !m.active ? h('span', { class: 'badge b-bad' }, icon('ban'), 'De baja') : null, bday ? h('span', { class: 'badge b-rose' }, icon('cake'), 'Cumple este mes') : null)),
    h('div', { class: 'card-actions' },
      h('button', { class: 'icon-btn', 'aria-label': `Editar a ${m.nickname}`, title: 'Editar', onclick: e => { e.stopPropagation(); openMember(m); } }, icon('pencil')),
      h('button', { class: 'icon-btn danger', 'aria-label': `Eliminar a ${m.nickname}`, title: 'Eliminar', onclick: e => { e.stopPropagation(); delMembers([String(m.id)], m.nickname); } }, icon('trash-2'))));
  return selectable(c, m.id);
}
function memberSummary(r) {
  const p = [];
  if (r.deleted) p.push(`${r.deleted} ${plural(r.deleted, 'eliminado', 'eliminados')}`);
  if (r.deactivated) p.push(`${r.deactivated} ${plural(r.deactivated, 'dado de baja por tener historial', 'dados de baja por tener historial')}`);
  return p.join(' y ') || 'Sin cambios';
}
async function delMembers(ids, name) {
  const n = ids.length;
  const ok = await ask({ danger: true, ok: 'Eliminar', ic: 'trash-2', title: n === 1 ? `Eliminar a ${name}` : `Eliminar ${n} integrantes`,
    body: ['Quienes ya participaron en dinámicas o votaciones se dan de baja en lugar de borrarse, para conservar las estadísticas.'] });
  if (!ok) { if (sel.on) selSync(); return; }
  const r = await api('POST', '/api/members/bulk-delete', { ids: ids.map(Number) });
  await exitCards(ids); selStop(); toast(memberSummary(r)); await M.reload();
}
function openMember(m) {
  const d = $('#mdlg'), f = $('#mform'); f._id = m ? m.id : null;
  $('#mdt').textContent = m ? 'Editar integrante' : 'Nuevo integrante';
  $('#m_n').value = m?.nickname || ''; $('#m_b').value = m?.birth_date || ''; $('#m_c').value = m?.country || ''; $('#m_j').value = m?.joined_at || TODAY();
  $('#m_bias').value = m?.bias || '';
  $('#m_a').checked = m ? !!m.active : true; $('#m_al').hidden = !m; errOf(f).textContent = ''; d.showModal(); $('#m_n').focus();
}
$('#mform').addEventListener('submit', e => { e.preventDefault(); const f = e.currentTarget; submitting(f, async () => {
  const b = { nickname: $('#m_n').value, birth_date: $('#m_b').value, country: $('#m_c').value, bias: $('#m_bias').value, joined_at: $('#m_j').value, active: $('#m_a').checked };
  await (f._id ? api('PATCH', '/api/members/' + f._id, b) : api('POST', '/api/members', b));
  $('#mdlg').close(); toast(f._id ? 'Cambios guardados' : 'Integrante creado'); M.reload();
}); });

/* ═════════ Dinámicas y votaciones: lista ═════════ */
const chip = c => h('span', { class: 'chip s-' + c.status }, icon(c.status === 'confirmed' ? 'circle-check' : c.status === 'pending' ? 'hourglass' : 'circle-x'), h('span', { style: 'color:var(--ink)' }, c.name));
const people = e => h('div', { class: 'meta' }, h('span', {}, icon('user'), 'Creada por ' + e.creator_name), e.supervisor_name ? h('span', {}, icon('shield-check'), 'Supervisa ' + e.supervisor_name) : null);
let E = { list: [] };
async function renderEvents(el) {
  const k = KIND[S.kind], grid = h('div', { class: 'grid', style: '--min:320px' });
  const cfg = {
    noun: ['elemento', 'elementos'], ids: () => E.list.filter(e => e.can_delete).map(e => String(e.id)), selectable: id => !!E.list.find(e => String(e.id) === id)?.can_delete,
    actions: [{ label: 'Eliminar', icon: 'trash-2', danger: true, run: delEvents }],
  };
  cfg.noun = S.kind === 'dynamic' ? ['dinámica', 'dinámicas'] : ['votación', 'votaciones']; cfg.fem = true;
  const count = h('span', { class: 'count-pill' });
  async function load() {
    E.list = await api('GET', `/api/events?kind=${S.kind}&history=${S.hist ? 1 : 0}`); count.textContent = E.list.length;
    const cards = E.list.map(eventCard);
    flip(grid, () => grid.replaceChildren(...cards));
    if (!cards.length) grid.replaceChildren(h('div', { style: 'grid-column:1/-1' }, S.hist
      ? emptyState('history', 'Todavía no hay historial', `Aquí aparecerán las ${k.many.toLowerCase()} que finalices.`)
      : emptyState(k.ic, `No hay ${k.many.toLowerCase()} programadas`, `Crea una ${k.one} para invitar a colaboradoras y registrar la participación.`, h('button', { class: 'btn primary', onclick: () => openEvForm(null) }, icon('plus'), k.nuevo))));
    if (sel.on && sel.cfg === cfg) { for (const id of [...sel.ids]) if (!cfg.ids().includes(id)) sel.ids.delete(id); selSync(); }
  }
  E.reload = load;
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ver' },
    h('button', { 'aria-pressed': String(!S.hist), onclick: () => { S.hist = false; go('events'); } }, icon('calendar-days'), 'Pendientes'),
    h('button', { 'aria-pressed': String(S.hist), onclick: () => { S.hist = true; go('events'); } }, icon('history'), 'Historial'));
  put(el,
    h('div', { class: 'head' }, h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon(k.ic)), h('h1', {}, k.many, count))),
    h('div', { class: 'toolbar glass' }, seg, h('span', { class: 'sp' }), selToggleBtn(cfg), h('button', { class: 'btn primary', onclick: () => openEvForm(null) }, icon('plus'), 'Crear ' + k.one)),
    grid);
  await load();
}
function eventCard(e) {
  const fin = e.status === 'finished', open = () => { if (!sel.on) go('evd', { evId: e.id }); };
  const c = h('article', { class: 'card link event', tabindex: 0, onclick: open, onkeydown: ev => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) { sel.on ? selToggle(String(e.id)) : open(); } else if (ev.key === ' ' && sel.on && ev.target === ev.currentTarget) { ev.preventDefault(); selToggle(String(e.id)); } } },
    h('div', { class: 'top' }, h('span', { class: 'kind' }, icon(KIND[e.kind].ic)), h('h3', {}, e.name)),
    h('div', { class: 'meta' }, h('span', {}, icon('calendar'), fdl(e.event_date)), e.start_time ? h('span', {}, icon('clock'), e.start_time) : null),
    people(e), h('div', { class: 'chips' }, e.collaborators.map(chip)),
    fin ? h('div', { class: 'stats' }, h('span', {}, icon('users'), `${e.participants} ${plural(e.participants, 'participante', 'participantes')}`), e.kind === 'voting' ? h('span', {}, icon('vote'), `${e.total_votes} ${plural(e.total_votes, 'voto', 'votos')}`) : null) : null,
    !fin && e.my_status === 'pending' ? h('div', { class: 'badges' }, h('span', { class: 'badge b-warn' }, icon('mail-open'), 'Te invitaron a colaborar')) : null);
  return selectable(c, e.id, e.can_delete);
}
async function delEvents(ids, name) {
  const n = ids.length, one = KIND[S.kind].one;
  const ok = await ask({ danger: true, ok: 'Eliminar', ic: 'trash-2', title: n === 1 ? `Eliminar «${name}»` : `Eliminar ${n} ${S.kind === 'dynamic' ? 'dinámicas' : 'votaciones'}`,
    body: [`Se borran también la participación y los votos registrados. Esta acción no se puede deshacer.`] });
  if (!ok) { if (sel.on) selSync(); return; }
  const r = await api('POST', '/api/events/bulk-delete', { ids: ids.map(Number) });
  const gone = ids.filter(i => !r.skipped.some(s => String(s.id) === i)); await exitCards(gone); selStop();
  toast(r.deleted ? `${r.deleted} ${plural(r.deleted, 'eliminada', 'eliminadas')}` : 'No se eliminó nada', r.deleted ? 'ok' : 'info');
  if (r.skipped.length) toast(`${r.skipped.length} ${plural(r.skipped.length, 'omitida', 'omitidas')}: ${r.skipped[0].reason}`, 'info');
  await E.reload();
}

/* ═════════ Formulario de dinámica / votación ═════════ */
let edEv = null;
async function openEvForm(e) {
  edEv = e; const k = KIND[S.kind], f = $('#eform'); let admins;
  try { admins = await api('GET', '/api/admins'); } catch (x) { return toast(x.message, 'err'); }
  const creator = e ? e.created_by : S.me.id, sel2 = e ? e.collaborators.map(c => c.id) : [], others = admins.filter(a => a.id !== creator);
  $('#edt').textContent = e ? k.editar : k.nuevo; $('#e_ic').replaceChildren(icon(k.ic));
  $('#e_n').value = e?.name || ''; $('#e_d').value = e?.event_date || ''; $('#e_t').value = e?.start_time || ''; $('#e_s').value = e?.description || '';
  $('#e_p').replaceChildren(new Option('Yo (quien la crea)', ''), ...others.map(a => new Option(a.display_name, a.id)));
  $('#e_p').value = e && e.supervisor_id !== creator ? e.supervisor_id : '';
  $('#e_c').replaceChildren(...(others.length ? others.map(a => h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: a.id, checked: sel2.includes(a.id) }), avatar(a.display_name, true), a.display_name)) : [h('span', { class: 'txt', style: 'color:var(--ink-3)' }, 'Aún no hay otras administradoras.')]));
  errOf(f).textContent = ''; $('#edlg').showModal(); $('#e_n').focus();
}
$('#eform').addEventListener('submit', e => { e.preventDefault(); submitting(e.currentTarget, async () => {
  const b = { kind: S.kind, name: $('#e_n').value, event_date: $('#e_d').value, start_time: $('#e_t').value, description: $('#e_s').value, supervisor_id: $('#e_p').value || null,
    collaborators: $$('#e_c input:checked').map(i => Number(i.value)) };
  if (edEv) { await api('PATCH', '/api/events/' + edEv.id, b); $('#edlg').close(); toast('Cambios guardados'); go('evd', { evId: edEv.id }); }
  else { const r = await api('POST', '/api/events', b); $('#edlg').close(); toast('Creada. Se enviaron las invitaciones'); go('evd', { evId: r.id }); }
}); });

/* ═════════ Detalle: participación y votos ═════════ */
let marks = new Map(), saved = '', EV = null, pq = '';
const sig = () => JSON.stringify([...marks].sort((a, b) => a[0] - b[0]));
async function renderEvDetail(el) {
  const e = EV = await api('GET', '/api/events/' + S.evId); S.kind = e.kind; syncTabs();
  marks = new Map(e.members.filter(m => m.participated !== null).map(m => [m.member_id, { p: !!m.participated, v: m.votes }])); saved = sig(); pq = '';
  const voting = e.kind === 'voting', on = e.can_manage, fin = e.status === 'finished', k = KIND[e.kind];
  const grid = h('div', { class: 'grid', style: '--min:290px' }), dirty = h('span', { class: 'dirty', hidden: true, title: 'Cambios sin guardar' }), saveBtn = h('button', { class: 'btn primary', onclick: () => saveMarks() }, icon('save'), 'Guardar participación', dirty);
  const kpis = h('div', { class: 'kpis' });
  const paint = () => {
    const ps = [...marks.values()].filter(x => x.p), tv = ps.reduce((a, x) => a + x.v, 0);
    fill(kpis, h('div', { class: 'kpi' }, h('b', {}, ps.length), h('span', {}, plural(ps.length, 'participante', 'participantes'))), voting ? h('div', { class: 'kpi' }, h('b', {}, tv), h('span', {}, plural(tv, 'voto', 'votos'))) : null);
    dirty.hidden = sig() === saved;
  };
  const cfg = { noun: ['integrante', 'integrantes'], ids: () => visible().map(m => String(m.member_id)), selectable: () => on,
    actions: [{ label: 'Participó', icon: 'check', run: ids => bulkMark(ids, true) }, { label: 'No participó', icon: 'x', run: ids => bulkMark(ids, false) }] };
  const visible = () => e.members.filter(m => !pq || m.nickname.toLowerCase().includes(pq.toLowerCase()));
  const setMark = (id, p, v) => { marks.set(id, { p, v: p ? v : 0 }); };
  function bulkMark(ids, p) {
    ids.forEach(i => { const id = Number(i), cur = marks.get(id); setMark(id, p, p ? (cur && cur.p ? cur.v : 1) : 0); });
    selStop(); drawGrid(); toast(`${ids.length} ${plural(ids.length, 'marcado', 'marcados')} como ${p ? 'participaron' : 'no participaron'}. Guarda para confirmar.`, 'info');
  }
  function pcard(m) {
    const s = marks.get(m.member_id), c = h('article', { class: 'card pcard', tabindex: 0 });
    const redraw = () => { const n = pcard(m); c.replaceWith(n); };
    const setP = p => { setMark(m.member_id, p, p ? (s && s.p ? s.v : 1) : 0); redraw(); };
    const setV = v => { setMark(m.member_id, true, Math.max(0, Math.min(100000, v))); redraw(); };
    const inp = h('input', { type: 'number', min: 0, max: 100000, step: 1, value: s?.v ?? 0, inputmode: 'numeric', 'aria-label': `Votos de ${m.nickname}`, disabled: !on,
      onchange: ev => { const n = Number(ev.target.value); if (!Number.isInteger(n) || n < 0) { ev.target.value = s.v; return toast('Los votos deben ser un número entero, 0 o más', 'err'); } setV(n); } });
    c.append(h('div', { class: 'id' }, avatar(m.nickname), h('div', { style: 'min-width:0' }, h('h3', { title: m.nickname }, m.nickname + (m.active ? '' : ' (baja)')), h('div', { class: 'meta' }, m.country ? h('span', {}, icon('globe'), m.country) : null))),
      h('div', { class: 'ctrl' },
        h('div', { class: 'yn', role: 'group', 'aria-label': `Participación de ${m.nickname}` },
          h('button', { class: 'y', 'aria-pressed': String(!!(s && s.p)), disabled: !on, onclick: () => setP(true) }, icon('check'), 'Participó'),
          h('button', { class: 'n', 'aria-pressed': String(!!(s && !s.p)), disabled: !on, onclick: () => setP(false) }, icon('x'), 'No')),
        voting && s && s.p ? h('div', { class: 'step' }, h('button', { class: 'icon-btn', disabled: !on || s.v <= 0, 'aria-label': 'Quitar un voto', onclick: () => setV(s.v - 1) }, icon('minus')), inp,
          h('button', { class: 'icon-btn', disabled: !on, 'aria-label': 'Sumar un voto', onclick: () => setV(s.v + 1) }, icon('plus'))) : null));
    selectable(c, m.member_id, on); c.classList.toggle('is-selected', sel.on && sel.ids.has(String(m.member_id)));
    paint(); return c;
  }
  function drawGrid() {
    const v = visible(); grid.replaceChildren(...(v.length ? v.map(pcard) : [h('div', { style: 'grid-column:1/-1' }, emptyState('search', 'Sin resultados', 'Ningún integrante coincide con la búsqueda.'))]));
    if (sel.on) selSync(); paint();
  }
  const bar = on ? h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => openEvForm(e) }, icon('pencil'), 'Editar'), saveBtn,
    h('button', { class: 'btn', onclick: finishEv }, icon('flag'), 'Finalizar'), e.can_delete ? h('button', { class: 'btn danger', onclick: delEv }, icon('trash-2'), 'Eliminar') : null)
    : (e.can_delete ? h('div', { class: 'actions' }, h('button', { class: 'btn danger', onclick: delEv }, icon('trash-2'), 'Eliminar')) : null);
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Buscar integrante', 'aria-label': 'Buscar integrante', autocomplete: 'off', oninput: debounce(ev => { pq = ev.target.value; drawGrid(); }, 160) });
  put(el,
    h('button', { class: 'btn ghost back', onclick: () => go('events', { kind: e.kind, hist: fin }) }, icon('chevron-left'), k.many),
    e.my_status === 'pending' && !fin ? h('div', { class: 'banner glass' }, icon('mail-open'), h('span', { class: 'grow' }, 'Te invitaron a colaborar en esta ' + k.one + '.'),
      h('button', { class: 'btn primary', onclick: () => respond(e.id, true) }, icon('check'), 'Aceptar'), h('button', { class: 'btn', onclick: () => respond(e.id, false) }, icon('x'), 'Rechazar')) : null,
    h('section', { class: 'hero-card glass' },
      h('div', { class: 'top' }, h('span', { class: 'tile-ic' }, icon(k.ic)), h('div', { style: 'min-width:0' }, h('h1', {}, e.name),
        h('div', { class: 'badges', style: 'margin-top:8px' }, fin ? h('span', { class: 'badge b-ok' }, icon('circle-check'), 'Finalizada, solo lectura') : h('span', { class: 'badge b-aqua' }, icon('calendar-days'), 'Programada')))),
      h('div', { class: 'meta' }, h('span', {}, icon('calendar'), fdl(e.event_date)), e.start_time ? h('span', {}, icon('clock'), 'Abre a las ' + e.start_time) : null),
      e.description ? h('p', { class: 'desc' }, e.description) : null, people(e), h('div', { class: 'chips' }, e.collaborators.map(chip)), kpis, bar),
    h('div', { class: 'head', style: 'margin-bottom:12px' }, h('h2', {}, 'Integrantes')),
    h('div', { class: 'toolbar glass' }, h('label', { class: 'input-ic grow' }, icon('search'), q), h('span', { class: 'sp' }), on ? selToggleBtn(cfg) : null),
    grid);
  drawGrid();
}
async function saveMarks(quiet) {
  try {
    const r = await api('PUT', `/api/events/${EV.id}/participations`, { entries: [...marks].map(([id, s]) => ({ member_id: id, participated: s.p, votes: s.v })) });
    if (!quiet) { toast(`Participación guardada (${r.saved})`); await go('evd', { evId: EV.id }); } return true;
  } catch (x) { toast(x.message, 'err'); return false; }
}
async function finishEv() {
  if (!await ask({ title: 'Finalizar ' + KIND[EV.kind].one, ic: 'flag', ok: 'Finalizar', body: ['Se guarda la participación actual y ya no podrás modificar nada: solo eliminarla.'] })) return;
  if (!await saveMarks(true)) return;
  try { await api('POST', `/api/events/${EV.id}/finish`); toast('Finalizada'); go('evd', { evId: EV.id }); } catch (x) { toast(x.message, 'err'); }
}
async function delEv() {
  if (!await ask({ danger: true, ok: 'Eliminar', ic: 'trash-2', title: `Eliminar «${EV.name}»`, body: ['Se borran también la participación y los votos registrados. Esta acción no se puede deshacer.'] })) return;
  try { await api('DELETE', '/api/events/' + EV.id); toast('Eliminada'); go('events', { kind: EV.kind, hist: EV.status === 'finished' }); } catch (x) { toast(x.message, 'err'); }
}

/* ═════════ Administradoras (solo superadmin) ═════════ */
let A = { list: [] }, adEdit = null;
async function renderAdmins(el) {
  if (S.me.role !== 'superadmin') return go('home');
  const grid = h('div', { class: 'grid', style: '--min:300px' }), reveal = h('div'), count = h('span', { class: 'count-pill' });
  const cfg = { noun: ['administradora', 'administradoras'], fem: true, ids: () => A.list.filter(a => a.id !== S.me.id).map(a => String(a.id)), selectable: id => Number(id) !== S.me.id,
    actions: [{ label: 'Eliminar', icon: 'trash-2', danger: true, run: delAdmins }] };
  async function load() {
    A.list = await api('GET', '/api/admins?manage=1'); count.textContent = A.list.length;
    const cards = A.list.map(adminCard); flip(grid, () => grid.replaceChildren(...cards));
    if (sel.on && sel.cfg === cfg) { for (const id of [...sel.ids]) if (!cfg.ids().includes(id)) sel.ids.delete(id); selSync(); }
  }
  A.reload = load;
  A.reveal = (who, pass) => { const code = h('code', {}, pass);
    reveal.replaceChildren(h('div', { class: 'banner glass reveal' }, icon('key-round'), h('span', { class: 'grow' }, `Clave temporal de ${who}: `, code, h('br'), h('small', { style: 'color:var(--ink-2)' }, 'Anótala ahora: no se vuelve a mostrar. Deberá cambiarla al entrar.')),
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(pass); toast('Clave copiada'); } catch { toast('Selecciona la clave y cópiala a mano', 'info'); } } }, icon('copy'), 'Copiar'),
      h('button', { class: 'icon-btn', 'aria-label': 'Cerrar aviso', onclick: () => reveal.replaceChildren() }, icon('x')))); };
  put(el,
    h('div', { class: 'head' }, h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon('shield-check')), h('h1', {}, 'Administradoras', count))),
    h('div', { class: 'toolbar glass' }, h('p', { class: 'grow', style: 'color:var(--ink-2);padding:0 6px' }, 'Quien tenga historial se da de baja en lugar de borrarse.'), selToggleBtn(cfg),
      h('button', { class: 'btn primary', onclick: () => openAdmin(null) }, icon('user-plus'), 'Nueva administradora')),
    reveal, grid);
  await load();
}
function adminCard(a) {
  const me = a.id === S.me.id, su = a.role === 'superadmin';
  const c = h('article', { class: 'card admin' + (a.active ? '' : ' off'), 'data-palette': a.profile_palette || 'default', tabindex: 0 },
    h('div', { class: 'row' }, profileAvatar(a), h('div', { class: 'who' }, h('h3', { title: a.display_name }, a.display_name), h('div', { class: 'meta' }, h('span', {}, icon('at-sign'), a.username))),
      h('div', { class: 'card-actions' },
        h('button', { class: 'icon-btn', 'aria-label': `Editar a ${a.display_name}`, title: 'Editar', onclick: e => { e.stopPropagation(); openAdmin(a); } }, icon('pencil')),
        h('button', { class: 'icon-btn', 'aria-label': `Restablecer clave de ${a.display_name}`, title: me ? 'Tu clave se cambia al entrar' : 'Restablecer clave', disabled: me, onclick: e => { e.stopPropagation(); resetPass(a); } }, icon('key-round')),
        h('button', { class: 'icon-btn danger', 'aria-label': `Eliminar a ${a.display_name}`, title: me ? 'No puedes eliminarte' : 'Eliminar', disabled: me, onclick: e => { e.stopPropagation(); delAdmins([String(a.id)], a.display_name); } }, icon('trash-2')))),
    profileDetails(a),
    h('div', { class: 'foot' }, h('div', { class: 'badges' },
      su ? h('span', { class: 'badge b-rose' }, icon('crown'), 'Superadmin') : h('span', { class: 'badge' }, icon('shield'), 'Administradora'),
      a.active ? null : h('span', { class: 'badge b-bad' }, icon('ban'), 'De baja'),
      a.must_change_password && a.active ? h('span', { class: 'badge b-warn' }, icon('key-round'), 'Clave temporal') : null,
      me ? h('span', { class: 'badge b-aqua' }, 'Tú') : null),
      h('span', { class: 'meta', title: 'Fecha de creación' }, h('span', {}, icon('calendar'), fd((a.created_at || '').slice(0, 10))))));
  return selectable(c, a.id, !me);
}
function openAdmin(a) {
  adEdit = a; const f = $('#aform'), me = a && a.id === S.me.id;
  $('#adt').textContent = a ? 'Editar administradora' : 'Nueva administradora';
  $('#a_n').value = a?.display_name || ''; $('#a_u').value = a?.username || ''; $('#a_r').value = a?.role || 'admin'; $('#a_a').checked = a ? !!a.active : true;
  $('#a_al').hidden = !a; $('#a_r').disabled = !!me; $('#a_a').disabled = !!me; errOf(f).textContent = '';
  $('#adlg').showModal(); $('#a_n').focus();
}
$('#aform').addEventListener('submit', e => { e.preventDefault(); submitting(e.currentTarget, async () => {
  const b = { display_name: $('#a_n').value, username: $('#a_u').value, role: $('#a_r').value };
  if (adEdit) { if (adEdit.id !== S.me.id) b.active = $('#a_a').checked; await api('PATCH', '/api/admins/' + adEdit.id, b); $('#adlg').close(); toast('Cambios guardados'); if (adEdit.id === S.me.id) { S.me.display_name = b.display_name.trim(); $('#me').replaceChildren(profileAvatar(S.me, true), h('span', {}, S.me.display_name)); } }
  else { const r = await api('POST', '/api/admins', b); $('#adlg').close(); toast('Administradora creada'); A.reveal(r.username, r.temp_password); }
  A.reload();
}); });
async function resetPass(a) {
  if (!await ask({ title: `Restablecer la clave de ${a.display_name}`, ic: 'key-round', ok: 'Restablecer', body: ['Se genera una clave temporal nueva y se cierran sus sesiones abiertas. Deberá cambiarla al entrar.'] })) return;
  try { const r = await api('PATCH', '/api/admins/' + a.id, { reset_password: true }); A.reveal(a.username, r.temp_password); toast('Clave restablecida'); A.reload(); } catch (x) { toast(x.message, 'err'); }
}
async function delAdmins(ids, name) {
  const n = ids.length;
  const ok = await ask({ danger: true, ok: 'Eliminar', ic: 'trash-2', title: n === 1 ? `Eliminar a ${name}` : `Eliminar ${n} administradoras`,
    body: ['Pierden el acceso de inmediato. Quienes ya crearon o colaboraron en dinámicas o votaciones se dan de baja en lugar de borrarse, para no romper el historial.'] });
  if (!ok) { if (sel.on) selSync(); return; }
  const r = await api('POST', '/api/admins/bulk-delete', { ids: ids.map(Number) });
  const gone = ids.filter(i => !r.skipped.some(s => String(s.id) === i)); await exitCards(gone); selStop();
  const p = []; if (r.deleted) p.push(`${r.deleted} ${plural(r.deleted, 'eliminada', 'eliminadas')}`); if (r.deactivated) p.push(`${r.deactivated} ${plural(r.deactivated, 'dada de baja', 'dadas de baja')}`);
  toast(p.join(' y ') || 'No se eliminó nada', p.length ? 'ok' : 'info');
  if (r.skipped.length) toast(`${r.skipped.length} ${plural(r.skipped.length, 'omitida', 'omitidas')}: ${r.skipped[0].reason}`, 'info');
  await A.reload();
}

/* ═════════ Arranque ═════════ */
api('GET', '/api/auth/me').then(a => enter(a)).catch(() => enter(null));

function profileAvatar(profile, small) {
  const el = avatar(profile.display_name, small);
  if (profile.has_photo) {
    const img = h('img', { src: '/api/profile/photo/' + profile.id + '?v=' + Date.now(), alt: '' });
    img.onerror = () => img.remove();
    el.append(img);
  }
  return el;
}

function profileDetails(profile) {
  const years = age(profile.profile_birth_date);
  return h('div', { class: 'meta' },
    years === null ? null : h('span', {}, years + ' años'),
    profile.profile_country ? h('span', {}, profile.profile_country) : null,
    profile.profile_bias ? h('span', {}, 'Bias: ' + profile.profile_bias) : null);
}

function applyProfile(profile) {
  Object.assign(S.me, profile);
  $('#me').replaceChildren(profileAvatar(S.me, true), h('span', {}, S.me.display_name));
  $('#app').dataset.palette = profile.profile_palette || 'default';
}

async function loadOwnProfile(account) {
  $('#app').dataset.palette = 'default';
  try {
    const profile = await api('GET', '/api/profile');
    if (S.me === account) applyProfile(profile);
  } catch (error) {
    if (S.me === account) toast(error.message, 'err');
  }
}

async function compressProfilePhoto(file) {
  if (file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Elige una imagen JPEG, PNG o WebP de hasta 10 MB.');
  }
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('No se pudo abrir la foto.'); });
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.65, 0.45, 0.25]) {
      const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (data && data.length <= 87380) return data;
    }
    throw new Error('No se pudo comprimir la foto. Elige otra.');
  } finally {
    bitmap.close();
  }
}

$('#me').onclick = async () => {
  const account = S.me;
  try {
    const p = await api('GET', '/api/profile');
    if (S.me !== account || $('#profile-dialog').open) return;
    const f = $('#profile-form');
    f.reset();
    errOf(f).textContent = '';
    for (const [id, key] of Object.entries({ name: 'display_name', birth: 'profile_birth_date', country: 'profile_country', bias: 'profile_bias', palette: 'profile_palette' })) {
      $('#profile-' + id).value = p[key] || '';
    }
    $('#profile-birth').max = TODAY();
    $('#profile-age').textContent = p.profile_birth_date ? age(p.profile_birth_date) + ' años' : '';
    $('#profile-remove').disabled = !p.has_photo;
    $('#profile-preview').replaceChildren(profileAvatar(p));
    $('#profile-dialog').showModal();
  } catch (error) { if (S.me === account) toast(error.message, 'err'); }
};
$('#profile-birth').oninput = e => {
  $('#profile-age').textContent = e.target.value ? age(e.target.value) + ' años' : '';
};
$('#profile-form').onsubmit = e => {
  e.preventDefault();
  submitting(e.currentTarget, async () => {
    const account = S.me;
    const body = {
      display_name: $('#profile-name').value, birth_date: $('#profile-birth').value,
      country: $('#profile-country').value, bias: $('#profile-bias').value, palette: $('#profile-palette').value,
    };
    const file = $('#profile-photo').files[0];
    if (file) body.photo = await compressProfilePhoto(file);
    else if ($('#profile-remove').checked) body.photo = null;
    const profile = await api('PATCH', '/api/profile', body);
    if (S.me !== account) return;
    applyProfile(profile);
    $('#profile-dialog').close();
    if (S.view === 'admins') await go('admins');
    toast('Perfil actualizado');
  });
};
