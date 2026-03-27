#!/usr/bin/env bash
set -euo pipefail

orchestrator_log_path=""

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

log_with_level() {
    local level="$1"
    shift
    local message="$*"
    local line="[$(timestamp)] [$level] $message"

    printf '%s\n' "$line"
    if [[ -n "${orchestrator_log_path:-}" ]]; then
        printf '%s\n' "$line" >> "$orchestrator_log_path"
    fi
}

log_info() {
    log_with_level INFO "$@"
}

log_warn() {
    log_with_level WARN "$@"
}

log_error() {
    log_with_level ERROR "$@"
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

write_rpd_resume_state() {
    local increment_code="$1"
    local increment_title="$2"
    local command_args_json="$3"
    local state_path="$4"
    local offset_minutes="$5"

    python3 - "$increment_code" "$increment_title" "$command_args_json" "$state_path" "$offset_minutes" <<'PY'
import json
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

increment_code = sys.argv[1]
increment_title = sys.argv[2]
command_args = json.loads(sys.argv[3])
state_path = sys.argv[4]
offset_minutes = int(sys.argv[5])

pacific = ZoneInfo("America/Los_Angeles")
now_pt = datetime.now(pacific)
resume_pt = (now_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=offset_minutes)
resume_utc = resume_pt.astimezone(timezone.utc)

payload = {
    "increment_code": increment_code,
    "increment_title": increment_title,
    "reason": "gemini_rpd_exhausted",
    "created_at_utc": datetime.now(timezone.utc).isoformat(),
    "resume_after_utc": resume_utc.isoformat(),
    "resume_after_pacific": resume_pt.isoformat(),
    "command": command_args,
}

with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2, ensure_ascii=False)
PY
}

ensure_rpd_resume_cron() {
    local cron_poll_minutes="$1"
    local cron_marker="# VMS_AUTO_RESUME"
    local cron_job_script="$repo_root/scripts/resume_pending.sh"
    local cron_log_path="$generated_dir_path/auto_resume.log"
    local escaped_repo_root escaped_log_path escaped_script current_crontab filtered_crontab cron_line

    if ! command -v crontab >/dev/null 2>&1; then
        echo "crontab is not available, so automatic RPD resume cannot be scheduled." >&2
        return 1
    fi

    mkdir -p "$generated_dir_path"

    escaped_repo_root="$(python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$repo_root")"
    escaped_script="$(python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$cron_job_script")"
    escaped_log_path="$(python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$cron_log_path")"

    cron_line="*/${cron_poll_minutes} * * * * /bin/bash -lc 'cd ${escaped_repo_root} && ${escaped_script} >> ${escaped_log_path} 2>&1' ${cron_marker}"
    current_crontab="$(crontab -l 2>/dev/null || true)"
    filtered_crontab="$(printf '%s\n' "$current_crontab" | grep -vF "$cron_marker" || true)"

    {
        if [[ -n "$filtered_crontab" ]]; then
            printf '%s\n' "$filtered_crontab"
        fi
        printf '%s\n' "$cron_line"
    } | crontab -
}

