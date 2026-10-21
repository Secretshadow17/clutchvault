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

## Things to edit in `script.js`
- `CONFIG.nextTournament`: date for the countdown timer.
- `CONFIG.formEndpoint`: paste your Formspree form URL to start collecting emails. Until then the form shows a "not connected" message.
- `RANKS`: tier names, points and reward text. Put real reward amounts only when your sponsor fund is confirmed.
- `TOURNAMENTS` and `BOARD`: **sample data**. Replace with real entries or remove them before you launch.

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
