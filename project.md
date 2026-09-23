# Adrafteo Project

## Vision

Adrafteo helps online resellers create reusable marketplace listing templates, fill in variables, and copy ready-to-post adverts quickly.

## Current Stage

**MVP / closed beta**

The product is ready for a small group of first users and feedback collection. It is not yet ready for a large public launch.

## Architecture

```text
React + Vite frontend
        |
        | Supabase client with publishable key
        v
Supabase Auth + PostgreSQL
        |
        +-- user accounts
        +-- personal templates
        +-- feedback submissions
```

Advert generation runs in the browser. It replaces variables such as `[Brand]`, `[Size]`, and `[Condition]` without calling an AI service or backend function.

## Stack

- React 18
- Vite
- Supabase Auth
- Supabase PostgreSQL
- Vercel for hosting
- IONOS for the `adrafteo.com` domain and email forwarding

## Implemented

- Landing page for unauthenticated visitors
- Adrafteo branding and favicon
- Email/password sign-up and sign-in through Supabase
- Personal templates loaded from Supabase
- Template title and description fields
- Variables in titles and descriptions
- Client-side advert generation
- Copy generated listing text
- Three-template desktop grid with bounded previews
- Unsaved-change confirmation for template editing and generation
- Account settings modal
- Password change
- Permanent account deletion with double confirmation
- Default sneaker resale template per user
- Feedback form for anonymous and authenticated visitors
- Feedback storage in Supabase
- Vercel deployment configuration

## Supabase SQL Files

Run these files in the Supabase SQL Editor:

- `supabase/default_template.sql`: creates a personal starter template for new users and adds it to existing users once.
- `supabase/delete_my_account.sql`: creates the authenticated account deletion RPC.
- `supabase/feedback.sql`: creates the feedback table with insert-only RLS policies.

The `templates` table must already exist with at least:

```text
id          uuid primary key
user_id     uuid referencing auth.users
name        text
 title       text
content     text
created_at  timestamptz
updated_at  timestamptz
```

## Environment Variables

Local `.env.local` and Vercel should contain only the public Supabase frontend values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

Never commit `.env.local` or expose a Supabase `service_role` key.

The current feedback implementation stores submissions in Supabase. It does not require Resend, SMTP, or a Vercel API function.

## Local Development

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Validate a production build:

```powershell
npm run build
```

## Deployment

Vercel settings:

```text
Framework: Vite
Build command: npm run build
Output directory: dist
```

Configure the two `VITE_SUPABASE_*` variables in Vercel for Production, Preview, and Development. Add the deployed Vercel URL to Supabase Authentication URL Configuration.

## Known Limitations

- No AI-assisted listing generation yet.
- No image upload or image hosting.
- No billing or subscriptions.
- No admin dashboard for feedback; feedback is read from Supabase Table Editor.
- Feedback submissions are insert-only but need CAPTCHA or rate limiting before a public launch.
- No automated end-to-end tests yet.
- No migration tooling; SQL files are currently run manually in Supabase.

## Next Priorities

### Before the first beta users

- Run and verify all Supabase SQL files.
- Test account creation, template creation, generation, feedback, password change, and account deletion.
- Test data isolation with two separate accounts.
- Confirm Vercel environment variables and production auth redirect URLs.
- Monitor feedback and authentication errors.

### After initial feedback

- Improve the most common confusing workflow.
- Add an admin-only feedback view or notification workflow.
- Add CAPTCHA/rate limiting to public feedback.
- Add basic automated tests.
- Consider image fields or image storage if users ask for them.

### Later

- Optional AI assistance behind an explicit user action.
- Usage limits and billing only if the product demonstrates repeated value.
- MCP integration only if an agent needs structured access to templates or generation tools.

## Product Decisions

- Keep generation client-side to minimize hosting and API costs.
- Use Supabase as the source of truth for user data.
- Give each user a copy of the default template so it can be edited or deleted independently.
- Keep the MVP focused on reusable text templates before adding AI or marketplace integrations.

## Development Workflow

- Project-wide Copilot rules live in `.github/copilot-instructions.md`.
- After substantive implementation, architecture, schema, deployment, or security changes, update this file so it remains the source of truth for project state.
