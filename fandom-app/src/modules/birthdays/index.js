const express = require('express');
const { ah } = require('../../core/http');
const { requireAuth, requireRole } = require('../auth/service');
const { id } = require('../../core/validate');

const adminOnly = requireRole('superadmin');
const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
const birthdayYear = () => Number(new Intl.DateTimeFormat('en', {
  timeZone: 'America/Guayaquil', year: 'numeric',
}).format(new Date()));
const invalid = (res, error) => res.status(400).json({ error });

exports.register = ({ app, db }) => {
  const base = '/api/birthdays';
  const assertCategory = async key => db.one('SELECT id FROM birthday_categories WHERE id=$1', [key]);
  app.get(base, requireAuth, ah(async (req, res) => {
    const year = birthdayYear();
    const categories = await db.all(`SELECT c.id,c.label,t.updated_at FROM birthday_categories c
      LEFT JOIN birthday_templates t ON c.id=t.category ORDER BY c.label`);
    const members = await db.all(`SELECT r.id,r.nickname,r.bias,r.birthday_category,r.proposed_category,
      COALESCE(r.birthday_category,r.proposed_category,'ot5') category,
      left(m.birth_date::text,10) birth_date
      FROM birthday_bias_review r JOIN members m ON m.id=r.id
      WHERE m.active=1 ORDER BY lower(r.nickname)`);
    const messages = await db.all(`SELECT b.member_id,b.admin_id,b.message,b.approved,a.display_name
      FROM birthday_messages b JOIN admins a ON b.admin_id=a.id
      WHERE b.birthday_year=$1 AND (b.admin_id=$2 OR b.approved OR $3::boolean)`,
    [year, req.admin.id, req.admin.role === 'superadmin']);
    res.json({ year, categories, members, messages });
  }));

  app.get(base + '/templates/:category', requireAuth, ah(async (req, res) => {
    const template = await db.one('SELECT image FROM birthday_templates WHERE category=$1', [req.params.category]);
    if (!template) return res.status(404).json({ error: 'Plantilla pendiente' });
    res.set('Cache-Control', 'private, no-cache').type('png').send(template.image);
  }));

  app.put(base + '/templates/:category', requireAuth, adminOnly,
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
      if (!(await assertCategory(category))) return invalid(res, 'Categoría inválida.');
      await db.run(`INSERT INTO birthday_templates(category,image) VALUES($1,$2)
        ON CONFLICT(category) DO UPDATE SET image=excluded.image,updated_at=now()`, [category, image]);
      res.json({ ok: true });
    }));

  app.patch(base + '/members/:id/category', requireAuth, adminOnly, ah(async (req, res) => {
    const member = id(req.params.id);
    const category = req.body.category;
    if (!member || typeof category !== 'string' || !(await assertCategory(category))) {
      return invalid(res, 'Integrante o categoría inválida.');
    }
    const row = await db.one('UPDATE members SET birthday_category=$1 WHERE id=$2 RETURNING id', [category, member]);
    if (!row) return res.status(404).json({ error: 'Integrante no encontrado.' });
    res.json({ ok: true });
  }));

  app.put(base + '/members/:id/message', requireAuth, ah(async (req, res) => {
    const member = id(req.params.id);
    const message = typeof req.body.message === 'string' ? req.body.message.trim().replace(/\s+/gu, ' ') : null;
    if (!member || message === null || message.length > 160 || message.includes('\u0000')) {
      return invalid(res, 'El mensaje admite hasta 160 caracteres.');
    }
    const year = birthdayYear();
    const params = [member, year, req.admin.id];
    if (!(await db.one('SELECT id FROM members WHERE id=$1 AND active=1 AND birth_date IS NOT NULL', [member]))) {
      return res.status(404).json({ error: 'Integrante sin cumpleaños registrado.' });
    }
    if (message) {
      await db.run(`INSERT INTO birthday_messages(member_id,birthday_year,admin_id,message) VALUES($1,$2,$3,$4)
        ON CONFLICT(member_id,birthday_year,admin_id) DO UPDATE SET message=excluded.message,approved=false
        WHERE birthday_messages.message IS DISTINCT FROM excluded.message`, [...params, message]);
    } else {
      await db.run('DELETE FROM birthday_messages WHERE member_id=$1 AND birthday_year=$2 AND admin_id=$3', params);
    }
    res.json({ ok: true });
  }));

  app.put(base + '/members/:id/approval', requireAuth, adminOnly, ah(async (req, res) => {
    const member = id(req.params.id);
    const admin = req.body.admin_id === null ? null : id(req.body.admin_id);
    if (!member || (req.body.admin_id !== null && (!admin || typeof req.body.message !== 'string'))) {
      return invalid(res, 'Selecciona un mensaje válido.');
    }
    const year = birthdayYear();
    const ok = await db.tx(async t => {
      if (!(await t.one('SELECT id FROM members WHERE id=$1 FOR UPDATE', [member]))) return false;
      if (admin && !(await t.one(`SELECT admin_id FROM birthday_messages
        WHERE member_id=$1 AND birthday_year=$2 AND admin_id=$3 AND message=$4 FOR UPDATE`,
      [member, year, admin, req.body.message]))) return false;
      await t.run('UPDATE birthday_messages SET approved=false WHERE member_id=$1 AND birthday_year=$2 AND approved', [member, year]);
      if (admin) await t.run('UPDATE birthday_messages SET approved=true WHERE member_id=$1 AND birthday_year=$2 AND admin_id=$3', [member, year, admin]);
      return true;
    });
    if (!ok) return res.status(409).json({ error: 'El mensaje cambió o ya no existe. Recarga la lista.' });
    res.json({ ok: true });
  }));
};
