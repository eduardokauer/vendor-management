[CmdletBinding()]
param(
    [int]$PrNumber
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Import-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            continue
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $existingValue = [Environment]::GetEnvironmentVariable($name)
        if ([string]::IsNullOrWhiteSpace($existingValue)) {
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

function Invoke-GeminiPrompt {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiKey,
        [Parameter(Mandatory = $true)]
        [string]$Prompt,
        [Parameter(Mandatory = $true)]
        [double]$Temperature,
        [Parameter(Mandatory = $true)]
        [int]$MaxOutputTokens
    )

    $uri = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$ApiKey"
    $body = @{
        contents = @(
            @{
                role  = "user"
                parts = @(
                    @{
                        text = $Prompt
                    }
                )
            }
        )
        generationConfig = @{
            temperature     = $Temperature
            maxOutputTokens = $MaxOutputTokens
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body -ErrorAction Stop
    } catch {
        $message = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $message = $_.ErrorDetails.Message
        }
        throw "Gemini API request failed: $message"
    }

    if (-not $response.candidates) {
        throw "Gemini API returned no candidates."
    }

    $textParts = @(
        $response.candidates[0].content.parts |
            ForEach-Object { $_.text } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    $result = ($textParts -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($result)) {
        throw "Gemini API returned no text content."
    }

    return $result
}

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

function Get-GhText {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & gh @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments -join ' ') failed: $output"
    }

    return ($output -join [Environment]::NewLine)
}

function Open-InVSCode {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $codeCommand = Get-Command code -ErrorAction SilentlyContinue
    if ($codeCommand) {
        & $codeCommand.Source $Path | Out-Null
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$rootEnvPath = Join-Path $repoRoot ".env"
$projectContextPath = Join-Path $repoRoot "docs/project_context.md"
$pmWorkflowPath = Join-Path $repoRoot "docs/pm_workflow.md"
$nextPromptPath = Join-Path $repoRoot "prompts/next_prompt.md"
$outputPath = Join-Path $repoRoot "prompts/review_result.md"

Import-EnvFile -Path $rootEnvPath

$geminiKey = [Environment]::GetEnvironmentVariable("GEMINI_KEY")
if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw "GEMINI_KEY is not defined. Set it in the environment or in the root .env file."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "gh CLI was not found in PATH."
}

if (-not (Test-Path -LiteralPath $nextPromptPath)) {
    throw "prompts/next_prompt.md was not found. Run scripts/gen_prompt.ps1 before reviewing a PR."
}

$viewArgs = @("pr", "view")
if ($PSBoundParameters.ContainsKey("PrNumber")) {
    $viewArgs += "$PrNumber"
}
$viewArgs += @("--json", "number,title,body,url,headRefName,baseRefName")
$pr = Get-GhJson -Arguments $viewArgs

$diffArgs = @("pr", "diff", "$($pr.number)")
$prDiff = Get-GhText -Arguments $diffArgs
if ($prDiff.Length -gt 8000) {
    $prDiff = $prDiff.Substring(0, 8000) + "`n`n[diff truncated at 8000 characters]"
}

$projectContext = Get-Content -LiteralPath $projectContextPath -Raw
$pmWorkflow = Get-Content -LiteralPath $pmWorkflowPath -Raw
$originalPrompt = Get-Content -LiteralPath $nextPromptPath -Raw

$reviewPrompt = @"
Voce esta atuando como PM revisor do projeto `vendor-management`.

Sua tarefa e revisar o PR abaixo contra:
1. o contexto real do projeto;
2. o workflow do PM;
3. o prompt original enviado ao Codex;
4. o diff real do PR.

Regras da resposta:
1. A primeira linha deve ser exatamente `STATUS: APROVADO` ou `STATUS: REPROVADO`.
2. Depois da primeira linha, responda em Markdown.
3. Avalie o objetivo, o fora de escopo e cada item do DoD de forma objetiva.
4. Nao mascare falhas: se houver falta de evidencia, marque como reprovado.
5. Se reprovar, gere no final um prompt de correcao pronto para o Codex.
6. Se aprovar, diga explicitamente por que o PR esta pronto para merge.

Formato esperado:
STATUS: APROVADO|REPROVADO

## Resumo

## Objetivo
- [x] ou [ ] ...

## Fora de escopo
- [x] ou [ ] ...

## DoD
- [x] ou [ ] item 1
- [x] ou [ ] item 2

## Riscos ou lacunas

## Prompt de correcao para o Codex
(obrigatorio somente se STATUS: REPROVADO)

## Contexto do projeto

$projectContext

## Workflow do PM

$pmWorkflow

## Prompt original do Codex

$originalPrompt

## Metadados do PR

- Numero: $($pr.number)
- Titulo: $($pr.title)
- URL: $($pr.url)
- Branch head: $($pr.headRefName)
- Branch base: $($pr.baseRefName)

## Body do PR

$($pr.body)

## Diff do PR

$prDiff
"@

$reviewText = Invoke-GeminiPrompt -ApiKey $geminiKey -Prompt $reviewPrompt -Temperature 0.2 -MaxOutputTokens 4096
Set-Content -LiteralPath $outputPath -Value $reviewText -Encoding utf8

Write-Host "Review saved to $outputPath"
Open-InVSCode -Path $outputPath

$firstLine = ($reviewText -split "\r?\n")[0].Trim()
if ($firstLine -eq "STATUS: APROVADO") {
    Write-Host "Review status: APROVADO"
    exit 0
}

if ($firstLine -eq "STATUS: REPROVADO") {
    Write-Host "Review status: REPROVADO"
    exit 1
}

throw "Gemini review did not start with a valid STATUS line."
