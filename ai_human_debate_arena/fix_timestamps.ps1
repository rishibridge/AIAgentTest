# Fix file timestamps for gcloud deployment
Get-ChildItem -Path . -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\\.git\\' -and
    $_.FullName -notmatch '\\node_modules\\'
} | ForEach-Object {
    $_.LastWriteTime = Get-Date
}
Write-Host "Timestamps updated for all files" -ForegroundColor Green
