## What it does

LinkedIn’s job UI hides useful text, paints over listings you already handled, and interrupts you after every application. This userscript runs only in your browser and only on `linkedin.com`. Nothing is sent to a server. There is no account, no analytics, and no LinkedIn API access.

The ticks and crosses above are this build: each feature is compiled in only when its `FEATURE_*` flag in `.env` is on.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or another userscript manager) for your browser.
2. Click **Install userscript** at the top of this page. Tampermonkey should open an install dialog because the file ends in `.user.js`.
3. Confirm, then open [LinkedIn Jobs](https://www.linkedin.com/jobs/) and refresh.

If the click only shows source code, the manager is not installed or is not allowed to intercept the download. Paste the script URL into Tampermonkey → Dashboard → Utilities → Import from URL.

After a new deploy, Tampermonkey can pick up updates from this site automatically (`@updateURL` points here).

## Make it yours

Fork the repository, change the keyword markdown and `.env` values to match **your** skills, then enable GitHub Pages (source: GitHub Actions). Your fork’s Pages URL is the install page for your copy.

- Features: `FEATURE_*` keys in `.env` / `.env.example` (`true` to compile in, `false` to leave out).
- Keywords: `data/keywords/strong.md`, `rusty.md`, `unwanted.md` — one term per bullet.
- Script name, colours, version: `.env` (copy from `.env.example`).
- This page’s copy: `data/site.md`.

`npm run build` writes a static site into `dist/`. Pushing to `main` does the same in CI.
