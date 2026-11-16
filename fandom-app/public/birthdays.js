'use strict';

const birthdayApi = '/api/birthdays';
const birthdayLimit = 160;

function drawBirthday(canvas, category, title, message, template) {
  canvas.width = 1500;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  const paint = image => {
    ctx.fillStyle = '#f4fbfc';
    ctx.fillRect(0, 0, 1500, 1000);
    if (image) ctx.drawImage(image, 0, 0, 1500, 1000);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#215969';
    function block(value, x, top, width, height, font, size) {
      if (!value) return;
      for (; size >= 15; size--) {
        ctx.font = font + size + 'px Georgia, serif';
        const lines = [];
        let line = '';
        for (const word of value.split(/\s+/u)) {
          const candidate = line ? line + ' ' + word : word;
          if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
          if (line) lines.push(line);
          line = '';
          for (const char of word) {
            if (ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
            line += char;
          }
        }
        if (line) lines.push(line);
        const leading = size * 1.22;
        if (lines.length * leading > height) continue;
        lines.forEach((text, i) => ctx.fillText(text, x, top + height / 2 + (i - (lines.length - 1) / 2) * leading));
        return;
      }
    }
    block(title, 750, 320, 640, 124, 'bold ', 43);
    block(message, 750, 459, 620, 194, '', 36);
  };
  paint();
  if (!template?.updated_at) return;
  const image = new Image();
  image.onload = () => paint(image);
  image.src = birthdayApi + '/templates/' + encodeURIComponent(category) + '?v=' + encodeURIComponent(template.updated_at);
}

async function renderBirthdays(el) {
  const { year, categories, members, messages } = await api('GET', birthdayApi);
  const superadmin = S.me.role === 'superadmin';
  const routes = member => birthdayApi + '/members/' + member.id;
  const option = (key, label) => h('option', { value: key }, label);
  const categorySelect = (value, label) => {
    const control = h('select', { class: 'input', 'aria-label': label }, categories.map(c => option(c.id, c.label)));
    control.value = value;
    return control;
  };
  const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
  const save = async (button, action) => {
    button.disabled = true;
    try { await action(); toast('Cambios guardados'); await go('birthdays'); }
    catch (error) { toast(error.message, 'err'); }
    finally { button.disabled = false; }
  };
  const filter = categorySelect('', 'Filtrar por categoría');
  filter.prepend(option('', 'Todas las categorías'));
  filter.value = S.birthdayFilter || '';
  const recipient = h('select', { class: 'input', 'aria-label': 'Cumpleañera o cumpleañero' });
  const detail = h('div', { class: 'birthday-detail' });
  const eligible = members.filter(m => m.birth_date && (!filter.value || m.category === filter.value));
  recipient.append(...eligible.map(m => option(m.id, m.nickname)));
  recipient.value = eligible.some(m => String(m.id) === S.birthdayMember) ? S.birthdayMember : String(eligible[0]?.id ?? '');
  filter.onchange = () => go('birthdays', { birthdayFilter: filter.value });
  recipient.onchange = () => go('birthdays', { birthdayMember: recipient.value });
  el.append(h('h1', {}, 'Cumpleaños'), h('div', { class: 'toolbar glass' },
    field('Categoría', filter), field('Integrante', recipient)), detail);

  if (superadmin) {
    const category = categorySelect(categories[0]?.id, 'Categoría de la plantilla');
    const image = h('input', { class: 'input', type: 'file', accept: 'image/png', required: true });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Subir plantilla');
    const form = h('form', { class: 'card birthday-form' }, h('h2', {}, 'Plantillas por categoría'),
      field('Categoría', category), field('Imagen PNG', image), submit);
    form.onsubmit = event => {
      event.preventDefault();
      save(submit, async () => {
        const response = await fetch(birthdayApi + '/templates/' + category.value, {
          method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: image.files[0],
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'No se pudo subir la plantilla.');
      });
    };
    el.append(form);
    const unresolved = members.filter(m => !m.birthday_category && !m.proposed_category);
    if (unresolved.length) {
      const review = h('details', { class: 'card birthday-form' },
        h('summary', {}, 'Categorías por revisar (' + unresolved.length + ')'));
      for (const member of unresolved) {
        const choice = categorySelect(member.category, 'Categoría de ' + member.nickname);
        const button = h('button', { class: 'btn' }, 'Asignar');
        button.onclick = () => save(button, () => api('PATCH', routes(member) + '/category', { category: choice.value }));
        review.append(h('div', { class: 'birthday-review' },
          field(member.nickname + (member.bias ? ' · ' + member.bias : ' · Sin bias'), choice), button));
      }
      el.append(review);
    }
  }

  const member = eligible.find(m => String(m.id) === recipient.value);
  if (!member) {
    detail.append(h('p', {}, 'No hay integrantes con cumpleaños registrado en esta categoría.'));
    return;
  }
  S.birthdayMember = String(member.id);
  const entries = messages.filter(m => m.member_id === member.id);
  const mine = entries.find(m => m.admin_id === S.me.id);
  const approved = entries.find(m => m.approved);
  const date = new Date(member.birth_date + 'T12:00:00Z');
  const day = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  const age = year - date.getUTCFullYear();
  const greeting = `Hoy, ${day}, AlwaysTxT te desea ${age === 1 ? 'un feliz primer año' : 'unos felices ' + age + ' años'}, ${member.nickname}.`;
  const template = categories.find(c => c.id === member.category);
  const canvas = h('canvas', { class: 'birthday-preview', role: 'img', 'aria-label': greeting });
  const area = h('textarea', { class: 'input', rows: 3, maxlength: birthdayLimit, placeholder: 'Escribe un mensaje si quieres agregar uno.' });
  area.value = mine?.message || '';
  const counter = h('span', { class: 'meta' });
  const preview = h('input', { type: 'checkbox' });
  function redraw() {
    counter.textContent = area.value.length + ' / ' + birthdayLimit;
    const message = preview.checked ? area.value.trim() : approved?.message;
    canvas.setAttribute('aria-label', [greeting, message].filter(Boolean).join(' '));
    drawBirthday(canvas, member.category, greeting, message, template);
  }
  area.oninput = () => { preview.checked = true; redraw(); };
  preview.onchange = redraw;
  redraw();
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Guardar mensaje');
  const form = h('form', { class: 'card birthday-form' }, field('Mensaje para el cumpleañero (opcional)', area), counter,
    h('label', {}, preview, ' Ver mi borrador en la tarjeta'), button,
    mine ? h('p', {}, mine.approved ? 'Tu mensaje está aprobado.' : 'Tu mensaje está pendiente de aprobación.') : null);
  form.onsubmit = event => {
    event.preventDefault();
    save(button, () => api('PUT', routes(member) + '/message', { message: area.value }));
  };
  detail.append(canvas);
  if (!template?.updated_at) detail.append(h('p', {}, 'Esta categoría aún no tiene plantilla cargada.'));
  detail.append(form);

  if (superadmin) {
    const category = categorySelect(member.category, 'Categoría del integrante');
    const assign = h('button', { class: 'btn' }, 'Guardar categoría');
    assign.onclick = () => save(assign, () => api('PATCH', routes(member) + '/category', { category: category.value }));
    const approvals = h('section', { class: 'card birthday-form' }, h('h2', {}, 'Mensajes para revisar'),
      field('Categoría del integrante', category), assign);
    for (const entry of entries) {
      const approve = h('button', { class: 'btn' }, entry.approved ? 'Quitar aprobación' : 'Aprobar mensaje');
      approve.onclick = () => save(approve, () => api('PUT', routes(member) + '/approval', {
        admin_id: entry.approved ? null : entry.admin_id, message: entry.message,
      }));
      approvals.append(h('article', { class: 'birthday-entry' }, h('strong', {}, entry.display_name),
        h('p', {}, entry.message), approve));
    }
    if (!entries.length) approvals.append(h('p', {}, 'Todavía no hay mensajes.'));
    detail.append(approvals);
  }
}
