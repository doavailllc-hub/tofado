$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$staging = Join-Path $workspace '.staging'
$serverExe = Join-Path $staging 'runtime\mysql-8.4.11-winx64\bin\mysqld.exe'
$configPath = Join-Path $staging 'mysql.ini'
if (!(Test-Path -LiteralPath $serverExe) -or !(Test-Path -LiteralPath $configPath)) { throw 'Staging runtime/config is missing. See STAGING.md.' }
$probe = New-Object Net.Sockets.TcpClient
try {
    $probe.Connect('127.0.0.1', 3307)
    throw 'Port 3307 is already in use. Run staging:status; no second server was started.'
} catch [Net.Sockets.SocketException] {
    # Expected when this isolated instance is stopped.
} finally { $probe.Dispose() }
$arguments = @("--defaults-file=`"$configPath`"")
$bootstrap = Join-Path $staging 'bootstrap.sql'
if (Test-Path -LiteralPath $bootstrap) { $arguments += "--init-file=`"$bootstrap`"" }
$serverProcess = Start-Process -FilePath $serverExe -ArgumentList $arguments -WindowStyle Hidden -PassThru
$serverProcess.Id | Set-Content -LiteralPath (Join-Path $staging 'server.pid')
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) { throw 'Staging MySQL exited during startup. Inspect .staging/mysql-error.log.' }
    $check = New-Object Net.Sockets.TcpClient
    try { $check.Connect('127.0.0.1', 3307); $ready = $true } catch [Net.Sockets.SocketException] { } finally { $check.Dispose() }
    if ($ready) { break }
    Start-Sleep -Milliseconds 250
}
if (!$ready) { throw 'Staging MySQL did not begin listening within 15 seconds. Inspect the local log.' }
Write-Output 'Staging MySQL is listening in the background. Run npm run staging:status --prefix merchant-server to verify its identity.'
