#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_FAILED = "failed"
STATUS_SKIPPED = "skipped"
VALID_STATUSES = {
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_SKIPPED,
}
LAUNCH_MODE_AUTO = "auto"
LAUNCH_MODE_INLINE = "inline"
LAUNCH_MODE_NEW_WINDOW = "new-window"

TASK_HEADING_RE = re.compile(
    r"^(#{1,3})\s*(?:任务|Task)\s*(\d+)(?:\s*[:：.\-]\s*(.+?))?\s*$",
    re.IGNORECASE,
)

PROMPT_TEMPLATE = """你正在执行 llmWikiRPG v0.2 的分阶段任务。

当前任务编号：任务 {task_id}
当前任务标题：{task_title}

## 总体背景

这是 llmWikiRPG v0.1 后的真实抽取质量修复迭代。

v0.1 已经完成 RPG mode 的基础架构，但真实抽取中发现：
- player/characters 边界混淆
- events/plot-arcs 边界混乱
- current-scene 被静态百科污染
- concepts 混入百科标签/萌点
- locations/factions 漏抽
- 缺少 extraction validation/lint
- 缺少针对真实抽取问题的测试

本轮要求：
- 按当前 RPG-only 项目边界执行，不为旧 default / legacy llm_wiki 设计兼容或迁移路径
- 不要大规模重构 UI
- 不要引入大型依赖
- 不要写死 Fate 专有规则
- Fate 名称只能作为 regression fixture
- 当前只执行本任务，不要越界执行后续任务

## 上一阶段摘要

{previous_summaries}

## 当前任务详细要求

{task_body}

## 执行要求

1. 先检查当前项目结构和相关文件。
2. 只修改与当前任务直接相关的文件。
3. 如果发现当前任务依赖前置任务未完成，请说明并做最小兼容处理，不要擅自跳到其他任务。
4. 修改完成后尽量运行相关测试。
5. 如果无法运行完整测试，至少说明原因。
6. 最后输出执行摘要，包含：
   - 修改了哪些文件
   - 为什么这么改
   - 当前任务是否完成
   - 运行了哪些测试
   - 是否有遗留问题
   - 建议下一个任务从哪里继续

请现在执行任务 {task_id}。
"""

SUMMARY_TEMPLATE = """# Task {task_id:02d} Summary

Status: {status}
Title: {title}
Started: {started_at}
Finished: {finished_at}
Return code: {return_code}

## Changed files

{changed_files}

## Commands

{commands}

## Git status before

```text
{git_status_before}
```

## Git diff stat before

```text
{git_diff_before}
```

## Git status after

```text
{git_status_after}
```

## Git diff stat after

```text
{git_diff_after}
```

## Test results

{test_results}

## Result

{result_text}

## Stdout tail

```text
{stdout_tail}
```

## Stderr tail

```text
{stderr_tail}
```

## Notes

{notes}
"""


@dataclass(frozen=True)
class ParsedTask:
    task_id: int
    title: str
    heading: str
    body: str


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run llmWikiRPG v0.2 tasks one agent process at a time.",
    )
    parser.add_argument(
        "--task-doc",
        default="docs/RPG_V0_2_TASKS.md",
        help="Task document to parse. Default: docs/RPG_V0_2_TASKS.md",
    )
    parser.add_argument(
        "--agent",
        choices=("codex",),
        default="codex",
        help="Named agent preset used when --agent-command is not provided.",
    )
    parser.add_argument(
        "--agent-command",
        help='Exact command used to run the agent, for example "codex exec".',
    )
    parser.add_argument(
        "--agent-launch-mode",
        choices=(LAUNCH_MODE_AUTO, LAUNCH_MODE_INLINE, LAUNCH_MODE_NEW_WINDOW),
        default=LAUNCH_MODE_AUTO,
        help=(
            "How to launch each agent task. "
            "auto = use a new window for Codex on Windows, inline otherwise."
        ),
    )
    parser.add_argument(
        "--only",
        help="Comma-separated task ids to run, for example 2 or 2,3.",
    )
    parser.add_argument(
        "--from",
        dest="from_task",
        type=int,
        help="Start from this task id.",
    )
    parser.add_argument(
        "--to",
        dest="to_task",
        type=int,
        help="Stop at this task id.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from the next unfinished task based on state.json.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate prompts and state only. Do not execute the agent.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Do not ask for per-task confirmation before execution.",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue to later tasks after a failed task.",
    )
    parser.add_argument(
        "--git-checkpoint",
        action="store_true",
        help="After a successful task, run git add . and git commit for that task.",
    )
    parser.add_argument(
        "--require-clean",
        action="store_true",
        help="Fail fast if the git working tree is not clean before the run.",
    )
    parser.add_argument(
        "--test-command",
        help='Optional test command, for example "npm test".',
    )
    parser.add_argument(
        "--typecheck-command",
        help='Optional typecheck command, for example "npm run typecheck".',
    )
    args = parser.parse_args()
    validate_args(args)
    return args


