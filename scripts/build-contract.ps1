$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$compiler = Get-ChildItem -LiteralPath (Join-Path $backendRoot '.tools') -Directory -Filter 'llvm-mingw-*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($compiler) { $env:PATH = (Join-Path $compiler.FullName 'bin') + ';' + $env:PATH }
$cargoCommand = Get-Command cargo.exe -ErrorAction SilentlyContinue
if (-not $cargoCommand) { $cargoCommand = Get-Item -LiteralPath (Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe') }
Push-Location (Join-Path $backendRoot 'contracts\orby-market')
try {
  if ($compiler) {
    $env:RUSTC_BOOTSTRAP = '1'
    & $cargoCommand.FullName -Zhost-config -Ztarget-applies-to-host --config (Join-Path $PSScriptRoot 'rust-host.toml') build -p orby-market --target wasm32-unknown-unknown --release
  } else {
    & $cargoCommand.FullName build -p orby-market --target wasm32-unknown-unknown --release
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
