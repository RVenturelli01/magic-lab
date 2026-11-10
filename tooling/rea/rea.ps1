# Run the pinned REA installation with its dedicated Node.js runtime.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$nodeRoot = Join-Path $PSScriptRoot 'runtime/node-v24.22.2-win-x64'
$nodeExe = Join-Path $nodeRoot 'node.exe'
$entry = Join-Path $PSScriptRoot 'node_modules/rea-agents/scripts/rea.mjs'
if (!(Test-Path -LiteralPath $nodeExe) -or !(Test-Path -LiteralPath $entry)) {
    throw 'REA is not installed here. See tooling/rea/SETUP.md.'
}

$previousPath = $env:PATH
try {
    $env:PATH = "$nodeRoot;$previousPath"
    & $nodeExe $entry @args
    $reaExitCode = $LASTEXITCODE
} finally {
    $env:PATH = $previousPath
}
exit $reaExitCode
