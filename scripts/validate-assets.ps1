$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assetsRoot = Join-Path $root 'assets'
$refs = [System.Collections.Generic.HashSet[string]]::new()

Get-ChildItem -Path $root -Recurse -Filter '*.liquid' | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  foreach ($m in [regex]::Matches($content, "'([A-Za-z0-9_\-\./]+?\.(?:webp|jpeg|jpg|png|gif|webm))'\s*\|\s*asset_url")) {
    [void]$refs.Add($m.Groups[1].Value)
  }
  foreach ($m in [regex]::Matches($content, "assign\s+\w+\s*=\s*'([A-Za-z0-9_\-\./]+?\.(?:webp|jpeg|jpg|png|gif))'")) {
    [void]$refs.Add($m.Groups[1].Value)
  }
}

$missing = @()
foreach ($a in ($refs | Sort-Object)) {
  $path = Join-Path $assetsRoot ($a -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path $path)) { $missing += $a }
}

Write-Host "Referenced theme assets: $($refs.Count)"
Write-Host "Missing: $($missing.Count)"
$missing | ForEach-Object { Write-Host "  MISSING: $_" }
if ($missing.Count -eq 0) { Write-Host "OK: All referenced theme assets exist." }
