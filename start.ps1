$ROOT = "C:\Users\Nemet\Documents\Enclume"

Write-Host ""
Write-Host "========================================"
Write-Host "   ENCLUME - Demarrage intelligent"
Write-Host "========================================"
Write-Host ""

# --- DOCKER ---
Write-Host "[1] Docker..."

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "    Docker non detecte. Lancement de Docker Desktop..."
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  Write-Host "    Attente 30 secondes..."
  Start-Sleep -Seconds 30
} else {
  Write-Host "    Docker Desktop : OK"
}

# --- CONTENEURS ---
Write-Host "[2] Conteneurs Docker..."

Set-Location $ROOT
$running = docker compose ps --status running 2>&1
if ($running -match "postgres" -or $running -match "redis" -or $running -match "minio") {
  Write-Host "    Conteneurs deja actifs : OK"
} else {
  Write-Host "    Conteneurs arretes. Demarrage..."
  docker compose up -d
  Start-Sleep -Seconds 5
  Write-Host "    Conteneurs lances."
}

Write-Host ""

# --- STACK APPLICATIVE (serveur 3001 + client 5173) ---
# tools/dev-window.ps1 lance `npm run dev` (concurrently) sous le Job Object nomme
# "Enclume_DevStack" (KILL_ON_JOB_CLOSE). Ce job est la source de verite : on croise
# "process vivants dans le job" et "port en ecoute" pour classer l'etat sans deviner.
Write-Host "[3] Stack applicative (serveur 3001 + client 5173)..."

. "$ROOT\tools\lib.JobObject.ps1"

function Test-PortListening {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Start-DevWindow {
  Write-Host "    Ouverture de la fenetre dev supervisee..."
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$ROOT\tools\dev-window.ps1", "-Root", "$ROOT"
  Start-Sleep -Seconds 5
}

$jobProcs = Get-DevStackJobActiveProcesses
$portUp = (Test-PortListening -Port 3001) -or (Test-PortListening -Port 5173)

if ($jobProcs -gt 0 -and $portUp) {
  Write-Host "    Stack en ligne (job '$DevStackJobName', $jobProcs process) : OK"
}
elseif ($jobProcs -gt 0) {
  Write-Host "    Job actif mais aucun port en ecoute : stack plantee ou fenetre morte. Nettoyage..."
  & "$ROOT\tools\stop-dev.ps1"
  Start-DevWindow
}
elseif ($portUp) {
  Write-Host "    Port occupe hors job (orphelin anterieur au schema). Nettoyage..."
  & "$ROOT\tools\stop-dev.ps1"
  Start-DevWindow
}
else {
  Start-DevWindow
}

Write-Host ""

# --- VERIFICATION FINALE ---
Write-Host "Verification finale dans 8 secondes..."
Start-Sleep -Seconds 8
Write-Host ""
Write-Host "========================================"
Write-Host "   ETAT FINAL"
Write-Host "========================================"

try {
  Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 3 -UseBasicParsing | Out-Null
  Write-Host "    Serveur  http://localhost:3001  [OK]"
} catch {
  Write-Host "    Serveur  http://localhost:3001  [HORS LIGNE]"
}

try {
  Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -UseBasicParsing | Out-Null
  Write-Host "    Client   http://localhost:5173  [OK]"
} catch {
  Write-Host "    Client   http://localhost:5173  [HORS LIGNE]"
}

Write-Host ""
Write-Host "Si un service est HORS LIGNE, verifier la fenetre dev (logs prefixes server/client)."
Write-Host "Arret propre de la stack : tools\stop-dev.ps1"
Write-Host ""
