# Boardroom AI Debate - GCP Deployment Script
Write-Host "Starting deployment to GCP Cloud Run..." -ForegroundColor Cyan

# Load API Keys from parent .env
$envPath = "../.env"
$googleKey = ""
$deepseekKey = ""
$kimiKey = ""

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    foreach ($line in $envContent) {
        if ($line -match "^GOOGLE_API_KEY=(.*)") {
            $googleKey = $matches[1].Trim()
        }
        if ($line -match "^DEEPSEEK_API_KEY=(.*)") {
            $deepseekKey = $matches[1].Trim()
        }
        if ($line -match "^KIMI_API_KEY=(.*)") {
            $kimiKey = $matches[1].Trim()
        }
    }
}

if (-not $googleKey) {
    Write-Host "Error: GOOGLE_API_KEY not found in ../.env" -ForegroundColor Red
    exit 1
}

$GCLOUD = "C:\Users\rishi\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

& $GCLOUD run deploy boardroom-debate `
    --source . `
    --region us-central1 `
    --allow-unauthenticated `
    --set-env-vars "GOOGLE_API_KEY=$googleKey,DEEPSEEK_API_KEY=$deepseekKey,KIMI_API_KEY=$kimiKey" `
    --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment Successful!" -ForegroundColor Green
}
else {
    Write-Host "`nDeployment failed." -ForegroundColor Red
}

