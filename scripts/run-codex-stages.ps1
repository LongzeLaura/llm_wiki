[CmdletBinding()]
param(
    [Alias("StartStage")]
    [string]$From = "02",
    [string]$Until
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StageDir = Join-Path $RepoRoot ".codex/stages"
$StageIdPattern = '^\d{2}$'

if (-not (Test-Path -LiteralPath $StageDir)) {
    throw "Stage directory not found: $StageDir"
}

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "The 'codex' CLI is not available in PATH."
}

if ($From -notmatch $StageIdPattern) {
    throw "Invalid -From value '$From'. Expected a two-digit stage id such as 02."
}

if ($Until -and $Until -notmatch $StageIdPattern) {
    throw "Invalid -Until value '$Until'. Expected a two-digit stage id such as 02."
}

if ($Until -and $From -gt $Until) {
    throw "Invalid stage range: -From $From cannot be greater than -Until $Until."
}

$StagePattern = '^\d{2}-.*\.md$'
$StageFiles = Get-ChildItem -LiteralPath $StageDir -File |
    Where-Object { $_.Name -match $StagePattern } |
    Sort-Object Name

if (-not $StageFiles) {
    throw "No stage files were found in $StageDir"
}

$SelectedStages = $StageFiles | Where-Object {
    $StageNumber = $_.BaseName.Substring(0, 2)
    $StageNumber -ge $From -and (-not $Until -or $StageNumber -le $Until)
}

if (-not $SelectedStages) {
    $Available = ($StageFiles | ForEach-Object { $_.BaseName }) -join ", "
    if ($Until) {
        throw "No stage files found between '$From' and '$Until'. Available stages: $Available"
    }

    throw "No stage files found at or after '$From'. Available stages: $Available"
}

Write-Host ""
if ($Until) {
    Write-Host "Codex stage runner starting from stage $From until stage $Until" -ForegroundColor Cyan
}
else {
    Write-Host "Codex stage runner starting from stage $From" -ForegroundColor Cyan
}
Write-Host "Repository: $RepoRoot" -ForegroundColor Cyan

foreach ($Stage in $SelectedStages) {
    Write-Host ""
    Write-Host ("=== Running stage: {0} ===" -f $Stage.Name) -ForegroundColor Yellow

    $Prompt = Get-Content -LiteralPath $Stage.FullName -Raw
    $Prompt | & codex exec `
        --cd $RepoRoot `
        --sandbox workspace-write `
        -

    if ($LASTEXITCODE -ne 0) {
        throw ("Stage failed: {0} (exit code {1})" -f $Stage.Name, $LASTEXITCODE)
    }

    Write-Host ""
    Write-Host ("git status after {0}:" -f $Stage.Name) -ForegroundColor Green
    & git -C $RepoRoot status --short

    if ($LASTEXITCODE -ne 0) {
        throw ("git status failed after stage: {0}" -f $Stage.Name)
    }
}

Write-Host ""
Write-Host "All selected stages finished." -ForegroundColor Green
Write-Host "Manual review suggestions:" -ForegroundColor Cyan
Write-Host "1. Review git diff and confirm each stage stayed within its allowed scope."
Write-Host "2. Check docs/CURRENT_STATE.md, docs/TASK_QUEUE.md, and IMPLEMENTATION_LOG.md after every stage."
Write-Host "3. Run any additional human verification before committing."
Write-Host "4. Do not auto-commit; decide commits only after manual review."
