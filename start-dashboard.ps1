param(
    [ValidateSet('dev', 'build', 'test', 'typecheck', 'lint', 'visual')]
    [string]$Command = 'dev'
)
$ErrorActionPreference = 'Stop'
$nodeRoot = Join-Path $PSScriptRoot 'tooling/rea/runtime/node-v24.22.2-win-x64'
$nodeExe = Join-Path $nodeRoot 'node.exe'
if (!(Test-Path -LiteralPath $nodeExe)) {
    $nodeExe = (Get-Command node -ErrorAction Stop).Source
    $nodeRoot = Split-Path $nodeExe
}
$env:PATH = "$nodeRoot;$env:PATH"
Push-Location (Join-Path $PSScriptRoot 'dashboard')
try {
    if (!(Test-Path 'node_modules')) { throw 'Dependencies missing. Run npm ci inside dashboard first (Node 24 recommended).' }
    switch ($Command) {
        'dev' { & $nodeExe scripts/run-framework.mjs dev --host 127.0.0.1 }
        'build' { & $nodeExe scripts/run-framework.mjs build }
        'test' { & $nodeExe --test 'tests/data/*.test.mjs' 'tests/tooling/*.test.mjs' }
        'typecheck' { & $nodeExe node_modules/typescript/bin/tsc --noEmit }
        'lint' { & $nodeExe node_modules/eslint/bin/eslint.js --max-warnings 0 app components lib/data lib/algorithms lib/download.ts lib/table-export.ts }
        'visual' { & $nodeExe scripts/visual-check.mjs }
    }
    if ($LASTEXITCODE -ne 0) { throw "Dashboard command '$Command' failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