schedule_rpd_resume() {
    local increment_code="$1"
    local increment_title="$2"
    local pending_state_path="$3"
    local cron_poll_minutes="${AUTO_RESUME_POLL_MINUTES:-10}"
    local resume_offset_minutes="${AUTO_RESUME_AFTER_RESET_MINUTES:-5}"
    local command_args_json
    local resume_after_utc
    local resume_after_pacific

    command_args_json="$(python3 - "$increment_code" <<'PY'
import json
import sys

increment_code = sys.argv[1]
print(json.dumps(["./scripts/run_increment.sh", "--increment", increment_code]))
PY
)"

    write_rpd_resume_state "$increment_code" "$increment_title" "$command_args_json" "$pending_state_path" "$resume_offset_minutes"

    if ! ensure_rpd_resume_cron "$cron_poll_minutes"; then
        log_warn "Automatic resume could not be scheduled for the daily Gemini quota reset."
        log_warn "Pending resume state was still written to $pending_state_path."
        return 1
    fi

    resume_after_utc="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["resume_after_utc"])' "$pending_state_path")"
    resume_after_pacific="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["resume_after_pacific"])' "$pending_state_path")"

    log_warn "Gemini daily quota exhausted for $increment_code."
    log_info "Automatic resume scheduled after daily reset."
    log_info "Resume after (Pacific): $resume_after_pacific"
    log_info "Resume after (UTC): $resume_after_utc"
    log_info "A user cron job now polls every ${cron_poll_minutes} minute(s) and will rerun ./scripts/run_increment.sh --increment $increment_code when due."
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
- The host orchestrator owns validation, commit, push, PR creation/update and merge.
- Do not commit, push, open or update a PR from inside Codex.
- Do not run GitHub auth checks or publish steps from inside Codex.
- Prefer lightweight validation that is available inside your sandbox, but do not block on host-level Docker, browser or GitHub steps.
- Leave the working tree with the intended code changes so the host orchestrator can validate and publish them.

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
- The host orchestrator owns validation, commit, push, PR update and merge.
- Do not commit, push, open or update a PR from inside Codex.
- Focus on the code changes needed for this follow-up.
- Re-run only lightweight checks that are available in your sandbox. The host will run the required project validations after your edits.

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
- The host orchestrator owns validation, commit, push and PR updates.
- Do not commit, push, create or update a PR from inside Codex.

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
        log_info "Pushing new branch to origin: $branch_name"
        git push -u origin "$branch_name"
        return
    fi

    local ahead_count
    ahead_count="$(git rev-list --count "origin/$branch_name..$branch_name")"
    if [[ "$ahead_count" -gt 0 ]]; then
        log_info "Pushing ${ahead_count} new commit(s) to origin/$branch_name"
        git push origin "$branch_name"
    else
        log_info "No new commits to push for $branch_name"
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

    log_info "Starting Codex executor for $increment_code [$label]"
    log_info "Prompt archive: $last_codex_prompt_archive_path"
    log_info "Raw Codex events: $last_codex_events_path"
    log_info "Last Codex message: $last_codex_message_path"

    "${codex_cmd[@]}" - < "$prompt_path" | python3 - "$last_codex_events_path" "$orchestrator_log_path" <<'PY'
import json
import sys
from datetime import datetime

events_path = sys.argv[1]
human_log_path = sys.argv[2]


