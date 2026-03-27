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
while [[ $# -gt 0 ]]; do
    case "$1" in
        -PrNumber|--pr-number)
            [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
            pr_number="$2"
            shift 2
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

read -r -p "Proceed with squash merge and delete branch? [y/N] " confirmation
if [[ "$confirmation" != "y" && "$confirmation" != "Y" && "$confirmation" != "yes" && "$confirmation" != "YES" ]]; then
    rm -f "$pr_json_file"
    echo "Merge cancelled by user." >&2
    exit 1
fi

gh pr merge "$resolved_pr_number" --squash --delete-branch

git switch develop
git pull --ff-only origin develop

if [[ ! "$pr_title" =~ (INC-[0-9]{3}) ]]; then
    rm -f "$pr_json_file"
    echo "Could not detect an INC-XXX code in the PR title." >&2
    exit 1
fi

increment_code="${BASH_REMATCH[1]}"
increments_path="$repo_root/INCREMENTS.md"

python3 - "$increments_path" "$increment_code" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
increment_code = sys.argv[2]
text = path.read_text(encoding="utf-8")
pattern = re.compile(rf"(?m)^- \[[ x>]\] \*\*{re.escape(increment_code)}\*\*(.*)$")

if not pattern.search(text):
    raise SystemExit(f"Could not find {increment_code} in INCREMENTS.md.")

updated = pattern.sub(rf"- [x] **{increment_code}**\1", text, count=1)
path.write_text(updated, encoding="utf-8")
PY

git add INCREMENTS.md
git commit -m "Mark $increment_code as completed"
git push origin develop

rm -f "$pr_json_file"

echo "Merged PR #$resolved_pr_number and marked $increment_code as completed."
echo "Next step suggestion: ./scripts/gen_prompt.sh"
