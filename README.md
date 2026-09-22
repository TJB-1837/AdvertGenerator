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
