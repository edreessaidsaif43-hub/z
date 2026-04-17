param(
  [string]$OutputDir = "release"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReleasePath = Join-Path $ProjectRoot $OutputDir
$ZipPath = Join-Path $ProjectRoot "enjazy-release.zip"

if (Test-Path -LiteralPath $ReleasePath) {
  Remove-Item -LiteralPath $ReleasePath -Recurse -Force
}
New-Item -ItemType Directory -Path $ReleasePath | Out-Null

$files = @(
  "index.html",
  "server.ps1",
  "app.py",
  "start.bat",
  "README.md",
  "DEPLOY_CLOUD_UBUNTU.md",
  "DEPLOY_VERCEL.md",
  "vercel.json",
  "package.json",
  ".gitignore"
)

foreach ($f in $files) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $f) -Destination (Join-Path $ReleasePath $f) -Force
}

$releaseDataDir = Join-Path $ReleasePath "data"
New-Item -ItemType Directory -Path $releaseDataDir | Out-Null
'{}' | Set-Content -LiteralPath (Join-Path $releaseDataDir "portfolios.json") -Encoding UTF8

$deploySrc = Join-Path $ProjectRoot "deploy"
$deployDst = Join-Path $ReleasePath "deploy"
if (Test-Path -LiteralPath $deploySrc) {
  Copy-Item -LiteralPath $deploySrc -Destination $deployDst -Recurse -Force
}

$apiSrc = Join-Path $ProjectRoot "api"
$apiDst = Join-Path $ReleasePath "api"
if (Test-Path -LiteralPath $apiSrc) {
  Copy-Item -LiteralPath $apiSrc -Destination $apiDst -Recurse -Force
}

$gasSrc = Join-Path $ProjectRoot "google-apps-script"
$gasDst = Join-Path $ReleasePath "google-apps-script"
if (Test-Path -LiteralPath $gasSrc) {
  Copy-Item -LiteralPath $gasSrc -Destination $gasDst -Recurse -Force
}

if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $ReleasePath "*") -DestinationPath $ZipPath -Force

Write-Output "Release ready:"
Write-Output "Folder: $ReleasePath"
Write-Output "Zip:    $ZipPath"
