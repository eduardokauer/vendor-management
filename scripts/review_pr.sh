#!/usr/bin/env bash
set -euo pipefail

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command not found in PATH: $command_name" >&2
        exit 1
    fi
}

load_env_file() {
    local env_path="$1"
    [[ -f "$env_path" ]] || return 0

    while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
        local line name value existing_value
        line="$(trim "$raw_line")"

        [[ -z "$line" ]] && continue
        [[ "${line:0:1}" == "#" ]] && continue
        [[ "$line" == *=* ]] || continue

        name="$(trim "${line%%=*}")"
        value="$(trim "${line#*=}")"

        [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

        if [[ ${#value} -ge 2 ]]; then
            if [[ ( "${value:0:1}" == '"' && "${value: -1}" == '"' ) || ( "${value:0:1}" == "'" && "${value: -1}" == "'" ) ]]; then
                value="${value:1:${#value}-2}"
            fi
        fi

        existing_value="${!name:-}"
        if [[ -z "$existing_value" ]]; then
            export "$name=$value"
        fi
    done < "$env_path"
}

invoke_gemini_prompt() {
    local api_key="$1"
    local prompt_file="$2"
    local temperature="$3"
    local max_output_tokens="$4"
    local model_name="$5"
    local payload_file response_file http_code
    local max_attempts="${GEMINI_MAX_RETRIES:-3}"
    local fallback_wait_seconds="${GEMINI_FALLBACK_RETRY_SECONDS:-60}"
    local attempt=1

    while (( attempt <= max_attempts )); do
        payload_file="$(mktemp)"
        response_file="$(mktemp)"

        python3 - "$prompt_file" "$temperature" "$max_output_tokens" > "$payload_file" <<'PY'
import json
import sys

prompt_path, temperature, max_tokens = sys.argv[1:]
with open(prompt_path, encoding="utf-8") as handle:
    prompt = handle.read()

payload = {
    "contents": [
        {
            "role": "user",
            "parts": [
                {"text": prompt}
            ],
        }
    ],
    "generationConfig": {
        "temperature": float(temperature),
        "maxOutputTokens": int(max_tokens),
    },
}

json.dump(payload, sys.stdout, ensure_ascii=False)
PY

        if ! http_code="$(
            curl -sS \
                -o "$response_file" \
                -w '%{http_code}' \
                -X POST \
                -H 'Content-Type: application/json' \
                --data-binary "@$payload_file" \
                "https://generativelanguage.googleapis.com/v1beta/models/${model_name}:generateContent?key=$api_key"
        )"; then
            local body
            body="$(<"$response_file")"
            rm -f "$payload_file" "$response_file"
            echo "Gemini API request failed: ${body:-curl request failed}" >&2
            return 1
        fi

        if (( http_code >= 200 && http_code < 300 )); then
            python3 - "$response_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)

candidates = data.get("candidates") or []
if not candidates:
    raise SystemExit("Gemini API returned no candidates.")

parts = ((candidates[0].get("content") or {}).get("parts") or [])
text = "\n".join(
    part.get("text", "")
    for part in parts
    if part.get("text", "").strip()
).strip()

if not text:
    raise SystemExit("Gemini API returned no text content.")

sys.stdout.write(text)
PY
            rm -f "$payload_file" "$response_file"
            return 0
        fi

        if [[ "$http_code" == "429" ]]; then
            local quota_info
            quota_info="$(python3 - "$response_file" <<'PY'
import json
import re
import sys

path = sys.argv[1]
data = json.load(open(path, encoding="utf-8"))
error = data.get("error") or {}
message = (error.get("message") or "").strip()
details = error.get("details") or []

retry_seconds = 0
quota_ids = []
is_daily = False

for detail in details:
    dtype = detail.get("@type", "")
    if dtype.endswith("RetryInfo"):
        raw = detail.get("retryDelay", "0s")
        match = re.match(r"(?:(\d+)s)?(?:(\d+)n)?", raw)
        if match:
            seconds = int(match.group(1) or 0)
            nanos = int(match.group(2) or 0)
            retry_seconds = max(retry_seconds, seconds + (1 if nanos else 0))
    if dtype.endswith("QuotaFailure"):
        for violation in detail.get("violations") or []:
            quota_id = violation.get("quotaId", "")
            if quota_id:
                quota_ids.append(quota_id)
                if "PerDay" in quota_id:
                    is_daily = True

print(f"retry_seconds={retry_seconds}")
print(f"is_daily={'true' if is_daily else 'false'}")
print("quota_ids=" + ",".join(quota_ids))
print("message=" + message.replace("\n", " ").replace("\r", " "))
PY
)"
            local retry_seconds is_daily quota_ids quota_message
            retry_seconds="$(printf '%s\n' "$quota_info" | sed -n 's/^retry_seconds=//p')"
            is_daily="$(printf '%s\n' "$quota_info" | sed -n 's/^is_daily=//p')"
            quota_ids="$(printf '%s\n' "$quota_info" | sed -n 's/^quota_ids=//p')"
            quota_message="$(printf '%s\n' "$quota_info" | sed -n 's/^message=//p')"

            rm -f "$payload_file" "$response_file"

            if [[ "$is_daily" == "true" ]]; then
                echo "Gemini API daily quota exceeded for model ${model_name}. quota_ids=${quota_ids:-unknown}. ${quota_message}" >&2
                return 75
            fi

            if (( attempt >= max_attempts )); then
                echo "Gemini API rate limit persisted after ${attempt} attempts for model ${model_name}. quota_ids=${quota_ids:-unknown}. ${quota_message}" >&2
                return 1
            fi

            if [[ -z "$retry_seconds" || "$retry_seconds" == "0" ]]; then
                retry_seconds="$(( fallback_wait_seconds * attempt ))"
            fi

            echo "Gemini API rate limit hit for model ${model_name}. quota_ids=${quota_ids:-unknown}. Waiting ${retry_seconds}s before retry ${attempt}/${max_attempts}..." >&2
            sleep "$retry_seconds"
            attempt=$((attempt + 1))
            continue
        fi

        local body
        body="$(<"$response_file")"
        rm -f "$payload_file" "$response_file"
        echo "Gemini API request failed (HTTP $http_code): $body" >&2
        return 1
    done

    echo "Gemini API retry budget exhausted unexpectedly." >&2
    return 1
}

open_in_vscode() {
    local file_path="$1"
    if command -v code >/dev/null 2>&1; then
        code "$file_path" >/dev/null 2>&1 &
    fi
}

pr_number=""
prompt_file_override=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -PrNumber|--pr-number)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            pr_number="$2"
            shift 2
            ;;
        --prompt-file)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            prompt_file_override="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

require_command python3
require_command curl
require_command gh

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root_env_path="$repo_root/.env"
project_context_path="$repo_root/docs/project_context.md"
pm_workflow_path="$repo_root/docs/pm_workflow.md"
output_path="$repo_root/prompts/review_result.md"
correction_output_path="$repo_root/prompts/correction_prompt.md"
generated_dir_path="$repo_root/prompts/generated"

load_env_file "$root_env_path"

gemini_key="${GEMINI_KEY:-}"
if [[ -z "$gemini_key" ]]; then
    echo "GEMINI_KEY is not defined. Set it in the environment or in the root .env file." >&2
    exit 1
fi

gemini_model="${GEMINI_MODEL:-gemini-2.5-flash}"

pr_json_file="$(mktemp)"
diff_file="$(mktemp)"
review_prompt_file="$(mktemp)"

if [[ -n "$pr_number" ]]; then
    gh pr view "$pr_number" --json number,title,body,url,headRefName,baseRefName > "$pr_json_file"
else
    gh pr view --json number,title,body,url,headRefName,baseRefName > "$pr_json_file"
fi

resolved_pr_number="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["number"])' "$pr_json_file")"
gh pr diff "$resolved_pr_number" > "$diff_file"

python3 - "$diff_file" <<'PY'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()

if len(text) > 8000:
    text = text[:8000] + "\n\n[diff truncated at 8000 characters]"

with open(path, "w", encoding="utf-8") as handle:
    handle.write(text)
PY

project_context="$(<"$project_context_path")"
pm_workflow="$(<"$pm_workflow_path")"
pr_body="$(python3 -c 'import json,sys; data=json.load(open(sys.argv[1], encoding="utf-8")); print(data.get("body") or "")' "$pr_json_file")"
pr_title="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["title"])' "$pr_json_file")"
pr_url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["url"])' "$pr_json_file")"
pr_head="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["headRefName"])' "$pr_json_file")"
pr_base="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["baseRefName"])' "$pr_json_file")"
pr_diff="$(<"$diff_file")"