def shorten(text, limit=140):
    text = (text or "").replace("\n", " ").replace("\r", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def emit(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [CODEX] {message}"
    print(line, flush=True)
    if human_log_path:
        with open(human_log_path, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")


with open(events_path, "w", encoding="utf-8") as raw_handle:
    for raw_line in sys.stdin:
        raw_handle.write(raw_line)
        raw_handle.flush()

        try:
            payload = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        event_type = payload.get("type", "")
        item = payload.get("item") or {}
        item_type = item.get("type", "")

        if event_type == "item.started":
            if item_type == "command_execution":
                emit(f"running command: {shorten(item.get('command', ''))}")
            elif item_type == "file_change":
                changes = item.get("changes") or []
                names = [change.get("path", "").split("/")[-1] for change in changes[:5] if change.get("path")]
                suffix = "..." if len(changes) > 5 else ""
                emit(f"editing files: {', '.join(names)}{suffix}" if names else "editing files")
            elif item_type == "agent_message":
                emit(shorten(item.get("text", "")))
            elif item_type == "mcp_tool_call":
                emit(f"calling tool: {item.get('tool') or item.get('server') or 'external tool'}")
        elif event_type == "item.updated" and item_type == "todo_list":
            items = item.get("items") or []
            completed = sum(1 for todo in items if todo.get("completed"))
            emit(f"updated plan: {completed}/{len(items)} items completed")
        elif event_type == "item.completed":
            if item_type == "command_execution":
                exit_code = item.get("exit_code")
                command = shorten(item.get("command", ""))
                if exit_code == 0:
                    emit(f"command completed: {command}")
                else:
                    emit(f"command failed ({exit_code}): {command}")
            elif item_type == "agent_message":
                emit(shorten(item.get("text", "")))
            elif item_type == "file_change":
                emit("file edits completed")
            elif item_type == "mcp_tool_call":
                emit(f"tool completed: {item.get('tool') or item.get('server') or 'external tool'}")
        elif event_type == "turn.completed":
            emit("executor turn completed")
PY

    log_info "Codex executor finished for $increment_code [$label]"
}

worktree_has_changes() {
    [[ -n "$(git status --porcelain)" ]]
}

ensure_executor_produced_changes() {
    if worktree_has_changes; then
        return 0
    fi

    log_error "Codex finished without producing local changes."
    return 1
}

run_host_validations() {
    local increment_code="$1"
    local label="$2"
    local validation_log_path="$generated_dir_path/${increment_code}-${label}-host-validation.log"

    : > "$validation_log_path"
    log_info "Host validation log: $validation_log_path"

    log_info "Running host hygiene check: git diff --check"
    if ! git diff --check 2>&1 | tee -a "$validation_log_path"; then
        log_error "git diff --check reported formatting issues."
        return 1
    fi

    log_info "Running required host validation: docker compose --profile test run --rm backend-test"
    if ! docker compose --profile test run --rm backend-test 2>&1 | tee -a "$validation_log_path"; then
        log_error "Required host validation failed. Keeping local changes for inspection."
        return 1
    fi

    log_info "Host validations completed successfully."
}

commit_increment_changes() {
    local increment_code="$1"
    local increment_title="$2"
    local commit_message="${increment_code} ${increment_title}"

    git add -A

    if git diff --cached --quiet; then
        log_error "No staged changes were found after validation."
        return 1
    fi

    log_info "Creating commit: $commit_message"
    git commit -m "$commit_message"
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
        log_info "Using existing PR #$pr_number for branch $branch_name"
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

    log_info "Creating PR for $branch_name against develop"
    gh pr create --base develop --head "$branch_name" --title "$increment_code $increment_title" --body-file "$pr_body_file" >/dev/null
    rm -f "$pr_body_file"

    existing_pr_json="$(find_open_pr_json "$branch_name")"
    existing_pr_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' <<<"$existing_pr_json")"
    if [[ "$existing_pr_count" -eq 0 ]]; then
        echo "Failed to create or locate the PR for branch $branch_name." >&2
        exit 1
    fi

    pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
    log_info "Created PR #$pr_number"
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
            log_error "No PR checks reported for PR #$pr_number after waiting. Failing closed before review/merge."
            return 2
        fi

        log_info "No PR checks reported for PR #$pr_number yet. Waiting ${auto_check_interval}s..."
        sleep "$auto_check_interval"
        attempt=$((attempt + 1))
    done

    log_info "Checks detected for PR #$pr_number. Waiting for completion..."
    if gh pr checks "$pr_number" --watch --fail-fast --interval "$auto_check_interval"; then
        log_info "PR checks passed for PR #$pr_number"
        return 0
    fi

    log_warn "PR checks reported failure for PR #$pr_number"
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
resume_pending_state_path="$generated_dir_path/pending_rpd_resume.json"

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
orchestrator_log_path="$generated_dir_path/${increment_code}-orchestrator.log"
: > "$orchestrator_log_path"

existing_pr_json="$(find_open_pr_json "$branch_name")"
existing_pr_count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' <<<"$existing_pr_json")"

log_info "Starting orchestration for $increment_code"
log_info "Increment title: $increment_title"
log_info "Target branch: $branch_name"
log_info "Orchestrator log: $orchestrator_log_path"
if [[ "$existing_pr_count" -gt 0 ]]; then
    existing_pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
    log_info "Existing PR detected: #$existing_pr_number"
else
    log_info "Existing PR detected: none"
fi

if [[ "$dry_run" == "true" ]]; then
    log_info "Dry run enabled. No changes were made."
    exit 0
fi

if [[ -f "$resume_pending_state_path" ]]; then
    pending_increment_code="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("increment_code",""))' "$resume_pending_state_path" 2>/dev/null || true)"
    if [[ "$pending_increment_code" == "$increment_code" ]]; then
        rm -f "$resume_pending_state_path"
    fi
fi

if [[ "$existing_pr_count" -gt 0 ]]; then
    log_info "Resuming existing branch and PR for $increment_code"
    ensure_local_branch "$branch_name"
    pr_number="$(python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["number"])' <<<"$existing_pr_json")"
else
    log_info "Syncing local develop before creating the increment branch"
    git switch develop >/dev/null
    git pull --ff-only origin develop

    if git show-ref --verify --quiet "refs/heads/$branch_name" || git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
        log_error "Branch $branch_name already exists but no open PR was found. Clean it up or resume manually."
        exit 1
    fi

    log_info "Generating increment prompt with Gemini"
    gen_prompt_cmd=("$gen_prompt_script")
    if [[ -n "$increment_override" ]]; then
        gen_prompt_cmd+=(--increment "$increment_override")
    fi
    if "${gen_prompt_cmd[@]}"; then
        :
    else
        gen_prompt_status=$?
        if [[ "$gen_prompt_status" -eq 75 ]] && is_true "${AUTO_RESUME_ON_RPD:-true}"; then
            schedule_rpd_resume "$increment_code" "$increment_title" "$resume_pending_state_path" || true
        fi
        exit "$gen_prompt_status"
    fi

    log_info "Creating branch $branch_name"
    git switch -c "$branch_name"

    initial_archived_prompt_path="$generated_dir_path/${increment_code}.md"
    initial_executor_prompt_path="$generated_dir_path/${increment_code}-executor-initial.md"
    build_initial_executor_prompt "$increment_code" "$increment_title" "$branch_name" "$initial_archived_prompt_path" "$initial_executor_prompt_path"
    if ! run_codex_exec "$initial_executor_prompt_path" "initial"; then
        log_error "Codex executor failed during the initial pass."
        exit 1
    fi
    ensure_executor_produced_changes
    run_host_validations "$increment_code" "initial"
    commit_increment_changes "$increment_code" "$increment_title"
    push_branch_if_needed "$branch_name"
    ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
fi

cycle=1
while (( cycle <= auto_max_cycles )); do
    log_info "Automation cycle $cycle/$auto_max_cycles for PR #$pr_number"

    pr_checks_json_path="$generated_dir_path/${increment_code}-checks-cycle-${cycle}.json"
    if ! wait_for_pr_checks "$pr_number" "$pr_checks_json_path"; then
        pr_checks_status=$?
        if [[ "$pr_checks_status" -eq 2 ]]; then
            log_error "Stopping automation because PR #$pr_number did not report any checks."
            log_error "Confirm that GitHub Actions is enabled and that the PR targets a branch with the expected workflow."
            exit 1
        fi

        ci_correction_prompt_path="$generated_dir_path/${increment_code}-ci-correction-${cycle}.md"
        ci_followup_prompt_path="$generated_dir_path/${increment_code}-ci-followup-${cycle}.md"

        log_warn "PR checks failed for PR #$pr_number. Building a CI correction prompt for Codex."
        build_ci_correction_prompt "$increment_code" "$branch_name" "$pr_number" "$increment_markdown" "$pr_checks_json_path" "$ci_correction_prompt_path"
        build_followup_executor_prompt "$increment_code" "$branch_name" "$ci_correction_prompt_path" "$ci_followup_prompt_path"
        if ! run_codex_exec "$ci_followup_prompt_path" "ci-fix-${cycle}"; then
            log_error "Codex executor failed while addressing CI feedback."
            exit 1
        fi
        ensure_executor_produced_changes
        run_host_validations "$increment_code" "ci-fix-${cycle}"
        commit_increment_changes "$increment_code" "$increment_title"
        push_branch_if_needed "$branch_name"
        ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
        cycle=$((cycle + 1))
        continue
    fi

    if "$review_script" -PrNumber "$pr_number"; then
        if is_true "$auto_merge_on_approval" && [[ "$no_merge" != "true" ]]; then
            "$merge_script" --yes -PrNumber "$pr_number"
            log_info "Increment $increment_code completed successfully."
        else
            log_info "PR #$pr_number is approved and ready for merge."
        fi
        exit 0
    else
        review_status=$?
        if [[ "$review_status" -eq 75 ]] && is_true "${AUTO_RESUME_ON_RPD:-true}"; then
            schedule_rpd_resume "$increment_code" "$increment_title" "$resume_pending_state_path" || true
        fi
        if [[ "$review_status" -eq 75 ]]; then
            exit "$review_status"
        fi
    fi

    if [[ ! -s "$correction_prompt_path" ]]; then
        log_error "Review rejected the PR, but no correction prompt was generated."
        exit 1
    fi

    review_followup_prompt_path="$generated_dir_path/${increment_code}-review-followup-${cycle}.md"
    log_warn "Gemini review rejected PR #$pr_number. Sending correction prompt back to Codex."
    build_followup_executor_prompt "$increment_code" "$branch_name" "$correction_prompt_path" "$review_followup_prompt_path"
    if ! run_codex_exec "$review_followup_prompt_path" "review-fix-${cycle}"; then
        log_error "Codex executor failed while addressing review feedback."
        exit 1
    fi
    ensure_executor_produced_changes
    run_host_validations "$increment_code" "review-fix-${cycle}"
    commit_increment_changes "$increment_code" "$increment_title"
    push_branch_if_needed "$branch_name"
    ensure_pr_exists "$branch_name" "$increment_code" "$increment_title" "$last_codex_message_path"
    cycle=$((cycle + 1))
done

log_error "Maximum automation cycles reached for $increment_code without approval."
exit 1
