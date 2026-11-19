'use strict';

function memberSections(current) {
  return h('nav', { class: 'birthday-sections', 'aria-label': 'Integrantes' },
    [
      ['members', 'Lista de integrantes', 'users'],
      ['birthdayCalendar', 'Calendario de cumpleaños', 'calendar-days'],
    ].map(([view, label, symbol]) => h('button', { class: 'btn ' + (view === current ? 'primary' : 'ghost'),
      'aria-current': view === current ? 'page' : null,
      onclick: () => { if (view !== current) go(view); } }, icon(symbol), label)));
}

function birthdayDateLabel(date, options) {
  return new Intl.DateTimeFormat('es-EC', { ...options, timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
}

function adjacentBirthdayMonth(month, offset) {
  const date = new Date(month + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

async function openBirthdayCard(member, date, trigger) {
  trigger.disabled = true;
  try {
    const card = await api('GET', birthdayApi + '/calendar/' + member.id + '/card?date=' + encodeURIComponent(date));
    if (!trigger.isConnected) return;
    const day = birthdayDateLabel(card.date, { day: 'numeric', month: 'long' });
    const age = card.age === 1 ? 'un feliz primer año' : 'unos felices ' + card.age + ' años';
    const greeting = 'Hoy, ' + day + ', AlwaysTxT te desea ' + age + ', ' + card.name + '.';
    const image = new Image();
    image.src = birthdayTemplateUrl(card.template);
    const qrImage = card.qr ? new Image() : null;
    if (qrImage) qrImage.src = card.qr;
    try { await Promise.all([image.decode(), qrImage?.decode()]); }
    catch { throw new Error('No se pudo abrir la plantilla. Inténtalo nuevamente.'); }
    if (!trigger.isConnected) return;
    birthdayDialog('Tarjeta de ' + card.name, (body, close) => {
      const canvas = h('canvas', { class: 'birthday-preview', role: 'img',
        'aria-label': [greeting, card.message].filter(Boolean).join(' ') });
      drawBirthdayCard(canvas, image, greeting, card.message, qrImage);
      const download = h('button', { class: 'btn primary' }, 'Descargar PNG');
      download.onclick = () => {
        canvas.toBlob(blob => {
          if (!blob) return toast('No se pudo descargar la tarjeta.', 'err');
          const url = URL.createObjectURL(blob);
          h('a', { href: url, download: 'cumpleanos-' + member.id + '-' + card.date + '.png' }).click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      };
      body.append(canvas);
      if (card.song) {
        body.append(h('a', { class: 'btn birthday-song-link', href: card.song.url,
          target: '_blank', rel: 'noopener noreferrer' },
        'Escuchar ' + (card.song.title || 'la canción') + (card.song.provider ? ' en ' + card.song.provider : '')));
      }
      body.append(h('div', { class: 'dlg-f' }, close, download));
      body.parentElement.classList.add('birthday-card-dialog');
      body.parentElement.addEventListener('close', () => {
        if (trigger.isConnected) trigger.focus();
      }, { once: true });
    });
  } catch (error) {
    if (trigger.isConnected) toast(error.message, 'err');
  } finally {
    trigger.disabled = false;
  }
}

async function renderBirthdayCalendar(el) {
  let activeDate = '';
  let request = 0;
  const dayButtons = new Map();
  const monthName = h('h2', { 'aria-live': 'polite', id: 'birthday-calendar-month' });
  const previous = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior' }, icon('chevron-left'));
  const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente' }, icon('chevron-left', 'birthday-icon-next'));
  const todayButton = h('button', { class: 'btn', type: 'button' }, 'Hoy');
  const calendar = h('div', { class: 'birthday-calendar-grid', 'aria-labelledby': monthName.id });
  const list = h('section', { class: 'card birthday-day-panel', 'aria-label': 'Cumpleaños del día', 'aria-live': 'polite' });
  const hint = h('div', { class: 'birthday-calendar-hint' },
    h('span', {}, icon('cake'), 'Día con cumpleaños'), h('span', {}, h('i', { class: 'birthday-today-dot' }), 'Hoy'));
  const controls = h('div', { class: 'birthday-calendar-controls' }, previous,
    monthName, next, todayButton);
  const weekdays = [
    ['Lun', 'Lunes'], ['Mar', 'Martes'], ['Mié', 'Miércoles'], ['Jue', 'Jueves'],
    ['Vie', 'Viernes'], ['Sáb', 'Sábado'], ['Dom', 'Domingo'],
  ];
  calendar.append(...weekdays.map(([short, label]) => h('abbr', { class: 'birthday-weekday', title: label }, short)));
  el.append(h('div', { class: 'head' },
    h('div', { class: 'titlebox' }, h('span', { class: 'tile-ic' }, icon('calendar-days')), h('h1', {}, 'Calendario de cumpleaños'))),
    memberSections('birthdayCalendar'),
    h('div', { class: 'birthday-calendar-layout' },
      h('section', { class: 'card birthday-calendar-panel' }, controls, calendar, hint), list));

  function selectDay(data, date) {
    activeDate = date;
    for (const [day, button] of dayButtons) button.setAttribute('aria-pressed', String(day === date));
    if (!date) {
      list.replaceChildren(h('span', { class: 'tile-ic' }, icon('cake')), h('h2', {}, 'Sin cumpleaños este mes'),
        h('p', { class: 'birthday-muted' }, 'Puedes revisar otro mes con las flechas del calendario.'));
      return;
    }
    const label = birthdayDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });
    const people = data.birthdays[date];
    const withinWindow = date >= data.today && date <= data.through;
    const explanation = date < data.today
      ? 'Este cumpleaños ya pasó.'
      : 'Las tarjetas se habilitan ' + data.days + ' días antes del cumpleaños.';
    fill(list,
      h('h2', { class: 'birthday-day-title' }, label),
      h('p', { class: 'birthday-muted' }, people.length + ' cumpleaños'),
      !withinWindow ? h('p', { class: 'birthday-day-notice' }, explanation) : null,
      h('ul', { class: 'birthday-people' }, people.map(person => {
        const view = h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Ver plantilla de ' + person.name },
          'Ver plantilla');
        view.onclick = () => openBirthdayCard(person, date, view);
        const info = h('button', { class: 'birthday-person-name birthday-person-info', type: 'button', 'aria-label': 'Ver datos de ' + person.name,
          onclick: () => openBirthdayMember(person.id) }, h('strong', {}, person.name, person.is_admin ? ' · Administradora' : ''),
            h('small', { class: 'birthday-muted' }, person.age + (person.age === 1 ? ' año' : ' años')));
        return h('li', { class: 'birthday-person' }, person.is_admin ? profileAvatar({id:-person.id,display_name:person.name,has_photo:true}) : avatar(person.name), info, withinWindow ? view : null);
      })));
  }

  async function loadMonth(month, selectToday = false) {
    const version = ++request;
    previous.disabled = next.disabled = todayButton.disabled = true;
    calendar.setAttribute('aria-busy', 'true');
    try {
      const data = await api('GET', birthdayApi + '/calendar' + (month ? '?month=' + encodeURIComponent(month) : ''));
      if (version !== request || !el.isConnected) return;
      S.birthdayMonth = data.month;
      const before = adjacentBirthdayMonth(data.month, -1);
      const after = adjacentBirthdayMonth(data.month, 1);
      const monthLabel = birthdayDateLabel(data.month + '-01', { month: 'long', year: 'numeric' });
      monthName.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      const first = new Date(data.month + '-01T12:00:00Z');
      const offset = (first.getUTCDay() + 6) % 7;
      const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const cells = Array.from({ length: offset }, () => h('div', { 'aria-hidden': 'true', class: 'birthday-day-placeholder' }));
      dayButtons.clear();

      for (let day = 1; day <= count; day++) {
        const date = data.month + '-' + String(day).padStart(2, '0');
        const current = date === data.today;
        const birthdays = data.birthdays[date]?.length || 0;
        const css = 'birthday-day' + (current ? ' birthday-today' : '');
        if (!birthdays) {
          cells.push(h('span', { class: css, 'aria-current': current ? 'date' : null }, String(day)));
          continue;
        }
        const fullDate = birthdayDateLabel(date, { day: 'numeric', month: 'long', weekday: 'long' });
        const button = h('button', { class: css + ' birthday-marked', type: 'button',
          'aria-current': current ? 'date' : null, 'aria-label': fullDate + ', ' + birthdays + ' cumpleaños',
          onclick: () => selectDay(data, date) },
        h('span', { class: 'birthday-day-number' }, String(day)),
        h('span', { class: 'birthday-day-cake', 'aria-hidden': 'true' }, icon('cake'), birthdays > 1 ? birthdays : null));
        dayButtons.set(date, button);
        cells.push(button);
      }

      const headings = Array.from(calendar.children).slice(0, 7);
      calendar.replaceChildren(...headings, ...cells);
      const dates = Object.keys(data.birthdays).sort();
      const closest = dates.find(date => date >= data.today) || dates.at(-1) || '';
      selectDay(data, selectToday && data.birthdays[data.today] ? data.today
        : data.birthdays[activeDate] ? activeDate : closest);
      previous.disabled = !before.startsWith('20');
      next.disabled = !after.startsWith('20');
      todayButton.disabled = false;
      previous.onclick = () => loadMonth(before);
      next.onclick = () => loadMonth(after);
      todayButton.onclick = () => loadMonth(data.today.slice(0, 7), true);
    } catch (error) {
      if (version !== request || !el.isConnected) return;
      list.replaceChildren(h('p', { role: 'alert' }, error.message),
        h('button', { class: 'btn', onclick: () => loadMonth(month, selectToday) }, 'Reintentar'));
      if (calendar.children.length > 7) previous.disabled = next.disabled = todayButton.disabled = false;
    } finally {
      if (version === request) calendar.removeAttribute('aria-busy');
    }
  }

  await loadMonth(S.birthdayMonth);
}

async function openBirthdayMember(id) {
  try {
    const m = await api('GET', birthdayApi + '/calendar/' + id + '/member');
    birthdayDialog('Datos de ' + m.nickname, (body, close) => {
      body.append(h('article', { class: 'card birthday-entry' },
        h('h3', {}, m.nickname),
        m.country ? h('p', {}, 'País: ' + m.country) : null,
        m.birth_date ? h('p', {}, 'Nacimiento: ' + m.birth_date) : null,
        m.bias ? h('p', {}, 'Bias: ' + m.bias) : null,
        m.phone ? h('p', {}, 'Celular / usuario: ' + m.phone) : null,
        m.phone ? h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(m.phone); toast('Contacto copiado'); } catch { toast('No se pudo copiar', 'err'); } } }, 'Copiar contacto') : null));
      body.append(h('div', { class: 'dlg-f' }, close));
    });
  } catch (error) { toast(error.message, 'err'); }
}
