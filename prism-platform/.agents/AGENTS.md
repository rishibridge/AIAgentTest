# Project Rules

## Post-Deploy Verification (MANDATORY)

After EVERY GCP deployment, you MUST:

1. **Run a full browser-based test suite against the LIVE GCP URL** (not localhost, not a local preview server).
2. **Take screenshots** at every major phase/screen of the application.
3. **Verify the JavaScript bundle hash** served by the live URL matches the local `dist/` build output.
4. **Present screenshots to the user** as proof that the deployment succeeded and the UI is correct.
5. **Never claim a deployment is successful** based solely on `gcloud` exit code. The container starting is not the same as the UI being correct.

## Deployment Process

1. Always use the project's `deploy.ps1` script — never run raw `gcloud run deploy` manually.
2. Always run `npm run build` in the UI directory before deploying.
3. Never change the GCP project, region, or service name without explicit user permission.
4. Always verify `.gitignore` and `.gcloudignore` are not excluding critical build artifacts (especially `dist/`).

## Version Control

1. Always create a git tag BEFORE making code changes (snapshot of the working state).
2. Always create a git tag AFTER changes are committed and verified.
3. Never silently switch `gcloud config` project settings.
