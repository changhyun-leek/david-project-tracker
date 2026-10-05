$ErrorActionPreference = 'Stop'

$appUrl = 'https://changhyun-leek.github.io/david-project-tracker/'
$shortcutName = '다윗 프로젝트 진행관리.lnk'
$desktopPath = [Environment]::GetFolderPath('DesktopDirectory')
$chromePath = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not $desktopPath -or -not (Test-Path -LiteralPath $desktopPath)) {
  throw 'Windows 바탕화면 폴더를 찾지 못했습니다.'
}
if (-not $chromePath) {
  throw 'Google Chrome을 찾지 못했습니다.'
}

$assetDirectory = Join-Path $env:LOCALAPPDATA 'DavidProjectTracker'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$iconPath = Join-Path $assetDirectory 'david.ico'

Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)
$shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
$shape.AddArc(8, 8, 96, 96, 180, 90)
$shape.AddArc(152, 8, 96, 96, 270, 90)
$shape.AddArc(152, 152, 96, 96, 0, 90)
$shape.AddArc(8, 152, 96, 96, 90, 90)
$shape.CloseFigure()
$background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(20, 56, 61))
$foreground = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(218, 238, 123))
$font = [System.Drawing.Font]::new('Georgia', 154, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$alignment = [System.Drawing.StringFormat]::new()
$alignment.Alignment = [System.Drawing.StringAlignment]::Center
$alignment.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.FillPath($background, $shape)
$graphics.DrawString('D', $font, $foreground, [System.Drawing.RectangleF]::new(0, -11, 256, 256), $alignment)

$pngStream = [System.IO.MemoryStream]::new()
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $pngStream.ToArray()
$iconStream = [System.IO.File]::Create($iconPath)
$writer = [System.IO.BinaryWriter]::new($iconStream)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([uint16]1)
$writer.Write([uint16]32)
$writer.Write([uint32]$pngBytes.Length)
$writer.Write([uint32]22)
$writer.Write($pngBytes)
$writer.Dispose()
$pngStream.Dispose()
$alignment.Dispose()
$font.Dispose()
$foreground.Dispose()
$background.Dispose()
$shape.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

$shortcutPath = Join-Path $desktopPath $shortcutName
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $chromePath
$shortcut.Arguments = "--profile-directory=Default --app=$appUrl"
$shortcut.WorkingDirectory = Split-Path -Parent $chromePath
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = '다윗 프로젝트 28일 진행관리'
$shortcut.Save()

Write-Output "바탕화면 바로가기: $shortcutPath"
Write-Output "전용 아이콘: $iconPath"
