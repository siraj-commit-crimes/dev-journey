"""QC engine: checks gender, sentiment and topics in an Excel sheet using Claude.

The Streamlit app (app.py) is just the UI. All the real work happens here,
so you can also import these functions in a notebook or another script.
"""

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

import anthropic
import pandas as pd
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

DEFAULT_MODEL = "claude-opus-5-5"

GENDERS = ["Male", "Female", "Unknown"]
SENTIMENTS = ["Positive", "Negative", "Neutral"]

# Words we look for in the column headers to guess which column is which.
COLUMN_HINTS = {
    "text": ["text", "content", "post", "comment", "message", "tweet", "body", "mention", "snippet"],
    "handle": ["handle", "screen name", "username", "account"],
    "author": ["author", "attribute", "full name", "display name", "user name", "name"],
    "gender": ["gender", "sex"],
    "sentiment": ["sentiment", "tone", "polarity"],
    "topic": ["topic", "category", "theme", "subject", "tag"],
}

# Different teams write the same label in different ways (M, male, ذكر ...).
GENDER_ALIASES = {
    "male": "Male", "m": "Male", "man": "Male", "ذكر": "Male",
    "female": "Female", "f": "Female", "woman": "Female", "أنثى": "Female", "انثى": "Female",
    "unknown": "Unknown", "u": "Unknown", "n/a": "Unknown", "na": "Unknown", "": "Unknown",
    "غير معروف": "Unknown",
}
SENTIMENT_ALIASES = {
    "positive": "Positive", "pos": "Positive", "إيجابي": "Positive", "ايجابي": "Positive",
    "negative": "Negative", "neg": "Negative", "سلبي": "Negative",
    "neutral": "Neutral", "neu": "Neutral", "محايد": "Neutral",
}

ROW_SYSTEM_PROMPT = """You are a quality-control reviewer for social media monitoring data.
Each row is one post. The text can be Arabic (MSA or Gulf/Saudi dialects), English,
Arabizi (Arabic written in Latin letters and numbers like 7, 3, 5), or a mix.

For every row decide:

1. Gender of the author: Male, Female or Unknown.
   - Use the author name first, then the handle (e.g. "Mohammed", "abu_khalid", "um_sara",
     "noura_99", "سارة").
   - Brands, companies, news outlets, government bodies, fan pages, bots and anything
     you cannot tell with reasonable confidence are Unknown. Do not guess.

2. Sentiment of the text: Positive, Negative or Neutral.
   - Read emojis as part of the meaning (😂 can mock, 🙄 is annoyed, 💔 is sad, 🔥 is usually praise).
   - Watch for sarcasm: praise words used to complain ("great service, only waited 3 hours 👏")
     are Negative. Set sarcasm to true when the literal words and the real meaning differ.
   - Neutral is for news, questions, ads and plain information with no opinion.
   - Judge the author's attitude toward the subject, not just positive or negative words.

3. Topic: check whether the row's current topic actually describes the text.
   - topic_fits is false when the topic is wrong or empty.
   - suggested_topic must be the best topic for the text, chosen from the allowed topic
     list when one is given. If none fits, write a short new topic name.

Keep each reason short (under 15 words), in English.
Return one result for every row id you receive."""

TOPIC_SYSTEM_PROMPT = """You clean up topic labels from social media monitoring data.
You get a list of topic labels with how many rows use each one. Many labels mean the
same thing (different spelling, Arabic vs English, singular vs plural, very narrow
sub-topics). Map every original label to one unified label.

- Merge labels only when they really mean the same subject.
- Use clear, short English names in Title Case for unified labels, unless an allowed
  topic list is given: then every unified label must come from that list.
- Every original label must appear exactly once in the mapping, spelled exactly as given."""

