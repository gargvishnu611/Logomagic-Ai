# Logomagic AI

A full-stack starter for an advanced AI logo platform that supports:
- text or image-based logo prompts
- 3D logo and animated logo modes
- login/register with per-user private history
- owner/admin analytics (total users, total logos, type breakdown)
- premium visuals (parallax, glassmorphism, skeuomorphic cards, faux-depth effects)

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Admin account

By default, `owner@logomagic.ai` becomes admin on registration. You can override this:

```bash
ADMIN_EMAIL=you@yourdomain.com npm start
```

## API summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/logo/generate`
- `GET /api/dashboard/me`
- `GET /api/dashboard/admin` (admin only)
