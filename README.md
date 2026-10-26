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
- `src/pages/`: full screens (public pages, Overview and Inventory).
- `src/components/`: forms, cards and dialogs. For example, `ShipmentForm.jsx` handles the shipment form, and `InventoryForms.jsx` contains item creation, lot creation and lot editing.
- `src/lib/workspace.js`: shared calculations, formatting, currency settings and template variable replacement.
- `src/lib/supabase.js`: the Supabase client.
- `src/styles.css`: the shared stylesheet; legacy overrides remain for a separate visual cleanup.
- `supabase/inventory.sql`: inventory schema, access policies and transactional shipment functions.

A component is a JavaScript function returning JSX (HTML-like markup). `export` makes a component available to another file; `import` brings it into that file. `App.jsx` passes values and callbacks to components through props. To change a field, start in its form component; to change a calculation, start in `workspace.js`.

Sale costs are monetary totals: marketplace commission plus shipping to the buyer paid by the seller. For a sale of 100 with a 13% commission and 5 shipping, enter 18. Acquisition shipping is included in purchase cost instead. A shipment must contain only additional acquisition costs that were not already entered on the item.

## Validation

Run `npm test` for the business regression suite and `npm run build` for a production compilation.

The SQL regression runner uses a temporary PGlite installation (PostgreSQL in memory). It does not connect to Supabase or change application dependencies. From PowerShell:

```powershell
npm install --prefix "$env:TEMP/adrafteo-sql-validation" --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
$env:ADRAFTEO_PGLITE_MODULE = "$env:TEMP/adrafteo-sql-validation/node_modules/@electric-sql/pglite/dist/index.js"
node tests/inventory-sql.mjs
```

Before deploying the updated frontend, run `supabase/inventory.sql` in the Supabase SQL Editor to install the shipment RPCs and lot-shipping allocation triggers. This adds an allocated lot shipping share to each item and recalculates existing lot totals. Re-running the script recomputes shares rather than adding them again. Shipping is shared per physical unit: a line of quantity 2 receives twice the share of a line of quantity 1. Item final prices include their base purchase price, individual acquisition shipping, allocated lot shipping and shipment costs. The lot total is the sum of its item final prices.

Review any past shipment in which the same acquisition shipping may have been entered twice; that separate historical duplication cannot be identified automatically.