def validate_args(args: argparse.Namespace) -> None:
    if args.only and (args.from_task is not None or args.to_task is not None or args.resume):
        raise SystemExit("--only cannot be combined with --from, --to, or --resume.")

    if args.resume and (args.from_task is not None or args.to_task is not None):
        raise SystemExit("--resume cannot be combined with --from or --to.")

    if args.from_task is not None and args.to_task is not None and args.from_task > args.to_task:
        raise SystemExit("--from must be less than or equal to --to.")


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def relative_to_repo(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def ensure_runtime_dirs(base_dir: Path) -> dict[str, Path]:
    prompts_dir = base_dir / "prompts"
    logs_dir = base_dir / "logs"
    summaries_dir = base_dir / "summaries"
    launchers_dir = base_dir / "launchers"
    for directory in (base_dir, prompts_dir, logs_dir, summaries_dir, launchers_dir):
        directory.mkdir(parents=True, exist_ok=True)
    return {
        "base": base_dir,
        "prompts": prompts_dir,
        "logs": logs_dir,
        "summaries": summaries_dir,
        "launchers": launchers_dir,
        "state": base_dir / "state.json",
    }


def read_task_doc(task_doc: Path) -> str:
    if not task_doc.exists():
        raise FileNotFoundError(f"Required task document not found: {task_doc}")
    return task_doc.read_text(encoding="utf-8")


def parse_tasks(task_doc_text: str) -> list[ParsedTask]:
    lines = task_doc_text.splitlines()
    matches: list[tuple[int, re.Match[str]]] = []
    for index, line in enumerate(lines):
        match = TASK_HEADING_RE.match(line.strip())
        if match:
            matches.append((index, match))

    if not matches:
        raise ValueError("No task headings were recognized in the task document.")

    tasks: list[ParsedTask] = []
    for idx, (start_line, match) in enumerate(matches):
        end_line = matches[idx + 1][0] if idx + 1 < len(matches) else len(lines)
        task_id = int(match.group(2))
        raw_title = (match.group(3) or "").strip()
        title = raw_title or f"任务 {task_id}"
        block_lines = lines[start_line:end_line]
        body = "\n".join(block_lines).strip() + "\n"
        tasks.append(
            ParsedTask(
                task_id=task_id,
                title=title,
                heading=lines[start_line].strip(),
                body=body,
            )
        )

    seen_ids: set[int] = set()
    duplicate_ids: set[int] = set()
    for task in tasks:
        if task.task_id in seen_ids:
            duplicate_ids.add(task.task_id)
        seen_ids.add(task.task_id)
    if duplicate_ids:
        duplicate_list = ", ".join(str(task_id) for task_id in sorted(duplicate_ids))
        raise ValueError(f"Duplicate task ids were found in the task document: {duplicate_list}")

    return tasks


def find_non_consecutive_ids(tasks: list[ParsedTask]) -> list[str]:
    warnings: list[str] = []
    task_ids = [task.task_id for task in tasks]
    for previous, current in zip(task_ids, task_ids[1:]):
        if current != previous + 1:
            warnings.append(
                f"Warning: task ids are not consecutive between {previous} and {current}."
            )
    return warnings


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {"tasks": {}}
    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"State file is not valid JSON: {state_path}") from exc


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state["updated_at"] = now_iso()
    state_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sync_state(
    state: dict[str, Any],
    tasks: list[ParsedTask],
    root: Path,
    task_doc: Path,
    agent_command: str,
    paths: dict[str, Path],
) -> dict[str, Any]:
    existing_tasks = state.get("tasks", {})
    synced_tasks: dict[str, Any] = {}

    for task in tasks:
        key = str(task.task_id)
        prompt_file = paths["prompts"] / f"task_{task.task_id:02d}_prompt.md"
        stdout_log = paths["logs"] / f"task_{task.task_id:02d}_stdout.log"
        stderr_log = paths["logs"] / f"task_{task.task_id:02d}_stderr.log"
        summary_file = paths["summaries"] / f"task_{task.task_id:02d}_summary.md"
        launch_script = paths["launchers"] / f"task_{task.task_id:02d}_launch.ps1"
        prior = existing_tasks.get(key, {})
        status = prior.get("status", STATUS_PENDING)
        if status not in VALID_STATUSES:
            status = STATUS_PENDING

        synced_tasks[key] = {
            "title": task.title,
            "status": status,
            "prompt_file": relative_to_repo(prompt_file, root),
            "stdout_log": relative_to_repo(stdout_log, root),
            "stderr_log": relative_to_repo(stderr_log, root),
            "summary_file": relative_to_repo(summary_file, root),
            "launch_script": relative_to_repo(launch_script, root),
            "started_at": prior.get("started_at"),
            "finished_at": prior.get("finished_at"),
            "return_code": prior.get("return_code"),
            "last_error": prior.get("last_error"),
            "test_return_code": prior.get("test_return_code"),
            "typecheck_return_code": prior.get("typecheck_return_code"),
            "git_status_before": prior.get("git_status_before"),
            "git_diff_before": prior.get("git_diff_before"),
            "git_status_after": prior.get("git_status_after"),
            "git_diff_after": prior.get("git_diff_after"),
        }

    state["task_doc"] = relative_to_repo(task_doc, root)
    state["agent_command"] = agent_command
    state["tasks"] = synced_tasks
    return state


