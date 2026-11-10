# Recreate the pinned local tooling. Registration is an explicit optional step.
param([switch]$RegisterCodex)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$nodeVersion = '24.22.2'
$archiveName = "node-v$nodeVersion-win-x64.zip"
$expectedHash = 'CA1BFF5D8EAD13C9F2EA404A176DB46BD430704D5B5113734049FA365E7799E2'
$nodeRoot = Join-Path $PSScriptRoot "runtime/node-v$nodeVersion-win-x64"
$nodeExe = Join-Path $nodeRoot 'node.exe'

if (!(Test-Path -LiteralPath $nodeExe)) {
    $downloadRoot = Join-Path $PSScriptRoot 'downloads'
    $runtimeRoot = Join-Path $PSScriptRoot 'runtime'
    New-Item -ItemType Directory -Force -Path $downloadRoot, $runtimeRoot | Out-Null
    $archivePath = Join-Path $downloadRoot $archiveName
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$nodeVersion/$archiveName" -OutFile $archivePath -TimeoutSec 120
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'Node.js archive checksum mismatch.'
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot
}
if ((& $nodeExe --version) -ne "v$nodeVersion") {
    throw "Expected the dedicated Node.js v$nodeVersion runtime."
}

$previousPath = $env:PATH
try {
    $env:PATH = "$nodeRoot;$previousPath"
    & $nodeExe (Join-Path $nodeRoot 'node_modules/npm/bin/npm-cli.js') ci --prefix $PSScriptRoot --cache (Join-Path $PSScriptRoot 'npm-cache') --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'REA dependency installation failed.' }
    if ($RegisterCodex) {
        & $nodeExe (Join-Path $PSScriptRoot 'node_modules/rea-agents/scripts/rea.mjs') setup --client codex
        if ($LASTEXITCODE -ne 0) { throw 'Codex registration did not complete.' }
    }
} finally {
    $env:PATH = $previousPath
}
