$ErrorActionPreference = 'Stop'
$env:AWS_LC_SYS_PREBUILT_NASM = '1'
$backendRoot = Split-Path -Parent $PSScriptRoot
$compiler = Get-ChildItem -LiteralPath (Join-Path $backendRoot '.tools') -Directory -Filter 'llvm-mingw-*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($compiler) {
  $env:PATH = (Join-Path $compiler.FullName 'bin') + ';' + $env:PATH
  $env:RUSTFLAGS = '-C link-self-contained=yes -C linker=rust-lld -C linker-flavor=ld.lld'
}
$cargoPath = (Get-Command cargo.exe -ErrorAction SilentlyContinue).Source
if (-not $cargoPath) { $cargoPath = Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe' }
& $cargoPath test --manifest-path (Join-Path $backendRoot 'contracts/orby-market/Cargo.toml')
exit $LASTEXITCODE