def parse_task_selection(
    args: argparse.Namespace,
    tasks: list[ParsedTask],
    state: dict[str, Any],
) -> list[ParsedTask]:
    task_map = {task.task_id: task for task in tasks}
    sorted_ids = sorted(task_map)

    if args.only:
        requested_ids = []
        for raw_item in args.only.split(","):
            item = raw_item.strip()
            if not item:
                continue
            if not item.isdigit():
                raise SystemExit(f"Invalid task id in --only: {item}")
            requested_ids.append(int(item))
        if not requested_ids:
            raise SystemExit("--only did not contain any valid task ids.")
        missing = [task_id for task_id in requested_ids if task_id not in task_map]
        if missing:
            raise SystemExit(f"Unknown task ids in --only: {', '.join(map(str, missing))}")
        return [task_map[task_id] for task_id in requested_ids]

    if args.resume:
        for task_id in sorted_ids:
            status = state.get("tasks", {}).get(str(task_id), {}).get("status", STATUS_PENDING)
            if status != STATUS_DONE:
                return [task_map[current_id] for current_id in sorted_ids if current_id >= task_id]
        raise SystemExit("All tasks are already marked done in state.json. Nothing to resume.")

    from_task = args.from_task if args.from_task is not None else sorted_ids[0]
    to_task = args.to_task if args.to_task is not None else sorted_ids[-1]

    missing = [task_id for task_id in (from_task, to_task) if task_id not in task_map]
    if missing:
        raise SystemExit(f"Unknown task ids in selected range: {', '.join(map(str, missing))}")

    return [task for task in tasks if from_task <= task.task_id <= to_task]


