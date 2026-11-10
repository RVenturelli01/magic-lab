# Start this only when the user is ready to begin the browser investigation.
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 9222,
    [string]$Url = 'about:blank',
    [switch]$CheckOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$browserCandidates = @(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (Join-Path $env:LOCALAPPDATA 'Google/Chrome/Application/chrome.exe')
)
$browserExe = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$browserExe) { throw 'Google Chrome was not found in its usual Windows installation locations.' }
if ($Url -ne 'about:blank') {
    $targetUri = [Uri]$Url
    if (!$targetUri.IsAbsoluteUri -or $targetUri.Scheme -notin @('http', 'https') -or $Url.Contains('"')) {
        throw 'Use about:blank or an absolute HTTP(S) URL.'
    }
}

$profilePath = Join-Path $PSScriptRoot 'browser-profile'
$endpoint = "http://127.0.0.1:$Port"
if ($CheckOnly) {
    [pscustomobject]@{ Browser = $browserExe; Profile = $profilePath; Endpoint = $endpoint; LaunchPerformed = $false }
    return
}

# Refuse to reuse an unrelated service or browser already listening on this port.
$portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $portProbe.Start()
} catch {
    throw "Port $Port is already in use. Close the previous investigation browser or select another -Port."
} finally {
    $portProbe.Stop()
}

New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
$launchArguments = @(
    '--remote-debugging-address=127.0.0.1',
    "--remote-debugging-port=$Port",
    ('--user-data-dir="' + $profilePath + '"'),
    '--no-first-run',
    '--no-default-browser-check',
    ('"' + $Url + '"')
)
# This is an interactive browser for the user, so its window is intentionally visible.
$browserProcess = Start-Process -FilePath $browserExe -ArgumentList $launchArguments -PassThru
[pscustomobject]@{ ProcessId = $browserProcess.Id; Endpoint = $endpoint; Profile = $profilePath }
