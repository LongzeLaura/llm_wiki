<#
.SYNOPSIS
Runs llmWikiRPG Codex stages one process at a time.

.DESCRIPTION
This script executes stage prompts from .codex/stages in numeric order.
Each stage starts a fresh Codex process, so context does not accumulate in one
long session. Stage-to-stage memory is carried by docs/CURRENT_STATE.md and
docs/IMPLEMENTATION_LOG.md, and every stage prompt asks Codex to reread core
documents before making changes.

The legacy .opencode/stages directory may still exist, but it is treated as
historical reference only. The default automation entrypoint is now
scripts/run-codex-stages.ps1 with prompts under .codex/stages.

Recovery examples:
  powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 6 -Until 12
  powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 6 -Until 6

Safety rules:
  - No --yolo or dangerous flags are used.
  - No git commit or git push is performed.
  - A failed stage stops the run immediately.
  - Stages are never merged into one long Codex session.

If your Codex CLI uses different arguments, only modify Invoke-CodexStage.
#>

param(
    [int]$From = 0,
    [int]$Until = 12,
    [string]$StageDir = ".codex/stages",
    [string]$CodexCommand = "codex",
    [switch]$DryRun
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Invoke-CodexStage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PromptFile,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $prompt = Get-Content -Raw -Path $PromptFile

    # Default implementation: run Codex non-interactively with the stage prompt.
    # If your Codex CLI uses different arguments, only modify this function.
    # Do not add --yolo or approval-bypassing flags.
    & $Command exec $prompt | Out-Host
    return [int]$LASTEXITCODE
}

function Get-StageNumber {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileInfo]$File
    )

    if ($File.Name -match '^(\d{2})-.*\.md$') {
        return [int]$Matches[1]
    }

    return $null
}

function Write-StageHeader {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Number,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host ""
    Write-Host "============================================================"
    Write-Host ("Stage {0}: {1}" -f $Number.ToString("00"), $Name)
    Write-Host "Time: $now"
    Write-Host "============================================================"
}

if ($From -lt 0 -or $Until -lt 0) {
    throw "-From and -Until must be non-negative stage numbers."
}

if ($From -gt $Until) {
    throw "-From must be less than or equal to -Until."
}

$phasePlan = "docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md"
if (-not (Test-Path -LiteralPath $phasePlan)) {
    throw "Required file not found: $phasePlan"
}

if (-not (Test-Path -LiteralPath $StageDir)) {
    throw "Stage directory not found: $StageDir"
}

$stageFiles = @(
    Get-ChildItem -LiteralPath $StageDir -Filter "*.md" |
        ForEach-Object {
            $number = Get-StageNumber -File $_
            if ($null -ne $number) {
                [PSCustomObject]@{
                    Number = $number
                    Name = $_.Name
                    FullName = $_.FullName
                }
            }
        } |
        Where-Object {
            $_.Number -ge $From -and $_.Number -le $Until
        } |
        Sort-Object Number, Name
)

if (-not $stageFiles -or $stageFiles.Count -eq 0) {
    throw "No stage files found in range $From to $Until under $StageDir."
}

Write-Host "llmWikiRPG staged Codex runner"
Write-Host "Stage range: $From to $Until"
Write-Host "Stage directory: $StageDir"
Write-Host "Codex command: $CodexCommand"
Write-Host "Dry run: $([bool]$DryRun)"
Write-Host ""
Write-Host "Context management: each stage runs in a fresh Codex process."
Write-Host "Cross-stage state is passed through docs/CURRENT_STATE.md and docs/IMPLEMENTATION_LOG.md."
Write-Host ""

if ($DryRun) {
    Write-Host "Stages that would run:"
    foreach ($stage in $stageFiles) {
        Write-Host ("- {0}: {1}" -f $stage.Number.ToString("00"), $stage.Name)
    }
    Write-Host ""
    Write-Host "Dry run complete. No Codex process was started."
    exit 0
}

$completed = @()

foreach ($stage in $stageFiles) {
    Write-StageHeader -Number $stage.Number -Name $stage.Name
    Write-Host "Prompt file: $($stage.FullName)"
    Write-Host "Starting fresh Codex process for this stage."

    $exitCode = Invoke-CodexStage -PromptFile $stage.FullName -Command $CodexCommand

    Write-Host ""
    Write-Host ("git status --short after stage {0}:" -f $stage.Number.ToString("00"))
    git status --short

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Error ("Stage {0} failed with exit code {1}. Stopping." -f $stage.Number.ToString("00"), $exitCode)
        exit $exitCode
    }

    $completed = @($completed + $stage)
    Write-Host ("Stage {0} completed successfully." -f $stage.Number.ToString("00"))
}

Write-Host ""
Write-Host "All requested stages completed."
Write-Host "Completed stages:"
foreach ($stage in $completed) {
    Write-Host ("- {0}: {1}" -f $stage.Number.ToString("00"), $stage.Name)
}
Write-Host ""
Write-Host "No git commit or git push was performed. Review changes before committing manually."
