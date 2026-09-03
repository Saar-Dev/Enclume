<#
.SYNOPSIS
  Lance la stack de dev Enclume (serveur + client) dans un unique arbre de processus
  supervise par un Job Object nomme, dont la mort est garantie a la fermeture de la
  fenetre.

.DESCRIPTION
  Windows ne propage pas l'arret aux processus enfants quand une fenetre console est
  fermee par la croix (TerminateProcess, pas d'arret propre) ; nodemon laisse alors un
  `node src/index.js` orphelin qui garde le port 3001 (incident 2026-09-03).

  Ce script cree le Job Object nomme "Enclume_DevStack" avec le drapeau
  JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE et s'y assigne AVANT de lancer `npm run dev`.
  concurrently, nodemon, node, vite... heritent de l'appartenance au job. Quand la
  fenetre est tuee, le dernier handle se ferme et Windows termine tout l'arbre.

  Le job nomme est aussi la source de verite de "la stack tourne-t-elle ?" pour
  start.ps1 / stop-dev.ps1 (cf. tools/lib.JobObject.ps1).

.PARAMETER Root
  Racine du depot. Par defaut : deduite de l'emplacement du script.

.PARAMETER DryRun
  Arme le job, affiche l'etat, sort SANS lancer la stack.
#>
[CmdletBinding()]
param(
  [string]$Root,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# --- Emplacement du script (fiable hors defaut de param() sous PowerShell 5.1) ---
$here = $PSScriptRoot
if (-not $here -and $PSCommandPath) { $here = Split-Path -Parent $PSCommandPath }
if (-not $here -and $MyInvocation.MyCommand.Path) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $here) { throw "Impossible de localiser le script (relancer avec -Root <chemin>)." }

. (Join-Path $here 'lib.JobObject.ps1')

if (-not $Root) { $Root = Split-Path -Parent $here }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'package.json'))) {
  throw "Racine invalide (pas de package.json) : $Root"
}

# --- Job Object ---
$job = Enter-DevStackJob

if ($job.AlreadyExists) {
  Write-Host "[dev-window] Une stack Enclume tourne deja (job '$DevStackJobName')." -ForegroundColor Yellow
  Write-Host "[dev-window] Rien a faire ici. Arret : tools\stop-dev.ps1" -ForegroundColor Yellow
  exit 0
}
if ($job.Assigned) {
  Write-Host "[dev-window] Job '$DevStackJobName' arme (KILL_ON_JOB_CLOSE) - l'arbre dev mourra avec cette fenetre." -ForegroundColor Green
} else {
  Write-Warning "Job Object non arme : $($job.Warning)"
  Write-Warning "La stack demarrera quand meme, mais une fermeture brutale peut laisser des orphelins."
}

if ($DryRun) {
  Write-Host "[dev-window] DryRun : assigned=$($job.Assigned), racine=$Root - sortie sans lancer la stack." -ForegroundColor Yellow
  return
}

# --- Lancement de la stack ---
Set-Location $Root
Write-Host "[dev-window] npm run dev  (cwd=$Root)" -ForegroundColor Cyan
& npm run dev
$code = $LASTEXITCODE
Write-Host ""
Write-Host "[dev-window] 'npm run dev' termine (code $code). Fenetre laissee ouverte pour les logs." -ForegroundColor Yellow
Write-Host "[dev-window] Fermer la fenetre (ou tools\stop-dev.ps1) pour liberer le job." -ForegroundColor Yellow