def determine_agent_command(args: argparse.Namespace) -> str:
    if args.agent_command:
        return args.agent_command.strip()

    presets = {
        "codex": "codex exec",
    }
    return presets[args.agent]


def determine_agent_launch_mode(args: argparse.Namespace, agent_command: str) -> str:
    if args.agent_launch_mode != LAUNCH_MODE_AUTO:
        return args.agent_launch_mode

    if os.name == "nt":
        parts = split_command(agent_command)
        executable_name = Path(parts[0]).name.lower()
        if executable_name in {"codex", "codex.exe"}:
            return LAUNCH_MODE_NEW_WINDOW

    return LAUNCH_MODE_INLINE


def split_command(command: str) -> list[str]:
    if not command.strip():
        raise ValueError("Command cannot be empty.")
    posix = os.name != "nt"
    return shlex.split(command, posix=posix)


def ensure_executable(command: str) -> None:
    parts = split_command(command)
    executable = parts[0]
    if any(sep in executable for sep in (os.sep, "/", "\\")):
        if not Path(executable).exists():
            raise FileNotFoundError(f"Agent executable not found: {executable}")
        return
    if shutil.which(executable) is None:
        raise FileNotFoundError(
            f'Command not found: "{executable}". '
            "Set --agent-command explicitly, for example --agent-command \"codex exec\"."
        )


def resolve_executable(command: str) -> str:
    parts = split_command(command)
    executable = parts[0]
    if any(sep in executable for sep in (os.sep, "/", "\\")):
        return str(Path(executable))
    if os.name == "nt" and "." not in Path(executable).name:
        resolved_exe = shutil.which(f"{executable}.exe")
        if resolved_exe:
            return resolved_exe
    resolved = shutil.which(executable)
    return resolved or executable


