<#
.SYNOPSIS
  Arret propre de la stack de dev Enclume.

.DESCRIPTION
  1. TerminateJobObject sur le job nomme "Enclume_DevStack" : tue concurrently +
     serveur + client + la fenetre dev en un seul appel noyau.
  2. Filet de securite : libere les ports 3001 / 5173 s'ils sont encore tenus par
     un process hors job (orphelin anterieur a ce schema, ex. nodemon detache).

.PARAMETER Ports
  Ports a verifier en filet. Defaut : 3001, 5173.
#>
[CmdletBinding()]
param(
  [int[]]$Ports = @(3001, 5173)
)

$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
if (-not $here -and $PSCommandPath) { $here = Split-Path -Parent $PSCommandPath }
if (-not $here) { throw "Impossible de localiser le script." }
. (Join-Path $here 'lib.JobObject.ps1')

# --- 1. Job Object ---
if (Stop-DevStackJob) {
  Write-Host "  Job '$DevStackJobName' termine (arbre dev tue)." -ForegroundColor Green
} else {
  Write-Host "  Aucun job '$DevStackJobName' actif."
}

Start-Sleep -Milliseconds 500

# --- 2. Fenetres dev-window residuelles (mode degrade, ou reste d'un crash) ---
$stale = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match '[\\/]dev-window\.ps1' -and $_.ProcessId -ne $PID }
foreach ($s in $stale) {
  Write-Host "  Fenetre dev-window residuelle (PID $($s.ProcessId)) -> taskkill /T /F." -ForegroundColor Yellow
  taskkill /PID $s.ProcessId /T /F 2>&1 | Out-Null
}

# --- 3. Filet : ports encore tenus par un orphelin hors job ---
foreach ($port in $Ports) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if (-not $conns) {
    Write-Host "  Port $port : libre." -ForegroundColor Green
    continue
  }
  foreach ($procId in ($conns.OwningProcess | Sort-Object -Unique)) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $name = if ($p) { $p.ProcessName } else { "?" }
    Write-Host "  Port $port : orphelin hors job (PID $procId / $name) -> taskkill /T /F." -ForegroundColor Yellow
    taskkill /PID $procId /T /F 2>&1 | Out-Null
  }
}

Start-Sleep -Milliseconds 500

$busy = @()
foreach ($port in $Ports) {
  $still = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($still) { $busy += $port; Write-Warning "Port $port toujours occupe (PID $($still.OwningProcess))." }
}
if (-not $busy) { Write-Host "  Stack arretee, ports $($Ports -join ' et ') libres." -ForegroundColor Green }
