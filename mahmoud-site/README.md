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
Netlify: connect this repo; `netlify.toml` sets the build (`npm run build`, publish `dist`).
`public/_redirects` makes `/video`, `/brands`, `/admin` work on refresh.
