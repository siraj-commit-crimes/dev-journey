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
    "brand": ["brand", "query", "keyword", "search term", "project", "client"],
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

2. Sentiment: Positive, Negative or Neutral, judged toward the TARGET BRAND only,
   not the general mood of the post.
   - target_brand is the row's "brand" field when it has one. Otherwise it is the client
     from the brand list if the post mentions the client, otherwise the first monitored
     brand the post mentions. With no brand list and no row brand, target_brand is ""
     and you judge the post's overall sentiment.
   - Complaints or praise about something other than the target brand do not count:
     "the food was great but the delivery app was slow" is Positive for the restaurant
     and Negative for the delivery app.
   - Comparisons count from the target brand's side: "STC is better than Mobily" is
     Positive for STC and Negative for Mobily.
   - Read emojis as part of the meaning (😂 can mock, 🙄 is annoyed, 💔 is sad, 🔥 is usually praise).
   - Watch for sarcasm: praise words used to complain ("great service, only waited 3 hours 👏")
     are Negative. Set sarcasm to true when the literal words and the real meaning differ.
   - Neutral is for news, questions, ads and plain information with no opinion.
   - Judge the author's attitude toward the subject, not just positive or negative words.

3. Brands: brands_mentioned lists every brand from the brand list that the post talks
   about (match Arabic and English spellings, nicknames and handles; use the brand's
   main name). brand_sentiments gives the sentiment toward each of those brands.
   relevant is false when the post is not really about the target brand or any
   monitored brand (noise picked up by the search query). With no brand list and no
   row brand, return empty lists and relevant true.

