$ROOT = $PSScriptRoot
$SERVER = Join-Path $ROOT 'server'
$CLIENT = Join-Path $ROOT 'client'

Write-Host ""
Write-Host "========================================"
Write-Host "   ENCLUME - Demarrage local complet"
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

# --- SERVEUR ---
Write-Host "[3] Serveur Express (port 3001)..."

try {
  Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 3 -UseBasicParsing | Out-Null
  Write-Host "    Serveur deja en ligne : OK"
} catch {
  Write-Host "    Serveur arrete. Ouverture fenetre PowerShell..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$SERVER'; npm run dev"
  Start-Sleep -Seconds 3
}

Write-Host ""

# --- CLIENT ---
Write-Host "[4] Client React (port 5173)..."

try {
  Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -UseBasicParsing | Out-Null
  Write-Host "    Client deja en ligne : OK"
} catch {
  Write-Host "    Client arrete. Ouverture fenetre PowerShell..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$CLIENT'; npm run dev"
  Start-Sleep -Seconds 3
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
Write-Host "Si un service est HORS LIGNE, verifier la fenetre PowerShell correspondante."
Write-Host ""
