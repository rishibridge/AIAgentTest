# NatureCure v3.1 — GCP Cloud Run Deployment
Write-Host "Deploying NatureCure v3.1 to GCP Cloud Run..." -ForegroundColor Cyan

# Load API Key from parent .env
$envPath = "../.env"
$googleKey = ""

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    foreach ($line in $envContent) {
        if ($line -match "^GOOGLE_API_KEY=(.*)") {
            $googleKey = $matches[1].Trim()
        }
    }
}

if (-not $googleKey) {
    Write-Host "Error: GOOGLE_API_KEY not found in ../.env" -ForegroundColor Red
    exit 1
}

Write-Host "API key loaded." -ForegroundColor Green

$GCLOUD = "C:\Users\rishi\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

& $GCLOUD run deploy naturecure-v2 `
    --source . `
    --region us-central1 `
    --allow-unauthenticated `
    --set-env-vars "GOOGLE_API_KEY=$googleKey" `
    --memory 512Mi `
    --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment Successful!" -ForegroundColor Green
    Write-Host "URL: https://naturecure-v2-525536279111.us-central1.run.app" -ForegroundColor Cyan
    Write-Host "Remy: https://naturecure-v2-525536279111.us-central1.run.app/remy" -ForegroundColor Cyan
}
else {
    Write-Host "`nDeployment failed." -ForegroundColor Red
}
