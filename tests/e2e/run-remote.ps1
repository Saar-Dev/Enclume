$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$defaultKey = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '..\..\codex_enclume_staging_ed25519'))
$sshKey = if ($env:ENCLUME_SSH_KEY) { $env:ENCLUME_SSH_KEY } else { $defaultKey }
$localPort = if ($env:ENCLUME_LOCAL_PORT) { [int]$env:ENCLUME_LOCAL_PORT } else { 18293 }
$sshHost = if ($env:ENCLUME_SSH_HOST) { $env:ENCLUME_SSH_HOST } else { 'codex@89.92.219.211' }
$sshPort = if ($env:ENCLUME_SSH_PORT) { [int]$env:ENCLUME_SSH_PORT } else { 8222 }

if (-not (Test-Path -LiteralPath $sshKey)) {
  throw "Clé SSH Enclume introuvable : $sshKey"
}

$sshArgs = @(
  '-N',
  '-o', 'BatchMode=yes',
  '-o', 'ExitOnForwardFailure=yes',
  '-i', $sshKey,
  '-p', $sshPort,
  '-L', "${localPort}:127.0.0.1:8293",
  $sshHost
)

$tunnel = Start-Process -FilePath 'ssh.exe' -ArgumentList $sshArgs -PassThru -WindowStyle Hidden

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ($tunnel.HasExited) {
      throw "Le tunnel SSH s'est arrêté avec le code $($tunnel.ExitCode)."
    }
    if (Test-NetConnection -ComputerName '127.0.0.1' -Port $localPort -InformationLevel Quiet) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) {
    throw "Le tunnel SSH Enclume n'est pas devenu disponible sur le port local $localPort."
  }

  $env:ENCLUME_BASE_URL = "http://127.0.0.1:$localPort"
  & (Join-Path $repoRoot 'node_modules\.bin\playwright.cmd') test
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  if ($tunnel -and -not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force
  }
}