if [[ "$pr_title" =~ (INC-[0-9]{3}) ]]; then
    increment_code="${BASH_REMATCH[1]}"
elif [[ -n "$prompt_file_override" ]]; then
    increment_code="MANUAL"
else
    echo "Could not detect an INC-XXX code in the PR title. Review requires an increment-specific prompt archive." >&2
    rm -f "$pr_json_file" "$diff_file" "$review_prompt_file"
    exit 1
fi

if [[ -n "$prompt_file_override" ]]; then
    prompt_source_path="$prompt_file_override"
else
    prompt_source_path="$generated_dir_path/${increment_code}.md"
fi

if [[ ! -f "$prompt_source_path" ]]; then
    echo "Prompt source not found: $prompt_source_path" >&2
    echo "Generate the increment prompt first with ./scripts/gen_prompt.sh or pass --prompt-file explicitly." >&2
    rm -f "$pr_json_file" "$diff_file" "$review_prompt_file"
    exit 1
fi

original_prompt="$(<"$prompt_source_path")"

{
    cat <<'EOF'
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

EOF
    printf '%s\n\n' "$project_context"
    cat <<'EOF'
## Workflow do PM

EOF
    printf '%s\n\n' "$pm_workflow"
    cat <<'EOF'
## Prompt original do Codex

EOF
    printf '%s\n\n' "$original_prompt"
    cat <<EOF
## Metadados do PR

- Numero: $resolved_pr_number
- Incremento: $increment_code
- Titulo: $pr_title
- URL: $pr_url
- Branch head: $pr_head
- Branch base: $pr_base
- Prompt source: $prompt_source_path

## Body do PR

$pr_body

## Diff do PR

$pr_diff
EOF
} > "$review_prompt_file"

