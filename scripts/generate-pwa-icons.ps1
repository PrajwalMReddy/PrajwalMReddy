param()

$baseDir = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $baseDir "public\img\hurricane.png"
$iconsDir = Join-Path $baseDir "public\icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

function Resize-Image($sourcePath, $destinationPath, $width, $height) {
    $src = [System.Drawing.Image]::FromFile($sourcePath)
    $dst = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $width, $height)
    $dst.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dst.Dispose()
    $src.Dispose()
    Write-Host ("Created " + $destinationPath + " (" + $width + "x" + $height + ")")
}

Resize-Image $srcPath (Join-Path $iconsDir "icon-192.png") 192 192
Resize-Image $srcPath (Join-Path $iconsDir "icon-512.png") 512 512
Resize-Image $srcPath (Join-Path $iconsDir "apple-touch-icon.png") 180 180
