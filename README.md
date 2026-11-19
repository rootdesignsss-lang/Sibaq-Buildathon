# HIREYOU

HIREYOU is a skills-first hiring platform built with Next.js, TypeScript, and Supabase. Candidates create a short profile, choose the work they are interested in, and apply to open roles with role-specific work samples. Employers publish roles and deadlines, review applicant results, and chat with applicants.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable (or legacy anon) key.
3. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql) to create the app tables, scoring trigger, and row-level security policies.
4. In Supabase Authentication settings, allow `http://localhost:3000` as the site URL and redirect URL.
5. Start the app with `npm run dev`, then open `http://localhost:3000`.

The database schema is required for profiles, role listings, applications, scoring, and chat. The app does not need a Supabase service-role key or an AI provider key; do not put privileged keys in a `NEXT_PUBLIC_` variable.

Candidate workspaces include Niko, a local job-search assistant that ranks open roles using profile interests and listed salary, offers general work-sample guidance, and saves deadline reminders in the current browser. It does not send profile data to an AI provider; reminders are shown in the workspace and are not push notifications.

## Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set `NEXT_PUBLIC_SITE_URL` and the Supabase authentication site/redirect URLs to your deployed domain.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
