# Adrafteo

Adrafteo helps resellers create reusable listing templates, fill in variables, and copy ready-to-post adverts in seconds.

## Stack

- React + Vite
- Supabase Auth
- Supabase PostgreSQL
- Vercel for hosting

## Local setup

Requirements:

- Node.js 18 or newer
- A Supabase project

Install dependencies:

```powershell
npm install
```

Create `.env.local` at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

Start the frontend:

```powershell
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

Create a production build:

```powershell
npm run build
```

## Supabase setup

Create a `templates` table with these columns:

```text
id          uuid primary key
user_id     uuid referencing auth.users
name        text
title       text
content     text
created_at  timestamptz
updated_at  timestamptz
```

Enable Row Level Security and add policies so users can only access their own templates.

Run these SQL files from the Supabase SQL Editor:

- `supabase/feedback.sql` creates the feedback table and allows public submissions without allowing public reads.
- `supabase/delete_my_account.sql` creates the secure account deletion function used by the account settings panel.
- `supabase/default_template.sql` adds a personal sneaker resale starter template to new and existing accounts.

Enable email/password authentication in **Authentication > Providers**. Email confirmation can remain disabled during early testing, then be enabled before a public launch.

### Google sign-in

The sign-in and sign-up screens include **Continue with Google**, using Supabase OAuth. Enable the provider before using the button:

1. In Google Auth Platform, configure the consent screen and create an OAuth client of type **Web application**. Add the application origins (`https://adrafteo.com` and `http://localhost:5173` when testing locally).
2. Copy the callback URL shown on the Google provider page in Supabase into Google's **Authorized redirect URIs**. It normally looks like `https://<project-ref>.supabase.co/auth/v1/callback`; this is the Supabase callback, not the Adrafteo home page.
3. Enable **Google** under Supabase Authentication providers and enter the Google Client ID and Client Secret there. Never put the Client Secret in frontend code or `VITE_*` variables.
4. In Supabase **Authentication > URL Configuration**, set the production Site URL and allow `https://adrafteo.com/` and `http://localhost:5173/` as redirect URLs. Add each preview URL you intend to test.
5. While the Google app is in testing, add the intended testers in its Audience configuration; configure production access before opening sign-in to everyone.

The app returns to the current application's root URL and restores the Supabase session through the existing authentication listener. A new Google account receives its own default template through the existing database trigger. Cancelled or failed OAuth callbacks return to the sign-in screen with a retry message.

