# RPG v0.2 Automation

## Purpose

`scripts/run_rpg_v02_tasks.py` is a small task runner for the llmWikiRPG v0.2 extraction-quality work.
It reads `docs/RPG_V0_2_TASKS.md`, splits the document by numbered task headings, generates one prompt per task, and runs each task in a fresh agent process so context does not grow without bound.

The script is intentionally scoped to automation only:

- It does not modify `docs/RPG_V0_2_TASKS.md`.
- It does not automatically run all ten tasks unless you ask it to.
- It does not commit by default.

## Prepare The Task Doc

Make sure `docs/RPG_V0_2_TASKS.md` exists and uses numbered headings such as:

```md
## 任务 1：...
## 任务 2：...
```

The parser also accepts:

```md
## Task 1: ...
### 任务 1 ...
# 任务 1 ...
```

## Start With Dry Run

Generate prompts without launching the agent:

```bash
python scripts/run_rpg_v02_tasks.py --dry-run
```

This creates prompt files under:

```text
.agent_runs/rpg_v02/prompts/
```

## Run One Task

Run task 2 only:

```bash
python scripts/run_rpg_v02_tasks.py --only 2 --agent-command "codex exec"
```

Run tasks 2 through 5:

```bash
python scripts/run_rpg_v02_tasks.py --from 2 --to 5 --agent-command "codex exec"
```

If you omit `--agent-command`, the default preset is:

```text
codex exec
```

You can also switch presets:

```bash
python scripts/run_rpg_v02_tasks.py --only 2 --agent opencode
```

That preset expands to:

```text
opencode run
```

## Launch Mode

The runner now supports two execution styles:

- `inline`: run the agent in the current terminal process.
- `new-window`: open a fresh terminal window for the agent, then wait for it to finish.

Default behavior:

- On Windows, when the resolved agent command is `codex`, `auto` becomes `new-window`.
- Otherwise `auto` falls back to `inline`.

Examples:

```bash
python scripts/run_rpg_v02_tasks.py --only 1 --agent-command "codex exec" --agent-launch-mode new-window
python scripts/run_rpg_v02_tasks.py --only 1 --agent-command "codex exec" --agent-launch-mode inline
```

In `new-window` mode, each task uses its own fresh Codex CLI window and the generated prompt file for that task is piped into the command automatically.

## Resume After Failure Or Interruption

Resume from the next task whose status is not `done`:

```bash
python scripts/run_rpg_v02_tasks.py --resume --agent-command "codex exec"
```

The runner uses `.agent_runs/rpg_v02/state.json` to decide where to continue.

## Confirmation Behavior

Without `--yes`, the runner asks before each task.

Skip prompts and run immediately:

```bash
python scripts/run_rpg_v02_tasks.py --from 2 --to 3 --agent-command "codex exec" --yes
```

## Logs, State, And Summaries

The runner creates:

```text
.agent_runs/rpg_v02/
  state.json
  prompts/
  logs/
  summaries/
```

Key files:

- `state.json`: per-task status, timestamps, return codes, prompt/log/summary paths.
- `prompts/task_XX_prompt.md`: the exact prompt sent to the agent.
- `logs/task_XX_stdout.log`: captured stdout.
- `logs/task_XX_stderr.log`: captured stderr.
- `summaries/task_XX_summary.md`: a simple task summary generated without another LLM call.
- `launchers/task_XX_launch.ps1`: Windows launcher script used when `--agent-launch-mode new-window` is active.

## Continue After A Failure

By default, the runner stops on the first failed task.

To keep going anyway:

```bash
python scripts/run_rpg_v02_tasks.py --from 2 --to 5 --continue-on-error --agent-command "codex exec"
```

If a task fails, inspect:

- `.agent_runs/rpg_v02/summaries/task_XX_summary.md`
- `.agent_runs/rpg_v02/logs/task_XX_stdout.log`
- `.agent_runs/rpg_v02/logs/task_XX_stderr.log`

Then rerun with `--resume`.

## Optional Test And Typecheck Hooks

Run validation commands after each successful task:

```bash
python scripts/run_rpg_v02_tasks.py --only 2 --agent-command "codex exec" --test-command "npm test" --typecheck-command "npm run typecheck"
```

Outputs are saved to:

```text
.agent_runs/rpg_v02/logs/task_XX_test.log
.agent_runs/rpg_v02/logs/task_XX_typecheck.log
```

If either command fails, that task is marked `failed`.

## Git Notes

The runner always records `git status --short` and `git diff --stat` before and after each executed task in the generated summary.

If the working tree is dirty before the run, the script prints:

```text
Warning: working tree is not clean.
```

To fail instead of warn:

```bash
python scripts/run_rpg_v02_tasks.py --require-clean --dry-run
```

Optional checkpoint commits are available, but disabled by default:

```bash
python scripts/run_rpg_v02_tasks.py --only 2 --agent-command "codex exec" --git-checkpoint
```

Use `--git-checkpoint` carefully, preferably on a clean working tree, because it runs:

```text
git add .
git commit -m "rpg-v0.2 task {task_id}: {task_title}"
```

## Common Commands

Dry run all tasks:

```bash
python scripts/run_rpg_v02_tasks.py --dry-run
```

Run task 1:

```bash
python scripts/run_rpg_v02_tasks.py --only 1 --agent-command "codex exec" --agent-launch-mode new-window
```

Run task 2:

```bash
python scripts/run_rpg_v02_tasks.py --only 2 --agent-command "codex exec" --agent-launch-mode new-window
```

Resume:

```bash
python scripts/run_rpg_v02_tasks.py --resume --agent-command "codex exec" --agent-launch-mode new-window
```
