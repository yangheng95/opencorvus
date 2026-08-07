param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [Parameter(Mandatory = $true)]
  [int]$WindowProcessId,
  [Parameter(Mandatory = $true)]
  [string]$TaskId,
  [Parameter(Mandatory = $true)]
  [string]$Requirement,
  [int]$DurationSeconds = 45,
  [int]$FramesPerSecond = 6,
  [int]$PlaybackFramesPerSecond = 12,
  [int]$FrameWidth = 0,
  [int]$FrameHeight = 0,
  [string]$TaskStatusEndpoint = "",
  [int]$TerminalHoldSeconds = 12
)

$ErrorActionPreference = "Stop"

if ($DurationSeconds -lt 10) {
  throw "DurationSeconds must be at least 10"
}
if ($FramesPerSecond -lt 2) {
  throw "FramesPerSecond must be at least 2"
}
if ($PlaybackFramesPerSecond -lt $FramesPerSecond) {
  throw "PlaybackFramesPerSecond must not be lower than FramesPerSecond"
}
if (
  ($FrameWidth -ne 0 -or $FrameHeight -ne 0) -and
  ($FrameWidth -lt 1280 -or $FrameHeight -lt 720 -or ($FrameWidth * 9) -ne ($FrameHeight * 16))
) {
  throw "FrameWidth and FrameHeight must define a promotional 16:9 frame of at least 1280x720"
}
if ($TaskStatusEndpoint -ne "") {
  # URI means Uniform Resource Identifier, the absolute task-status API address.
  $parsedTaskStatusEndpoint = $null
  if (
    -not [Uri]::TryCreate($TaskStatusEndpoint, [UriKind]::Absolute, [ref]$parsedTaskStatusEndpoint) -or
    $parsedTaskStatusEndpoint.Scheme -notin @("http", "https")
  ) {
    throw "TaskStatusEndpoint must be an absolute HTTP or HTTPS URI"
  }
  if ($TerminalHoldSeconds -lt 5) {
    throw "TerminalHoldSeconds must be at least 5"
  }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $resolvedOutput) {
  $existingFrames = @(Get-ChildItem -LiteralPath $resolvedOutput -Filter "frame-*.png" -File)
  if ($existingFrames.Count -gt 0) {
    throw "OutputDirectory already contains captured frames: $resolvedOutput"
  }
} else {
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}

Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class OpenCorvusRecordingWindow {
  // GDI means Windows Graphics Device Interface, the native screen-capture surface.
  [DllImport("user32.dll")]
  public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

  [DllImport("user32.dll")]
  public static extern bool GetClientRect(IntPtr window, out Rectangle rectangle);

  [DllImport("user32.dll")]
  public static extern bool ClientToScreen(IntPtr window, ref Point point);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr window);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr window);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr window, int command);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr window, StringBuilder title, int maximumCount);

  private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);

  public static IntPtr FindLargestVisibleWindow(uint expectedProcessId) {
    IntPtr selected = IntPtr.Zero;
    long selectedArea = 0;
    EnumWindows((window, parameter) => {
      uint processId;
      GetWindowThreadProcessId(window, out processId);
      if (processId != expectedProcessId || !IsWindowVisible(window)) return true;
      Rectangle rectangle;
      if (!GetClientRect(window, out rectangle)) return true;
      long width = rectangle.Right - rectangle.Left;
      long height = rectangle.Bottom - rectangle.Top;
      long area = width * height;
      if (area > selectedArea) {
        selected = window;
        selectedArea = area;
      }
      return true;
    }, IntPtr.Zero);
    return selected;
  }

  public static string ReadWindowTitle(IntPtr window) {
    StringBuilder title = new StringBuilder(512);
    GetWindowText(window, title, title.Capacity);
    return title.ToString();
  }

  public struct Rectangle {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public struct Point {
    public int X;
    public int Y;
  }
}
'@

$clientProcess = Get-Process -Id $WindowProcessId -ErrorAction Stop
if ($clientProcess.ProcessName -ne "opencorvus-overlay") {
  throw "WindowProcessId must belong to opencorvus-overlay, got $($clientProcess.ProcessName)"
}

# DPI means dots per inch. Per-monitor awareness keeps native window coordinates
# and Graphics.CopyFromScreen pixels in the same physical coordinate system.
$dpiAwarenessPerMonitorVersion2 = [IntPtr](-4)
[OpenCorvusRecordingWindow]::SetProcessDpiAwarenessContext($dpiAwarenessPerMonitorVersion2) | Out-Null

# The process-reported MainWindowHandle is not stable for a Tauri WebView.
# Enumerate the process-owned windows and select the largest visible client surface.
$clientWindow = [OpenCorvusRecordingWindow]::FindLargestVisibleWindow([uint32]$clientProcess.Id)
if ($clientWindow -eq [IntPtr]::Zero) {
  throw "OpenCorvus process has no visible client window"
}

# SW_MAXIMIZE means Show Window Maximize. The recording must fill the desktop
# presentation surface rather than preserve a restored half-screen window.
$swMaximize = 3
[OpenCorvusRecordingWindow]::ShowWindow($clientWindow, $swMaximize) | Out-Null
[OpenCorvusRecordingWindow]::SetForegroundWindow($clientWindow) | Out-Null
Start-Sleep -Milliseconds 300

