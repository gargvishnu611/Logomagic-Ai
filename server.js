const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'owner@logomagic.ai').toLowerCase();
const DB_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], logos: [], counters: { userId: 1, logoId: 1 } };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const db = loadDb();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, original] = stored.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(original));
}

function createToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = (token || '').split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  if (signature !== expected) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function buildLogoResult(payload) {
  const safePrompt = payload.prompt.slice(0, 140);
  return {
    headline: `${payload.logo_type.toUpperCase()} | ${payload.style_preset} | ${payload.brand_tone}`,
    seo: {
      title: `${safePrompt} | AI Logo Studio`,
      description: `Advanced AI-generated ${payload.logo_type} logo concept with ${payload.style_preset} style and ${payload.brand_tone} tone.`,
      keywords: `${safePrompt.split(' ').slice(0, 3).join(' ')}, ${payload.logo_type}, ${payload.style_preset}, branding`
    },
    outputAssets: {
      staticPreview: `https://dummyimage.com/640x360/111827/ffffff&text=${encodeURIComponent(payload.logo_type + '+Logo')}`,
      animatedPreview: payload.logo_type === 'animated' ? 'https://example.com/fake-animation-preview.gif' : null,
      model3d: payload.logo_type === '3d' ? 'https://example.com/fake-3d-model.glb' : null
    }
  };
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  return verifyToken(token);
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath);
  const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && serveStatic(req, res)) return;

  if (req.method === 'POST' && req.url === '/api/auth/register') {
    try {
      const { name, email, password } = await parseBody(req);
      if (!name || !email || !password || password.length < 6) {
        return json(res, 400, { error: 'Name, email, and password (min 6 chars) are required.' });
      }
      const normalizedEmail = String(email).toLowerCase().trim();
      if (db.users.some((u) => u.email === normalizedEmail)) {
        return json(res, 409, { error: 'Email already exists.' });
      }
      const role = normalizedEmail === ADMIN_EMAIL ? 'admin' : 'user';
      const user = {
        id: db.counters.userId++,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        role,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      saveDb(db);
      return json(res, 201, { token: createToken({ id: user.id, role: user.role, email: user.email }), role: user.role });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    try {
      const { email, password } = await parseBody(req);
      const user = db.users.find((u) => u.email === String(email || '').toLowerCase().trim());
      if (!user || !verifyPassword(password || '', user.passwordHash)) {
        return json(res, 401, { error: 'Invalid email or password.' });
      }
      return json(res, 200, {
        token: createToken({ id: user.id, role: user.role, email: user.email }),
        role: user.role,
        name: user.name
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (req.method === 'GET' && req.url === '/api/auth/me') {
    const userAuth = authUser(req);
    if (!userAuth) return json(res, 401, { error: 'Authentication required.' });
    const user = db.users.find((u) => u.id === userAuth.id);
    return json(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at });
  }

  if (req.method === 'POST' && req.url === '/api/logo/generate') {
    const userAuth = authUser(req);
    if (!userAuth) return json(res, 401, { error: 'Authentication required.' });

    try {
      const body = await parseBody(req);
      const required = ['input_mode', 'prompt', 'logo_type', 'style_preset', 'brand_tone', 'color_palette'];
      const missing = required.filter((key) => !body[key]);
      if (missing.length) {
        return json(res, 400, { error: `Missing fields: ${missing.join(', ')}` });
      }
      const generated = buildLogoResult(body);
      const row = {
        id: db.counters.logoId++,
        user_id: userAuth.id,
        input_mode: body.input_mode,
        prompt: String(body.prompt).trim(),
        logo_type: body.logo_type,
        style_preset: body.style_preset,
        brand_tone: body.brand_tone,
        color_palette: body.color_palette,
        generated_result: generated,
        created_at: new Date().toISOString()
      };
      db.logos.push(row);
      saveDb(db);
      return json(res, 201, { id: row.id, generated });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (req.method === 'GET' && req.url === '/api/dashboard/me') {
    const userAuth = authUser(req);
    if (!userAuth) return json(res, 401, { error: 'Authentication required.' });
    const mine = db.logos.filter((r) => r.user_id === userAuth.id);
    const byTypeMap = mine.reduce((acc, row) => {
      acc[row.logo_type] = (acc[row.logo_type] || 0) + 1;
      return acc;
    }, {});
    const byType = Object.entries(byTypeMap).map(([logo_type, total]) => ({ logo_type, total }));
    return json(res, 200, {
      totalLogos: mine.length,
      byType,
      history: mine.slice(-20).reverse().map(({ id, prompt, logo_type, style_preset, brand_tone, color_palette, created_at }) => ({
        id,
        prompt,
        logo_type,
        style_preset,
        brand_tone,
        color_palette,
        created_at
      }))
    });
  }

  if (req.method === 'GET' && req.url === '/api/dashboard/admin') {
    const userAuth = authUser(req);
    if (!userAuth) return json(res, 401, { error: 'Authentication required.' });
    if (userAuth.role !== 'admin') return json(res, 403, { error: 'Admin access only.' });

    const typesMap = db.logos.reduce((acc, row) => {
      acc[row.logo_type] = (acc[row.logo_type] || 0) + 1;
      return acc;
    }, {});
    const types = Object.entries(typesMap).map(([logo_type, total]) => ({ logo_type, total }));

    return json(res, 200, {
      totalUsers: db.users.length,
      totalLogos: db.logos.length,
      types,
      recentUsers: db.users.slice(-10).reverse().map(({ id, name, email, role, created_at }) => ({ id, name, email, role, created_at }))
    });
  }

  if (serveStatic({ url: '/index.html' }, res)) return;
  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Logomagic AI running at http://localhost:${PORT}`);
});
