param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IndexFile = Join-Path $BaseDir "index.html"
$DataDir = Join-Path $BaseDir "data"
$DataFile = Join-Path $DataDir "portfolios.json"

if (-not (Test-Path -LiteralPath $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir | Out-Null
}
if (-not (Test-Path -LiteralPath $DataFile)) {
  '{}' | Set-Content -LiteralPath $DataFile -Encoding UTF8
}

function ConvertTo-Hashtable($obj) {
  if ($null -eq $obj) { return @{} }
  if ($obj -is [hashtable]) { return $obj }
  $h = @{}
  foreach ($p in $obj.PSObject.Properties) {
    $h[$p.Name] = $p.Value
  }
  return $h
}

function Load-Store {
  try {
    $raw = Get-Content -LiteralPath $DataFile -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
    $obj = $raw | ConvertFrom-Json
    return (ConvertTo-Hashtable $obj)
  } catch {
    return @{}
  }
}

function Save-Store([hashtable]$store) {
  $json = $store | ConvertTo-Json -Depth 20
  Set-Content -LiteralPath $DataFile -Value $json -Encoding UTF8
}

function New-ShortId([hashtable]$store) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray()
  do {
    $id = -join (1..8 | ForEach-Object { $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)] })
  } while ($store.ContainsKey($id))
  return $id
}

function Get-StatusText([int]$status) {
  switch ($status) {
    200 { "OK" }
    201 { "Created" }
    400 { "Bad Request" }
    413 { "Payload Too Large" }
    404 { "Not Found" }
    default { "OK" }
  }
}

function Write-Response(
  [System.IO.Stream]$stream,
  [int]$status,
  [string]$contentType,
  [byte[]]$body,
  [hashtable]$headers
) {
  $writer = [System.IO.StreamWriter]::new($stream, [System.Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $statusText = Get-StatusText $status
  $writer.WriteLine("HTTP/1.1 $status $statusText")
  $writer.WriteLine("Content-Type: $contentType")
  $writer.WriteLine("Content-Length: $($body.Length)")
  $writer.WriteLine("Connection: close")
  foreach ($k in $headers.Keys) {
    $writer.WriteLine("${k}: $($headers[$k])")
  }
  $writer.WriteLine("")
  $writer.Flush()
  $stream.Write($body, 0, $body.Length)
  $stream.Flush()
}

function Write-Json([System.IO.Stream]$stream, [int]$status, $payload) {
  $json = $payload | ConvertTo-Json -Depth 20
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Write-Response -stream $stream -status $status -contentType "application/json; charset=utf-8" -body $bytes -headers @{}
}

function Write-Html([System.IO.Stream]$stream, [int]$status, [string]$html) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
  Write-Response -stream $stream -status $status -contentType "text/html; charset=utf-8" -body $bytes -headers @{}
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host "Enjazy server running at http://localhost:$Port"
$maxBodyChars = 26000000

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 8192, $true)

    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      $client.Close()
      continue
    }

    $parts = $requestLine.Split(" ")
    $method = $parts[0]
    $path = $parts[1]

    $headers = @{}
    while ($true) {
      $line = $reader.ReadLine()
      if ($line -eq $null -or $line -eq "") { break }
      $idx = $line.IndexOf(":")
      if ($idx -gt 0) {
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        $headers[$name] = $value
      }
    }

    $contentLength = 0
    if ($headers.ContainsKey("Content-Length")) {
      [void][int]::TryParse($headers["Content-Length"], [ref]$contentLength)
    }

    $bodyText = ""
    if ($contentLength -gt 0) {
      if ($contentLength -gt $maxBodyChars) {
        Write-Json $stream 413 @{ error = "payload_too_large" }
        continue
      }
      $buffer = New-Object char[] $contentLength
      [void]$reader.ReadBlock($buffer, 0, $contentLength)
      $bodyText = -join $buffer
    }

    if (($method -eq "GET") -and (($path -eq "/") -or ($path -eq "/index.html"))) {
      $html = Get-Content -LiteralPath $IndexFile -Raw
      Write-Html $stream 200 $html
      continue
    }

    if (($method -eq "GET") -and ($path -match "^/share/[A-Za-z0-9]+$")) {
      $html = Get-Content -LiteralPath $IndexFile -Raw
      Write-Html $stream 200 $html
      continue
    }

    if (($method -eq "GET") -and ($path -eq "/health")) {
      Write-Json $stream 200 @{ status = "ok" }
      continue
    }

    if (($method -eq "GET") -and ($path -match "^/api/portfolios/([A-Za-z0-9]+)$")) {
      $shortId = $matches[1]
      $store = Load-Store
      if (-not $store.ContainsKey($shortId)) {
        Write-Json $stream 404 @{ error = "not_found" }
      } else {
        Write-Json $stream 200 $store[$shortId]
      }
      continue
    }

    if (($method -eq "POST") -and ($path -eq "/api/portfolios")) {
      try {
        $body = $bodyText | ConvertFrom-Json
      } catch {
        Write-Json $stream 400 @{ error = "invalid_payload" }
        continue
      }

      $profile = ConvertTo-Hashtable $body.profile
      if ($profile.ContainsKey("password")) { $profile.Remove("password") }
      $entries = @($body.entries)

      $payload = @{
        profile = $profile
        entries = $entries
        generatedAt = $body.generatedAt
      }

      $store = Load-Store
      $shortId = New-ShortId $store
      $store[$shortId] = $payload
      Save-Store $store

      $hostHeader = if ($headers.ContainsKey("Host")) { $headers["Host"] } else { "localhost:$Port" }
      Write-Json $stream 201 @{
        id = $shortId
        url = "http://$hostHeader/share/$shortId"
      }
      continue
    }

    Write-Json $stream 404 @{ error = "not_found" }
  } catch {
    try {
      $stream = $client.GetStream()
      Write-Json $stream 400 @{ error = "request_error"; message = $_.Exception.Message }
    } catch { }
  } finally {
    $client.Close()
  }
}
