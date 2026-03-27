#!/usr/bin/env bash
set -euo pipefail

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command not found in PATH: $command_name" >&2
        exit 1
    fi
}

pr_number=""
assume_yes="false"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -PrNumber|--pr-number)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            pr_number="$2"
            shift 2
            ;;
        --yes)
            assume_yes="true"
            shift
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

require_command gh
require_command python3
require_command git

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

pr_json_file="$(mktemp)"

if [[ -n "$pr_number" ]]; then
    gh pr view "$pr_number" --json number,title,url,headRefName,baseRefName > "$pr_json_file"
else
    gh pr view --json number,title,url,headRefName,baseRefName > "$pr_json_file"
fi

resolved_pr_number="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["number"])' "$pr_json_file")"
pr_title="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["title"])' "$pr_json_file")"
pr_url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["url"])' "$pr_json_file")"
pr_head="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["headRefName"])' "$pr_json_file")"
pr_base="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["baseRefName"])' "$pr_json_file")"

echo "PR #$resolved_pr_number"
echo "Title: $pr_title"
echo "URL: $pr_url"
echo "Branch: $pr_head -> $pr_base"

if [[ "$pr_base" != "develop" ]]; then
    rm -f "$pr_json_file"
    echo "This workflow only supports squash merge automation for PRs targeting develop." >&2
    exit 1
fi

if [[ ! "$pr_title" =~ (INC-[0-9]{3}) ]]; then
    rm -f "$pr_json_file"
    echo "Could not detect an INC-XXX code in the PR title." >&2
    exit 1
fi

increment_code="${BASH_REMATCH[1]}"

if [[ "$assume_yes" != "true" ]]; then
    read -r -p "Proceed with squash merge and delete branch? [y/N] " confirmation
    if [[ "$confirmation" != "y" && "$confirmation" != "Y" && "$confirmation" != "yes" && "$confirmation" != "YES" ]]; then
        rm -f "$pr_json_file"
        echo "Merge cancelled by user." >&2
        exit 1
    fi
else
    echo "Auto-confirm enabled via --yes"
fi

gh pr merge "$resolved_pr_number" --squash --delete-branch

increments_path="$repo_root/INCREMENTS.md"
repo_name_with_owner="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
contents_json_file="$(mktemp)"
update_payload_file="$(mktemp)"

gh api "repos/$repo_name_with_owner/contents/INCREMENTS.md?ref=develop" > "$contents_json_file"

python3 - "$contents_json_file" "$increment_code" "$update_payload_file" <<'PY'
import base64
import json
import re
import sys

contents_json_path = sys.argv[1]
increment_code = sys.argv[2]
output_payload_path = sys.argv[3]

with open(contents_json_path, encoding="utf-8") as handle:
    contents_data = json.load(handle)

content = base64.b64decode(contents_data["content"]).decode("utf-8")
pattern = re.compile(rf"(?m)^- \[[ x>]\] \*\*{re.escape(increment_code)}\*\*(.*)$")

if not pattern.search(content):
    raise SystemExit(f"Could not find {increment_code} in INCREMENTS.md.")

updated = pattern.sub(rf"- [x] **{increment_code}**\1", content, count=1)
payload = {
    "message": f"Mark {increment_code} as completed",
    "content": base64.b64encode(updated.encode("utf-8")).decode("ascii"),
    "sha": contents_data["sha"],
    "branch": "develop",
}

with open(output_payload_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
PY

gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$repo_name_with_owner/contents/INCREMENTS.md" \
    --input "$update_payload_file" >/dev/null

if git diff --quiet && git diff --cached --quiet; then
    git fetch origin develop
    git switch develop
    git pull --ff-only origin develop
else
    echo "Remote backlog updated, but local working tree is dirty. Skipping local develop sync."
fi

rm -f "$pr_json_file" "$contents_json_file" "$update_payload_file"

echo "Merged PR #$resolved_pr_number and marked $increment_code as completed on develop."
echo "Next step suggestion: ./scripts/gen_prompt.sh"
