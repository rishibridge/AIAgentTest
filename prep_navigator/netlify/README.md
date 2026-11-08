# Continuity — static demo (Netlify)

A **self-contained, browser-only** build of the PrEP Navigator console for
sharing the demo publicly. It's a single `index.html` with no backend: data
lives in each visitor's browser (`localStorage`), so everyone gets their own
copy to click through. Feature-complete for evaluating what the app does —
worklist, Patient 360, messaging + inbox, notes→tasks, panel health — but
**not** the live multi-user version.

For the real server-side, cross-client-synced version, deploy the app to
**Google Cloud Run + Firestore** — see [`../DEPLOY.md`](../DEPLOY.md) and
[`../DEPLOY_GIT.md`](../DEPLOY_GIT.md).

## Deploy to Netlify

**Option A — drag & drop (fastest):**
Go to <https://app.netlify.com/drop> and drop this `netlify/` folder onto the
page. You get a public `https://<random-name>.netlify.app` URL instantly.

**Option B — connect the repo (auto-deploys on push):**
In Netlify → **Add new site → Import an existing project → GitHub →**
`rishibridge/AIAgentTest`, then set:
- **Base directory:** `prep_navigator/netlify`
- **Build command:** *(leave empty)*
- **Publish directory:** `prep_navigator/netlify`

Deploy. Every push to the tracked branch republishes.

## Notes

- Each visitor's changes are local to their browser; refresh keeps them,
  another person won't see them. That's expected for a static demo.
- Works with no configuration — no env vars, no keys.
