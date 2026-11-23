# Restaurant sites

Interactive restaurant websites. Each restaurant lives in its own folder and deploys as its own Netlify site.

| Restaurant | Folder | Status |
|---|---|---|
| Blaze (Nashville hot chicken, Beirut) | `blaze/` | Redesign pitch demo |
| Station / المحطة (Lebanese resto-café, 10 branches) | `station/` | Redesign pitch demo |
| Food Bae (burgers, zingers, Fit Bae, Beirut) | `foodbae/` | Redesign pitch demo (draft) |

## Blaze

Plain HTML/CSS/JS, no build step.

- **Live menu:** `app.js` reads `/api/menu`, which `_redirects` proxies to Blaze's existing system at blaze-menu.com. Prices, stock, hours and discounts stay in sync with their `/staff` editor. It checks for menu changes every minute.
- **Fallback:** if the live menu can't be reached, it shows `menu-snapshot.json` (saved copy).
- **Ordering:** cart → WhatsApp message to the number for the chosen delivery area.
- **Private demo:** `noindex` meta tag and `X-Robots-Tag` header keep it out of search engines.

Preview locally with any static server that proxies `/api/*` to `https://blaze-menu.com` (without the proxy it falls back to the snapshot).

### Things to confirm with Blaze before going live
- **Opening hours:** their system has the default 00:00–00:00 for every day, so the site shows no hours or open/closed status. Fill them in on their `/staff` page, or set `HOURS_OVERRIDE` in `blaze/app.js`.
- **How many people The Blaze Takeover feeds:** currently a placeholder of 4 (`FEEDS_GUESS` in `blaze/app.js`).
- **Instagram handle** in the footer: `@blaze.hotchicken`.
- **Higher-resolution photos:** the dish photos are 300px wide and look soft in the large photo strip.

## Station

Plain HTML/CSS/JS, no build step. Train-station theme: a food train that pulls into the hero's platform carrying plates of real dishes (tap one to order), the 10 branches as stops on three metro lines, a timetable menu, and the cart as a train ticket. English / Arabic switch (Arabic is right-to-left).

- **Menus per branch:** `data/menus/<branch>.json`, saved from each branch's ordering page. Refresh with `node tools/update-menus.js` (run from `station/`, needs Playwright). Five branches have readable online menus: Hadath, Mazraa, Moawad, Khaldeh, Saida. Nabatieh, Bar Elias, Mekseh, Ferzol and Baalbek show "menu coming soon" with a call button: their menu links don't load (Nabatieh has none).
- **Photos:** loaded from the ordering platform's image server (fbgcdn.com). Hadath's own photos are tiny placeholders, so the script reuses the same dish's photo from another branch (177 of 214 matched).
- **Placeholder photos:** about 4 in 10 dishes have Station's logo uploaded as their "photo". The refresh script detects it by fingerprint and drops it, so those dishes show a plain logo tile and never ride the train. Real photos for them would help a lot.
- **Ordering:** ticket → WhatsApp to the chosen branch, message includes English + Arabic dish names.

### Testing
`node tests/run-tests.js` (from `station/`) opens the site in a headless browser and checks 66 things: menu data, every branch, search and filters, the ticket and the WhatsApp message, Arabic, phone layout, reduced motion, and that scrolling never jumps. Add `--images` to also check that dish photos load. Failures save a screenshot to `tests/output/`. Run it after every change, and after refreshing menus.

### Things to confirm with Station before going live
- **WhatsApp numbers:** taken from each branch's ordering page (`wa` in `BRANCHES` in `station/app.js`). The Contact page lists different (landline) numbers, used for the Call button.
- **Hadath's opening hours:** not in its menu data, so the site says "Call for opening hours".
- **The about-section numbers** (20+ years, 10 branches, 85k orders) come from their current About page.

## Food Bae

Phone-first ordering (95% of their orders are on phones), styled like their Instagram posters, with a dating-app wink that matches their slogan "Too Good To Ghost".

- **Menu:** `data/menu.json`, saved from their Restbits page. Refresh with `node tools/update-menu.js` (no browser needed). 74 dishes with photos; protein/calorie numbers are only shown where Food Bae lists them.
- **Features:** swipe deck ("Can't decide? Swipe": right = match, left = ghost), compact poster deals row from their combos with the match-day card first, Fit Bae mode (high-protein first), "Same as last time?" reorder, "Complete the date" suggestions in the cart (side, drink, dessert), numbered 3-step checkout ending in "Send order on WhatsApp", English/Arabic interface, installable to the home screen (works offline once visited).
- **Owner settings in `data/promo.json`:** the match-day card (`enabled: false` hides it) and `soldOut` (dish ids shown as "Ghosted us today" with an alternative).
- **Phones first:** the first dish is about 1.1 screens down on an iPhone 13 (was 2.25 in the first draft).
- **Dips and Extras** are separate items on their current menu; here they are offered as optional add-ons inside dishes (dips on savoury dishes, extras on burgers/zingers/sandwiches).

### Things to confirm with Food Bae before going live
- **WhatsApp per branch:** both branches use the WhatsApp number on their current ordering page (`BRANCHES` in `foodbae/app.js`).
- **Opening hours:** their page data says 09:00–17:00 every day.
- **Bir El Abed dine-in:** Instagram said it was temporarily closed, then reopening; check its current status.
- **Add-ons on dishes:** confirm they are happy for dips/extras to be offered inside each dish.
