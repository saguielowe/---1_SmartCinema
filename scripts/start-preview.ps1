[CmdletBinding()]
param(
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

function Test-SmartCinemaPage {
  param([string]$Uri)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 1
    return $response.StatusCode -eq 200 -and $response.Content -match 'SmartCinema'
  } catch {
    return $false
  }
}

function Test-SmartCinemaRealtime {
  param([string]$Uri)

  $client = New-Object System.Net.WebSockets.ClientWebSocket
  $cancellation = New-Object System.Threading.CancellationTokenSource
  $cancellation.CancelAfter(1500)
  try {
    $client.ConnectAsync([Uri]$Uri, $cancellation.Token).GetAwaiter().GetResult()
    if ($client.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
      return $false
    }

    $probeId = "launcher-probe-$([Guid]::NewGuid().ToString('N'))"
    $hello = "{`"type`":`"hello`",`"clientId`":`"$probeId`"}"
    $sendBytes = [System.Text.Encoding]::UTF8.GetBytes($hello)
    $sendBuffer = [System.ArraySegment[byte]]::new($sendBytes)
    $client.SendAsync(
      $sendBuffer,
      [System.Net.WebSockets.WebSocketMessageType]::Text,
      $true,
      $cancellation.Token
    ).GetAwaiter().GetResult()

    $receiveBytes = New-Object byte[] 4096
    $receiveBuffer = [System.ArraySegment[byte]]::new($receiveBytes)
    $receiveResult = $client.ReceiveAsync(
      $receiveBuffer,
      $cancellation.Token
    ).GetAwaiter().GetResult()
    $responseText = [System.Text.Encoding]::UTF8.GetString(
      $receiveBytes,
      0,
      $receiveResult.Count
    )
    return $receiveResult.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Text `
      -and $responseText -match '"type":"snapshot"'
  } catch {
    return $false
  } finally {
    $client.Dispose()
    $cancellation.Dispose()
  }
}

function Get-PythonRuntime {
  $candidates = New-Object System.Collections.Generic.List[object]
  $knownPaths = @(
    "$env:SystemDrive\msys64\ucrt64\bin\python.exe",
    "$env:SystemDrive\msys64\mingw64\bin\python.exe",
    "$env:SystemDrive\Python313\python.exe",
    "$env:SystemDrive\Python312\python.exe",
    "$env:SystemDrive\Python311\python.exe"
  )

  foreach ($path in $knownPaths) {
    if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
      $candidates.Add([pscustomobject]@{
        FilePath = $path
        Prefix   = [string[]]@()
      })
    }
  }

  $searchPatterns = @()
  if ($env:LOCALAPPDATA) {
    $searchPatterns += Join-Path $env:LOCALAPPDATA 'Programs\Python\Python*\python.exe'
  }
  if ($env:ProgramFiles) {
    $searchPatterns += Join-Path $env:ProgramFiles 'Python*\python.exe'
  }

  foreach ($pattern in $searchPatterns) {
    foreach ($file in @(Get-Item -Path $pattern -ErrorAction SilentlyContinue)) {
      $candidates.Add([pscustomobject]@{
        FilePath = $file.FullName
        Prefix   = [string[]]@()
      })
    }
  }

  foreach ($name in @('python', 'python3')) {
    foreach ($command in @(Get-Command $name -CommandType Application -All -ErrorAction SilentlyContinue)) {
      if ($command.Source -and $command.Source -notmatch '\\WindowsApps\\') {
        $candidates.Add([pscustomobject]@{
          FilePath = $command.Source
          Prefix   = [string[]]@()
        })
      }
    }
  }

  foreach ($command in @(Get-Command py -CommandType Application -All -ErrorAction SilentlyContinue)) {
    $candidates.Add([pscustomobject]@{
      FilePath = $command.Source
      Prefix   = [string[]]@('-3')
    })
  }

  $seen = @{}
  foreach ($candidate in $candidates) {
    $key = ($candidate.FilePath + '|' + ($candidate.Prefix -join ' ')).ToLowerInvariant()
    if ($seen.ContainsKey($key)) {
      continue
    }
    $seen[$key] = $true

    try {
      $versionArguments = @($candidate.Prefix) + @('--version')
      $versionOutput = & $candidate.FilePath $versionArguments 2>&1
      if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match '^Python 3\.') {
        return $candidate
      }
    } catch {
      continue
    }
  }

  return $null
}

