# Deploying to Google Cloud Run + Firestore

The app selects storage automatically: **Firestore** when running on Cloud Run
(Cloud Run sets `K_SERVICE`), **SQLite** locally. Cross-client/cross-instance
live sync uses Firestore `onSnapshot` listeners re-broadcast over SSE, so it
works even when Cloud Run scales to multiple instances.

> These are the commands you run against **your** Google Cloud project — they
> can't be run from the build sandbox. Replace `PROJECT_ID` and the region as
> needed.

## 1. One-time setup

```bash
gcloud auth login
export PROJECT_ID=your-project-id
export REGION=us-central1
gcloud config set project "$PROJECT_ID"

# Enable the APIs this uses
gcloud services enable run.googleapis.com firestore.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

# Create a Firestore database in Native mode (once per project).
# Location is multi-region (nam5 = US) or a single region; pick one.
gcloud firestore databases create --location=nam5
```

## 2. Give Cloud Run access to Firestore

Cloud Run runs as the Compute Engine default service account unless you set
another. Grant it Firestore access:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## 3. Deploy

From `prep_navigator/` (the `Dockerfile` here is used automatically):

```bash
gcloud run deploy continuity \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances=1 \
  --port=8080
```

`--min-instances=1` keeps one instance warm so SSE connections aren't dropped
by scale-to-zero (optional; scale-to-zero also works, clients just reconnect).

The command prints a service URL like
`https://continuity-xxxxxxxx-uc.a.run.app` — that is your live, shared,
persistent app. Open it in two browsers to see cross-client sync.

## 4. Reset / seed

The database seeds itself on first run if empty. To reseed sample data later,
hit the **Reset** button in the UI (or `POST /api/reset`).

## Costs (rough)

- **Cloud Run**: pay-per-use; effectively free at low traffic. `--min-instances=1`
  keeps one small instance warm (a few dollars/month) — drop it to `0` to avoid.
- **Firestore**: generous free tier (reads/writes/storage) that a prototype
  stays well within.

## ⚠️ Before anyone else uses it

`--allow-unauthenticated` makes the URL **public**. This build has **no
application auth, no RBAC, and no audit log**, and the data would be real PHI
in production. Before non-demo use, add at minimum:

- Access control — Identity-Aware Proxy (IAP) in front of Cloud Run, or
  app-level login — plus per-navigator identity instead of the hardcoded user.
- An **audit log** of every read/write, and a signed BAA with Google for
  HIPAA-covered workloads (Firestore and Cloud Run can be covered).
- Real integrations replacing the seeded data (EHR/pharmacy/lab/messaging).

## Local development

No Google Cloud needed — defaults to SQLite:

```bash
npm install        # only needed for the Firestore path; SQLite is dependency-free
npm start          # http://localhost:5173  (SQLite)
```

To exercise the Firestore path locally, run the Firestore emulator and point
the app at it:

```bash
npx firebase-tools emulators:start --only firestore --project demo-continuity
# in another shell:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 STORE=firestore \
  GOOGLE_CLOUD_PROJECT=demo-continuity npm start
```
