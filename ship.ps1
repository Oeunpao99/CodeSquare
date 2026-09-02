# ship.ps1 — stage everything, commit, and push the current branch.
#
#   .\ship.ps1                     # commit with an auto timestamp message
#   .\ship.ps1 "fix: rate limits"  # commit with your own message
#
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$msg = if ($args.Count) { $args -join ' ' } else { "chore: update {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }

git status --porcelain | Out-String | Set-Variable dirty
if (-not $dirty.Trim()) {
    Write-Host "Working tree clean - nothing to commit."
    exit 0
}

$branch = (git branch --show-current).Trim()
if (-not $branch) { Write-Error "Detached HEAD - checkout a branch before shipping."; exit 1 }

git add -A
git status --short
git commit -m $msg
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { git push } else { git push -u origin $branch }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK - shipped '$msg' to $branch."