try {
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $sourceFolder = Get-ChildItem -LiteralPath $projectRoot -Directory |
    Where-Object {
      $_.Name -like '03_*' -and
      (Test-Path -LiteralPath (Join-Path $_.FullName 'index.html') -PathType Leaf)
    } |
    Select-Object -First 1

  if (-not $sourceFolder) {
    throw 'Source folder was not found. Keep the scripts folder inside the SmartCinema project root.'
  }

  $url = "http://127.0.0.1:$Port/index.html?v=feature-suite-6"
  $runtime = $null
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

  if ($listener) {
    if (-not (Test-SmartCinemaPage -Uri $url)) {
      $processIds = @($listener | Select-Object -ExpandProperty OwningProcess -Unique)
      throw "Port $Port is already occupied by another program (PID: $($processIds -join ', '))."
    }
  } else {
    $runtime = Get-PythonRuntime
    if (-not $runtime) {
      throw 'A working Python 3 runtime was not found. Install Python 3 or add it to PATH.'
    }

    Write-Host "[SmartCinema] Python: $($runtime.FilePath)"
    $serverArguments = @($runtime.Prefix) +
      @('-m', 'http.server', "$Port", '--bind', '127.0.0.1')
    $serverProcess = Start-Process `
      -FilePath $runtime.FilePath `
      -ArgumentList $serverArguments `
      -WorkingDirectory $sourceFolder.FullName `
      -WindowStyle Hidden `
      -PassThru

    $deadline = (Get-Date).AddSeconds(12)
    $ready = $false

    do {
      if (Test-SmartCinemaPage -Uri $url) {
        $ready = $true
        break
      }

      $serverProcess.Refresh()
      if ($serverProcess.HasExited) {
        throw "Python exited before the preview was ready (exit code: $($serverProcess.ExitCode))."
      }

      Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)

    if (-not $ready) {
      if (-not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
      }
      throw "Preview server did not become ready within 12 seconds."
    }
  }

  $realtimePort = 8765
  $realtimeUrl = "ws://127.0.0.1:$realtimePort"
  $realtimeScript = Join-Path $PSScriptRoot 'realtime-server.py'
  if (-not (Test-Path -LiteralPath $realtimeScript -PathType Leaf)) {
    throw 'scripts\realtime-server.py was not found.'
  }

  $realtimeListener = Get-NetTCPConnection `
    -LocalPort $realtimePort `
    -State Listen `
    -ErrorAction SilentlyContinue
  if ($realtimeListener) {
    if (-not (Test-SmartCinemaRealtime -Uri $realtimeUrl)) {
      $processIds = @($realtimeListener | Select-Object -ExpandProperty OwningProcess -Unique)
      throw "Port $realtimePort is occupied by a non-SmartCinema program (PID: $($processIds -join ', '))."
    }
  } else {
    if (-not $runtime) {
      $runtime = Get-PythonRuntime
    }
    if (-not $runtime) {
      throw 'A working Python 3 runtime was not found. Install Python 3 or add it to PATH.'
    }

    $realtimeArguments = @($runtime.Prefix) +
      @($realtimeScript, '--host', '127.0.0.1', '--port', "$realtimePort")
    $realtimeProcess = Start-Process `
      -FilePath $runtime.FilePath `
      -ArgumentList $realtimeArguments `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden `
      -PassThru

    $realtimeDeadline = (Get-Date).AddSeconds(8)
    $realtimeReady = $false
    do {
      if (Test-SmartCinemaRealtime -Uri $realtimeUrl) {
        $realtimeReady = $true
        break
      }
      $realtimeProcess.Refresh()
      if ($realtimeProcess.HasExited) {
        throw "Realtime server exited early (exit code: $($realtimeProcess.ExitCode))."
      }
      Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $realtimeDeadline)

    if (-not $realtimeReady) {
      if (-not $realtimeProcess.HasExited) {
        Stop-Process -Id $realtimeProcess.Id -Force -ErrorAction SilentlyContinue
      }
      throw 'Realtime WebSocket server did not become ready within 8 seconds.'
    }
  }

  Write-Host "[SmartCinema] Realtime ready: $realtimeUrl"
  Write-Host "[SmartCinema] Preview ready: $url"
  if (-not $NoBrowser) {
    Start-Process $url
  }
  exit 0
} catch {
  [Console]::Error.WriteLine("[SmartCinema] ERROR: $($_.Exception.Message)")
  exit 1
}
