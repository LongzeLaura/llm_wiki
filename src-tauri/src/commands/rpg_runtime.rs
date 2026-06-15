use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

const WORKER_FILE_NAME: &str = "rpg-runtime-worker.mjs";
const WORKER_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const TRACE_EVENT_PREFIX: &str = "__RPG_RUNTIME_TRACE_EVENT__";

#[tauri::command]
pub async fn rpg_runtime_run_turn(
    app: AppHandle,
    run_id: String,
    project_path: String,
    llm_config: Value,
    submitted_action: Value,
    soft_semantic_repair_retry: Option<Value>,
) -> Result<Value, String> {
    let worker_path = find_worker_path(&app)?;
    let node_path = find_node_command()?;
    let worker_input = json!({
        "runId": run_id.clone(),
        "projectPath": project_path,
        "llmConfig": llm_config,
        "submittedAction": submitted_action,
        "softSemanticRepairRetry": soft_semantic_repair_retry,
    });

    let mut cmd = Command::new(node_path);
    suppress_windows_console(&mut cmd);
    cmd.arg(&worker_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn RPG runtime worker {}: {e}", worker_path.display()))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "RPG runtime worker stdin is unavailable.".to_string())?;
    stdin
        .write_all(worker_input.to_string().as_bytes())
        .await
        .map_err(|e| format!("Failed to write RPG runtime worker input: {e}"))?;
    stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush RPG runtime worker input: {e}"))?;
    drop(stdin);

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "RPG runtime worker stdout is unavailable.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "RPG runtime worker stderr is unavailable.".to_string())?;
    let stdout_task = tokio::spawn(read_to_string(stdout));
    let trace_topic = format!("rpg-runtime:{run_id}:trace");
    let stderr_task = tokio::spawn(read_worker_stderr(stderr, app.clone(), trace_topic));

    let status = match tokio::time::timeout(WORKER_TIMEOUT, child.wait()).await {
        Ok(Ok(status)) => status,
        Ok(Err(error)) => return Err(format!("Failed while waiting for RPG runtime worker: {error}")),
        Err(_) => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Err("RPG runtime worker timed out after 30 minutes.".to_string());
        }
    };

    let stdout_text = stdout_task
        .await
        .map_err(|e| format!("RPG runtime worker stdout task failed: {e}"))??;
    let stderr_text = stderr_task
        .await
        .map_err(|e| format!("RPG runtime worker stderr task failed: {e}"))??;

    if !status.success() {
        let details = stderr_text.trim();
        return Err(if details.is_empty() {
            format!("RPG runtime worker exited with status {status}.")
        } else {
            format!("RPG runtime worker exited with status {status}: {details}")
        });
    }

    if !stderr_text.trim().is_empty() {
        eprintln!("[rpg-runtime-worker stderr]\n{}", stderr_text.trim());
    }

    parse_worker_stdout(&stdout_text)
}

pub fn parse_worker_stdout(stdout: &str) -> Result<Value, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Err("RPG runtime worker produced no stdout JSON.".to_string());
    }

    let parsed: Value = serde_json::from_str(trimmed)
        .map_err(|e| format!("RPG runtime worker stdout must be a single JSON value: {e}"))?;
    if !parsed.is_object() {
        return Err("RPG runtime worker stdout JSON must be an object.".to_string());
    }
    Ok(parsed)
}

async fn read_to_string<R>(mut reader: R) -> Result<String, String>
where
    R: AsyncRead + Unpin,
{
    let mut bytes = Vec::new();
    reader
        .read_to_end(&mut bytes)
        .await
        .map_err(|e| format!("failed to read worker pipe: {e}"))?;
    String::from_utf8(bytes).map_err(|e| format!("worker pipe was not UTF-8: {e}"))
}

