# Restaurant sites

Interactive restaurant websites. Each restaurant lives in its own folder and deploys as its own Netlify site.

| Restaurant | Folder | Status |
|---|---|---|
| Blaze (Nashville hot chicken, Beirut) | `blaze/` | Redesign pitch demo |

## Blaze

Plain HTML/CSS/JS, no build step.

- **Live menu:** `app.js` reads `/api/menu`, which `_redirects` proxies to Blaze's existing system at blaze-menu.com. Prices, stock, hours and discounts stay in sync with their `/staff` editor. It checks for menu changes every minute.
- **Fallback:** if the live menu can't be reached, it shows `menu-snapshot.json` (saved copy).
- **Ordering:** cart → WhatsApp message to the number for the chosen delivery area.
- **Private demo:** `noindex` meta tag and `X-Robots-Tag` header keep it out of search engines.

Preview locally with any static server that proxies `/api/*` to `https://blaze-menu.com` (without the proxy it falls back to the snapshot).
