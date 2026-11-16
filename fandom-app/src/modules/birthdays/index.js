const express = require('express');
const QRCode = require('qrcode');
const { ah } = require('../../core/http');
const { requireAuth, requireRole } = require('../auth/service');
const { isoDate, id } = require('../../core/validate');
const { birthdayWindow, birthdayOccurrence, selectForBirthday } = require('./dates');
const { songLink, songMetadata } = require('./songs');

const superadmin = requireRole('superadmin');
const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
const messageWords = 30;
const messageLength = 180;
const invalid = (res, error) => res.status(400).json({ error });
const missing = (res, error) => res.status(404).json({ error });

function normalizeMessage(message) {
  if (typeof message !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) return null;
  const normalized = message.trim().replace(/\s+/gu, ' ');
  if (normalized.length > messageLength || (normalized && normalized.split(' ').length > messageWords)) return null;
  return normalized;
}

function notifySuperadmins(db, admin, type, itemId, message) {
  return db.run(`INSERT INTO notifications(admin_id,type,birthday_item_id,message)
    SELECT id,$1,$2,$3 FROM admins WHERE active=1 AND role='superadmin' AND id<>$4`,
  [type, itemId, admin.display_name + ' ' + message, admin.id]);
}

exports.register = ({ app, db }) => {
  const base = '/api/birthdays';
  const categories = () => db.all(`SELECT c.id,c.label,t.updated_at
    FROM birthday_categories c LEFT JOIN birthday_templates t ON c.id=t.category
    ORDER BY c.label`);
  const songs = (where, args) => db.all(`SELECT s.id,s.url,s.provider,s.title,s.thumbnail_url,s.status,a.display_name
    FROM birthday_songs s JOIN admins a ON a.id=s.admin_id
    WHERE a.active=1 ${where} ORDER BY s.id DESC`, args);

  app.get(base + '/personalization', requireAuth, ah(async (req, res) => {
    const [message, ownSongs] = await Promise.all([
      db.one('SELECT message,status FROM birthday_profile_messages WHERE admin_id=$1', [req.admin.id]),
      songs('AND s.admin_id=$1', [req.admin.id]),
    ]);
    res.json({ message: message || null, songs: ownSongs, messageWords, messageLength });
  }));

  app.put(base + '/personalization/message', requireAuth, ah(async (req, res) => {
    const message = normalizeMessage(req.body.message);
    if (message === null) return invalid(res, 'Escribe hasta 30 palabras y 180 caracteres.');
    await db.tx(async t => {
      if (!message) {
        const removed = await t.one('DELETE FROM birthday_profile_messages WHERE admin_id=$1 RETURNING id', [req.admin.id]);
        if (removed) await t.run("DELETE FROM notifications WHERE type='birthday_message' AND birthday_item_id=$1", [removed.id]);
        return;
      }
      const row = await t.one(`INSERT INTO birthday_profile_messages(admin_id,message) VALUES($1,$2)
        ON CONFLICT(admin_id) DO UPDATE SET message=excluded.message,status='pending',
          revision=birthday_profile_messages.revision+1,updated_at=now()
        WHERE birthday_profile_messages.message IS DISTINCT FROM excluded.message
        RETURNING id,revision`, [req.admin.id, message]);
      if (row) {
        await t.run("DELETE FROM notifications WHERE type='birthday_message' AND birthday_item_id=$1", [row.id]);
        await notifySuperadmins(t, req.admin, 'birthday_message', row.id, row.revision === 1
          ? 'creó un mensaje personalizado para las tarjetas.'
          : 'actualizó su mensaje personalizado para las tarjetas.');
      }
    });
    res.json({ ok: true });
  }));

  app.post(base + '/personalization/songs', requireAuth, ah(async (req, res) => {
    const song = songLink(req.body.url);
    if (!song) return invalid(res, 'Pega un enlace HTTPS válido de la canción.');
    const metadata = await songMetadata(song);
    const row = await db.tx(async t => {
      const created = await t.one(`INSERT INTO birthday_songs(admin_id,url,provider,title,thumbnail_url)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(admin_id,url) DO NOTHING RETURNING id`,
      [req.admin.id, song.url, song.provider, metadata.title || null, metadata.thumbnail || null]);
      if (created) await notifySuperadmins(t, req.admin, 'birthday_song', created.id,
        'envió una canción para las tarjetas.');
      return created;
    });
    if (!row) return res.status(409).json({ error: 'Ya guardaste esta canción.' });
    res.status(201).json({ id: row.id });
  }));

  app.get(base + '/manage', requireAuth, superadmin, ah(async (req, res) => {
    const [templates, messages, submittedSongs] = await Promise.all([
      categories(),
      db.all(`SELECT m.id,m.message,m.status,m.revision,a.display_name
        FROM birthday_profile_messages m JOIN admins a ON a.id=m.admin_id
        WHERE a.active=1 ORDER BY (m.status='pending') DESC,m.updated_at DESC,m.id DESC`),
      songs('', []),
    ]);
    res.json({ templates, messages, songs: submittedSongs });
  }));

  app.patch(base + '/manage/messages/:id', requireAuth, superadmin, ah(async (req, res) => {
    const item = id(req.params.id);
    const revision = id(req.body.revision);
    const { status } = req.body;
    if (!item || !revision || !['approved', 'rejected'].includes(status)) return invalid(res, 'Revisión de mensaje inválida.');
    const row = await db.one(`UPDATE birthday_profile_messages SET status=$1,revision=revision+1
      WHERE id=$2 AND revision=$3 RETURNING id`, [status, item, revision]);
    if (!row) return res.status(409).json({ error: 'El mensaje cambió. Actualiza la lista para revisar la última versión.' });
    res.json({ ok: true });
  }));

  app.patch(base + '/manage/songs/:id', requireAuth, superadmin, ah(async (req, res) => {
    const item = id(req.params.id);
    const { status } = req.body;
    if (!item || !['approved', 'rejected'].includes(status)) return invalid(res, 'Revisión de canción inválida.');
    const song = await db.one('UPDATE birthday_songs SET status=$1 WHERE id=$2 RETURNING id', [status, item]);
    if (!song) return missing(res, 'La canción ya no está disponible.');
    res.json({ ok: true });
  }));

  app.delete(base + '/manage/songs/:id', requireAuth, superadmin, ah(async (req, res) => {
    const item = id(req.params.id);
    if (!item) return invalid(res, 'Canción inválida.');
    await db.tx(async t => {
      await t.run('DELETE FROM birthday_songs WHERE id=$1', [item]);
      await t.run("DELETE FROM notifications WHERE type='birthday_song' AND birthday_item_id=$1", [item]);
    });
    res.json({ ok: true });
  }));

  app.get(base + '/templates/:category', requireAuth, ah(async (req, res) => {
    const row = await db.one('SELECT image FROM birthday_templates WHERE category=$1', [req.params.category]);
    if (!row) return missing(res, 'Plantilla pendiente.');
    const image = Buffer.isBuffer(row.image) ? row.image : Buffer.from(row.image);
    res.set('Cache-Control', 'private, no-cache').type('png').send(image);
  }));

  app.put(base + '/templates/:category', requireAuth, superadmin,
    express.raw({ type: 'image/png', limit: '5mb' }), ah(async (req, res) => {
      const image = req.body;
      if (!Buffer.isBuffer(image) || image.length < 33 || !image.subarray(0, 8).equals(pngHeader)
          || image.toString('ascii', 12, 16) !== 'IHDR') return invalid(res, 'Sube una imagen PNG válida.');
      const width = image.readUInt32BE(16);
      const height = image.readUInt32BE(20);
      if (!width || !height || width > 3000 || height > 2000 || Math.abs(width / height - 1.5) > 0.05) {
        return invalid(res, 'Usa una plantilla horizontal de proporción 3:2, por ejemplo 1500 × 1000 px.');
      }
      const category = req.params.category;
      const found = await db.one('SELECT id FROM birthday_categories WHERE id=$1', [category]);
      if (!found) return invalid(res, 'Selecciona una categoría de bias válida.');
      await db.run(`INSERT INTO birthday_templates(category,image) VALUES($1,$2)
        ON CONFLICT(category) DO UPDATE SET image=excluded.image,updated_at=now()`, [category, image]);
      res.json({ ok: true });
    }));

  app.get(base + '/calendar', requireAuth, ah(async (req, res) => {
    const window = birthdayWindow();
    const month = req.query.month || window.today.slice(0, 7);
    if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return invalid(res, 'Mes inválido.');
    const year = Number(month.slice(0, 4));
    const members = await db.all(`SELECT id,nickname,left(birth_date::text,10) birth_date FROM members
      WHERE active=1 AND birth_date IS NOT NULL ORDER BY lower(nickname),id`);
    const days = {};
    for (const member of members) {
      const occurrence = birthdayOccurrence(member.birth_date, year);
      if (!occurrence?.date.startsWith(month + '-')) continue;
      (days[occurrence.date] ||= []).push({ id: member.id, name: member.nickname, age: occurrence.age });
    }
    res.json({ month, ...window, birthdays: days });
  }));

  app.get(base + '/calendar/:id/card', requireAuth, ah(async (req, res) => {
    const memberId = id(req.params.id);
    const date = isoDate(req.query.date);
    const { today, through, days } = birthdayWindow();
    if (!memberId || !date) return invalid(res, 'Integrante o fecha inválida.');
    if (date < today || date > through) return invalid(res, 'La tarjeta se genera dentro de los ' + days + ' días anteriores al cumpleaños.');
    const member = await db.one(`SELECT nickname,left(birth_date::text,10) birth_date
      FROM members WHERE id=$1 AND active=1`, [memberId]);
    const occurrence = member && birthdayOccurrence(member.birth_date, Number(date.slice(0, 4)));
    if (occurrence?.date !== date) return missing(res, 'No hay un cumpleaños de esta integrante en esa fecha.');
    const [templates, messages, songs] = await Promise.all([
      db.all(`SELECT t.category AS id,t.updated_at,c.label FROM birthday_templates t
        JOIN birthday_categories c ON c.id=t.category ORDER BY t.category`),
      db.all(`SELECT m.message FROM birthday_profile_messages m JOIN admins a ON a.id=m.admin_id
        WHERE m.status='approved' AND a.active=1 ORDER BY m.id`),
      db.all(`SELECT s.url,s.title,s.provider FROM birthday_songs s JOIN admins a ON a.id=s.admin_id
        WHERE s.status='approved' AND a.active=1 ORDER BY s.id`),
    ]);
    const template = selectForBirthday(templates, date, memberId);
    if (!template) return missing(res, 'Carga una plantilla en Administración para generar tarjetas.');
    const message = selectForBirthday(messages, date, memberId);
    const song = selectForBirthday(songs, date, memberId);
    const qr = song && await QRCode.toDataURL(song.url, {
      errorCorrectionLevel: 'M', margin: 4, width: 208,
      color: { dark: '#1a3441', light: '#ffffffff' },
    });
    res.json({
      name: member.nickname, date, age: occurrence.age, template,
      message: message?.message || '',
      song: song ? { title: song.title, provider: song.provider, url: song.url } : null,
      qr: qr || null,
    });
  }));
};

exports.normalizeMessage = normalizeMessage;
