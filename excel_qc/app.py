"""Excel QC tool - upload a sheet, let Claude check gender, sentiment and topics.

Run it with:  streamlit run excel_qc/app.py
"""

import os

import pandas as pd
import streamlit as st

import offline_engine
import qc_engine

MODELS = {
    "Claude Opus 5.5 (best quality)": "claude-opus-5-5",
    "Claude Sonnet 5.5 (cheaper)": "claude-sonnet-5-5",
    "Claude Haiku 5.5 (cheapest, fastest)": "claude-haiku-5-5",
    "Offline rules (free, no AI)": "offline",
}

st.set_page_config(page_title="Excel QC", page_icon="✅", layout="wide")
st.title("Excel QC")
st.caption("Checks gender, sentiment toward your client and competitors (emojis and sarcasm included) and topics, then gives you back a highlighted Excel file.")

# ---------- sidebar: settings ----------
with st.sidebar:
    st.header("Settings")
    api_key = st.text_input(
        "Anthropic API key",
        type="password",
        help="Leave empty if ANTHROPIC_API_KEY is already set on your computer.",
    )
    model_label = st.selectbox("Model", list(MODELS))
    offline = MODELS[model_label] == "offline"
    has_key = offline or bool(api_key or os.environ.get("ANTHROPIC_API_KEY"))
    if offline:
        st.info(
            "Offline mode uses word and name lists instead of Claude. It's free but much "
            "weaker: it misses most sarcasm and dialect, can't merge Arabic and English "
            "topics, and doesn't check whether a topic fits the text. Use it to catch "
            "obvious mistakes."
        )
    elif not has_key:
        st.warning("Add an API key to run the QC, or pick Offline rules.")
    effort, batch_size = "medium", 20
    if not offline:
        effort = st.select_slider(
            "How hard Claude thinks", ["low", "medium", "high"], value="medium",
            help="Higher catches more sarcasm but is slower and costs more.",
        )
        batch_size = st.slider("Rows per request", 5, 50, 20)
    brands_text = st.text_area(
        "Client and competitors",
        placeholder="Client: STC, اس تي سي, stc_ksa\nCompetitor: Mobily, موبايلي\nCompetitor: Zain, زين",
        help="One brand per line. Start with Client: or Competitor:, then the brand name and any "
             "other spellings or handles, separated by commas. Sentiment is judged toward "
             "these brands, not the general mood of the post.",
    )
    brands = qc_engine.parse_brands(brands_text)
    if not brands:
        st.info("No brands added: sentiment will be the post's overall mood.")
    allowed_text = st.text_area(
        "Approved topic list (optional)",
        help="One topic per line. If you fill this in, every topic is mapped onto this list.",
    )
    allowed_topics = [t.strip() for t in allowed_text.splitlines() if t.strip()]

# ---------- upload ----------
uploaded = st.file_uploader("Upload the Excel file", type=["xlsx", "xls", "csv"])
if not uploaded:
    st.stop()

if uploaded.name.lower().endswith(".csv"):
    df = pd.read_csv(uploaded)
else:
    sheets = pd.ExcelFile(uploaded).sheet_names
    sheet = st.selectbox("Sheet", sheets) if len(sheets) > 1 else sheets[0]
    df = pd.read_excel(uploaded, sheet_name=sheet)

st.write(f"**{len(df)} rows**, {len(df.columns)} columns")
st.dataframe(df.head(10), use_container_width=True)

# ---------- column mapping ----------
st.subheader("Columns")
st.caption("I guessed these from the headers. Fix any that are wrong.")
guesses = qc_engine.guess_columns(df.columns)
options = ["(none)"] + list(df.columns)
labels = {
    "text": "Text / Content (required)",
    "author": "Author name",
    "handle": "Handle",
    "gender": "Gender",
    "sentiment": "Sentiment",
    "brand": "Brand / Query (optional)",
    "topic": "Topic",
}
columns = {}
picker_cols = st.columns(3)
for i, (role, label) in enumerate(labels.items()):
    default = options.index(guesses[role]) if guesses[role] in options else 0
    choice = picker_cols[i % 3].selectbox(label, options, index=default, key=f"col_{role}")
    columns[role] = None if choice == "(none)" else choice

limit = st.number_input(
    "Only check the first N rows (0 = all). Try a small number first to see the quality and cost.",
    min_value=0, max_value=len(df), value=min(50, len(df)),
)

file_id = f"{uploaded.name}-{uploaded.size}"
if st.session_state.get("qc_file") != file_id:
    st.session_state.pop("qc", None)  # new file, forget the old results

if st.button("Run QC", type="primary", disabled=not (columns["text"] and has_key)):
    work_df = df.head(limit) if limit else df
    bar = st.progress(0.0, text="Starting...")

    def show_progress(done, total, message):
        bar.progress(done / total if total else 1.0, text=message)

    try:
        client = offline_engine.OfflineClient() if offline else qc_engine.make_client(api_key or None)
        result, summary, topic_map, brand_sentiment = qc_engine.run_qc(
            work_df, columns, client,
            model=MODELS[model_label], effort=effort, batch_size=batch_size,
            allowed_topics=allowed_topics, brands=brands, progress=show_progress,
        )
    except Exception as error:
        st.error(f"QC failed: {error}")
        st.stop()
    bar.progress(1.0, text="Done")
    mode = "Offline rules (no AI)" if offline else model_label
    summary = pd.concat([pd.DataFrame([("Checked with", None, mode)], columns=summary.columns), summary])
    if offline:
        summary.loc[summary["Check"] == "Topic mismatches", "Note"] = "Not checked in offline mode"
    # Streamlit reruns the whole script on every click (even Download),
    # so keep the results in session_state.
    st.session_state["qc"] = (result, summary, topic_map, brand_sentiment, dict(columns))
    st.session_state["qc_file"] = file_id

if "qc" not in st.session_state:
    st.stop()
result, summary, topic_map, brand_sentiment, columns = st.session_state["qc"]

# ---------- results ----------
st.subheader("Summary")
st.dataframe(summary, hide_index=True)

errors = (result["QC_Status"] == "Error").sum()
if errors:
    st.warning(f"{errors} rows could not be checked. See QC_Flags for the reason.")

st.subheader("Rows to check")
to_check = result[result["QC_Status"] != "OK"]
st.dataframe(to_check, use_container_width=True)

if not brand_sentiment.empty:
    st.subheader("Sentiment by brand")
    st.dataframe(brand_sentiment, hide_index=True, use_container_width=True)

if not topic_map.empty:
    st.subheader("Topic mapping")
    st.dataframe(topic_map, hide_index=True, use_container_width=True)

name = uploaded.name.rsplit(".", 1)[0]
st.download_button(
    "Download QC'd Excel",
    data=qc_engine.to_excel(result, summary, topic_map, columns, brand_sentiment),
    file_name=f"{name}_QC.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    type="primary",
)