4. Topic: check whether the row's current topic actually describes the text.
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
                    "target_brand": {"type": "string"},
                    "brands_mentioned": {"type": "array", "items": {"type": "string"}},
                    "brand_sentiments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "brand": {"type": "string"},
                                "sentiment": {"type": "string", "enum": SENTIMENTS},
                            },
                            "required": ["brand", "sentiment"],
                            "additionalProperties": False,
                        },
                    },
                    "relevant": {"type": "boolean"},
                    "topic_fits": {"type": "boolean"},
                    "suggested_topic": {"type": "string"},
                },
                "required": [
                    "id", "gender", "gender_reason", "sentiment", "sarcasm",
                    "sentiment_reason", "target_brand", "brands_mentioned",
                    "brand_sentiments", "relevant", "topic_fits", "suggested_topic",
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
    if value is None:
        return ""
    try:
        if pd.isna(value):  # NaN, pd.NA, NaT
            return ""
    except (TypeError, ValueError):  # lists and other values pd.isna can't answer for
        pass
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


def parse_brands(text):
    """Read the brand list from the sidebar.

    Each line is "Client: STC, اس تي سي, stc_ksa" or "Competitor: Mobily, موبايلي".
    The first name is the brand's main name, the rest are other spellings.
    Lines without "Client:" or "Competitor:" count as competitors.
    """
    brands = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        role = "Competitor"
        head, sep, rest = line.partition(":")
        if sep and head.strip().lower() in ("client", "competitor"):
            role = head.strip().title()
            line = rest
        names = [n.strip() for n in line.split(",") if n.strip()]
        if names:
            brands.append({"name": names[0], "role": role, "aliases": names[1:]})
    return brands


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

def check_batch(client, rows, topic_list, model=DEFAULT_MODEL, effort="medium", brands=None):
    """rows: list of dicts with id, text, author, handle, brand, topic. Returns {id: result}."""
    payload = {"brand_list": brands or [], "allowed_topics": topic_list, "rows": rows}
    answer = ask_claude(
        client, model, effort, ROW_SYSTEM_PROMPT,
        json.dumps(payload, ensure_ascii=False), ROW_SCHEMA,
    )
    return {item["id"]: item for item in answer["results"]}


def run_qc(df, columns, client, model=DEFAULT_MODEL, effort="medium", batch_size=20,
           allowed_topics=None, brands=None, workers=4, progress=None):
    """Run the full QC on a DataFrame.

    columns: dict from guess_columns (the user can fix it in the app). "text" is required.
    brands: list from parse_brands. Sentiment is judged toward the row's brand (brand
            column) or the client; competitors get their own sentiment.
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
    row_brands = column_values("brand")

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
        {"id": i, "text": texts[i], "author": authors[i], "handle": handles[i],
         "brand": row_brands[i], "topic": unified[i]}
        for i in range(total)
    ]
    batches = [rows[i:i + batch_size] for i in range(0, total, batch_size)]
    answers = {}
    errors = {}
    done = 0
    report(0, total, "Checking rows...")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(check_batch, client, batch, topic_list, model, effort, brands): batch
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
    check_brands = bool(brands or columns.get("brand"))
    new_cols = {name: [] for name in [
        "QC_Status", "QC_Flags", "Unified_Topic", "QC_Topic", "QC_Topic_Fits",
        "QC_Gender", "QC_Gender_Reason", "QC_Sentiment", "QC_Sarcasm", "QC_Sentiment_Reason",
        "QC_Target_Brand", "QC_Relevant", "QC_Brands_Mentioned", "QC_Sentiment_By_Brand",
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
        if check_brands and not item["relevant"]:
            flags.append("Irrelevant")

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
        new_cols["QC_Target_Brand"].append(item["target_brand"])
        new_cols["QC_Relevant"].append("Yes" if item["relevant"] else "No")
        new_cols["QC_Brands_Mentioned"].append(", ".join(item["brands_mentioned"]))
        new_cols["QC_Sentiment_By_Brand"].append(
            " | ".join(f"{b['brand']}: {b['sentiment']}" for b in item["brand_sentiments"])
        )

    if not columns.get("topic"):
        del new_cols["Unified_Topic"]
        del new_cols["QC_Topic_Fits"]
    if not check_brands:
        del new_cols["QC_Target_Brand"]
        del new_cols["QC_Relevant"]
    if not brands:
        del new_cols["QC_Brands_Mentioned"]
        del new_cols["QC_Sentiment_By_Brand"]
    for name, values in new_cols.items():
        result[name] = values

    summary = build_summary(result, columns)
    brand_df = build_brand_sentiment(result)
    topic_map_df = pd.DataFrame(
        [{"Original_Topic": k, "Unified_Topic": v, "Rows": topics.count(k)} for k, v in topic_map.items()]
    )
    if not topic_map_df.empty:
        topic_map_df = topic_map_df.sort_values(["Unified_Topic", "Rows"], ascending=[True, False])
    return result, summary, topic_map_df, brand_df


def build_brand_sentiment(result):
    """Count Positive/Negative/Neutral per brand, for client vs competitor comparison."""
    if "QC_Sentiment_By_Brand" not in result:
        return pd.DataFrame()
    counts = {}
    for cell in result["QC_Sentiment_By_Brand"]:
        for part in clean(cell).split(" | "):
            brand, _, sentiment = part.rpartition(": ")
            if brand and sentiment in SENTIMENTS:
                counts.setdefault(brand, dict.fromkeys(SENTIMENTS, 0))[sentiment] += 1
    rows = []
    for brand, c in counts.items():
        total = sum(c.values())
        net = (c["Positive"] - c["Negative"]) / total * 100 if total else 0
        rows.append({"Brand": brand, **c, "Mentions": total, "Net_Sentiment": f"{net:.0f}%"})
    df = pd.DataFrame(rows)
    return df.sort_values("Mentions", ascending=False) if not df.empty else df


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
    if "QC_Relevant" in result:
        n = (result["QC_Relevant"] == "No").sum()
        lines.append(("Irrelevant posts (not about the brands)", n, pct(n)))
    sarcastic = (result["QC_Sarcasm"] == "Yes").sum()
    lines.append(("Sarcastic posts found", sarcastic, pct(sarcastic)))
    if "Unified_Topic" in result:
        before = result[columns["topic"]].map(clean).replace("", pd.NA).nunique()
        after = result["Unified_Topic"].replace("", pd.NA).nunique()
        lines.append(("Topics before unifying", before, ""))
        lines.append(("Topics after unifying", after, ""))
    return pd.DataFrame(lines, columns=["Check", "Count", "Note"])


# ---------- step 4: review ----------

REVIEW_KINDS = ["Gender", "Sentiment", "Topic", "Irrelevant"]
RELEVANCE = ["Relevant", "Irrelevant"]


def review_table(result, columns, kind):
    """The flagged rows for one kind of check, ready to review.

    Returns a DataFrame indexed like result with Row, Text, Original, Suggested, Reason.
    """
    flagged = result["QC_Flags"].fillna("").str.split(", ").map(lambda f: kind in f)
    rows = result[flagged & (result["QC_Status"] == "Check")]
    table = pd.DataFrame(index=rows.index)
    table["Row"] = rows.index + 2  # the row number in Excel (row 1 is the header)
    table["Text"] = rows[columns["text"]].map(clean)
    if kind == "Gender":
        table["Original"] = rows[columns["gender"]].map(clean)
        table["Suggested"] = rows["QC_Gender"]
        table["Reason"] = rows["QC_Gender_Reason"]
    elif kind == "Sentiment":
        table["Original"] = rows[columns["sentiment"]].map(clean)
        table["Suggested"] = rows["QC_Sentiment"]
        sarcasm = rows["QC_Sarcasm"].map(lambda v: "Sarcasm. " if v == "Yes" else "")
        table["Reason"] = sarcasm + rows["QC_Sentiment_Reason"]
    elif kind == "Topic":
        table["Original"] = rows["Unified_Topic"]
        table["Suggested"] = rows["QC_Topic"]
        table["Reason"] = "The topic doesn't match the text"
    else:
        table["Original"] = "Relevant"
        table["Suggested"] = "Irrelevant"
        target = rows.get("QC_Target_Brand", pd.Series("", index=rows.index)).map(clean)
        table["Reason"] = target.map(
            lambda t: f"Not really about {t}" if t else "Doesn't mention any monitored brand"
        )
    return table


def review_options(table, kind, extra=()):
    """The values the reviewer can pick for the Final column."""
    base = {"Gender": GENDERS, "Sentiment": SENTIMENTS, "Irrelevant": RELEVANCE}.get(kind, [])
    values = list(base) + list(table["Original"]) + list(table["Suggested"]) + list(extra)
    return list(dict.fromkeys(v for v in values if clean(v)))


def apply_topic_map(result, columns, mapping):
    """Recompute Unified_Topic after the reviewer edits the topic mapping."""
    if not columns.get("topic") or "Unified_Topic" not in result:
        return result
    result = result.copy()
    result["Unified_Topic"] = [mapping.get(clean(t), clean(t)) for t in result[columns["topic"]]]
    return result


def build_final(result, columns, decisions):
    """Apply the reviewer's decisions.

    decisions: {"Gender": {row_index: "Female"}, "Sentiment": {...}, ...}
    Flagged values that weren't reviewed keep the original value.
    Returns (result with Final_* and Review_Status columns, final data with the
    original columns and the final values filled in).
    """
    out = result.copy()
    original_cols = [
        c for c in result.columns
        if not str(c).startswith(("QC_", "Final_")) and c not in ("Unified_Topic", "Review_Status")
    ]
    finals = {
        "Gender": (columns.get("gender"), "Final_Gender"),
        "Sentiment": (columns.get("sentiment"), "Final_Sentiment"),
        "Topic": ("Unified_Topic" if columns.get("topic") else None, "Final_Topic"),
    }
    final_data = result[original_cols].copy()
    for kind, (source, final_col) in finals.items():
        if not source:
            continue
        chosen = decisions.get(kind, {})
        out[final_col] = [chosen.get(i, clean(v)) for i, v in out[source].items()]
        target = columns["topic"] if kind == "Topic" else source
        final_data[target] = out[final_col]
    if "QC_Relevant" in out:
        chosen = decisions.get("Irrelevant", {})
        out["Final_Relevant"] = [chosen.get(i, "Relevant") for i in out.index]
        final_data["Relevant"] = out["Final_Relevant"]

    statuses = []
    for i, (status, flags) in out[["QC_Status", "QC_Flags"]].iterrows():
        if status != "Check":
            statuses.append(status)
            continue
        kinds = [k for k in clean(flags).split(", ") if k]
        done = sum(i in decisions.get(k, {}) for k in kinds)
        statuses.append("Reviewed" if done == len(kinds) else "Partly reviewed" if done else "Not reviewed")
    out["Review_Status"] = statuses
    return out, final_data


def review_counts(result, columns, decisions):
    """{kind: (reviewed, total)} for every kind that has flagged rows."""
    counts = {}
    for kind in REVIEW_KINDS:
        if kind == "Gender" and not columns.get("gender"):
            continue
        if kind == "Sentiment" and not columns.get("sentiment"):
            continue
        if kind == "Topic" and not columns.get("topic"):
            continue
        if kind == "Irrelevant" and "QC_Relevant" not in result:
            continue
        rows = review_table(result, columns, kind).index
        if len(rows):
            chosen = decisions.get(kind, {})
            counts[kind] = (sum(i in chosen for i in rows), len(rows))
    return counts


# ---------- step 5: write the Excel file ----------

YELLOW = PatternFill("solid", start_color="FFF2CC")
RED = PatternFill("solid", start_color="F8CBAD")
GREEN = PatternFill("solid", start_color="E2EFDA")
HEADER = PatternFill("solid", start_color="D9E1F2")


def to_excel(result, summary, topic_map_df, columns, brand_df=None, final_data=None):
    """Build the output workbook and return it as bytes (ready for download)."""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Summary", index=False)
        if final_data is not None:
            final_data.to_excel(writer, sheet_name="Final Data", index=False)
        result.to_excel(writer, sheet_name="QC Results", index=False)
        if not topic_map_df.empty:
            topic_map_df.to_excel(writer, sheet_name="Topic Mapping", index=False)
        if brand_df is not None and not brand_df.empty:
            brand_df.to_excel(writer, sheet_name="Brand Sentiment", index=False)

        sheet = writer.sheets["QC Results"]
        headers = list(result.columns)
        col_index = {name: headers.index(name) + 1 for name in headers}
        # Which original column and QC column to colour for each kind of flag.
        pairs = {
            "Gender": (columns.get("gender"), "QC_Gender"),
            "Sentiment": (columns.get("sentiment"), "QC_Sentiment"),
            "Topic": (columns.get("topic"), "QC_Topic"),
            "Irrelevant": (None, "QC_Relevant"),
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

        # In Final Data, colour the cells the review changed.
        if final_data is not None:
            final_sheet = writer.sheets["Final Data"]
            final_headers = list(final_data.columns)
            for col in (columns.get("gender"), columns.get("sentiment"), columns.get("topic")):
                if not col or col not in final_headers:
                    continue
                col_num = final_headers.index(col) + 1
                before = result[col].map(clean).tolist()
                for row_num, (old, new) in enumerate(zip(before, final_data[col].map(clean)), start=2):
                    if old != new:
                        final_sheet.cell(row_num, col_num).fill = GREEN

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
