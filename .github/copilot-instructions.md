# Adrafteo Project Guidelines

## Product Context

Adrafteo is an early-beta SaaS for resellers. Users create reusable marketplace listing templates, fill variables in titles and descriptions, and copy generated adverts.

## Architecture

- React + Vite frontend.
- Supabase Auth and PostgreSQL are the source of truth for user data.
- Vercel hosts the frontend.
- Advert generation is intentionally client-side string replacement; do not add server or AI calls for ordinary generation.
- Templates belong to the authenticated user through `user_id` and Supabase RLS.
- Feedback is stored in Supabase through insert-only RLS policies.

## Implementation Rules

- Preserve the existing React/Vite/Supabase stack and local patterns.
- Keep changes focused; avoid unrelated refactors and dependency additions.
- Keep user-facing text clear and consistent with the Adrafteo brand.
- Protect unsaved template and generator input before closing a modal.
- Keep account deletion explicit, destructive, and protected by double confirmation.
- Never expose Supabase `service_role` keys, SMTP credentials, API keys, or other secrets in frontend code or `VITE_*` variables.
- Do not bypass RLS. Any new Supabase table or RPC must include appropriate policies and a SQL file under `supabase/`.
- Give every user-owned record a `user_id` and scope reads, updates, and deletes to the current user.
- Default templates must be personal copies created for each user, never shared mutable rows.
- Maximize SEO and GEO thoughtfully for all public user-facing content and features. Use clear intent-based copy, semantic headings, accessible HTML, accurate metadata, canonical URLs, Open Graph data, structured data, internal links, crawlable public content, and useful FAQ-style answers where relevant.
- Keep SEO and GEO factual and user-first: never use keyword stuffing, hidden text, fake reviews, misleading JSON-LD, duplicate thin pages, or expose private authenticated content to crawlers.
- Preserve Adrafteo's multi-platform positioning. Do not create marketplace-specific pages unless each page provides genuinely distinct, useful content and still explains the reusable cross-platform template model.

## Validation

After frontend or configuration changes, run:

```powershell
npm run build
```

Also inspect relevant diagnostics and test the changed workflow when possible. Do not claim a feature works without mentioning validation or a remaining setup step.

For SEO/GEO-related changes, also verify public metadata, canonical URLs, Open Graph previews, robots.txt, sitemap.xml, structured data, mobile rendering, accessibility, and Core Web Vitals when the relevant surfaces exist.

## Project Documentation

`README.md` is for setup and user-facing project information. `project.md` is the working source of truth for architecture, progress, decisions, known limitations, and next priorities.

After every substantive implementation, architecture, schema, deployment, or security change:

1. Update `project.md` to reflect the new state.
2. Add the change to `Implemented`, `Known Limitations`, `Next Priorities`, or `Product Decisions` as appropriate.
3. Keep the update concise and factual.
4. Do not update `project.md` for trivial formatting-only changes unless the project state changed.

When a task changes Supabase behavior, update the relevant SQL file and mention the required SQL execution step in `project.md`.
