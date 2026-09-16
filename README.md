# LinkedIn Job Tools

A Tampermonkey userscript that highlights the skills you care about on LinkedIn job posts, colours listings you have already viewed, and dismisses a few noisy bits of UI.

The public site is static HTML. A small Node build reads markdown keyword lists and `.env` values, then writes the userscript plus an install page into `dist/`. GitHub Actions publishes that folder to GitHub Pages.

## Use this build

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the GitHub Pages site for this repo and click **Install userscript**.

After a deploy, Tampermonkey can update from the same `.user.js` URL.

## Customise your own copy

Anyone else should fork the repo, change the keyword lists to match their skills, and deploy their own Pages site.

1. Fork, then clone.
2. Copy `.env.example` to `.env` if you want a different script name, author, version, colours, or **feature flags**. You can also edit `.env.example` directly — that is what CI reads when `.env` is absent. Set a `FEATURE_*` key to `false` to leave that feature out of the compiled userscript.
3. Edit `data/keywords/strong.md`, `rusty.md`, and `unwanted.md`. Only bullet lines become match terms. Headings are ignored.
4. Edit `data/site.md` if you want different install copy.
5. In the fork, set **Settings → Pages → Source** to **GitHub Actions** (already done on this repo).
6. Push to `main`. Open `https://<your-username>.github.io/improved-linkedin-job-tools/` and install from there.

CI fills the userscript `@downloadURL` / `@updateURL` from `GITHUB_REPOSITORY`, so a fork does not need to hardcode Pages URLs. Set `SITE_ORIGIN` and `SITE_BASE_PATH` in `.env` only if you use a custom domain.

## Local build

Requires Node.js 20+.

```bash
npm run build      # writes dist/
npm run preview    # build, then serve dist/ at http://127.0.0.1:5173/
```

There are no runtime dependencies. `dist/` is generated and is not committed.

## Features

Toggle these in `.env` / `.env.example`. `true` compiles the feature into the userscript; `false` omits it. The install page shows a tick or cross for each.

| Flag | What it does |
| --- | --- |
| `FEATURE_EXPAND_DESCRIPTION` | Clicks “more” so the full job posting is visible |
| `FEATURE_HIGHLIGHT_SKILLS` | Highlights strong / rusty / unwanted terms in the description |
| `FEATURE_HIGHLIGHT_JOB_CARDS` | Colours viewed, applied, and promoted cards |
| `FEATURE_DISMISS_POST_APPLY` | Dismisses the post-apply “turn your resume into a profile” modal |
| `FEATURE_HIDE_AI_WIDGET` | Hides the “is this information helpful?” widget |
| `FEATURE_CONFIRM_APPLIED` | Clicks **Yes** on “did you apply for this job?” so LinkedIn marks the listing as seen |

## Keyword tiers

The lists shipped here follow the resume at `thethomaseffect/resume`:

- **Strong** (green) — `skillCatalog` entries with `tier: core`, plus English and a few role-shape phrases (`full-stack`, `backend`, `event-driven`).
- **Rusty** (yellow) — `tier: also` skills that still show up in job ads, including C# / .NET / ASP.NET from the Microsoft internship.
- **Unwanted** (red) — Swedish (`svenska`) because it is marked insufficient for day-to-day work, plus stacks to skip (C++, PHP, Elixir, Ruby, Swift, Kotlin, Scala). Go/Golang are rusty, not unwanted.

Job-ad aliases (`js`, `k8s`, `psql`, `ci/cd`) sit next to the canonical name.

## Layout

```
.env.example                 script name, colours, version, FEATURE_* flags
data/site.md                 install page copy
data/keywords/*.md           match lists
src/script.template.js       userscript with {{placeholders}}
src/index.template.html      static page
scripts/build.js             compiles markdown + env into dist/
```
