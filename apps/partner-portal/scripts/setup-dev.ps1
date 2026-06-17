# One-time Partner Portal app proxy setup (run in an interactive PowerShell terminal).
# Usage: npm run setup  (from apps/partner-portal)

$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent $PSScriptRoot
Set-Location $AppDir

Write-Host ""
Write-Host "=== Anand Rasa Partner Portal — App Proxy Setup ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Green
} else {
  Write-Host ".env already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 1: Link this folder to your Partner Dashboard app" -ForegroundColor Cyan
Write-Host "  shopify app config link --client-id <YOUR_APP_CLIENT_ID>"
Write-Host "  (Or run without --client-id to pick from the list)"
Write-Host ""
shopify app config link

Write-Host ""
Write-Host "Step 2: Pull app env (API secret, etc.) into .env" -ForegroundColor Cyan
shopify app env pull

Write-Host ""
Write-Host "Step 3: Start app dev (tunnel + app proxy registration)" -ForegroundColor Cyan
Write-Host "  Keep this running alongside shopify theme dev"
Write-Host ""
npm run shopify:dev
