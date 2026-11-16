'use strict';

const birthdayApi = '/api/birthdays';
const birthdayStatus = {
  pending: ['Pendiente', 'b-warn'],
  approved: ['Aprobado', 'b-ok'],
  rejected: ['Rechazado', 'b-bad'],
};

function birthdayField(label, input, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), input, hint);
}

function birthdayTemplateUrl(template) {
  return birthdayApi + '/templates/' + encodeURIComponent(template.id) + '?v=' + encodeURIComponent(template.updated_at);
}

function birthdayBadge(status) {
  const [label, color] = birthdayStatus[status];
  return h('span', { class: 'badge ' + color }, label);
}

function birthdayDialog(title, layout) {
  const heading = h('h2', { id: 'birthday-dialog-title' }, title);
  const body = h('div', { class: 'dlg birthday-dialog' }, h('header', { class: 'dlg-h' }, heading));
  const dialog = h('dialog', { 'aria-labelledby': heading.id }, body);
  const close = h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, 'Cerrar');
  layout(body, close, () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function birthdaySongCard(song, showAuthor, actions = []) {
  const cover = h('div', { class: 'birthday-song-cover', 'aria-hidden': 'true' }, icon('heart'));
  if (song.thumbnail_url) {
    const image = h('img', { src: song.thumbnail_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    image.onerror = () => image.remove();
    cover.append(image);
  }
  const source = song.provider || new URL(song.url).hostname;
  return h('article', { class: 'card birthday-entry', tabindex: -1 },
    h('div', { class: 'birthday-entry-row' }, cover,
      h('div', { class: 'birthday-entry-copy' },
        h('a', { href: song.url, target: '_blank', rel: 'noopener noreferrer' }, song.title || 'Abrir canción'),
        h('p', { class: 'birthday-muted' }, source, showAuthor ? ' · ' + song.display_name : '')),
      birthdayBadge(song.status)),
    actions.length ? h('div', { class: 'birthday-actions' }, actions) : null);
}

function birthdaySongForm(move) {
  const url = h('input', { class: 'input', type: 'url', maxlength: 2048, required: true,
    placeholder: 'https://…', spellcheck: 'false' });
  const form = h('form', { class: 'birthday-form' }, birthdayField('Enlace de la canción', url),
    h('p', { class: 'form-err', role: 'alert' }),
    h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Agregar canción'));
  form.onsubmit = e => {
    e.preventDefault();
    submitting(form, async () => {
      await api('POST', birthdayApi + '/personalization/songs', { url: url.value });
      toast('Canción enviada a revisión');
      if (form.isConnected) await move();
    });
  };
  return form;
}

async function renderPersonalization(el) {
  const data = await api('GET', birthdayApi + '/personalization');
  if (!el.isConnected) return;
  const refetch = () => go('personalization');
  const message = h('textarea', { class: 'input', rows: 4, maxlength: data.messageLength,
    'aria-describedby': 'birthday-message-counter', placeholder: 'Escribe una dedicatoria que pueda servir para distintos cumpleaños…' });
  message.value = data.message?.message || '';
  const saved = message.value;
  const status = data.message?.status;
  const counter = h('small', { id: 'birthday-message-counter', class: 'birthday-muted' });
  const save = h('button', { type: 'submit', class: 'btn primary' }, icon('save'), 'Guardar mensaje');
  const form = h('form', { class: 'birthday-form' },
    birthdayField('Mensaje de cumpleaños (opcional)', message, counter),
    h('p', { class: 'form-err', role: 'alert' }), save);

  function updateCount() {
    const cleaned = message.value.trim();
    const words = cleaned ? cleaned.split(/\s+/u).length : 0;
    counter.textContent = words + ' / ' + data.messageWords + ' palabras · ' + message.value.length + ' / ' + data.messageLength + ' caracteres';
    message.setCustomValidity(words > data.messageWords ? 'Usa hasta ' + data.messageWords + ' palabras.' : '');
    save.disabled = words > data.messageWords || message.value === saved;
  }

  message.addEventListener('input', updateCount);
  updateCount();
  form.onsubmit = e => {
    e.preventDefault();
    submitting(form, async () => {
      await api('PUT', birthdayApi + '/personalization/message', { message: message.value });
      toast(message.value.trim() ? 'Mensaje guardado' : 'Mensaje retirado');
      if (form.isConnected) await refetch();
    }).finally(updateCount);
  };

  el.append(
    h('div', { class: 'head' }, h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon('sparkles')),
      h('h1', {}, 'Personalización')),
    h('button', { class: 'btn', onclick: () => $('#me').click() }, icon('user'), 'Mi perfil')),
    h('div', { class: 'birthday-personalization' },
      h('section', { class: 'card birthday-panel' },
        h('div', { class: 'birthday-panel-heading' }, h('h2', {}, 'Dedicatoria'), status ? birthdayBadge(status) : null),
        h('p', { class: 'birthday-muted' }, 'Tu mensaje se guarda para que una superadmin lo revise. Puedes dejarlo vacío.'),
        form),
      h('section', { class: 'card birthday-panel' }, h('h2', {}, 'Canciones para dedicar'),
        birthdaySongForm(refetch)),
      h('section', { class: 'birthday-song-list' }, h('h2', {}, 'Mis canciones'),
        data.songs.length ? data.songs.map(song => birthdaySongCard(song, false))
          : h('p', { class: 'birthday-muted' }, 'Todavía no has enviado canciones.'))));
}

function openBirthdayTemplateForm(templates, activeCategory, refresh) {
  birthdayDialog('Subir plantilla', (body, close, dismiss) => {
    close.textContent = 'Cancelar';
    const category = h('select', { class: 'input', required: true },
      h('option', { value: '' }, 'Selecciona un bias'),
      templates.map(item => h('option', { value: item.id }, item.label)));
    category.value = activeCategory || '';
    const file = h('input', { class: 'input', type: 'file', accept: 'image/png,.png', required: true });
    const hint = h('small', { class: 'birthday-muted', 'aria-live': 'polite' });
    const form = h('form', { class: 'birthday-form' },
      birthdayField('Categoría de bias', category, hint),
      birthdayField('Archivo PNG', file, h('small', { class: 'birthday-muted' }, 'Formato horizontal 3:2. Recomendado: 1500 × 1000 px. Hasta 5 MB.')),
      h('p', { class: 'form-err', role: 'alert' }),
      h('div', { class: 'dlg-f' }, close, h('button', { class: 'btn primary', type: 'submit' }, 'Guardar plantilla')));
    const updateHint = () => {
      const selected = templates.find(item => item.id === category.value);
      hint.textContent = selected?.updated_at ? 'El nuevo PNG reemplazará la plantilla de ' + selected.label + '.' : '';
    };
    category.onchange = updateHint;
    updateHint();
    form.onsubmit = e => {
      e.preventDefault();
      submitting(form, async () => {
        if (file.files[0].size > 5 * 1024 * 1024) throw new Error('El PNG supera los 5 MB.');
        const response = await fetch(birthdayApi + '/templates/' + encodeURIComponent(category.value), {
          method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: file.files[0],
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'No se pudo guardar la plantilla.');
        }
        dismiss();
        toast('Plantilla guardada');
        await refresh();
      });
    };
    body.append(form);
  });
}

async function renderBirthdayAdministration(el) {
  if (S.me.role !== 'superadmin') return go('home');
  const data = await api('GET', birthdayApi + '/manage');
  if (!el.isConnected) return;
  const sectionNames = { templates: 'Plantillas', messages: 'Mensajes', songs: 'Canciones' };
  const section = Object.hasOwn(sectionNames, S.birthdayReviewTab) ? S.birthdayReviewTab : 'templates';
  const target = S.birthdayReviewItem;
  const refresh = () => {
    if (el.isConnected) return go('birthdayAdministration', { birthdayReviewTab: section, birthdayReviewItem: null });
  };
  function reviewAction(button, action) {
    button.disabled = true;
    return action().then(() => {
      toast('Cambios guardados');
      if (el.isConnected) return refresh();
    }).catch(error => toast(error.message, 'err')).finally(() => { button.disabled = false; });
  }

  const panel = h('section', { class: 'birthday-content', 'aria-label': sectionNames[section] });
  el.append(
    h('div', { class: 'head' },
      h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon('cake')), h('h1', {}, 'Plantillas de cumpleaños')),
      h('button', { class: 'btn', onclick: () => go('admins') }, icon('chevron-left'), 'Administradoras')),
    h('nav', { class: 'birthday-sections', 'aria-label': 'Administración de cumpleaños' },
      Object.entries(sectionNames).map(([key, label]) => {
        const count = key === 'templates' ? 0 : data[key].filter(item => item.status === 'pending').length;
        return h('button', { class: 'btn ' + (key === section ? 'primary' : 'ghost'),
          'aria-current': key === section ? 'page' : null,
          onclick: () => go('birthdayAdministration', { birthdayReviewTab: key, birthdayReviewItem: null }) },
        label, count ? h('span', { class: 'birthday-nav-count', 'aria-label': count + ' pendientes' }, count) : null);
      })), panel);

  if (section === 'templates') {
    panel.append(
      h('div', { class: 'birthday-panel-heading' }, h('p', { class: 'birthday-muted' }, 'Una imagen por categoría de bias.'),
        h('button', { class: 'btn primary', onclick: () => openBirthdayTemplateForm(data.templates, '', refresh) },
          icon('plus'), 'Subir plantilla')),
      h('div', { class: 'birthday-template-grid' }, data.templates.map(item => h('article', { class: 'card birthday-template' },
        h('div', { class: 'birthday-template-media' }, item.updated_at
          ? h('img', { src: birthdayTemplateUrl(item), alt: 'Plantilla de ' + item.label, loading: 'lazy' })
          : h('span', {}, icon('cake'), 'Sin plantilla')),
        h('div', { class: 'birthday-template-info' }, h('h3', {}, item.label),
          h('button', { class: 'btn', onclick: () => openBirthdayTemplateForm(data.templates, item.id, refresh) },
            item.updated_at ? 'Reemplazar' : 'Subir'))))));
    return;
  }

  function buttons(item, type) {
    const actions = ['approved', 'rejected'].filter(status => status !== item.status).map(status => {
      const button = h('button', { class: 'btn ' + (status === 'approved' ? 'primary' : '') },
        status === 'approved' ? 'Aprobar' : 'Rechazar');
      button.onclick = () => reviewAction(button, () => api('PATCH', birthdayApi + '/manage/' + type + '/' + item.id,
        { status, ...(type === 'messages' ? { revision: item.revision } : {}) }));
      return button;
    });
    if (type === 'songs') {
      const remove = h('button', { class: 'btn danger' }, icon('trash-2'), 'Eliminar');
      remove.onclick = async () => {
        if (!await ask({ title: 'Eliminar canción', body: [item.title || item.url], ok: 'Eliminar', danger: true, ic: 'trash-2' })) return;
        await reviewAction(remove, () => api('DELETE', birthdayApi + '/manage/songs/' + item.id));
      };
      actions.push(remove);
    }
    return actions;
  }

  if (section === 'songs') {
    panel.append(h('section', { class: 'card birthday-panel' }, h('h2', {}, 'Agregar una canción'), birthdaySongForm(refresh)));
  }
  const list = h('div', { class: 'birthday-review-list' });
  const rows = data[section];
  let targetCard;
  for (const item of rows) {
    const card = section === 'songs' ? birthdaySongCard(item, true, buttons(item, 'songs')) :
      h('article', { class: 'card birthday-entry', tabindex: -1 },
        h('div', { class: 'birthday-panel-heading' }, h('h3', {}, item.display_name), birthdayBadge(item.status)),
        h('p', {}, item.message), h('div', { class: 'birthday-actions' }, buttons(item, 'messages')));
    list.append(card);
    if (String(item.id) === String(target)) targetCard = card;
  }
  if (!rows.length) list.append(h('p', { class: 'birthday-muted' }, section === 'songs' ? 'Todavía no hay canciones.' : 'Todavía no hay mensajes.'));
  panel.append(list);
  if (targetCard) {
    targetCard.classList.add('birthday-entry-target');
    targetCard.focus();
    targetCard.scrollIntoView({ block: 'nearest' });
  }
}

function drawBirthdayCard(canvas, image, title, message) {
  canvas.width = 1500;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, 1500, 1000);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#215969';

  function drawTextBlock(value, top, width, height, weight, size) {
    if (!value) return;
    const center = 750;
    ctx.save();
    ctx.beginPath();
    ctx.rect(center - width / 2, top, width, height);
    ctx.clip();
    for (; size >= 15; size--) {
      ctx.font = weight + size + 'px Georgia, serif';
      const lines = [];
      let line = '';
      for (const word of value.split(/\s+/u)) {
        const candidate = line ? line + ' ' + word : word;
        if (ctx.measureText(candidate).width <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = '';
        for (const character of word) {
          if (ctx.measureText(line + character).width > width) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      if (line) lines.push(line);
      const leading = size * 1.22;
      if (lines.length * leading > height) continue;
      lines.forEach((text, i) => ctx.fillText(text, center, top + height / 2 + (i - (lines.length - 1) / 2) * leading));
      break;
    }
    ctx.restore();
  }

  drawTextBlock(title, 320, 640, 124, 'bold ', 43);
  drawTextBlock(message, 459, 620, 194, '', 36);
}
