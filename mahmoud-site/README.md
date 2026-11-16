# Mahmoud Haidar — portfolio site

React + Vite + Tailwind. Rebuilt from the original mahmoudhaidar.netlify.app.

## Content editing (no code needed)
Gallery photos, brands (logo, image, order) and the "Details" list are stored in
Supabase and edited at `/admin` (sign in at `/login`). Images bundled in `src/assets`
are only fallbacks shown if the database is unreachable.

## What lives in the code
- Homepage photo: `src/assets/hero.jpg` (framing in `src/pages/Index.tsx`)
- About text, contact links, footer: `src/pages/Index.tsx`
- Video page: `src/pages/Video.tsx`, file `src/assets/video.mp4`
- Fonts, colours, text styles: `src/index.css`

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Hosted on Cloudflare Workers (static assets), worker `www` on the `mahmoudhaidar`
workers.dev subdomain: https://www.mahmoudhaidar.workers.dev
Run `npm run build`, then in Cloudflare: Workers & Pages → www → upload a new version
with the `dist` folder. The build copies `index.html` into `admin/`, `login/`, `brands/`
and `video/` (scripts/route-pages.mjs) because dashboard uploads have no single-page-app
fallback; add a folder there for any new page address.

If the site address ever changes, update the `og:url` / `og:image` addresses in `index.html`
so link previews keep working.