review_text="$(invoke_gemini_prompt "$gemini_key" "$review_prompt_file" 0.2 4096 "$gemini_model")"
printf '%s\n' "$review_text" > "$output_path"

rm -f "$pr_json_file" "$diff_file" "$review_prompt_file"

echo "Review saved to $output_path"
open_in_vscode "$output_path"

first_line="$(head -n 1 "$output_path" | tr -d '\r')"
if [[ "$first_line" == "STATUS: APROVADO" ]]; then
    rm -f "$correction_output_path"
    echo "Review status: APROVADO"
    exit 0
fi

if [[ "$first_line" == "STATUS: REPROVADO" ]]; then
    mkdir -p "$generated_dir_path"

    correction_text="$(
        python3 - "$output_path" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, encoding="utf-8").read()
match = re.search(
    r"^## Prompt de correcao para o Codex\s*\n(.*?)(?=^## |\Z)",
    text,
    flags=re.MULTILINE | re.DOTALL,
)

if match:
    print(match.group(1).strip())
PY
    )"

    if [[ -n "$correction_text" ]]; then
        correction_archive_path="$generated_dir_path/${increment_code}-correction-$(date +%Y%m%d%H%M%S).md"
        printf '%s\n' "$correction_text" > "$correction_output_path"
        printf '%s\n' "$correction_text" > "$correction_archive_path"
        echo "Correction prompt saved to $correction_output_path"
        echo "Archived correction prompt to $correction_archive_path"
    else
        rm -f "$correction_output_path"
        echo "Review status is REPROVADO, but no correction prompt section was found." >&2
    fi

    echo "Review status: REPROVADO"
    exit 1
fi

echo "Gemini review did not start with a valid STATUS line." >&2
exit 1
