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

get_next_increment_json() {
    local increments_path="$1"
    python3 - "$increments_path" <<'PY'
import json
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()

start = None
code = None
title = None

for index, line in enumerate(lines):
    match = re.match(r"^- \[ \] \*\*(INC-\d{3})\*\* (.+)$", line)
    if match:
        start = index
        code, title = match.groups()
        break

if start is None:
    raise SystemExit(1)

block = []
for line in lines[start:]:
    if block and re.match(r"^- \[[ x>]\] \*\*INC-\d{3}\*\* ", line):
        break
    block.append(line)

print(json.dumps({
    "code": code,
    "title": title.strip(),
    "markdown": "\n".join(block),
}, ensure_ascii=False))
PY
}

invoke_gemini_prompt() {
    local api_key="$1"
    local prompt_file="$2"
    local temperature="$3"
    local max_output_tokens="$4"
    local payload_file response_file http_code

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
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$api_key"
    )"; then
        local body
        body="$(<"$response_file")"
        rm -f "$payload_file" "$response_file"
        echo "Gemini API request failed: ${body:-curl request failed}" >&2
        exit 1
    fi

    if (( http_code < 200 || http_code >= 300 )); then
        local body
        body="$(<"$response_file")"
        rm -f "$payload_file" "$response_file"
        echo "Gemini API request failed (HTTP $http_code): $body" >&2
        exit 1
    fi

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
}

open_in_vscode() {
    local file_path="$1"
    if command -v code >/dev/null 2>&1; then
        code "$file_path" >/dev/null 2>&1 &
    fi
}

require_command python3
require_command curl

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root_env_path="$repo_root/.env"
increments_path="$repo_root/INCREMENTS.md"
project_context_path="$repo_root/docs/project_context.md"
pm_workflow_path="$repo_root/docs/pm_workflow.md"
template_path="$repo_root/prompts/PROMPT_TEMPLATE.md"
output_path="$repo_root/prompts/next_prompt.md"
generated_dir_path="$repo_root/prompts/generated"

load_env_file "$root_env_path"

gemini_key="${GEMINI_KEY:-}"
if [[ -z "$gemini_key" ]]; then
    echo "GEMINI_KEY is not defined. Set it in the environment or in the root .env file." >&2
    exit 1
fi

if ! next_increment_json="$(get_next_increment_json "$increments_path")"; then
    echo "No pending increment found in INCREMENTS.md." >&2
    exit 1
fi

next_increment_code="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])' <<<"$next_increment_json")"
next_increment_title="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])' <<<"$next_increment_json")"
next_increment_markdown="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["markdown"])' <<<"$next_increment_json")"

project_context="$(<"$project_context_path")"
pm_workflow="$(<"$pm_workflow_path")"
prompt_template="$(<"$template_path")"
generated_prompt_path="$generated_dir_path/${next_increment_code}.md"

mkdir -p "$generated_dir_path"

prompt_file="$(mktemp)"
{
    cat <<'EOF'
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

EOF
    printf '%s\n\n' "$next_increment_markdown"
    cat <<'EOF'
## Contexto do projeto

EOF
    printf '%s\n\n' "$project_context"
    cat <<'EOF'
## Workflow do PM

EOF
    printf '%s\n\n' "$pm_workflow"
    cat <<'EOF'
## Template a ser preenchido

EOF
    printf '%s\n' "$prompt_template"
} > "$prompt_file"

generated_prompt="$(invoke_gemini_prompt "$gemini_key" "$prompt_file" 0.3 4096)"
rm -f "$prompt_file"

printf '%s\n' "$generated_prompt" > "$output_path"
printf '%s\n' "$generated_prompt" > "$generated_prompt_path"

echo "Prompt generated for $next_increment_code: $next_increment_title"
echo "Saved to $output_path"
echo "Archived prompt to $generated_prompt_path"

open_in_vscode "$output_path"