async fn read_worker_stderr<R>(reader: R, app: AppHandle, trace_topic: String) -> Result<String, String>
where
    R: AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    let mut collected = String::new();

    loop {
        match lines.next_line().await {
            Ok(Some(line)) => match parse_worker_stderr_trace_event_line(&line) {
                Ok(Some(payload)) => {
                    if let Err(error) = app.emit(&trace_topic, payload) {
                        collected.push_str(&format!(
                            "Failed to emit RPG runtime trace event on {trace_topic}: {error}\n",
                        ));
                    }
                }
                Ok(None) => {
                    collected.push_str(&line);
                    collected.push('\n');
                }
                Err(error) => {
                    collected.push_str(&error);
                    collected.push('\n');
                }
            },
            Ok(None) => break,
            Err(error) => return Err(format!("failed to read worker stderr: {error}")),
        }
    }

    Ok(collected)
}

pub fn parse_worker_stderr_trace_event_line(line: &str) -> Result<Option<Value>, String> {
    let Some(raw_payload) = line.strip_prefix(TRACE_EVENT_PREFIX) else {
        return Ok(None);
    };

    serde_json::from_str::<Value>(raw_payload)
        .map(Some)
        .map_err(|e| format!("Invalid RPG runtime trace event on worker stderr: {e}: {line}"))
}

fn find_worker_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = env::var("LLMWIKIRPG_RUNTIME_WORKER") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(project_root) = manifest_dir.parent() {
        let candidate = project_root.join("dist-runtime").join(WORKER_FILE_NAME);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        for candidate in [
            resource_dir.join(WORKER_FILE_NAME),
            resource_dir.join("dist-runtime").join(WORKER_FILE_NAME),
        ] {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err(format!(
        "RPG runtime worker not found. Run `npm run build:runtime` and ensure {WORKER_FILE_NAME} is bundled.",
    ))
}

fn find_node_command() -> Result<PathBuf, String> {
    if let Ok(path) = env::var("LLMWIKIRPG_NODE") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    #[cfg(windows)]
    {
        if let Ok(path) = which::which("node.exe") {
            return Ok(path);
        }
    }

    which::which("node").map_err(|_| "`node` not found on PATH; RPG runtime worker requires Node.js.".to_string())
}

fn suppress_windows_console(_cmd: &mut Command) {
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        _cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_worker_stdout_accepts_single_json_object() {
        let parsed = parse_worker_stdout("{\"ok\":true,\"result\":{}}").unwrap();
        assert_eq!(parsed["ok"], true);
    }

    #[test]
    fn parse_worker_stderr_trace_event_line_accepts_prefixed_json() {
        let parsed = parse_worker_stderr_trace_event_line(
            "__RPG_RUNTIME_TRACE_EVENT__{\"runId\":\"run-1\",\"sequence\":1,\"state\":{\"currentTrace\":null,\"lastTrace\":null}}",
        )
        .unwrap()
        .unwrap();

        assert_eq!(parsed["runId"], "run-1");
        assert_eq!(parsed["sequence"], 1);
    }

    #[test]
    fn parse_worker_stderr_trace_event_line_ignores_plain_stderr() {
        let parsed = parse_worker_stderr_trace_event_line("ordinary warning").unwrap();
        assert!(parsed.is_none());
    }

    #[test]
    fn parse_worker_stderr_trace_event_line_rejects_invalid_json() {
        let err = parse_worker_stderr_trace_event_line("__RPG_RUNTIME_TRACE_EVENT__not json").unwrap_err();
        assert!(err.contains("Invalid RPG runtime trace event"));
    }

    #[test]
    fn parse_worker_stdout_rejects_empty_output() {
        let err = parse_worker_stdout("  ").unwrap_err();
        assert!(err.contains("produced no stdout JSON"));
    }

    #[test]
    fn parse_worker_stdout_rejects_non_object_json() {
        let err = parse_worker_stdout("[]").unwrap_err();
        assert!(err.contains("must be an object"));
    }

    #[test]
    fn parse_worker_stdout_rejects_extra_non_json_text() {
        let err = parse_worker_stdout("{\"ok\":true}\nextra").unwrap_err();
        assert!(err.contains("single JSON value"));
    }
}
