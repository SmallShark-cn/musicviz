
    # 用法: .\fetch_multi_custom.ps1 win64:D:\output\win64 linux64:D:\output\linux64 macos64:D:\output\macos64
    param (
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$args
    )

$archToPattern = @{
    "win64"   = "windows-x64"
    "win32"   = "windows-x86"
    "winarm"  = "windows-arm64"
    "linux64" = "linux-x64"
    "linuxarm"= "linux-arm64"
    "macos64" = "macos-x64"
    "macosarm"= "macos-arm64"
}

foreach ($arg in $args) {
    $split = $arg -split ":", 2
    $arch = $split[0]
    $target = $split[1]

    if (-not $archToPattern.ContainsKey($arch)) {
        Write-Host "未知架构: $arch"
        continue
    }

    $pattern = $archToPattern[$arch]

    # 获取 Release 资源列表
    $releaseApi = "https://api.github.com/repos/2061360308/MusicLibrary/releases/latest"
    $headers = @{ "Accept" = "application/vnd.github.v3+json" }
    $releaseJson = Invoke-RestMethod -Uri $releaseApi -Headers $headers
    $assets = $releaseJson.assets

    # 模糊匹配 zip 文件名
    $matched = $null
    foreach ($asset in $assets) {
        if ($asset.name -match "$pattern.*\.zip$") {
            $matched = $asset
            break
        }
    }
    if (-not $matched) {
        Write-Host "未找到 $arch 对应的 zip 文件"
        continue
    }

    $zipName = $matched.name
    $zipUrl = $matched.browser_download_url
    $zipPath = Join-Path $target $zipName

    if (-not (Test-Path $target)) {
        New-Item -ItemType Directory -Path $target | Out-Null
    }
    Write-Host "下载 $zipName 到 $target ..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    Write-Host "解压 $zipName ..."
    Expand-Archive -Path $zipPath -DestinationPath $target -Force

    Write-Host "清理 lib 目录 ..."
    $libDir = Join-Path $target "lib"
    if (Test-Path $libDir) {
        Get-ChildItem -Path $libDir -File | Where-Object {
            $_.Extension -notin ".dll", ".so", ".dylib"
        } | Remove-Item -Force
    }

    Write-Host "$arch 完成`n"

    # 解压后删除 zip 文件
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
        Write-Host "已删除 $zipName"
    }
}

Write-Host "全部完成"