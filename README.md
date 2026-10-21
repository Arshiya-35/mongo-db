# ContentHub

A blog and content management system built with **Node.js, Express, MongoDB and Mongoose**. It ships as one project: an Express API plus a small vanilla-JS frontend in `public/` (no build step).

## Project structure

```
contenthub/
├── server.js            # entry point: env checks, DB connect, listen
├── app.js               # Express app (security headers, routes); imported by tests
├── config/db.js         # Mongoose connection
├── models/              # User, Article, Category schemas + indexes
├── routes/              # auth, articles, categories, uploads, admin, ai
├── middleware/          # auth + roles, validation, errors, rate limits, upload checks
├── services/            # sanitize.js, ai/ (provider abstraction + mock)
├── scripts/seed.js      # demo data
├── public/              # index.html, css/styles.css, js/app.js
├── uploads/             # uploaded images (contents git-ignored)
├── tests/api.test.js
├── .env.example  .gitignore  package.json  README.md
```

## Prerequisites

- Node.js 18 or newer and npm
- MongoDB: either a local MongoDB Community Server, or a free MongoDB Atlas cluster

## Installation

```bash
cd contenthub
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

### MongoDB configuration

- **Local:** start MongoDB, then keep `MONGODB_URI=mongodb://127.0.0.1:27017/contenthub`.
- **Atlas:** create a cluster and a database user, allow your IP, copy the connection string, and set `MONGODB_URI` in `.env` (for example `mongodb+srv://USER:PASS@cluster.mongodb.net/contenthub`).

### Environment setup

Edit `.env`. `JWT_SECRET` must be at least 32 characters; the server refuses to start otherwise. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`.env` is git-ignored. Only `.env.example` (placeholders) is committed.

## Run

```bash
npm run seed     # optional: demo users, categories, articles (clears those collections!)
npm start        # or: npm run dev (auto-reload)
```

Open http://localhost:3000. After seeding, sign in with password `Password123!` as `admin@`, `editor@`, `author@` or `reader@contenthub.test`. These are demo credentials only; never seed a shared or production database.

## Test

```bash
npm test
```

The included tests run **without MongoDB**. They cover security headers, validation errors, 401s on protected routes, forged tokens, the role middleware, HTML stripping and password hashing. They do not cover database-backed flows (publishing, search, uploads); see "Planned" below.

## Implemented features

- Registration and login with bcrypt hashing (cost 12) and JWT bearer auth; the user is re-read from the DB on every request, so role changes apply immediately
- Roles `reader < author < editor < admin`, enforced server-side by middleware; registration always creates a reader and only admins change roles
- Articles: create, edit, delete draft; workflow `draft -> in_review -> published`, with editor "request changes" (back to draft with a note) and archive
- Authors edit only their own drafts; editors and admins edit any article; admins delete any article
- Categories (editor+ manage, admin deletes) and free-form tags
- Public search (MongoDB text index), category/tag/author filters, sorting (newest/most viewed), pagination
- Image upload (PNG/JPEG/WebP, 2 MB, random filenames, magic-byte check) used for cover images
- Safe content: HTML stripped on save, frontend renders with `textContent`
- Helmet security headers (CSP), CORS allow-list, request size limit, global and stricter auth/upload rate limits, consistent JSON errors
- Responsive UI, keyboard focus styles, skip link, ARIA live toast, reduced-motion support, light/dark mode (follows OS, manual toggle)
- Basic SEO fields (meta description, used for storage; page title is set per article). View counter
- AI service abstraction: no keys in code; `AI_PROVIDER=none` (default) disables it, `mock` gives an offline demo. Suggestions are returned only, never saved; the UI shows them with explicit "Use as..." / "Dismiss" buttons

## Planned (NOT implemented)

Comments and replies, reactions, bookmarks, author follows, notifications, scheduled publishing, version history, media library, analytics dashboard, recommendations, server-rendered SEO/sitemap/Open Graph, AI moderation of comments, a real AI provider (add one in `services/ai/` and register it in `services/ai/index.js`), refresh tokens / httpOnly cookies, email verification and password reset, database-backed integration tests.

How the code is ready for them: `Article` has room for `scheduledFor` and versions; `User` for follows/bookmarks; each feature would be a new model in `models/` plus a router mounted in `app.js`.

## API overview

All routes are under `/api`. Send `Authorization: Bearer <token>` where auth is required.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | public | Health check |
| POST | `/auth/register` | public | Create reader account |
| POST | `/auth/login` | public | Get token |
| GET | `/auth/me` | any user | Current user |
| GET | `/articles` | public | Published list; `q, category, tag, author, sort, page, limit` |
| GET | `/articles/:slug` | public if published; else owner/editor+ | Read article |
| GET | `/articles/mine` | author+ | Own articles |
| GET | `/articles/review-queue` | editor+ | Articles awaiting review |
| GET | `/articles/manage/:id` | owner or editor+ | Full article for editing |
| POST | `/articles` | author+ | Create draft |
| PUT | `/articles/:id` | owner (drafts) / editor+ | Update |
| POST | `/articles/:id/submit` | owner | Draft -> in review |
| POST | `/articles/:id/publish` | editor+ | Publish |
| POST | `/articles/:id/reject` | editor+ | Back to draft; body `{ "note": "..." }` |
| POST | `/articles/:id/archive` | editor+ | Unpublish |
| DELETE | `/articles/:id` | owner (drafts) / admin | Delete |
| GET | `/categories` | public | List |
| POST, PUT | `/categories`, `/categories/:id` | editor+ | Create / update |
| DELETE | `/categories/:id` | admin | Delete (if unused) |
| POST | `/uploads` | author+ | Multipart field `image`; returns `{ url }` |
| GET | `/admin/users` | admin | List users |
| PATCH | `/admin/users/:id/role` | admin | Body `{ "role": "editor" }` |
| POST | `/ai/suggest` | author+ | Body `{ task: summarize|titles|moderate, text }`; suggestion only |

Errors look like `{ "error": "message", "details": [{ "field", "message" }] }` with 400/401/403/404/409/429/500.

## Assumptions and limitations

- The JWT is kept in `localStorage` for simplicity. That is readable by any script on the page; the strict CSP and `textContent` rendering reduce that risk, but httpOnly cookies are the safer upgrade.
- Article bodies are plain text (paragraphs split on blank lines), not Markdown or rich text.
- Uploads are stored on local disk, which suits local development but not multi-server deployment.
- Rate limiting is in-memory per process.
- The full database flow was not executed in the environment where this project was written (no MongoDB available there); only the tests above and a static/health smoke test were run. Please run the seed and click through once on your machine.

## Push to GitHub

1. Make sure `.env` is not tracked: `git status` should not list it.
2. Initialize and commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ContentHub MVP"
   git branch -M main
   ```
3. Create an empty repository on https://github.com/new named `contenthub` (no README or .gitignore).
4. Connect and push (replace `YOUR-USER`):
   ```bash
   git remote add origin https://github.com/YOUR-USER/contenthub.git
   git push -u origin main
   ```
   With the GitHub CLI instead: `gh repo create contenthub --public --source=. --push`.

If a real secret was ever committed, rotate it; deleting the file later does not remove it from history.