def run_command(
    command: str,
    cwd: Path,
    *,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    parts = split_command(command)
    return subprocess.run(
        parts,
        cwd=str(cwd),
        input=input_text,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def run_command_parts(
    parts: list[str],
    cwd: Path,
    *,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        parts,
        cwd=str(cwd),
        input=input_text,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def ps_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def powershell_array(values: list[str]) -> str:
    return "@(" + ", ".join(ps_quote(value) for value in values) + ")"


def windows_arguments_string(args: list[str]) -> str:
    if not args:
        return ""
    return subprocess.list2cmdline(args)


def cmd_quote(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def build_windows_launcher_script(
    *,
    command_parts: list[str],
    cwd: Path,
    prompt_file: Path,
    stdout_log: Path,
    stderr_log: Path,
    window_title: str,
) -> str:
    command_line = subprocess.list2cmdline(command_parts)
    prompt_path = str(prompt_file)
    stdout_path = str(stdout_log)
    stderr_path = str(stderr_log)
    return f"""$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = {ps_quote(window_title)}
Set-Location -LiteralPath {ps_quote(str(cwd))}
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$stdoutPath = {ps_quote(stdout_path)}
$stderrPath = {ps_quote(stderr_path)}
$promptPath = {ps_quote(prompt_path)}
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($stdoutPath)) | Out-Null
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($stderrPath)) | Out-Null
try {{
  $cmdArgs = @('/d', '/c', {ps_quote(command_line)})
  Get-Content -LiteralPath $promptPath -Raw | & cmd.exe @cmdArgs 1> $stdoutPath 2> $stderrPath
  exit $LASTEXITCODE
}} catch {{
  $_ | Out-String | Set-Content -LiteralPath $stderrPath -Encoding UTF8
  exit 1
}}
"""


def read_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def run_agent_in_new_window(
    *,
    agent_command: str,
    cwd: Path,
    prompt_file: Path,
    stdout_log: Path,
    stderr_log: Path,
    launch_script: Path,
    task_label: str,
) -> subprocess.CompletedProcess[str]:
    if os.name != "nt":
        raise RuntimeError("--agent-launch-mode new-window is currently supported on Windows only.")

    command_parts = split_command(agent_command)
    script_text = build_windows_launcher_script(
        command_parts=command_parts,
        cwd=cwd,
        prompt_file=prompt_file,
        stdout_log=stdout_log,
        stderr_log=stderr_log,
        window_title=task_label,
    )
    launch_script.write_text(script_text, encoding="utf-8")

    start_command = (
        "$proc = Start-Process -FilePath 'powershell.exe' "
        f"-ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', {ps_quote(str(launch_script))}) "
        f"-WorkingDirectory {ps_quote(str(cwd))} -PassThru -Wait; "
        "exit $proc.ExitCode"
    )
    supervisor = run_command_parts(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", start_command],
        cwd,
    )

    stdout_text = read_text_if_exists(stdout_log)
    stderr_text = read_text_if_exists(stderr_log)

    if supervisor.stdout.strip():
        stdout_text = "\n".join(part for part in (stdout_text, supervisor.stdout) if part).strip() + "\n"
    if supervisor.stderr.strip():
        stderr_text = "\n".join(part for part in (stderr_text, supervisor.stderr) if part).strip() + "\n"

    return subprocess.CompletedProcess(
        args=command_parts,
        returncode=supervisor.returncode,
        stdout=stdout_text,
        stderr=stderr_text,
    )


def git_capture(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(root),
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    if result.returncode != 0:
        return stderr or stdout or f"git {' '.join(args)} failed with code {result.returncode}"
    return stdout or "(clean)"


def is_working_tree_clean(root: Path) -> bool:
    status = git_capture(root, "status", "--short")
    return status == "(clean)"


def extract_changed_files(git_status_after: str) -> list[str]:
    if git_status_after == "(clean)":
        return []
    changed_files: list[str] = []
    for line in git_status_after.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parts = stripped.split(maxsplit=1)
        if len(parts) == 1:
            continue
        changed_files.append(parts[1].replace("\\", "/"))
    return changed_files


def truncate_tail(text: str, limit: int = 20) -> str:
    stripped = text.strip()
    if not stripped:
        return "(empty)"
    lines = stripped.splitlines()
    tail = lines[-limit:]
    return "\n".join(tail)


def confirm_task(task: ParsedTask) -> bool:
    prompt = f'Run task {task.task_id:02d} "{task.title}"? [y/N]: '
    try:
        answer = input(prompt).strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}


def previous_summaries_text(state: dict[str, Any], root: Path, current_task_id: int) -> str:
    summary_items: list[str] = []
    for task_id in sorted(int(key) for key in state.get("tasks", {})):
        if task_id >= current_task_id:
            continue
        task_state = state["tasks"][str(task_id)]
        summary_rel = task_state.get("summary_file")
        if not summary_rel:
            continue
        summary_path = root / Path(summary_rel)
        if not summary_path.exists():
            continue
        content = summary_path.read_text(encoding="utf-8").strip()
        if not content:
            continue
        status_line = next(
            (line for line in content.splitlines() if line.startswith("Status:")),
            "Status: unknown",
        )
        result_lines = []
        for line in content.splitlines():
            if line.startswith("Title:"):
                result_lines.append(line.strip())
            if line.startswith("Return code:"):
                result_lines.append(line.strip())
        snippet_parts = [status_line.strip(), *result_lines]
        snippet = " | ".join(snippet_parts)
        summary_items.append(f"- 任务 {task_id:02d}: {snippet}")

    return "\n".join(summary_items) if summary_items else "无"


def build_prompt(task: ParsedTask, previous_summaries: str) -> str:
    return PROMPT_TEMPLATE.format(
        task_id=task.task_id,
        task_title=task.title,
        previous_summaries=previous_summaries,
        task_body=task.body,
    )


def write_prompt(prompt_file: Path, prompt_text: str) -> None:
    prompt_file.write_text(prompt_text, encoding="utf-8")


def write_log(log_path: Path, content: str) -> None:
    log_path.write_text(content, encoding="utf-8")


def run_optional_command(
    command: str | None,
    root: Path,
    log_path: Path | None,
) -> tuple[int | None, str]:
    if not command:
        return None, "not run"
    result = run_command(command, root)
    combined = []
    if result.stdout:
        combined.append(result.stdout.rstrip())
    if result.stderr:
        combined.append(result.stderr.rstrip())
    log_text = "\n\n".join(part for part in combined if part).strip()
    if log_path is not None:
        write_log(log_path, log_text + ("\n" if log_text else ""))
    status = "passed" if result.returncode == 0 else f"failed ({result.returncode})"
    return result.returncode, status


def write_summary(
    summary_path: Path,
    *,
    task: ParsedTask,
    task_state: dict[str, Any],
    agent_command: str,
    agent_launch_mode: str,
    test_command: str | None,
    typecheck_command: str | None,
    stdout_text: str,
    stderr_text: str,
    notes: list[str],
) -> None:
    changed_files = extract_changed_files(task_state.get("git_status_after") or "(clean)")
    changed_files_text = (
        "\n".join(f"- {path}" for path in changed_files) if changed_files else "- (none detected)"
    )

    commands = [f"- {agent_command} < {task_state['prompt_file']}"]
    if agent_launch_mode == LAUNCH_MODE_NEW_WINDOW:
        commands.append("- launch mode: new-window")
    if test_command:
        commands.append(f"- {test_command}")
    if typecheck_command:
        commands.append(f"- {typecheck_command}")
    commands_text = "\n".join(commands)

    test_lines = []
    if test_command:
        code = task_state.get("test_return_code")
        test_lines.append(f"- test: {'passed' if code == 0 else f'failed ({code})'}")
    if typecheck_command:
        code = task_state.get("typecheck_return_code")
        test_lines.append(f"- typecheck: {'passed' if code == 0 else f'failed ({code})'}")
    if not test_lines:
        test_lines.append("- no extra test or typecheck command configured")

    return_code = task_state.get("return_code")
    result_text = (
        f"Agent exited with code {return_code}."
        if return_code is not None
        else "Agent was not executed."
    )
    if task_state.get("status") == STATUS_FAILED and task_state.get("last_error"):
        result_text += f" Error: {task_state['last_error']}"

    summary_text = SUMMARY_TEMPLATE.format(
        task_id=task.task_id,
        status=task_state.get("status", STATUS_PENDING),
        title=task.title,
        started_at=task_state.get("started_at") or "(not started)",
        finished_at=task_state.get("finished_at") or "(not finished)",
        return_code=return_code if return_code is not None else "(not run)",
        changed_files=changed_files_text,
        commands=commands_text,
        git_status_before=task_state.get("git_status_before") or "(not captured)",
        git_diff_before=task_state.get("git_diff_before") or "(not captured)",
        git_status_after=task_state.get("git_status_after") or "(not captured)",
        git_diff_after=task_state.get("git_diff_after") or "(not captured)",
        test_results="\n".join(test_lines),
        result_text=result_text,
        stdout_tail=truncate_tail(stdout_text),
        stderr_tail=truncate_tail(stderr_text),
        notes="\n".join(f"- {note}" for note in notes) if notes else "- none",
    )
    summary_path.write_text(summary_text, encoding="utf-8")


def mark_skipped(
    task: ParsedTask,
    state: dict[str, Any],
    root: Path,
    paths: dict[str, Path],
    agent_command: str,
    prompt_text: str,
) -> None:
    task_state = state["tasks"][str(task.task_id)]
    prompt_file = root / Path(task_state["prompt_file"])
    summary_file = root / Path(task_state["summary_file"])
    write_prompt(prompt_file, prompt_text)
    task_state["status"] = STATUS_SKIPPED
    task_state["started_at"] = None
    task_state["finished_at"] = now_iso()
    task_state["return_code"] = None
    task_state["last_error"] = "Skipped by user confirmation."
    task_state["git_status_before"] = git_capture(root, "status", "--short")
    task_state["git_diff_before"] = git_capture(root, "diff", "--stat")
    task_state["git_status_after"] = task_state["git_status_before"]
    task_state["git_diff_after"] = task_state["git_diff_before"]
    write_summary(
        summary_file,
        task=task,
        task_state=task_state,
        agent_command=agent_command,
        agent_launch_mode=LAUNCH_MODE_INLINE,
        test_command=None,
        typecheck_command=None,
        stdout_text="",
        stderr_text="",
        notes=["Task was skipped because the user did not confirm execution."],
    )
    save_state(paths["state"], state)


def main() -> int:
    args = parse_args()
    root = repo_root()
    task_doc = (root / args.task_doc).resolve()
    agent_command = determine_agent_command(args)
    agent_launch_mode = determine_agent_launch_mode(args, agent_command)
    paths = ensure_runtime_dirs(root / ".agent_runs" / "rpg_v02")

    if not args.dry_run:
        ensure_executable(agent_command)

    task_doc_text = read_task_doc(task_doc)
    tasks = parse_tasks(task_doc_text)
    warnings = find_non_consecutive_ids(tasks)

    state = load_state(paths["state"])
    state = sync_state(state, tasks, root, task_doc, agent_command, paths)
    selected_tasks = parse_task_selection(args, tasks, state)

    save_state(paths["state"], state)

    print("llmWikiRPG v0.2 task runner")
    print(f"Task doc: {relative_to_repo(task_doc, root)}")
    print(f"Agent command: {agent_command}")
    print(f"Agent launch mode: {agent_launch_mode}")
    print(f"Dry run: {args.dry_run}")
    print(f"Selected tasks: {', '.join(f'{task.task_id:02d}' for task in selected_tasks)}")
    for warning in warnings:
        print(warning, file=sys.stderr)

    git_status_initial = git_capture(root, "status", "--short")
    if git_status_initial != "(clean)":
        print("Warning: working tree is not clean.", file=sys.stderr)
        if args.require_clean:
            print("--require-clean was set, aborting.", file=sys.stderr)
            return 1

    if args.dry_run:
        for task in selected_tasks:
            task_state = state["tasks"][str(task.task_id)]
            prompt_file = root / Path(task_state["prompt_file"])
            prompt_text = build_prompt(task, previous_summaries_text(state, root, task.task_id))
            write_prompt(prompt_file, prompt_text)
        save_state(paths["state"], state)
        print("Dry run complete. Prompts generated:")
        for task in selected_tasks:
            print(f"- {state['tasks'][str(task.task_id)]['prompt_file']}")
        return 0

    overall_exit = 0
    for task in selected_tasks:
        prompt_text = build_prompt(task, previous_summaries_text(state, root, task.task_id))
        task_state = state["tasks"][str(task.task_id)]
        prompt_file = root / Path(task_state["prompt_file"])
        stdout_log = root / Path(task_state["stdout_log"])
        stderr_log = root / Path(task_state["stderr_log"])
        summary_file = root / Path(task_state["summary_file"])
        launch_script = root / Path(task_state["launch_script"])

        write_prompt(prompt_file, prompt_text)

        if not args.yes and not confirm_task(task):
            print(f"Skipping task {task.task_id:02d}.")
            mark_skipped(task, state, root, paths, agent_command, prompt_text)
            continue

        print(f"Running task {task.task_id:02d}: {task.title}")
        task_state["status"] = STATUS_RUNNING
        task_state["started_at"] = now_iso()
        task_state["finished_at"] = None
        task_state["return_code"] = None
        task_state["last_error"] = None
        task_state["test_return_code"] = None
        task_state["typecheck_return_code"] = None
        task_state["git_status_before"] = git_capture(root, "status", "--short")
        task_state["git_diff_before"] = git_capture(root, "diff", "--stat")
        save_state(paths["state"], state)

        if agent_launch_mode == LAUNCH_MODE_NEW_WINDOW:
            agent_result = run_agent_in_new_window(
                agent_command=agent_command,
                cwd=root,
                prompt_file=prompt_file,
                stdout_log=stdout_log,
                stderr_log=stderr_log,
                launch_script=launch_script,
                task_label=f"llmWikiRPG task {task.task_id:02d}",
            )
        else:
            agent_result = run_command(agent_command, root, input_text=prompt_text)
            write_log(stdout_log, agent_result.stdout)
            write_log(stderr_log, agent_result.stderr)

        if agent_launch_mode == LAUNCH_MODE_NEW_WINDOW:
            if not stdout_log.exists():
                write_log(stdout_log, agent_result.stdout)
            if not stderr_log.exists():
                write_log(stderr_log, agent_result.stderr)

        task_state["return_code"] = agent_result.returncode
        task_state["status"] = STATUS_DONE if agent_result.returncode == 0 else STATUS_FAILED
        if agent_result.returncode != 0:
            task_state["last_error"] = f"Agent exited with code {agent_result.returncode}."

        notes: list[str] = []
        test_log = paths["logs"] / f"task_{task.task_id:02d}_test.log"
        typecheck_log = paths["logs"] / f"task_{task.task_id:02d}_typecheck.log"

        if agent_result.returncode == 0:
            test_code, test_status = run_optional_command(args.test_command, root, test_log)
            typecheck_code, typecheck_status = run_optional_command(
                args.typecheck_command,
                root,
                typecheck_log,
            )
            task_state["test_return_code"] = test_code
            task_state["typecheck_return_code"] = typecheck_code
            if args.test_command:
                notes.append(f"Test command result: {test_status}.")
            if args.typecheck_command:
                notes.append(f"Typecheck command result: {typecheck_status}.")
            if (test_code not in (None, 0)) or (typecheck_code not in (None, 0)):
                task_state["status"] = STATUS_FAILED
                task_state["last_error"] = "Post-task test or typecheck command failed."

        if task_state["status"] == STATUS_DONE and args.git_checkpoint:
            commit_message = f"rpg-v0.2 task {task.task_id}: {task.title}"
            git_add_result = run_command_parts(["git", "add", "."], root)
            git_commit_result = run_command_parts(
                ["git", "commit", "-m", commit_message],
                root,
            )
            notes.append(f"git add . exit code: {git_add_result.returncode}.")
            notes.append(f"git commit exit code: {git_commit_result.returncode}.")
            if git_add_result.returncode != 0 or git_commit_result.returncode != 0:
                task_state["status"] = STATUS_FAILED
                task_state["last_error"] = "Git checkpoint command failed."
            checkpoint_stdout = "\n".join(
                text.strip()
                for text in (
                    git_add_result.stdout,
                    git_add_result.stderr,
                    git_commit_result.stdout,
                    git_commit_result.stderr,
                )
                if text.strip()
            )
            checkpoint_log = paths["logs"] / f"task_{task.task_id:02d}_git_checkpoint.log"
            write_log(checkpoint_log, checkpoint_stdout + ("\n" if checkpoint_stdout else ""))

        task_state["finished_at"] = now_iso()
        task_state["git_status_after"] = git_capture(root, "status", "--short")
        task_state["git_diff_after"] = git_capture(root, "diff", "--stat")

        if task_state["git_status_before"] != "(clean)":
            notes.append("Working tree was already dirty before this task; git summaries may include pre-existing changes.")

        write_summary(
            summary_file,
            task=task,
            task_state=task_state,
            agent_command=agent_command,
            agent_launch_mode=agent_launch_mode,
            test_command=args.test_command,
            typecheck_command=args.typecheck_command,
            stdout_text=agent_result.stdout,
            stderr_text=agent_result.stderr,
            notes=notes,
        )
        save_state(paths["state"], state)

        if task_state["status"] == STATUS_DONE:
            print(f"Task {task.task_id:02d} completed successfully.")
            continue

        overall_exit = 1 if overall_exit == 0 else overall_exit
        print(
            f"Task {task.task_id:02d} failed. See {task_state['summary_file']}.",
            file=sys.stderr,
        )
        if not args.continue_on_error:
            return overall_exit

    return overall_exit


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
