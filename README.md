# JH Figure storefront clone

A static, local replica of the [JH Figure homepage](https://jhfigure.com/), with the reference layout, Vietnamese content, banners, product photos, typography, and responsive styling.

## Open

Open `index.html` directly, use VS Code Live Server, or run:

```sh
cd project2
npm start
```

Then visit **http://127.0.0.1:3002**. No dependency installation is needed.

## Features

- Responsive desktop and mobile layouts
- Rotating hero banners and product carousels
- Desktop category dropdown and mobile category dialog
- Search across the included product catalog
- Product previews with quantity selection
- Favorites and cart saved in browser local storage
- Cart quantity controls, removal, and totals
- Contact links and back-to-top control

This is a frontend replica. Account authentication, order processing, and payment require the original store's backend. Informational articles and contact links open their original destinations. The video panel is represented by a local image linking to the store's YouTube channel. Product collections browse the catalog included on the cloned homepage.

## Files

- `index.html`: storefront markup
- `styles.css`: local carousel, dialog, and responsive behavior
- `app.js`: standalone interactions
- `assets/`: downloaded images, stylesheets, icons, and fonts
- `asset-sources.json`: original URLs for the mirrored assets
- `previews/`: desktop, mobile, and product-grid screenshots
- `scripts/serve.mjs`: dependency-free local preview server
- `scripts/mirror.mjs`: refresh reference markup and presentation assets (requires internet; overwrites `index.html`)
- `scripts/verify.mjs`: headless Chrome checks on Windows (requires the local server)

Run `npm run check` for JavaScript syntax validation. For browser verification, start the server, then run `node scripts/verify.mjs`.

Branding, product photographs, and original presentation assets belong to JH Figure and their respective owners. The mirrored page excludes the original analytics, store API scripts, and third-party account integrations.
