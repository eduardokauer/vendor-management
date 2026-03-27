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

resolve_codex_bin() {
    if [[ -n "${CODEX_BIN:-}" ]]; then
        if [[ -x "${CODEX_BIN}" ]]; then
            printf '%s' "${CODEX_BIN}"
            return 0
        fi

        echo "CODEX_BIN is set but is not executable: ${CODEX_BIN}" >&2
        exit 1
    fi

    if command -v codex >/dev/null 2>&1; then
        command -v codex
        return 0
    fi

    echo "Required Codex CLI not found. Add \`codex\` to PATH or set CODEX_BIN in the root .env." >&2
    exit 1
}

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command not found in PATH: $command_name" >&2
        exit 1
    fi
}

is_true() {
    local value="${1:-false}"
    value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
    [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "y" ]]
}

get_increment_json() {
    local increments_path="$1"
    local requested_code="${2:-}"

    python3 - "$increments_path" "$requested_code" <<'PY'
import json
import re
import sys

path = sys.argv[1]
requested = sys.argv[2].strip()
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()

start = None
status = None
code = None
title = None

for index, line in enumerate(lines):
    match = re.match(r"^- \[([ x>])\] \*\*(INC-\d{3})\*\* (.+)$", line)
    if not match:
        continue
    status, code, title = match.groups()
    if requested:
        if code == requested:
            start = index
            break
    elif status == " ":
        start = index
        break

if start is None:
    raise SystemExit(1)

if status == "x":
    raise SystemExit(2)

block = []
for line in lines[start:]:
    if block and re.match(r"^- \[[ x>]\] \*\*INC-\d{3}\*\* ", line):
        break
    block.append(line)

print(json.dumps({
    "status": status,
    "code": code,
    "title": title.strip(),
    "markdown": "\n".join(block),
}, ensure_ascii=False))
PY
}

slugify() {
    local raw_title="$1"
    python3 - "$raw_title" <<'PY'
import re
import sys
import unicodedata

text = sys.argv[1]
text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
text = text.lower()
text = re.sub(r"[^a-z0-9]+", "-", text)
text = re.sub(r"-{2,}", "-", text).strip("-")
print((text[:48]).strip("-") or "increment")
PY
}

