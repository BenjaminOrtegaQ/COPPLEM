param(
  # Carpeta donde quieres dejar el ZIP. Si no la pasas, se usará la carpeta padre de tu proyecto.
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

try {
  # === 1) Descubrir rutas ===
  $ScriptDir   = $PSScriptRoot
  $ProjectRoot = Split-Path -Parent $ScriptDir     # ...\copplem
  $ProjectName = Split-Path $ProjectRoot -Leaf     # copplem

  if ([string]::IsNullOrWhiteSpace($OutDir)) {
    # Por defecto, dejar el ZIP junto a la carpeta del proyecto (un nivel arriba)
    $OutDir = Split-Path -Parent $ProjectRoot
  }

  if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
  }

  $stamp     = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
  $tmpFolder = Join-Path $OutDir "${ProjectName}_backup_tmp_$stamp"
  $zipPath   = Join-Path $OutDir "${ProjectName}_backup_$stamp.zip"

  Write-Host "Proyecto:    $ProjectRoot"
  Write-Host "Destino ZIP: $zipPath"
  Write-Host "Temporal:    $tmpFolder"
  Write-Host ""

  # === 2) Copiar con exclusiones (usa ROBOCOPY) ===
  # /E  : incluye subcarpetas
  # /R:1 /W:1 : reintentos mínimos (copias rápidas)
  # /NFL /NDL /NP : salida limpia
  # /XD : carpetas a excluir
  # /XF : archivos a excluir (logs, envs locales, etc.)

  $excludeDirs = @(
    "node_modules", "dist", "dist-electron", ".git",
    ".vite", ".pnpm-store", "coverage", "out"
  )

  $excludeFiles = @(
    "*.log", "npm-debug.log*", "pnpm-debug.log*",
    ".DS_Store", "Thumbs.db",
    ".env.local", ".env.*.local"
  )

  # Crear carpeta temporal
  New-Item -ItemType Directory -Path $tmpFolder | Out-Null

  # Armar parámetros /XD y /XF con rutas/nombres
  $xdArgs = @()
  foreach ($d in $excludeDirs) { $xdArgs += @("/XD", (Join-Path $ProjectRoot $d)) }

  $xfArgs = @()
  foreach ($f in $excludeFiles) { $xfArgs += @("/XF", $f) }

  $roboCmd = @(
    "robocopy", $ProjectRoot, $tmpFolder,
    "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NP"
  ) + $xdArgs + $xfArgs

  Write-Host "Copiando archivos (excluyendo builds/caches/node_modules)..."
  $rob = Start-Process -FilePath $roboCmd[0] -ArgumentList $roboCmd[1..($roboCmd.Length-1)] -NoNewWindow -PassThru -Wait

  # Nota: Robocopy devuelve códigos >0 para cosas no fatales. Solo fallamos si no hay nada copiado.
  if (-not (Test-Path $tmpFolder)) { throw "La copia temporal no se creó." }

  # === 3) Comprimir a ZIP ===
  Write-Host "Comprimiendo en ZIP..."
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $tmpFolder "*") -DestinationPath $zipPath -Force

  # (Opcional) Hash del ZIP para verificar integridad
  $hash = Get-FileHash -Path $zipPath -Algorithm SHA256
  Write-Host "ZIP creado: $zipPath"
  Write-Host "SHA256: $($hash.Hash)"

} catch {
  Write-Error "Error en backup: $($_.Exception.Message)"
} finally {
  # === 4) Limpiar temporal ===
  if (Test-Path $tmpFolder) {
    try {
      Remove-Item $tmpFolder -Recurse -Force
    } catch {
      Write-Warning "No se pudo borrar la carpeta temporal: $tmpFolder"
    }
  }
}
