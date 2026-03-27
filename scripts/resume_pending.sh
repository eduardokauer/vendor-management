#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_path="$repo_root/prompts/generated/pending_rpd_resume.json"

if [[ ! -f "$state_path" ]]; then
    exit 0
fi

if python3 - "$state_path" <<'PY'
import json
import sys
from datetime import datetime, timezone

state = json.load(open(sys.argv[1], encoding="utf-8"))
resume_after_raw = state.get("resume_after_utc")
if not resume_after_raw:
    raise SystemExit(1)

resume_after = datetime.fromisoformat(resume_after_raw)
if resume_after.tzinfo is None:
    resume_after = resume_after.replace(tzinfo=timezone.utc)

now = datetime.now(timezone.utc)
raise SystemExit(0 if now >= resume_after else 2)
PY
then
    status=0
else
    status=$?
fi

if [[ "$status" -ne 0 ]]; then
    if [[ "$status" -eq 2 ]]; then
        exit 0
    fi
    echo "Pending RPD resume state exists but is invalid: $state_path" >&2
    exit 1
fi

command_json="$(python3 - "$state_path" <<'PY'
import json
import sys

state = json.load(open(sys.argv[1], encoding="utf-8"))
command = state.get("command")
if not isinstance(command, list) or not command:
    raise SystemExit(1)

print(json.dumps(command))
PY
)"

command_preview="$(python3 - "$command_json" <<'PY'
import json
import shlex
import sys

command = json.loads(sys.argv[1])
print(" ".join(shlex.quote(part) for part in command))
PY
)"

echo "Running scheduled Gemini RPD resume: $command_preview"
rm -f "$state_path"

python3 - "$repo_root" "$command_json" <<'PY'
import json
import os
import subprocess
import sys

repo_root = sys.argv[1]
command = json.loads(sys.argv[2])
result = subprocess.run(command, cwd=repo_root)
sys.exit(result.returncode)
PY