build_initial_executor_prompt() {
    local increment_code="$1"
    local increment_title="$2"
    local branch_name="$3"
    local base_prompt_path="$4"
    local output_path="$5"

    {
        cat <<EOF
Automation context:
- This increment is being executed by \`./scripts/run_increment.sh\`.
- The target increment is \`$increment_code\`.
- The branch \`$branch_name\` has already been created and checked out.
- Reuse the current branch. Do not create a different branch.
- Target base branch: \`develop\`.
- Open or update a PR targeting \`develop\` with title \`$increment_code $increment_title\`.
- If a PR already exists for this branch, update it instead of creating a new one.
- Commit only after the DoD is satisfied.

EOF
        cat "$base_prompt_path"
    } > "$output_path"
}

build_followup_executor_prompt() {
    local increment_code="$1"
    local branch_name="$2"
    local source_prompt_path="$3"
    local output_path="$4"

    {
        cat <<EOF
Automation context:
- Continue the existing work for increment \`$increment_code\`.
- Reuse the current branch \`$branch_name\`.
- Do not create a new branch.
- Update the existing PR if it already exists.
- Re-run the validations required by the work you are fixing.

EOF
        cat "$source_prompt_path"
    } > "$output_path"
}

build_ci_correction_prompt() {
    local increment_code="$1"
    local branch_name="$2"
    local pr_number="$3"
    local increment_markdown="$4"
    local checks_json_path="$5"
    local output_path="$6"

    {
        cat <<EOF
Before doing anything, read \`docs/project_context.md\` and \`docs/codex_workflow.md\` completely.

You are fixing a failing automated cycle for increment \`$increment_code\`.

Automation context:
- Current branch: \`$branch_name\`
- Current PR: \`#$pr_number\`
- Do not create a new branch.
- Do not create a new PR.
- Update the existing PR only.

The current increment definition is:

$increment_markdown

The GitHub PR checks failed. Fix the issues that caused these failures, run the relevant validations again, and push the updated branch.

Checks summary:

EOF
        python3 - "$checks_json_path" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    checks = json.load(handle)

for check in checks:
    name = check.get("name", "<unknown>")
    bucket = check.get("bucket", "<unknown>")
    state = check.get("state", "<unknown>")
    workflow = check.get("workflow", "<unknown>")
    link = check.get("link", "")
    print(f"- {name}: bucket={bucket}, state={state}, workflow={workflow}")
    if link:
        print(f"  Link: {link}")
PY
    } > "$output_path"
}

find_open_pr_json() {
    local branch_name="$1"
    gh pr list --head "$branch_name" --base develop --state open --json number,title,url,headRefName,baseRefName -L 1
}

push_branch_if_needed() {
    local branch_name="$1"

    if [[ "$(git branch --show-current)" != "$branch_name" ]]; then
        echo "Expected current branch $branch_name before pushing updates." >&2
        exit 1
    fi

    if ! git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
        git push -u origin "$branch_name"
        return
    fi

    local ahead_count
    ahead_count="$(git rev-list --count "origin/$branch_name..$branch_name")"
    if [[ "$ahead_count" -gt 0 ]]; then
        git push origin "$branch_name"
    fi
}

ensure_local_branch() {
    local branch_name="$1"

    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        git switch "$branch_name" >/dev/null
        return
    fi

    if git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
        git fetch origin "$branch_name:$branch_name" >/dev/null 2>&1
        git switch "$branch_name" >/dev/null
        return
    fi

    echo "Branch $branch_name does not exist locally or on origin." >&2
    exit 1
}

run_codex_exec() {
    local prompt_path="$1"
    local label="$2"

    last_codex_message_path="$generated_dir_path/${increment_code}-${label}-last-message.md"
    last_codex_events_path="$generated_dir_path/${increment_code}-${label}-events.jsonl"
    last_codex_prompt_archive_path="$generated_dir_path/${increment_code}-${label}-prompt.md"

    cp "$prompt_path" "$last_codex_prompt_archive_path"

    codex_cmd=("$codex_bin" exec -C "$repo_root" --json -o "$last_codex_message_path")
    if [[ -n "$codex_model" ]]; then
        codex_cmd+=(-m "$codex_model")
    fi

    if is_true "$codex_dangerous_bypass"; then
        codex_cmd+=(--dangerously-bypass-approvals-and-sandbox)
    else
        codex_cmd+=(-s "$codex_sandbox")
    fi

    echo "Running Codex executor for $increment_code [$label]..."
    "${codex_cmd[@]}" - < "$prompt_path" | tee "$last_codex_events_path"
}

ensure_pr_exists() {
    local branch_name="$1"
    local increment_code="$2"
    local increment_title="$3"
    local executor_summary_path="$4"

    existing_pr_json="$(find_open_pr_json "$branch_name")"
    existing_pr_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' <<<"$existing_pr_json")"

    if [[ "$existing_pr_count" -gt 0 ]]; then
        pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
        pr_title="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["title"])' <<<"$existing_pr_json")"
        if [[ "$pr_title" != "$increment_code"* ]]; then
            gh pr edit "$pr_number" --title "$increment_code $increment_title" >/dev/null
        fi
        return
    fi

    current_branch="$(git branch --show-current)"
    if [[ "$current_branch" != "$branch_name" ]]; then
        echo "Expected current branch $branch_name before creating the PR, found $current_branch." >&2
        exit 1
    fi

    if ! git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
        git push -u origin "$branch_name"
    fi

    pr_body_file="$(mktemp)"
    {
        cat <<EOF
Automated PR for \`$increment_code\`.

This PR was created or resumed by \`./scripts/run_increment.sh\`.

Executor summary:

EOF
        cat "$executor_summary_path"
    } > "$pr_body_file"

    gh pr create --base develop --head "$branch_name" --title "$increment_code $increment_title" --body-file "$pr_body_file" >/dev/null
    rm -f "$pr_body_file"

    existing_pr_json="$(find_open_pr_json "$branch_name")"
    existing_pr_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' <<<"$existing_pr_json")"
    if [[ "$existing_pr_count" -eq 0 ]]; then
        echo "Failed to create or locate the PR for branch $branch_name." >&2
        exit 1
    fi

    pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
}

wait_for_pr_checks() {
    local pr_number="$1"
    local checks_json_file="$2"
    local attempt=1

    while (( attempt <= auto_check_discovery_attempts )); do
        gh pr checks "$pr_number" --json name,bucket,state,workflow,link > "$checks_json_file"

        checks_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' < "$checks_json_file")"
        if [[ "$checks_count" -gt 0 ]]; then
            break
        fi

        if (( attempt == auto_check_discovery_attempts )); then
            echo "No PR checks reported for PR #$pr_number after waiting. Continuing without CI gating."
            return 0
        fi

        echo "No PR checks reported for PR #$pr_number yet. Waiting ${auto_check_interval}s..."
        sleep "$auto_check_interval"
        attempt=$((attempt + 1))
    done

    if gh pr checks "$pr_number" --watch --fail-fast --interval "$auto_check_interval"; then
        return 0
    fi

    return 1
}

usage() {
    cat <<'EOF'
Usage: ./scripts/run_increment.sh [options]

Options:
  --increment INC-XXX   Run a specific increment instead of the first pending one
  --dry-run             Print the resolved plan and stop before mutating anything
  --no-merge            Stop after an approved review instead of calling merge_pr.sh
  --max-cycles N        Override AUTO_MAX_CYCLES for this execution
EOF
}

increment_override=""
dry_run="false"
no_merge="false"
max_cycles_override=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --increment)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            increment_override="$2"
            shift 2
            ;;
        --dry-run)
            dry_run="true"
            shift
            ;;
        --no-merge)
            no_merge="true"
            shift
            ;;
        --max-cycles)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            max_cycles_override="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root_env_path="$repo_root/.env"
increments_path="$repo_root/INCREMENTS.md"
generated_dir_path="$repo_root/prompts/generated"
main_prompt_output_path="$repo_root/prompts/next_prompt.md"
correction_prompt_path="$repo_root/prompts/correction_prompt.md"
check_setup_script="$repo_root/scripts/check_setup.sh"
gen_prompt_script="$repo_root/scripts/gen_prompt.sh"
review_script="$repo_root/scripts/review_pr.sh"
merge_script="$repo_root/scripts/merge_pr.sh"

load_env_file "$root_env_path"

require_command git
require_command gh
require_command python3
require_command curl

codex_bin="$(resolve_codex_bin)"

"$check_setup_script"

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree must be clean before running the automated increment orchestrator." >&2
    exit 1
fi

increment_json_output="$(get_increment_json "$increments_path" "$increment_override" 2>&1)" || {
    increment_lookup_status=$?
    if [[ $increment_lookup_status -eq 2 ]]; then
        echo "Requested increment is already completed." >&2
    else
        echo "Unable to resolve the target increment from INCREMENTS.md." >&2
    fi
    echo "$increment_json_output" >&2
    exit 1
}

increment_code="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])' <<<"$increment_json_output")"
increment_title="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])' <<<"$increment_json_output")"
increment_markdown="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["markdown"])' <<<"$increment_json_output")"

branch_slug="$(slugify "$increment_title")"
auto_branch_prefix="${AUTO_BRANCH_PREFIX:-feature}"
branch_name="${auto_branch_prefix}/${increment_code,,}-${branch_slug}"
codex_model="${CODEX_MODEL:-gpt-5.4}"
codex_sandbox="${CODEX_SANDBOX:-workspace-write}"
codex_dangerous_bypass="${CODEX_DANGEROUS_BYPASS:-false}"
auto_check_interval="${AUTO_CHECK_INTERVAL:-10}"
auto_check_discovery_attempts="${AUTO_CHECK_DISCOVERY_ATTEMPTS:-12}"
auto_merge_on_approval="${AUTO_MERGE_ON_APPROVAL:-true}"
auto_max_cycles="${AUTO_MAX_CYCLES:-3}"
if [[ -n "$max_cycles_override" ]]; then
    auto_max_cycles="$max_cycles_override"
fi

mkdir -p "$generated_dir_path"

existing_pr_json="$(find_open_pr_json "$branch_name")"
existing_pr_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' <<<"$existing_pr_json")"

echo "Increment: $increment_code"
echo "Title: $increment_title"
echo "Branch: $branch_name"
if [[ "$existing_pr_count" -gt 0 ]]; then
    existing_pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
    echo "Existing PR detected: #$existing_pr_number"
else
    echo "Existing PR detected: none"
fi

if [[ "$dry_run" == "true" ]]; then
    echo "Dry run enabled. No changes were made."
    exit 0
fi

if [[ "$existing_pr_count" -gt 0 ]]; then
    ensure_local_branch "$branch_name"
    pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
else
    git switch develop >/dev/null
    git pull --ff-only origin develop

    if git show-ref --verify --quiet "refs/heads/$branch_name" || git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
        echo "Branch $branch_name already exists but no open PR was found. Clean it up or resume manually." >&2
        exit 1
    fi

    gen_prompt_cmd=("$gen_prompt_script")
    if [[ -n "$increment_override" ]]; then
        gen_prompt_cmd+=(--increment "$increment_override")
    fi
    "${gen_prompt_cmd[@]}"

    git switch -c "$branch_name"

    initial_archived_prompt_path="$generated_dir_path/${increment_code}.md"
    initial_executor_prompt_path="$generated_dir_path/${increment_code}-executor-initial.md"
    build_initial_executor_prompt "$increment_code" "$increment_title" "$branch_name" "$initial_archived_prompt_path" "$initial_executor_prompt_path"
    run_codex_exec "$initial_executor_prompt_path" "initial"
    push_branch_if_needed "$branch_name"
    ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
fi

cycle=1
while (( cycle <= auto_max_cycles )); do
    echo "Automation cycle $cycle/$auto_max_cycles for PR #$pr_number"

    pr_checks_json_path="$generated_dir_path/${increment_code}-checks-cycle-${cycle}.json"
    if ! wait_for_pr_checks "$pr_number" "$pr_checks_json_path"; then
        ci_correction_prompt_path="$generated_dir_path/${increment_code}-ci-correction-${cycle}.md"
        ci_followup_prompt_path="$generated_dir_path/${increment_code}-ci-followup-${cycle}.md"

        build_ci_correction_prompt "$increment_code" "$branch_name" "$pr_number" "$increment_markdown" "$pr_checks_json_path" "$ci_correction_prompt_path"
        build_followup_executor_prompt "$increment_code" "$branch_name" "$ci_correction_prompt_path" "$ci_followup_prompt_path"
        run_codex_exec "$ci_followup_prompt_path" "ci-fix-${cycle}"
        push_branch_if_needed "$branch_name"
        ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
        cycle=$((cycle + 1))
        continue
    fi

    if "$review_script" -PrNumber "$pr_number"; then
        if is_true "$auto_merge_on_approval" && [[ "$no_merge" != "true" ]]; then
            "$merge_script" --yes -PrNumber "$pr_number"
            echo "Increment $increment_code completed successfully."
        else
            echo "PR #$pr_number is approved and ready for merge."
        fi
        exit 0
    fi

    if [[ ! -s "$correction_prompt_path" ]]; then
        echo "Review rejected the PR, but no correction prompt was generated." >&2
        exit 1
    fi

    review_followup_prompt_path="$generated_dir_path/${increment_code}-review-followup-${cycle}.md"
    build_followup_executor_prompt "$increment_code" "$branch_name" "$correction_prompt_path" "$review_followup_prompt_path"
    run_codex_exec "$review_followup_prompt_path" "review-fix-${cycle}"
    push_branch_if_needed "$branch_name"
    ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
    cycle=$((cycle + 1))
done

echo "Maximum automation cycles reached for $increment_code without approval." >&2
exit 1
