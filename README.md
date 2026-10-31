# OpenPost — no-login public posting board

This starter website lets anyone publish a text post without creating an account. Posts are stored in Supabase and the public feed is visible to everyone. English is the default UI language; users can switch to Bengali, Spanish, French, Hindi, or Arabic.

## 1. Create the database

1. Create a free Supabase project at https://supabase.com/.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run the contents of `supabase-setup.sql`.
4. Open **Project Settings → API** (or **Data API**) and copy the Project URL and `anon` / publishable key.

## 2. Connect the website

Open `index.html` and replace:

- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

with your project's values. The anon/publishable key is intended for browser use; never put a `service_role` or secret key in frontend code.

## 3. Publish the website

You can deploy this folder using Cloudflare Pages, Netlify, or another static hosting provider. For a simple deployment, upload `index.html`; keep `supabase-setup.sql` and this README for reference.

## Important safety and abuse notes

- This is a public, no-login demo. Anyone can post, and anyone can read posts.
- No-login public posting can attract spam, abusive content, or automated submissions. Before sharing widely, add moderation, a report button, rate limiting/CAPTCHA, and a way to remove harmful posts.
- The starter accepts text only. It does not support image/video/file uploads.
- Do not store private information in public posts.
- Free-plan limits and terms can change; check the provider dashboards for current quotas.