Setup reference: [Supabase Google sign-in documentation](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Features

- Landing page and free account creation
- Personal listing templates stored in Supabase
- Variables in listing titles and descriptions, such as `[Brand]` or `[Size]`
- Client-side advert generation with no AI or server compute required
- Copy-ready title and description
- Safe close confirmation for unsaved template and generator data
- Account password change and permanent account deletion
- Feedback form stored in Supabase

## Deploy to Vercel

The repository includes `vercel.json` with an explicit static build configuration. Use the full `npm run build` command; running `vite build` alone does not generate the public pages or sitemap. The build output is `dist`, with no runtime rendering server. Vercel serves the generated pages and `404.html`; do not add a catch-all rewrite to `/index.html`, which would turn missing URLs into successful landing-page responses.

For everyday development, use `npm run dev`. If using `vercel dev`, the explicit `devCommand` runs npm and Vite binds to the `PORT` supplied by Vercel; Yarn is not required. Restart `vercel dev` after changing this configuration.

Import the GitHub repository into Vercel. Vercel detects Vite automatically.

Set these environment variables for Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Use:

```text
Build command: npm run build
Output directory: dist
```

After deployment, add the Vercel URL in Supabase under **Authentication > URL Configuration**. Add both the site URL and the allowed redirect URL.

## Security notes

- Never commit `.env.local`.
- Never expose a Supabase `service_role` key in the frontend.
- The Supabase publishable key is designed to be used in the browser, with RLS protecting the data.
- Feedback is intentionally insert-only from the public application. Read feedback from the Supabase dashboard.

## Current scope

Adrafteo is currently an early beta. Templates and feedback are persisted in Supabase, while advert text generation runs locally in the user's browser. There is no AI generation, billing, admin dashboard, or image hosting yet.

## Finding your way around the code

- `src/App.jsx`: connects the session, loaded data, navigation and save/delete actions.
- `src/pages/`: full screens (public pages, Overview, Inventory and the dedicated Import shipment page). Import page styles are scoped in `ShipmentPage.css`.
- `src/components/`: forms, cards and dialogs. For example, `ShipmentForm.jsx` handles the shipment form, and `InventoryForms.jsx` contains item creation, lot creation and lot editing.
- `src/lib/workspace.js`: shared calculations, formatting, currency settings and template variable replacement.
- `src/lib/supabase.js`: the Supabase client.
- `src/styles.css`: the shared stylesheet; legacy overrides remain for a separate visual cleanup.
- `supabase/inventory.sql`: inventory schema, access policies and transactional shipment functions.

A component is a JavaScript function returning JSX (HTML-like markup). `export` makes a component available to another file; `import` brings it into that file. `App.jsx` passes values and callbacks to components through props. To change a field, start in its form component; to change a calculation, start in `workspace.js`.

Sale costs are monetary totals: marketplace commission plus shipping to the buyer paid by the seller. For a sale of 100 with a 13% commission and 5 shipping, enter 18. Acquisition shipping is included in purchase cost instead. A shipment must contain only additional acquisition costs that were not already entered on the item.

### Import shipments

Use **Inventory > Import shipment** to manage import delivery, VAT and forwarding costs. Select items or lots and their physical quantities, then enter delivery and any optional fees. Each row previews its current total cost, added fees and new final cost. If only some units travel, those new fees are added to the inventory row total; the preview also includes the other units on that row.

Automatic VAT uses `sum(base_purchase_price / quantity * selected_quantity) × VAT rate`. Individual seller-to-forwarder delivery, allocated lot shipping and all shipment costs are excluded from this default base. The page displays the base and formula. A custom taxable base or an invoice VAT amount can be entered explicitly instead. Included VAT and additional delivery/forwarding fees are then shared proportionally to goods value, equally per physical unit, or manually according to the selected allocation method. Existing acquisition delivery is never prefilled as a new shipment charge.

## Validation

### Public website and SEO

The public website stays in English for V1. Its React pages are rendered to static HTML during the build and hydrated in the browser. Marketing pages do not load the Supabase client or wait for authentication. The workspace is available at `/app` and is marked `noindex`; the public root remains the marketing home even for returning users. Existing Supabase OAuth and confirmation callbacks to the root are preserved and handled by the workspace, so the current root redirect allowlist remains valid.

Public routes include `/pricing`, `/faq`, `/listing-templates`, `/reseller-inventory`, `/reseller-profit-tracking`, two `/guides/` articles, and `/legal`, `/privacy`, `/terms`. Legal pages are accessible but marked `noindex`. Public content and FAQ answers are defined in `src/lib/public-content.js`; the same FAQ data generates the visible answers and JSON-LD. `scripts/build.mjs` generates per-page metadata, canonical URLs, social cards and the sitemap. Optional `public/llms.txt` summarises the published content; it does not guarantee discovery by AI search engines.

The canonical origin is currently `https://adrafteo.com`. Confirm this domain in Vercel and configure redirects for domain aliases there. When adding or changing public pages, update the route definitions and rebuild. Keep robots.txt permissive for indexable content; never use it as an access-control mechanism for private data.

After building, run `node tests/seo-built.mjs` to validate rendered content, metadata, sitemap membership, FAQ schemas, internal links, social-image dimensions and the published profit example. `node tests/seo-browser.mjs` uses the temporary Playwright module described below to inspect the built pages without JavaScript, mobile overflow, hydration, normal navigation, sign-in screens, root OAuth cancellation and a static 404 response. This runner uses the real Vite production-preview server; production Vercel routing still needs a post-deployment check.

Before launch, verify page status codes, HTML and canonical URLs on the deployed domain, test real OAuth with the configured Google provider, inspect pages in Search Console and submit `/sitemap.xml`. Check social previews on the target platforms and measure mobile Core Web Vitals using production traffic; local browser checks do not establish field performance or indexing. Search Console/Bing access and acquisition analytics are not configured by this change.

Run `npm test` for the business regression suite and `npm run build` for a production compilation.

The SQL regression runner uses a temporary PGlite installation (PostgreSQL in memory). It does not connect to Supabase or change application dependencies. From PowerShell:

```powershell
npm install --prefix "$env:TEMP/adrafteo-sql-validation" --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
$env:ADRAFTEO_PGLITE_MODULE = "$env:TEMP/adrafteo-sql-validation/node_modules/@electric-sql/pglite/dist/index.js"
node tests/inventory-sql.mjs
```

The import-page browser regression runner uses local Chrome and temporary Playwright tooling. It runs against fictitious inventory and never connects to Supabase:

```powershell
npm.cmd install --prefix "$env:TEMP/adrafteo-browser-validation" --no-save --package-lock=false --ignore-scripts playwright
$env:ADRAFTEO_PLAYWRIGHT_MODULE = "$env:TEMP/adrafteo-browser-validation/node_modules/playwright/index.mjs"
node tests/import-shipment-browser.mjs
node tests/auth-browser.mjs
```

Desktop and mobile screenshots are written to the temporary `adrafteo-browser-validation` folder. Set `ADRAFTEO_BROWSER_EXECUTABLE` to use another installed Chromium browser.

The authentication browser runner uses a simulated Supabase client to check Google OAuth requests, errors, cancellation callbacks and email registration. A live Google sign-in still needs verification after provider configuration.

Before deploying the updated frontend, run `supabase/inventory.sql` in the Supabase SQL Editor to install the shipment RPCs and lot-shipping allocation triggers. This adds an allocated lot shipping share to each item and recalculates existing lot totals. Re-running the script recomputes shares rather than adding them again. Shipping is shared per physical unit: a line of quantity 2 receives twice the share of a line of quantity 1. Item final prices include their base purchase price, individual acquisition shipping, allocated lot shipping and shipment costs. The lot total is the sum of its item final prices.

Review any past shipment in which the same acquisition shipping may have been entered twice; that separate historical duplication cannot be identified automatically.
