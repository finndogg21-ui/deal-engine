# Daily deal-engine pipeline (scan + score). Scheduled for 12:00 via Windows
# Task Scheduler ("deal-engine daily scan").
#
# PGlite is single-connection. If the dev server is up it OWNS the database,
# so we trigger the scan inside that process via POST /api/admin/scan.
# Only when nothing is listening do we run the standalone scan safely.

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\12108\deal-engine'
$log  = Join-Path $repo 'logs\daily-scan.log'
function Log($msg) { "$(Get-Date -Format s) $msg" | Add-Content -Path $log }

Set-Location $repo
Log '--- daily scan starting ---'

# Read config from .env (never printed, never leaves this machine).
$envLines = Get-Content (Join-Path $repo '.env')
$port  = (($envLines | Where-Object { $_ -match '^API_PORT=' }) -replace '^API_PORT=', '')
if (-not $port) { $port = 8787 }
$token = (($envLines | Where-Object { $_ -match '^SCAN_TRIGGER_TOKEN=' }) -replace '^SCAN_TRIGGER_TOKEN=', '')

$serverUp = $false
try {
  $probe = Test-NetConnection -ComputerName 'localhost' -Port ([int]$port) -WarningAction SilentlyContinue
  $serverUp = $probe.TcpTestSucceeded
} catch {}

if ($serverUp -and $token) {
  Log "server on port $port owns the DB; triggering in-process scan"
  try {
    $r = Invoke-RestMethod -Method Post -Uri "http://localhost:$port/api/admin/scan" `
          -Headers @{ 'x-scan-token' = $token } -TimeoutSec 900
    Log ("in-process scan ok: " + ($r | ConvertTo-Json -Compress -Depth 4))
    exit 0
  } catch {
    Log "in-process trigger FAILED: $($_.Exception.Message) - NOT falling back while the server holds the DB"
    exit 1
  }
}

Log 'no server holding the DB; running standalone scan + score'
& npm run scan  2>&1 | Add-Content -Path $log
if ($LASTEXITCODE -ne 0) { Log "standalone scan FAILED (exit $LASTEXITCODE)"; exit 1 }
& npm run score 2>&1 | Add-Content -Path $log
if ($LASTEXITCODE -ne 0) { Log "score rebuild FAILED (exit $LASTEXITCODE)"; exit 1 }
Log 'standalone scan + score ok'
exit 0
