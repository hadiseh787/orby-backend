$ErrorActionPreference = 'Stop'
& node.exe (Join-Path $PSScriptRoot 'backend/scripts/local.mjs') --stop
exit $LASTEXITCODE
