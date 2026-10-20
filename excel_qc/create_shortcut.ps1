# Creates "Excel QC" shortcuts on the desktop and in the Start menu (Windows).
# Run it by double-clicking "Create Shortcut (Windows).bat".

$launcher = Join-Path $PSScriptRoot "Start Excel QC (Windows).bat"
$repo = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path -LiteralPath $launcher)) {
    Write-Host "Can't find $launcher" -ForegroundColor Red
    exit 1
}

$places = @(
    [Environment]::GetFolderPath("Desktop"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs")
)

$shell = New-Object -ComObject WScript.Shell
foreach ($place in $places) {
    $path = Join-Path $place "Excel QC.lnk"
    $shortcut = $shell.CreateShortcut($path)
    # Point at cmd.exe instead of the .bat itself, so the shortcut can be pinned to the taskbar.
    $shortcut.TargetPath = Join-Path $env:WINDIR "System32\cmd.exe"
    $shortcut.Arguments = "/c `"`"$launcher`"`""
    $shortcut.WorkingDirectory = $repo
    $shortcut.Description = "Start the Excel QC tool"
    $shortcut.Save()
    Write-Host "Created: $path"
}
