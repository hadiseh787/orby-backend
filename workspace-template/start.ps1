param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'backend/scripts/local.mjs'
if ($NoBrowser) { & node.exe $launcher --no-browser } else { & node.exe $launcher }
exit $LASTEXITCODE
