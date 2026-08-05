# Continuous deployment from git (GitHub → Cloud Build → Cloud Run)

Every push to the chosen branch builds the container and deploys it to Cloud
Run automatically, using [`cloudbuild.yaml`](./cloudbuild.yaml). Run the setup
**once**; after that, `git push` is your deploy.

> All commands run against **your** Google Cloud project. This can't be done
> from the build sandbox — it needs your credentials and a one-time GitHub
> authorization only the repo/account owner can grant.

## One-time setup

```bash
# 0) Pick project + region
export PROJECT_ID=your-project-id
export REGION=us-central1
gcloud config set project "$PROJECT_ID"

# 1) Enable APIs
gcloud services enable \
  run.googleapis.com firestore.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

# 2) Firestore database (once per project)
gcloud firestore databases create --location=nam5

# 3) Artifact Registry repo to hold the image (matches _REPO in cloudbuild.yaml)
gcloud artifacts repositories create continuity \
  --repository-format=docker --location="$REGION"

# 4) Let Cloud Run's runtime service account use Firestore
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"

# 5) Let the Cloud Build service account deploy to Cloud Run
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## Connect the repo + create the trigger

**Authorize GitHub once** (opens a browser to install the Cloud Build GitHub
app on `rishibridge/AIAgentTest`):

```bash
gcloud builds connections create github continuity-conn --region="$REGION"
# follow the printed URL to authorize, then link the repo:
gcloud builds repositories create aiagenttest \
  --remote-uri=https://github.com/rishibridge/AIAgentTest.git \
  --connection=continuity-conn --region="$REGION"
```

Then create the trigger (deploys on push to your PR branch — change to
`^master$` once merged):

```bash
gcloud builds triggers create github \
  --name=continuity-deploy \
  --region="$REGION" \
  --repository="projects/$PROJECT_ID/locations/$REGION/connections/continuity-conn/repositories/aiagenttest" \
  --branch-pattern="^claude/prep-navigator-lifecycle-app-bhlsa5$" \
  --build-config=prep_navigator/cloudbuild.yaml
```

> Prefer no CLI? Do the same in the Console: **Cloud Run → Create service →
> "Continuously deploy from a repository" → Set up with Cloud Build**, point it
> at this repo/branch and at `prep_navigator/cloudbuild.yaml`. Same result.

## Get your URL

Kick the first build (or just push a commit):

```bash
gcloud builds triggers run continuity-deploy --region="$REGION" \
  --branch=claude/prep-navigator-lifecycle-app-bhlsa5

# once it finishes, print the live URL:
gcloud run services describe continuity --region="$REGION" \
  --format='value(status.url)'
```

That prints `https://continuity-XXXXXXXXXX-uc.a.run.app` — your live, shared,
Firestore-backed app. Open it in two browsers to see cross-client sync. From
now on, every push to the branch redeploys automatically.

## Notes

- **Demo, no auth** — `--allow-unauthenticated` keeps the URL public, as
  intended. (No auth/audit/PHI safeguards in this build; fine for a demo.)
- **Cost** — `--min-instances=1` keeps one instance warm so live-sync SSE
  connections don't drop (a few $/month); set it to `0` in `cloudbuild.yaml`
  to scale to zero and pay ~nothing.
- **Reset** — the DB seeds on first run; the UI's Reset button reseeds anytime.
