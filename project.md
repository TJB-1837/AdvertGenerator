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
- SEO and GEO foundations are not implemented yet: metadata, Open Graph, robots.txt, sitemap.xml, JSON-LD, FAQ content, and SEO monitoring remain to be added.

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

## SEO and GEO Roadmap

SEO means making the site easier for search engines to discover, understand, and rank for useful searches. GEO means making the same information clear and reliable for generative search engines and AI assistants. There is no single GEO tag; crawlability, useful content, clear answers, structured data, and external trust signals are the foundation for both.

The product remains multi-platform. Adrafteo should explain that one reusable template can produce adverts for Vinted, eBay, Depop, and other marketplaces. We should not create thin duplicate pages that incorrectly imply a different product for each platform.

### Phase 1: define the search strategy

- [x] Confirm the initial audience: online resellers and marketplace sellers.
- [x] Confirm the first language: the current UI and landing page are in English, so the first SEO content will remain coherent in English.
- [x] Confirm the first geographic market: target the global English-speaking market without country-specific local SEO for the initial launch.
- [x] List initial user questions and search intents around reusable listing templates, marketplace adverts, product descriptions, and faster listing workflows.
- [x] Choose one primary topic for the home page: reusable marketplace listing templates for resellers.
- [x] Keep the product promise consistent across the website, YouTube, social profiles, and any future directory listings.

Initial search-intent hypotheses to validate before writing metadata or long-form content:

- People looking for reusable marketplace listing templates.
- Resellers looking for a faster way to write product titles and descriptions.
- Sellers looking for Vinted, eBay, Depop, or multi-marketplace listing templates.
- Sellers looking for a way to fill product variables and copy a ready-to-post advert.
- Users asking how to standardize listings across several marketplaces.

Initial user questions to answer in public content:

- What is a reusable marketplace listing template?
- How can resellers write listings faster?
- Can one template be adapted for Vinted, eBay, Depop, and other marketplaces?
- How do variables such as brand, size, and condition work?
- Are Adrafteo templates private?
- Does Adrafteo use AI to generate adverts?

The initial SEO and GEO strategy will use international English. Avoid country-specific claims, local business markup, local phone numbers, or location pages unless the product later adopts a specific regional strategy.

**Objective:** target useful searches with one clear product position instead of repeating generic marketing phrases or stuffing keywords.

### Phase 2: improve the public page metadata

- [x] Replace the generic `<title>` in `index.html` with a descriptive, unique title containing the product category.
- [x] Add one concise `meta description` explaining what Adrafteo does and who it helps.
- [x] Add the canonical URL for `https://adrafteo.com/`.
- [x] Add Open Graph metadata: `og:title`, `og:description`, `og:url`, `og:type`, and `og:image`.
- [x] Add Twitter/X card metadata using the same approved title, description, URL, and image.
- [x] Keep the favicon and theme color consistent with the brand.

The first social preview asset is `public/og-image.svg`. Phase 6 should assess replacing it with an optimized PNG or other broadly supported bitmap asset.

**Objective:** control how the home page is understood in search results and how it appears when shared in messaging apps, social networks, or work tools.

### Phase 3: improve the landing page content

- [x] Make the landing page `h1` explicitly describe reusable marketplace listing templates.
- [x] Rewrite the supporting paragraph to mention reusable templates, variables, ready-to-copy adverts, and the reseller audience naturally.
- [x] Keep one clear `h1`, then organize sections with meaningful `h2` and `h3` headings.
- [x] Explain that the same template can be adapted for multiple marketplaces instead of creating one product page per marketplace.
- [x] Add a visible FAQ section with questions such as: What is Adrafteo? How do reusable listing templates work? Can I use Adrafteo for Vinted, eBay, and Depop? Are templates private? Does Adrafteo use AI?
- [x] Make every FAQ answer factual, concise, and visible in the rendered page.
- [ ] Add clear public links to privacy, terms, contact, and any future documentation pages.

The public landing page now explains Adrafteo as a multi-platform workflow. Marketplace-specific pages remain intentionally deferred because the product uses one reusable template model across platforms.

**Objective:** make the product immediately understandable to visitors, search engines, and generative engines, while answering the questions users actually ask.

### Phase 4: add crawl and index files

- [x] Create `public/robots.txt` with `Allow: /` and the absolute sitemap URL.
- [x] Create `public/sitemap.xml` containing only public, canonical, indexable URLs.
- [x] Keep private account, authentication, and user workspace URLs out of the sitemap.
- [ ] If private URLs become real routes, consider `Disallow: /app`, `Disallow: /account`, and `Disallow: /auth` in `robots.txt`.
- [x] Never treat `robots.txt` as a security mechanism. Supabase Auth and RLS must protect private data.

The current sitemap contains only `https://adrafteo.com/` because the application does not yet expose separate public or private URL routes. Additions to the sitemap must be made when new canonical public pages are created.

**Objective:** help crawlers discover public content while avoiding wasted crawling of private application surfaces.

