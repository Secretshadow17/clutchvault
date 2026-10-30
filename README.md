# ClutchVault: Homepage (Step 0 design)

A static, mobile-friendly homepage for ClutchVault. It needs no build tools. Push these files to GitHub and turn on GitHub Pages.

## Files
- `index.html`: page structure and sections
- `style.css`: the full design (colors are at the top in `:root`)
- `script.js`: settings and sample data (rank rewards, tournaments, leaderboard, countdown, email form)

## Publish on GitHub Pages (free)
1. Create a GitHub account if you don't have one, then click **New repository** and name it `clutchvault`. Set it to **Public**.
2. Click **Add file → Upload files** and upload `index.html`, `style.css`, `script.js` and `README.md`. Commit.
3. Go to **Settings → Pages**. Under **Source** choose **Deploy from a branch**, pick `main` and `/ (root)`, then Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/clutchvault/`.
5. For a custom domain, add it in the same Pages settings and point your domain's DNS there.

## Update the site daily from a Google Sheet (no code needed)
The site can read tournaments, the leaderboard, tier rewards and the countdown date from a Google Sheet.

1. Go to sheets.google.com and click **Blank spreadsheet**, then **File → Import → Upload**, choose `clutchvault-live-data.xlsx` and pick **Replace spreadsheet**.
2. Check that the tabs are named exactly `Settings`, `Ranks`, `Tournaments` and `Leaderboard`, and that row 1 of each is unchanged. (The `Read me` tab is only for you.)
3. Click **File → Share → Publish to web**. Choose the `Settings` tab, choose **Comma-separated values (.csv)**, click **Publish**, and copy the link.
4. Repeat step 3 for `Ranks`, `Tournaments` and `Leaderboard`. You will have four links.
5. In GitHub, open `script.js`, click the pencil icon, and paste the four links between the quotes under `CONFIG.sheets`. Commit the change.
6. From now on, just edit the sheet. The site picks up changes within about 5 to 10 minutes (Google publishes edits with a short delay).

If a link is empty or a sheet cannot be reached, that section shows the sample data built into `script.js`, so the page never goes blank.

Only public information belongs in the sheet. Published tabs are readable by anyone with the link, so never add phone numbers, KYC or payout details.

## Step 1: Login, player profiles and admin panel (Supabase)
Files: `account.html`, `account.js`, `admin.html`, `admin.js`, `app.css`, `supabase.js` (the Supabase library, self-hosted), `supabase-config.js` (your project URL and publishable key), `step1_database.sql`.

1. **Database:** Supabase > SQL Editor > New query > paste `step1_database.sql` > Run. Do this BEFORE anyone signs up.
2. **Auth URLs:** Supabase > Authentication > URL Configuration. Set **Site URL** to `https://secretshadow17.github.io/clutchvault/` and add the same address plus `account.html` under **Redirect URLs** (for example `https://secretshadow17.github.io/clutchvault/account.html`). Without this, confirmation emails link to localhost.
3. **Email confirmation:** Supabase's built-in email sender is heavily rate-limited. While testing, you can turn off Authentication > Sign In / Providers > Email > "Confirm email". Turn it back on, or add a custom SMTP provider, before a public launch.
4. Upload all new files to GitHub (same folder as `index.html`).
5. Open `account.html` on your site, sign up, and save your BGMI details.
6. Make yourself admin: SQL Editor > run `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');` then open `admin.html`.

Only the publishable key lives in the site code. Never put a secret or service_role key in any file in this repo.

## Step 2: Tier reward claims
Files: `claim.html`, `claim.js`, `step2_database.sql` (plus updated `admin.html`, `admin.js`, `account.html`, `app.css`, `script.js`).

1. **Database:** Supabase > SQL Editor > New query > paste `step2_database.sql` > Run. (Run `step1_database.sql` first.) Supabase may show a "destructive operation" warning because the script re-creates its own rules; that is expected, click Run.
2. Upload the updated files to GitHub (same names replace the old ones).
3. Player flow: log in, save a BGMI ID in the profile, open `claim.html`, pick a tier, upload a screenshot (PNG/JPG/WebP, up to 3 MB), submit.
4. Admin flow: `admin.html` > Tier reward claims > View proof > Approve or Reject (with a note) > after paying, Mark paid with a payout note.
5. Each season, edit `CURRENT_SEASON` and the `TIERS` list at the top of `claim.js`.

Rules built into the database: one live claim per player per tier per season (a rejected claim can be re-sent), at most 5 pending claims per player, screenshots are stored privately (only the player and admins can open them), and only admins can approve, reject or mark paid. Do not put full gift codes or phone numbers in payout notes.

## Step 2b: Anti-fraud code and the separate admin console
Files: `step2b_security.sql`, updated `claim.html`, `claim.js`, `admin.html`, `admin.js`, `account.html`, `account.js`, `app.css`.

1. **Database:** Supabase > SQL Editor > New query > paste `step2b_security.sql` > Run. (Run it after `step2_database.sql`.)
2. **How the code works:** before claiming, a player presses "Get my verification code". The server creates a one-time code (valid 30 minutes, used once, tied to that player). The player writes it in their own BGMI profile and the screenshot must show it. A stolen or borrowed screenshot cannot contain a fresh code written by the real account holder, and the admin sees the code next to each claim.
3. **Admin console:** open `https://YOUR-USERNAME.github.io/clutchvault/admin.html` directly and bookmark it. It has its own login. No public page links to it. Players who open it are shown "Access denied". Real protection still comes from the database rules, not from hiding the page.
4. Old claims made before this step have no code and show "—".

Limits to know: no system can be 100% fraud-proof. The code makes borrowed screenshots useless, but admins should still compare the BGMI ID, check the image looks untouched, and for high-value tiers ask for a short screen recording before approving. Consider turning on Supabase two-factor login for admin accounts before launch.

## Other things to edit in `script.js`
- `CONFIG.formEndpoint`: paste your Formspree form URL to start collecting emails. Until then the form shows a "not connected" message.
- The sample data near the top of the file is only a fallback. Once your sheet is connected, you do not need to edit it.

## Colors
Change these in `style.css` under `:root`:
`--accent` (crimson-orange), `--gold` (reward highlight), `--bg` (background), `--light` (light sections).

## Before you go live
- Replace the sample tournaments and leaderboard.
- Write real Terms, Privacy Policy and Fair Play Rules (the footer links are placeholders).
- Have a lawyer confirm your tournament and reward setup under the Online Gaming Act and its final rules.
- Check "ClutchVault" for existing trademarks (IP India search) and secure the domain and social handles.

## What this page does not do yet
It is a front-end only. There is no login, database or reward claiming. Those come in the next steps (Supabase for accounts, results and the admin panel).

ClutchVault is independent and not affiliated with Krafton, Tencent or any game publisher.
