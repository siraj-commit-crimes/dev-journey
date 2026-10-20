"""Subscription mode: runs the checks through Claude Code (`claude -p`) on this computer.

Claude Code comes with a Claude Pro or Max plan and logs in with your Claude account,
so no API key or credit is needed. Each batch of rows is sent with one `claude -p`
call and counts toward your plan's usage limits.

ClaudeCodeClient pretends to be the Anthropic client (like OfflineClient does), so
qc_engine.run_qc works the same way in every mode.
"""

import json
import os
import shutil
import subprocess
import tempfile
from types import SimpleNamespace

# The app's model IDs -> Claude Code's model aliases.
MODEL_ALIASES = {
    "claude-opus-5-5": "opus",
    "claude-sonnet-5-5": "sonnet",
    "claude-haiku-5-5": "haiku",
}
# Tools Claude doesn't need for reading rows; removed so post text can't make it run anything.
BLOCKED_TOOLS = "Bash,PowerShell,Edit,Write,NotebookEdit,WebFetch,WebSearch,Agent"
PROMPT = "Check every row in the input above and answer in the required JSON format."
TIMEOUT_SECONDS = 15 * 60


def find_claude():
    """Path to the claude program, or None if it isn't installed."""
    found = shutil.which("claude")
    if found:
        return found
    # The native installer puts it here; the app may have started before PATH was updated.
    home = os.path.expanduser("~")
    for name in ("claude.exe", "claude"):
        path = os.path.join(home, ".local", "bin", name)
        if os.path.isfile(path):
            return path
    return None


def check_status():
    """Returns (ready, message) for the sidebar."""
    exe = find_claude()
    if not exe:
        return False, "Claude Code isn't installed yet."
    try:
        proc = subprocess.run(
            [exe, "auth", "status"], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return False, f"Couldn't start Claude Code: {error}"
    try:
        info = json.loads(proc.stdout)
    except ValueError:
        info = {}
    if proc.returncode != 0 or info.get("authMethod") == "none":
        return False, "Claude Code is installed but not logged in."
    # claude.ai = normal login; oauth_token = a long-lived token made from a subscription.
    if info.get("authMethod") not in (None, "claude.ai", "oauth_token"):
        return True, f"Logged in with {info['authMethod']}, not a Claude subscription. Usage is billed to that account."
    return True, "Ready: logged in with your Claude account."


def parse_json_text(text):
    """Pull the JSON object out of a text answer (in case it's wrapped in ``` fences)."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in the answer")
    return json.loads(text[start:end + 1])


class ClaudeCodeMessages:
    def __init__(self, exe):
        self.exe = exe

    def create(self, **request):
        schema = request["output_config"]["format"]["schema"]
        effort = request["output_config"].get("effort")
        model = MODEL_ALIASES.get(request["model"], request["model"])
        # A .cmd launcher (npm install on Windows) goes through cmd.exe, which mangles
        # the quotes in a JSON argument, so put the schema in the instructions instead.
        schema_flag = not self.exe.lower().endswith((".cmd", ".bat"))
        system = request["system"]
        if not schema_flag:
            system += (
                "\n\nReply with only a JSON object that matches this JSON Schema, no other text:\n"
                + json.dumps(schema)
            )

        # Run in an empty folder so no project settings, hooks or CLAUDE.md get loaded.
        with tempfile.TemporaryDirectory() as work:
            system_file = os.path.join(work, "instructions.txt")
            with open(system_file, "w", encoding="utf-8") as f:
                f.write(system)
            cmd = [
                self.exe, "-p", PROMPT,
                "--output-format", "json",
                "--system-prompt-file", system_file,
                "--model", model,
                "--no-session-persistence",
                "--strict-mcp-config",
                "--permission-mode", "dontAsk",
                "--disallowedTools", BLOCKED_TOOLS,
            ]
            if effort:
                cmd += ["--effort", effort]
            if schema_flag:
                cmd += ["--json-schema", json.dumps(schema)]
            env = dict(os.environ, CLAUDE_CODE_SAFE_MODE="1")
            env.pop("ANTHROPIC_API_KEY", None)  # use the subscription login, not an API key
            try:
                proc = subprocess.run(
                    cmd, input=request["messages"][0]["content"], capture_output=True, text=True,
                    encoding="utf-8", errors="replace", cwd=work, env=env, timeout=TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                raise RuntimeError("Claude Code took too long; try fewer rows per request") from None

        try:
            data = json.loads(proc.stdout)
        except ValueError:
            detail = (proc.stderr or proc.stdout or "no output").strip()[:300]
            raise RuntimeError(f"Claude Code failed: {detail}") from None
        if data.get("is_error") or proc.returncode != 0:
            message = str(data.get("result") or data.get("subtype") or "unknown error")[:300]
            if "limit" in message.lower():
                message = f"Usage limit reached ({message}). Wait for it to reset, then run again."
            raise RuntimeError(f"Claude Code: {message}")

        answer = data.get("structured_output")
        if answer is None:
            try:
                answer = parse_json_text(str(data.get("result", "")))
            except ValueError:
                raise RuntimeError("Claude Code didn't answer in JSON; try again") from None
        block = SimpleNamespace(type="text", text=json.dumps(answer, ensure_ascii=False))
        return SimpleNamespace(stop_reason="end_turn", content=[block])


class ClaudeCodeClient:
    """Stand-in for anthropic.Anthropic() that runs each request through `claude -p`."""

    def __init__(self, exe=None):
        exe = exe or find_claude()
        if not exe:
            raise RuntimeError("Claude Code isn't installed. See the setup steps in the sidebar.")
        self.beta = SimpleNamespace(messages=ClaudeCodeMessages(exe))
