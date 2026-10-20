"""Tests for subscription mode, using a fake `claude` program (no login needed)."""

import json
import os
import sys
import textwrap

import pandas as pd
import pytest

import claude_code_engine
import qc_engine

FAKE_CLAUDE = textwrap.dedent('''\
    import json, os, sys
    args = sys.argv[1:]
    log = os.environ["FAKE_CLAUDE_LOG"]
    if args[:2] == ["auth", "status"]:
        print(json.dumps({"authMethod": os.environ.get("FAKE_AUTH", "claude.ai")}))
        sys.exit(0 if os.environ.get("FAKE_AUTH", "claude.ai") != "none" else 1)
    payload = json.loads(sys.stdin.read())
    with open(log, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "args": args,
            "cwd": os.getcwd(),
            "api_key": "ANTHROPIC_API_KEY" in os.environ,
            "system": open(args[args.index("--system-prompt-file") + 1], encoding="utf-8").read(),
            "payload": payload,
        }, ensure_ascii=False) + "\\n")
    if os.environ.get("FAKE_FAIL"):
        print(json.dumps({"type": "result", "is_error": True, "result": os.environ["FAKE_FAIL"]}))
        sys.exit(1)
    if "topics" in payload:
        answer = {"mapping": [{"original": t["label"], "unified": t["label"].title()} for t in payload["topics"]]}
    else:
        answer = {"results": [{
            "id": r["id"], "gender": "Female", "gender_reason": "name", "sentiment": "Negative",
            "sarcasm": True, "sentiment_reason": "mocking", "target_brand": "", "brands_mentioned": [],
            "brand_sentiments": [], "relevant": True, "topic_fits": True, "suggested_topic": r["topic"],
        } for r in payload["rows"]]}
    out = {"type": "result", "is_error": False, "result": ""}
    if "--json-schema" in args:
        out["structured_output"] = answer
    else:
        out["result"] = "Here you go:\\n```json\\n" + json.dumps(answer) + "\\n```"
    print(json.dumps(out))
''')


@pytest.fixture
def fake_claude(tmp_path, monkeypatch):
    script = tmp_path / "fake_claude.py"
    script.write_text(FAKE_CLAUDE, encoding="utf-8")
    if os.name == "nt":
        exe = tmp_path / "claude.exe.bat"  # not used on CI; tests run on Linux/Mac
        exe.write_text(f'@"{sys.executable}" "{script}" %*\n')
    else:
        exe = tmp_path / "claude"
        exe.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{script}" "$@"\n')
        exe.chmod(0o755)
    log = tmp_path / "calls.jsonl"
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(log))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-should-not-be-passed")

    def calls():
        if not log.exists():
            return []
        return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]

    return str(exe), calls


def sample():
    df = pd.DataFrame({
        "Author": ["Khalid", "Fahad"],
        "Content": ["Great service STC, waited 3 hours 👏", "خدمة ممتازة"],
        "Gender": ["Male", "Female"],
        "Sentiment": ["Positive", "Negative"],
        "Topic": ["service", "service"],
    })
    return df, qc_engine.guess_columns(df.columns)


def test_status(fake_claude, monkeypatch):
    exe, _ = fake_claude
    monkeypatch.setattr(claude_code_engine, "find_claude", lambda: exe)
    assert claude_code_engine.check_status() == (True, "Ready: logged in with your Claude account.")
    monkeypatch.setenv("FAKE_AUTH", "none")
    assert claude_code_engine.check_status()[0] is False
    monkeypatch.setattr(claude_code_engine, "find_claude", lambda: None)
    assert claude_code_engine.check_status() == (False, "Claude Code isn't installed yet.")


def test_full_run_through_claude_code(fake_claude):
    exe, calls = fake_claude
    df, columns = sample()
    client = claude_code_engine.ClaudeCodeClient(exe)
    result, summary, topic_map, _ = qc_engine.run_qc(
        df, columns, client, model="claude-sonnet-5-5", effort="low", batch_size=10, workers=2,
    )
    assert list(result["QC_Gender"]) == ["Female", "Female"]
    assert list(result["QC_Flags"]) == ["Gender, Sentiment", ""]
    assert list(result["Unified_Topic"]) == ["Service", "Service"]

    made = calls()
    assert len(made) == 2  # one topic call, one batch of rows
    row_call = next(c for c in made if "rows" in c["payload"])
    args = row_call["args"]
    assert args[0] == "-p"
    assert args[args.index("--model") + 1] == "sonnet"
    assert args[args.index("--effort") + 1] == "low"
    assert args[args.index("--output-format") + 1] == "json"
    assert "--json-schema" in args and "--no-session-persistence" in args
    assert "Bash" in args[args.index("--disallowedTools") + 1]
    assert row_call["api_key"] is False  # the subscription login is used, not an API key
    assert "sarcasm" in row_call["system"].lower()
    assert row_call["payload"]["rows"][1]["text"] == "خدمة ممتازة"  # Arabic survives the trip
    assert os.path.basename(row_call["cwd"]) != "excel_qc"  # runs in an empty temp folder


def test_answer_without_schema_flag_is_parsed(fake_claude, monkeypatch):
    exe, calls = fake_claude
    # Pretend it's an npm .cmd launcher: the schema goes into the instructions instead,
    # and the answer comes back as text with the JSON inside.
    client = claude_code_engine.ClaudeCodeClient(exe + ".cmd")
    original_run = claude_code_engine.subprocess.run

    def run(cmd, **kwargs):
        return original_run([exe] + cmd[1:], **kwargs)

    monkeypatch.setattr(claude_code_engine.subprocess, "run", run)
    df, columns = sample()
    columns["topic"] = None
    result, *_ = qc_engine.run_qc(df, columns, client, model="claude-haiku-5-5")
    assert list(result["QC_Gender"]) == ["Female", "Female"]  # parsed from the text answer
    assert list(result["QC_Status"]) == ["Check", "OK"]
    call = calls()[0]
    assert "--json-schema" not in call["args"]
    assert "JSON Schema" in call["system"]


def test_usage_limit_marks_rows_as_error(fake_claude, monkeypatch):
    exe, _ = fake_claude
    monkeypatch.setenv("FAKE_FAIL", "Claude usage limit reached. Your limit will reset at 5pm")
    df, columns = sample()
    columns["topic"] = None
    result, *_ = qc_engine.run_qc(df, columns, claude_code_engine.ClaudeCodeClient(exe))
    assert set(result["QC_Status"]) == {"Error"}
    assert "Usage limit reached" in result.loc[0, "QC_Flags"]


def test_parse_json_text():
    assert claude_code_engine.parse_json_text('Sure!\n```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(ValueError):
        claude_code_engine.parse_json_text("no json here")


def test_missing_claude_code(monkeypatch):
    monkeypatch.setattr(claude_code_engine, "find_claude", lambda: None)
    with pytest.raises(RuntimeError, match="isn't installed"):
        claude_code_engine.ClaudeCodeClient()
