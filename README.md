# Logomagic AI Platform (Enterprise Blueprint MVP)

This repository now contains a **multi-page AI logo platform scaffold** with:

- Public pages: Home, Features, Generator, 3D, Animated, Brand Kit, Mascot, Gallery, Pricing, Blog, About, Contact, FAQ, Marketplace.
- User pages: Dashboard, Library, Editor, Settings, Billing, Downloads.
- Admin pages: Admin Dashboard, Users, Analytics, Stats, Subscriptions, Moderation, System Monitoring.
- Theme system: Futuristic, Glassmorphism, Minimal, Creative, Dark Professional.
- Auth + role system: register/login, admin role by configured owner email.
- Logo pipeline API: supports text/image/sketch input concepts and 2D/3D/animated/mascot/brand-kit outputs.
- Private user data: `/api/dashboard/me` only returns current user history.
- Admin analytics: `/api/admin/overview` returns platform metrics.
- Security basics: PBKDF2 password hashing, signed tokens, simple rate limiting, security headers.
- SEO assets: `robots.txt`, `sitemap.xml`, rich page metadata.

## Run

```bash
npm start
```

Open: `http://localhost:3000`

## Environment variables

- `PORT` (default `3000`)
- `ADMIN_EMAIL` (default `owner@logomagic.ai`)
- `JWT_SECRET` (default `super-secret-change-me`)

## Key APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/public/stats`
- `POST /api/logo/generate`
- `GET /api/dashboard/me`
- `GET /api/admin/overview` (admin only)
