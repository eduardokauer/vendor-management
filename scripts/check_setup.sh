#!/usr/bin/env bash
set -euo pipefail

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
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

is_true() {
    local value="${1:-false}"
    value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
    [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "y" ]]
}

log_ok() {
    printf '[OK] %s\n' "$1"
}

log_warn() {
    printf '[WARN] %s\n' "$1"
}

log_fail() {
    printf '[FAIL] %s\n' "$1"
}

deep_check="false"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --deep)
            deep_check="true"
            shift
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root_env_path="$repo_root/.env"
backend_env_path="$repo_root/backend/.env"

load_env_file "$root_env_path"

failures=0
warnings=0

check_command() {
    local name="$1"
    if command -v "$name" >/dev/null 2>&1; then
        log_ok "Command available: $name"
    else
        log_fail "Missing required command: $name"
        failures=$((failures + 1))
    fi
}

check_command git
check_command gh
check_command codex
check_command curl
check_command python3
check_command docker

if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
        log_ok "Docker Compose is available"
    else
        log_fail "docker compose is not available"
        failures=$((failures + 1))
    fi

    if docker ps >/dev/null 2>&1; then
        log_ok "Docker daemon is reachable"
    else
        log_warn "Docker daemon is not reachable from this shell"
        warnings=$((warnings + 1))
    fi
fi

git_user_name="$(git config --get user.name || true)"
git_user_email="$(git config --get user.email || true)"

if [[ -n "$git_user_name" ]]; then
    log_ok "git user.name is configured: $git_user_name"
else
    log_fail "git user.name is not configured"
    failures=$((failures + 1))
fi

if [[ -n "$git_user_email" ]]; then
    log_ok "git user.email is configured: $git_user_email"
else
    log_fail "git user.email is not configured"
    failures=$((failures + 1))
fi

if gh auth status >/dev/null 2>&1; then
    log_ok "gh authentication is active"
else
    log_fail "gh authentication is not active"
    failures=$((failures + 1))
fi

if [[ -n "${GEMINI_KEY:-}" ]]; then
    if [[ -f "$root_env_path" ]]; then
        log_ok "Root .env found and GEMINI_KEY is available"
    else
        log_ok "GEMINI_KEY is available from the current environment"
        log_warn "Root .env file is missing; create it if you want persistent local configuration"
        warnings=$((warnings + 1))
    fi
else
    log_fail "GEMINI_KEY is not defined in the environment or root .env"
    failures=$((failures + 1))
fi

if [[ -f "$backend_env_path" ]]; then
    log_ok "backend/.env exists"
else
    log_warn "backend/.env is missing; local app execution may fail"
    warnings=$((warnings + 1))
fi

if [[ -f "$repo_root/.env.example" ]]; then
    log_ok ".env.example exists"
else
    log_warn ".env.example is missing"
    warnings=$((warnings + 1))
fi

codex_model="${CODEX_MODEL:-gpt-5.4}"
codex_sandbox="${CODEX_SANDBOX:-workspace-write}"
log_ok "Codex model configured as: $codex_model"
log_ok "Codex sandbox configured as: $codex_sandbox"

if is_true "$deep_check"; then
    if [[ -n "${GEMINI_KEY:-}" ]]; then
        gemini_payload_file="$(mktemp)"
        gemini_response_file="$(mktemp)"
        cat > "$gemini_payload_file" <<'EOF'
{"contents":[{"role":"user","parts":[{"text":"Respond with exactly OK."}]}],"generationConfig":{"temperature":0.1,"maxOutputTokens":16}}
EOF

        gemini_http_code="$(
            curl -sS \
                -o "$gemini_response_file" \
                -w '%{http_code}' \
                -X POST \
                -H 'Content-Type: application/json' \
                --data-binary "@$gemini_payload_file" \
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}"
        )" || gemini_http_code="000"

        if [[ "$gemini_http_code" =~ ^2[0-9][0-9]$ ]]; then
            gemini_text="$(python3 - "$gemini_response_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)

parts = ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
text = "\n".join(part.get("text", "") for part in parts if part.get("text", "").strip()).strip()
print(text)
PY
)"
            if [[ "$gemini_text" == "OK" ]]; then
                log_ok "Deep Gemini check passed"
            else
                log_warn "Deep Gemini check returned unexpected text: ${gemini_text:-<empty>}"
                warnings=$((warnings + 1))
            fi
        else
            log_fail "Deep Gemini check failed (HTTP $gemini_http_code)"
            failures=$((failures + 1))
        fi

        rm -f "$gemini_payload_file" "$gemini_response_file"
    fi

    codex_tmp_output="$(mktemp)"
    if printf 'Respond with exactly OK.' | codex exec -C "$repo_root" -s read-only -o "$codex_tmp_output" - >/dev/null 2>&1; then
        codex_text="$(<"$codex_tmp_output")"
        if [[ "$(trim "$codex_text")" == "OK" ]]; then
            log_ok "Deep Codex check passed"
        else
            log_warn "Deep Codex check returned unexpected text: ${codex_text:-<empty>}"
            warnings=$((warnings + 1))
        fi
    else
        log_fail "Deep Codex check failed"
        failures=$((failures + 1))
    fi
    rm -f "$codex_tmp_output"
fi

printf '\nSummary: %s failure(s), %s warning(s)\n' "$failures" "$warnings"

if (( failures > 0 )); then
    exit 1
fi
