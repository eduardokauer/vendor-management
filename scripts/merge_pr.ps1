[CmdletBinding()]
param(
    [int]$PrNumber
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-GhJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & gh @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments -join ' ') failed: $output"
    }

    return ($output | ConvertFrom-Json)
}

function Invoke-Gh {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & gh @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments -join ' ') failed."
    }
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "gh CLI was not found in PATH."
}

$viewArgs = @("pr", "view")
if ($PSBoundParameters.ContainsKey("PrNumber")) {
    $viewArgs += "$PrNumber"
}
$viewArgs += @("--json", "number,title,url,headRefName,baseRefName")
$pr = Get-GhJson -Arguments $viewArgs

Write-Host "PR #$($pr.number)"
Write-Host "Title: $($pr.title)"
Write-Host "URL: $($pr.url)"
Write-Host "Branch: $($pr.headRefName) -> $($pr.baseRefName)"

$confirmation = Read-Host "Proceed with squash merge and delete branch? [y/N]"
if ($confirmation -notin @("y", "Y", "yes", "YES")) {
    throw "Merge cancelled by user."
}

Invoke-Gh -Arguments @("pr", "merge", "$($pr.number)", "--squash", "--delete-branch")

Invoke-Git -Arguments @("switch", "develop")
Invoke-Git -Arguments @("pull", "--ff-only", "origin", "develop")

if ($pr.title -notmatch '(INC-\d{3})') {
    throw "Could not detect an INC-XXX code in the PR title."
}

$incrementCode = $Matches[1]
$incrementsPath = Join-Path $repoRoot "INCREMENTS.md"
$incrementsContent = Get-Content -LiteralPath $incrementsPath -Raw
$escapedCode = [regex]::Escape($incrementCode)
$pattern = "(?m)^- \[[ x>]\] \*\*$escapedCode\*\*(.*)$"

if ($incrementsContent -notmatch $pattern) {
    throw "Could not find $incrementCode in INCREMENTS.md."
}

$updatedContent = [regex]::Replace($incrementsContent, $pattern, "- [x] **$incrementCode**`$1", 1)
Set-Content -LiteralPath $incrementsPath -Value $updatedContent -Encoding utf8

Invoke-Git -Arguments @("add", "INCREMENTS.md")
Invoke-Git -Arguments @("commit", "-m", "Mark $incrementCode as completed")
Invoke-Git -Arguments @("push", "origin", "develop")

Write-Host "Merged PR #$($pr.number) and marked $incrementCode as completed."
Write-Host "Next step suggestion: pwsh ./scripts/gen_prompt.ps1"