$clientRectangle = New-Object OpenCorvusRecordingWindow+Rectangle
if (-not [OpenCorvusRecordingWindow]::GetClientRect($clientWindow, [ref]$clientRectangle)) {
  throw "Unable to read the OpenCorvus client bounds"
}
$clientOrigin = New-Object OpenCorvusRecordingWindow+Point
if (-not [OpenCorvusRecordingWindow]::ClientToScreen($clientWindow, [ref]$clientOrigin)) {
  throw "Unable to project the OpenCorvus client bounds onto the screen"
}
$clientWidth = $clientRectangle.Right - $clientRectangle.Left
$clientHeight = $clientRectangle.Bottom - $clientRectangle.Top
$captureScale = [int][Math]::Floor([Math]::Min($clientWidth / 16, $clientHeight / 9))
$captureWidth = $FrameWidth
$captureHeight = $FrameHeight
if ($captureWidth -eq 0) {
  $captureWidth = $captureScale * 16
}
if ($captureHeight -eq 0) {
  $captureHeight = $captureScale * 9
}
if ($captureWidth -lt 1280 -or $captureHeight -lt 720) {
  throw "OpenCorvus window is too small for promotional recording: client=${clientWidth}x${clientHeight}"
}
if ($clientWidth -lt $captureWidth -or $clientHeight -lt $captureHeight) {
  throw "OpenCorvus window is too small for the requested promotional frame: client=${clientWidth}x${clientHeight}, frame=${captureWidth}x${captureHeight}"
}

$frameCount = $DurationSeconds * $FramesPerSecond
$frameIntervalMilliseconds = 1000 / $FramesPerSecond
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$capturedFrameCount = 0
$terminalStatuses = @("completed", "failed", "cancelled", "blocked")
$terminalStatus = $null
$terminalObservedAtSeconds = $null

for ($frameIndex = 0; $frameIndex -lt $frameCount; $frameIndex += 1) {
  $targetMilliseconds = $frameIndex * $frameIntervalMilliseconds
  $remainingMilliseconds = $targetMilliseconds - $timer.Elapsed.TotalMilliseconds
  if ($remainingMilliseconds -gt 1) {
    Start-Sleep -Milliseconds ([int][Math]::Floor($remainingMilliseconds))
  }

  $bitmap = New-Object System.Drawing.Bitmap $captureWidth, $captureHeight
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen(
      $clientOrigin.X,
      $clientOrigin.Y,
      0,
      0,
      $bitmap.Size,
      [System.Drawing.CopyPixelOperation]::SourceCopy
    )
    $framePath = Join-Path $resolvedOutput ("frame-{0:D5}.png" -f $frameIndex)
    $bitmap.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $capturedFrameCount += 1
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  if ($TaskStatusEndpoint -ne "" -and $frameIndex % $FramesPerSecond -eq 0) {
    $taskStatusPayload = Invoke-RestMethod -Uri $TaskStatusEndpoint -Method Get -TimeoutSec 10
    $matchingTasks = @($taskStatusPayload.tasks | Where-Object { $_.task.id -eq $TaskId })
    if ($matchingTasks.Count -ne 1) {
      throw "TaskStatusEndpoint must expose exactly one matching task for $TaskId"
    }
    $observedStatus = [string]$matchingTasks[0].task.status
    if ($terminalStatuses -contains $observedStatus -and $null -eq $terminalObservedAtSeconds) {
      $terminalStatus = $observedStatus
      $terminalObservedAtSeconds = $timer.Elapsed.TotalSeconds
    }
  }

  if (
    $null -ne $terminalObservedAtSeconds -and
    $timer.Elapsed.TotalSeconds - $terminalObservedAtSeconds -ge $TerminalHoldSeconds
  ) {
    break
  }
}

$timer.Stop()
$metadata = [ordered]@{
  source = "real-opencorvus-desktop-window"
  processId = $clientProcess.Id
  processStartTime = $clientProcess.StartTime.ToUniversalTime().ToString("o")
  application = "OpenCorvus"
  observedWindowTitle = [OpenCorvusRecordingWindow]::ReadWindowTitle($clientWindow)
  windowHandle = $clientWindow.ToInt64()
  captureBounds = "native-client-content-16:9"
  taskId = $TaskId
  requirement = $Requirement
  width = $captureWidth
  height = $captureHeight
  clientWidth = $clientWidth
  clientHeight = $clientHeight
  framesPerSecond = $FramesPerSecond
  playbackFramesPerSecond = $PlaybackFramesPerSecond
  frameCount = $capturedFrameCount
  maximumDurationSeconds = $DurationSeconds
  terminalStatus = $terminalStatus
  terminalHoldSeconds = if ($TaskStatusEndpoint -eq "") { $null } else { $TerminalHoldSeconds }
  capturedDurationSeconds = [Math]::Round($timer.Elapsed.TotalSeconds, 3)
}
$metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $resolvedOutput "recording.json") -Encoding UTF8

Write-Output ($metadata | ConvertTo-Json -Compress)
