const normalizeCountry = require('../../core/country');
const db = require('../../core/db');
const v = require('../../core/validate');
const { requireAuth } = require('../auth/service');
const { ah } = require('../../core/http');

const fields = 'id, display_name, profile_birth_date, profile_country, profile_bias, profile_palette, profile_photo IS NOT NULL AS has_photo';
const palettes = ['default', 'rose', 'lavender', 'mint', 'peach'];

exports.register = ({ app }) => {
  app.get('/api/profile', requireAuth, ah(async (req, res) => {
    res.json(await db.one(`SELECT ${fields} FROM admins WHERE id=$1`, [req.admin.id]));
  }));

  app.get('/api/profile/photo/:id', requireAuth, ah(async (req, res) => {
    const id = v.id(req.params.id);
    const row = id && await db.one('SELECT profile_photo FROM admins WHERE id=$1', [id]);
    if (!row?.profile_photo) return res.sendStatus(404);
    res.set('Cache-Control', 'private, no-store').type('image/jpeg').send(row.profile_photo);
  }));

  app.patch('/api/profile', requireAuth, ah(async (req, res) => {
    const { display_name, birth_date, country, bias, palette, photo } = req.body;
    const name = v.clean(display_name, 60);
    const date = birth_date ? v.isoDate(birth_date) : null;
    const place = country ? normalizeCountry(country) : null;
    const favorite = bias ? v.clean(bias, 60) : null;
    if (!name || (birth_date && (!date || date < '1900-01-01' || date > new Date().toISOString().slice(0, 10)))
      || (country && !place) || (bias && !favorite) || !palettes.includes(palette)) {
      return res.status(400).json({ error: 'Revisa el nombre, la fecha de nacimiento, el país, el bias y la paleta.' });
    }

    let bytes = null;
    if (photo !== undefined && photo !== null) {
      if (typeof photo !== 'string' || photo.length > 87384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
        return res.status(400).json({ error: 'Selecciona una foto válida.' });
      }
      bytes = Buffer.from(photo, 'base64');
      if (bytes.length < 5 || bytes.length > 65536 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255
        || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) {
        return res.status(400).json({ error: 'La foto debe ser JPEG y pesar hasta 64 KB después de comprimirla.' });
      }
    }

    const profile = await db.one(`UPDATE admins
      SET display_name=$1, profile_birth_date=$2, profile_country=$3, profile_bias=$4, profile_palette=$5,
          profile_photo=CASE WHEN $6 THEN $7::bytea ELSE profile_photo END
      WHERE id=$8 RETURNING ${fields}`,
    [name, date, place, favorite, palette, photo !== undefined, bytes, req.admin.id]);
    res.json(profile);
  }));
};
