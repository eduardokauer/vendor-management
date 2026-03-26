[CmdletBinding()]
param()

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

function Get-NextIncrement {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $lines = Get-Content -LiteralPath $Path
    $startIndex = $null
    $code = $null
    $title = $null

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match '^- \[ \] \*\*(INC-\d{3})\*\* (.+)$') {
            $startIndex = $index
            $code = $Matches[1]
            $title = $Matches[2].Trim()
            break
        }
    }

    if ($null -eq $startIndex) {
        return $null
    }

    $blockLines = @()
    for ($index = $startIndex; $index -lt $lines.Count; $index++) {
        if ($index -ne $startIndex -and $lines[$index] -match '^- \[[ x>]\] \*\*INC-\d{3}\*\* ') {
            break
        }
        $blockLines += $lines[$index]
    }

    return [PSCustomObject]@{
        Code     = $code
        Title    = $title
        Markdown = ($blockLines -join [Environment]::NewLine)
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
$incrementsPath = Join-Path $repoRoot "INCREMENTS.md"
$projectContextPath = Join-Path $repoRoot "docs/project_context.md"
$pmWorkflowPath = Join-Path $repoRoot "docs/pm_workflow.md"
$templatePath = Join-Path $repoRoot "prompts/PROMPT_TEMPLATE.md"
$outputPath = Join-Path $repoRoot "prompts/next_prompt.md"

Import-EnvFile -Path $rootEnvPath

$geminiKey = [Environment]::GetEnvironmentVariable("GEMINI_KEY")
if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw "GEMINI_KEY is not defined. Set it in the environment or in the root .env file."
}

$nextIncrement = Get-NextIncrement -Path $incrementsPath
if ($null -eq $nextIncrement) {
    throw "No pending increment found in INCREMENTS.md."
}

$projectContext = Get-Content -LiteralPath $projectContextPath -Raw
$pmWorkflow = Get-Content -LiteralPath $pmWorkflowPath -Raw
$promptTemplate = Get-Content -LiteralPath $templatePath -Raw

$prompt = @"
Voce esta atuando como PM/guia do projeto `vendor-management`.

Leia e siga rigorosamente o contexto e o workflow abaixo. Preserve as regras, o escopo e a ordem correta de implementacao.

Sua tarefa e preencher o template de prompt para o Codex com base no proximo incremento pendente do backlog.

Regras para sua resposta:
1. Retorne somente o prompt final preenchido em Markdown.
2. Nao use fences de codigo.
3. Nao deixe placeholders sem preencher.
4. Mantenha as secoes fixas do template.
5. Use o estado real documentado do projeto, sem inventar stack, comandos ou arquivos.
6. O prompt final precisa mandar o Codex ler `docs/project_context.md` e `docs/codex_workflow.md` por completo antes de qualquer trabalho.
7. O DoD deve ser verificavel, objetivo e coerente com o incremento.
8. O valor funcional da etapa precisa ser explicito.

## Proximo incremento pendente

$($nextIncrement.Markdown)

## Contexto do projeto

$projectContext

## Workflow do PM

$pmWorkflow

## Template a ser preenchido

$promptTemplate
"@

$generatedPrompt = Invoke-GeminiPrompt -ApiKey $geminiKey -Prompt $prompt -Temperature 0.3 -MaxOutputTokens 4096
Set-Content -LiteralPath $outputPath -Value $generatedPrompt -Encoding utf8

Write-Host "Prompt generated for $($nextIncrement.Code): $($nextIncrement.Title)"
Write-Host "Saved to $outputPath"

Open-InVSCode -Path $outputPath
