# we grant access to the current user instead of Administrators so the installer
# can run without elevation
param (
  [string]$targetUser
)
if (-not $targetUser) {
  $targetUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
}

# Powershell doesn't like emojis in the source code
$emojiWrench = [char]::ConvertFromUtf32(0x1F527)
$emojiCheck  = [char]::ConvertFromUtf32(0x2705)

# If not admin, rerun the script with elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "$emojiWrench Requesting administrator privileges..."
  # -Verb RunAs to run as admin, -Wait to wait for the process to finish
  # it will run in a new window that quickly appears and disappears
  Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -targetUser `"$targetUser`""

  Write-Host "$emojiCheck Successfully obtained access to Slack"
  exit
}

function Run-Bin {
  param([ScriptBlock]$Command)
  & $Command > $null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Command failed with exit code ${LASTEXITCODE}: $Command"
    exit 1
  }
}
$windowsAppsPath = "$env:ProgramFiles\WindowsApps"

Write-Host "$emojiWrench Obtaining read access to WindowsApps directory"

# take ownership of WindowsApps
Run-Bin { takeown /F "$windowsAppsPath" /A }
# grant full control to Administrators (required in order to give the ownership back to TrustedInstaller at the end)
Run-Bin { icacls "$windowsAppsPath" /grant "Administrators:F" }
# grant read permissions to current user
Run-Bin { icacls "$windowsAppsPath" /grant "$($targetUser):RX" }
# restore ownership to TrustedInstaller
Run-Bin { icacls "$windowsAppsPath" /setowner "NT SERVICE\TrustedInstaller" }

$slackFolders = Get-ChildItem -Path $windowsAppsPath -Directory -Filter 'com.tinyspeck.slackdesktop_*'
foreach ($folder in $slackFolders) {
  $slackPackagePath = $folder.FullName

  Write-Host "$emojiWrench Obtaining full access to Slack package at $slackPackagePath"

  # take ownership of the Slack package
  Run-Bin { takeown /F "$slackPackagePath" /A /R /D Y }
  # grant full control to current user
  Run-Bin { icacls "$slackPackagePath" /grant "$($targetUser):F" /T /C }
  # restore ownership to TrustedInstaller
  Run-Bin { icacls "$slackPackagePath" /setowner "NT SERVICE\TrustedInstaller" /T /C }
}

Write-Host "$emojiCheck Successfully obtained access to Slack"