ROW_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "gender": {"type": "string", "enum": GENDERS},
                    "gender_reason": {"type": "string"},
                    "sentiment": {"type": "string", "enum": SENTIMENTS},
                    "sarcasm": {"type": "boolean"},
                    "sentiment_reason": {"type": "string"},
                    "topic_fits": {"type": "boolean"},
                    "suggested_topic": {"type": "string"},
                },
                "required": [
                    "id", "gender", "gender_reason", "sentiment", "sarcasm",
                    "sentiment_reason", "topic_fits", "suggested_topic",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["results"],
    "additionalProperties": False,
}

TOPIC_SCHEMA = {
    "type": "object",
    "properties": {
        "mapping": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "original": {"type": "string"},
                    "unified": {"type": "string"},
                },
                "required": ["original", "unified"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["mapping"],
    "additionalProperties": False,
}


# ---------- helpers ----------

def clean(value):
    """Turn any cell value into a plain string ('' for empty cells)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def normalize_gender(value):
    text = clean(value).lower()
    return GENDER_ALIASES.get(text, clean(value))


def normalize_sentiment(value):
    text = clean(value).lower()
    return SENTIMENT_ALIASES.get(text, clean(value))


def guess_columns(columns):
    """Guess which column holds the text, author, handle, gender, sentiment and topic.

    Returns a dict like {"text": "Content", "gender": "Gender", "handle": None, ...}.
    """
    guesses = {}
    used = set()
    for role, hints in COLUMN_HINTS.items():
        guesses[role] = None
        # Exact header match first, then "header contains the hint".
        for exact in (True, False):
            for hint in hints:
                for col in columns:
                    header = str(col).strip().lower()
                    matched = header == hint if exact else hint in header
                    if matched and col not in used:
                        guesses[role] = col
                        used.add(col)
                        break
                if guesses[role] is not None:
                    break
            if guesses[role] is not None:
                break
    return guesses


def make_client(api_key=None):
    # With no key given, the SDK reads ANTHROPIC_API_KEY from the environment.
    return anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()


def ask_claude(client, model, effort, system, user_content, schema):
    """Send one request and return the parsed JSON answer."""
    request = {
        "model": model,
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": user_content}],
        "output_config": {
            "effort": effort,
            "format": {"type": "json_schema", "schema": schema},
        },
    }
    # Haiku has no server-side fallback; the bigger models re-run a declined
    # request on another model instead of failing.
    if not model.startswith("claude-haiku"):
        request["betas"] = ["server-side-fallback-2026-07-01"]
        request["fallbacks"] = "default"

    response = client.beta.messages.create(**request)

    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined this batch")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("Answer was cut off; try a smaller batch size")
    text = next(block.text for block in response.content if block.type == "text")
    return json.loads(text)


# ---------- step 1: unify topics ----------

def unify_topics(client, topic_counts, model=DEFAULT_MODEL, effort="medium", allowed_topics=None):
    """Map each original topic label to a unified label.

    topic_counts: dict {topic label: number of rows}
    Returns a dict {original: unified}. Labels Claude forgets keep their own name.
    """
    if not topic_counts:
        return {}
    payload = {
        "topics": [{"label": label, "rows": count} for label, count in topic_counts.items()],
        "allowed_topics": allowed_topics or [],
    }
    answer = ask_claude(
        client, model, effort, TOPIC_SYSTEM_PROMPT,
        json.dumps(payload, ensure_ascii=False), TOPIC_SCHEMA,
    )
    mapping = {item["original"]: item["unified"].strip() for item in answer["mapping"]}
    return {label: mapping.get(label) or label for label in topic_counts}


# ---------- step 2: check each row ----------

def check_batch(client, rows, topic_list, model=DEFAULT_MODEL, effort="medium"):
    """rows: list of dicts with id, text, author, handle, topic. Returns {id: result}."""
    payload = {"allowed_topics": topic_list, "rows": rows}
    answer = ask_claude(
        client, model, effort, ROW_SYSTEM_PROMPT,
        json.dumps(payload, ensure_ascii=False), ROW_SCHEMA,
    )
    return {item["id"]: item for item in answer["results"]}


def run_qc(df, columns, client, model=DEFAULT_MODEL, effort="medium", batch_size=20,
           allowed_topics=None, workers=4, progress=None):
    """Run the full QC on a DataFrame.

    columns: dict from guess_columns (the user can fix it in the app). "text" is required.
    progress: optional function(done_rows, total_rows, message) for the progress bar.
    Returns (result_df, summary_df, topic_map_df).
    """
    if not columns.get("text"):
        raise ValueError("Pick the Text/Content column first")

    def report(done, total, message):
        if progress:
            progress(done, total, message)

    df = df.reset_index(drop=True)
    result = df.copy()
    total = len(df)

    def column_values(role):
        col = columns.get(role)
        return [clean(v) for v in df[col]] if col else [""] * total

    texts = column_values("text")
    authors = column_values("author")
    handles = column_values("handle")
    topics = column_values("topic")

    # Step 1: unify topic labels across the whole file.
    topic_map = {}
    if columns.get("topic"):
        report(0, total, "Unifying topics...")
        counts = pd.Series([t for t in topics if t]).value_counts().to_dict()
        topic_map = unify_topics(client, counts, model, effort, allowed_topics)
    unified = [topic_map.get(t, t) for t in topics]
    topic_list = allowed_topics or sorted({t for t in unified if t})

    # Step 2: send rows to Claude in batches, a few batches at a time.
    rows = [
        {"id": i, "text": texts[i], "author": authors[i], "handle": handles[i], "topic": unified[i]}
        for i in range(total)
    ]
    batches = [rows[i:i + batch_size] for i in range(0, total, batch_size)]
    answers = {}
    errors = {}
    done = 0
    report(0, total, "Checking rows...")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(check_batch, client, batch, topic_list, model, effort): batch
            for batch in batches
        }
        for future in as_completed(futures):
            batch = futures[future]
            try:
                answers.update(future.result())
            except Exception as error:  # keep going; mark these rows instead
                for row in batch:
                    errors[row["id"]] = str(error)
            done += len(batch)
            report(done, total, f"Checked {done} of {total} rows")

    # Step 3: compare Claude's answers with what is in the file.
    original_gender = column_values("gender")
    original_sentiment = column_values("sentiment")
    new_cols = {name: [] for name in [
        "QC_Status", "QC_Flags", "Unified_Topic", "QC_Topic", "QC_Topic_Fits",
        "QC_Gender", "QC_Gender_Reason", "QC_Sentiment", "QC_Sarcasm", "QC_Sentiment_Reason",
    ]}
    for i in range(total):
        item = answers.get(i)
        if item is None:
            new_cols["QC_Status"].append("Error")
            new_cols["QC_Flags"].append(errors.get(i, "No answer for this row"))
            new_cols["Unified_Topic"].append(unified[i])
            for name in list(new_cols)[3:]:
                new_cols[name].append("")
            continue

        flags = []
        if columns.get("gender") and normalize_gender(original_gender[i]) != item["gender"]:
            flags.append("Gender")
        if columns.get("sentiment") and normalize_sentiment(original_sentiment[i]) != item["sentiment"]:
            flags.append("Sentiment")
        if columns.get("topic") and not item["topic_fits"]:
            flags.append("Topic")

        new_cols["QC_Status"].append("Check" if flags else "OK")
        new_cols["QC_Flags"].append(", ".join(flags))
        new_cols["Unified_Topic"].append(unified[i])
        new_cols["QC_Topic"].append(item["suggested_topic"])
        new_cols["QC_Topic_Fits"].append("Yes" if item["topic_fits"] else "No")
        new_cols["QC_Gender"].append(item["gender"])
        new_cols["QC_Gender_Reason"].append(item["gender_reason"])
        new_cols["QC_Sentiment"].append(item["sentiment"])
        new_cols["QC_Sarcasm"].append("Yes" if item["sarcasm"] else "")
        new_cols["QC_Sentiment_Reason"].append(item["sentiment_reason"])

    if not columns.get("topic"):
        del new_cols["Unified_Topic"]
        del new_cols["QC_Topic_Fits"]
    for name, values in new_cols.items():
        result[name] = values

    summary = build_summary(result, columns)
    topic_map_df = pd.DataFrame(
        [{"Original_Topic": k, "Unified_Topic": v, "Rows": topics.count(k)} for k, v in topic_map.items()]
    )
    if not topic_map_df.empty:
        topic_map_df = topic_map_df.sort_values(["Unified_Topic", "Rows"], ascending=[True, False])
    return result, summary, topic_map_df


def build_summary(result, columns):
    total = len(result)
    flags = result["QC_Flags"].fillna("")
    checked = result["QC_Status"] != "Error"

    def pct(n):
        return f"{(n / total * 100):.1f}%" if total else "0%"

    lines = [("Total rows", total, ""), ("Rows OK", (result["QC_Status"] == "OK").sum(), "")]
    lines.append(("Rows to check", (result["QC_Status"] == "Check").sum(), ""))
    lines.append(("Rows with errors", (~checked).sum(), "Re-run these rows"))
    for kind in ["Gender", "Sentiment", "Topic"]:
        role = kind.lower()
        if columns.get(role):
            n = (checked & flags.str.contains(kind)).sum()
            lines.append((f"{kind} mismatches", n, pct(n)))
    sarcastic = (result["QC_Sarcasm"] == "Yes").sum()
    lines.append(("Sarcastic posts found", sarcastic, pct(sarcastic)))
    if "Unified_Topic" in result:
        before = result[columns["topic"]].map(clean).replace("", pd.NA).nunique()
        after = result["Unified_Topic"].replace("", pd.NA).nunique()
        lines.append(("Topics before unifying", before, ""))
        lines.append(("Topics after unifying", after, ""))
    return pd.DataFrame(lines, columns=["Check", "Count", "Note"])


# ---------- step 4: write the Excel file ----------

YELLOW = PatternFill("solid", start_color="FFF2CC")
RED = PatternFill("solid", start_color="F8CBAD")
GREEN = PatternFill("solid", start_color="E2EFDA")
HEADER = PatternFill("solid", start_color="D9E1F2")


def to_excel(result, summary, topic_map_df, columns):
    """Build the output workbook and return it as bytes (ready for download)."""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Summary", index=False)
        result.to_excel(writer, sheet_name="QC Results", index=False)
        if not topic_map_df.empty:
            topic_map_df.to_excel(writer, sheet_name="Topic Mapping", index=False)

        sheet = writer.sheets["QC Results"]
        headers = list(result.columns)
        col_index = {name: headers.index(name) + 1 for name in headers}
        # Which original column and QC column to colour for each kind of flag.
        pairs = {
            "Gender": (columns.get("gender"), "QC_Gender"),
            "Sentiment": (columns.get("sentiment"), "QC_Sentiment"),
            "Topic": (columns.get("topic"), "QC_Topic"),
        }
        for row_num, (status, flags) in enumerate(zip(result["QC_Status"], result["QC_Flags"]), start=2):
            sheet.cell(row_num, col_index["QC_Status"]).fill = (
                GREEN if status == "OK" else RED if status == "Error" else YELLOW
            )
            if status != "Check":
                continue
            for kind, (original_col, qc_col) in pairs.items():
                if kind in flags:
                    if original_col:
                        sheet.cell(row_num, col_index[original_col]).fill = RED
                    sheet.cell(row_num, col_index[qc_col]).fill = YELLOW

        for ws in writer.sheets.values():
            for cell in ws[1]:
                cell.font = Font(bold=True)
                cell.fill = HEADER
            ws.freeze_panes = "A2"
            ws.auto_filter.ref = ws.dimensions
            for i, column_cells in enumerate(ws.iter_cols(max_row=min(ws.max_row, 200)), start=1):
                longest = max(len(clean(c.value)) for c in column_cells)
                ws.column_dimensions[get_column_letter(i)].width = min(max(longest + 2, 10), 60)
    return buffer.getvalue()