### Phase 5: add structured data

- [x] Add JSON-LD for the public product as a `WebApplication` or suitable `SoftwareApplication` entity.
- [x] Include only facts that are true: product name, URL, description, category, and supported operating context.
- [x] Add `FAQPage` structured data only when the same questions and answers are visibly present on the page.
- [x] Do not add fake reviews, ratings, prices, or claims that are not displayed and verifiable.
- [ ] Validate structured data after deployment with Google's rich result testing tools.

The current JSON-LD is embedded in `index.html` and describes the public Adrafteo application and the visible landing-page FAQ. External validation remains pending until the production domain serves the updated build.

**Objective:** give search engines and generative systems machine-readable context about Adrafteo without creating misleading markup.

### Phase 6: performance, accessibility, and rendering

- [ ] Check the mobile layout visually at representative phone and desktop widths.
- [x] Add a skip link, visible keyboard focus states, navigation labeling, and reduced-motion support.
- [x] Preserve labels and semantic descriptions for the public interactive elements and product preview.
- [ ] Audit contrast and image alternative text in a browser-based accessibility check.
- [ ] Measure Core Web Vitals: Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift.
- [ ] Reduce unnecessary JavaScript and avoid layout shifts on the public page.
- [ ] Replace the initial SVG Open Graph asset with an optimized bitmap image if social-platform compatibility testing requires it. It should be a social preview image, not a decorative page background.
- [ ] Assess whether the public landing page should be pre-rendered or moved to SSR if organic search becomes a major acquisition channel.

The code now includes basic keyboard and motion accessibility support. Core Web Vitals, contrast, mobile rendering, and Open Graph format compatibility still require browser or production-domain testing.

**Objective:** make the public page fast, stable, usable, and available in a form that crawlers can reliably process.

### Phase 7: YouTube and external authority

- [ ] Create a short product demonstration showing the problem, creation of a reusable template, variable filling, and copying the final advert.
- [ ] Use a descriptive YouTube title and description containing the real product use case, not only the brand name.
- [ ] Link the video to `https://adrafteo.com/` and link the website back to the video when useful.
- [ ] Add captions or a transcript so the explanation is accessible and textually understandable.
- [ ] Reuse the transcript as source material for a help article or FAQ, without duplicating it mechanically.
- [ ] Seek genuine mentions from relevant reseller communities and resources; avoid mass-produced or purchased backlinks.

**Objective:** demonstrate the product, create a useful external source, and build genuine trust signals for SEO and GEO.

### Phase 8: public information architecture

- [ ] Keep the home page as the main multi-platform product page.
- [ ] Add a general guide or documentation area only when it answers a distinct user need.
- [ ] Create marketplace-specific pages only if they contain genuinely different, useful content and still explain that Adrafteo uses reusable templates across platforms.
- [ ] Add internal links between the home page, FAQ, guides, documentation, and sign-up entry point.
- [ ] Use stable, readable URLs and one canonical URL per public page.

**Objective:** expand the number of useful entry points without producing thin duplicate pages or contradicting the multi-platform product model.

### Phase 9: search monitoring and iteration

This phase is intentionally last. The domain is already connected to Google Search Console, but monitoring and submission still need to be completed after the public SEO files and content are ready.

- [ ] Deploy the SEO changes to `https://adrafteo.com/`.
- [ ] Confirm that `https://adrafteo.com/robots.txt` returns the expected file.
- [ ] Confirm that `https://adrafteo.com/sitemap.xml` returns valid XML.
- [ ] Submit the sitemap in Google Search Console.
- [ ] Request indexing for the home page after the final public content is deployed.
- [ ] Inspect indexing status, discovered URLs, search queries, impressions, clicks, click-through rate, and average position.
- [ ] Configure Bing Webmaster Tools and submit the same sitemap when appropriate.
- [ ] Review the data after several weeks and improve the pages based on real queries instead of assumptions.

**Objective:** measure discovery and search demand, identify technical problems, and improve the content using evidence.

### SEO and GEO implementation rules

- Public content must be written for users first and remain factually accurate.
- New public features should include an intentional title, description, heading structure, canonical URL, and sharing behavior where relevant.
- New public pages should be considered for sitemap inclusion, structured data, internal links, and FAQ-style answers where appropriate.
- Private user data, templates, account screens, and authenticated workflows must never be exposed for indexing.
- Do not add keyword stuffing, hidden text, fake structured data, fake reviews, or duplicate pages solely to target search terms.
- After each substantive SEO or GEO implementation, run `npm run build` and update this section with the completed work.

## Product Decisions

- Keep generation client-side to minimize hosting and API costs.
- Use Supabase as the source of truth for user data.
- Give each user a copy of the default template so it can be edited or deleted independently.
- Keep the MVP focused on reusable text templates before adding AI or marketplace integrations.

## Development Workflow

- Project-wide Copilot rules live in `.github/copilot-instructions.md`.
- After substantive implementation, architecture, schema, deployment, or security changes, update this file so it remains the source of truth for project state.
