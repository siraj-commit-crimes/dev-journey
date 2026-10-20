"""Excel QC tool - upload a sheet, check gender, sentiment, brands and topics, review, download.

Run it with:  streamlit run excel_qc/app.py   (or double-click a Start Excel QC file)
"""

import os
from io import BytesIO

import pandas as pd
import streamlit as st

import offline_engine
import qc_engine
import ui

MODELS = {
    "Opus 5.5 · best quality": "claude-opus-5-5",
    "Sonnet 5.5 · cheaper": "claude-sonnet-5-5",
    "Haiku 5.5 · cheapest, fastest": "claude-haiku-5-5",
}
STEPS = ["Upload", "Columns", "Setup", "Review & download"]
TO_REVIEW = "To review"  # shown in the Final column until the reviewer picks a value
ROLE_LABELS = {
    "text": ("Text / Content", "The post itself. Required."),
    "author": ("Author name", "Used to guess gender."),
    "handle": ("Handle", "Used to guess gender when the name doesn't help."),
    "gender": ("Gender", "The team's gender labels to check."),
    "sentiment": ("Sentiment", "The team's sentiment labels to check."),
    "topic": ("Topic", "The team's topic labels to check and merge."),
    "brand": ("Brand / Query", "Which brand each row is about, if the sheet says."),
}

st.set_page_config(page_title="Excel QC", page_icon="✅", layout="wide")
ui.style()

ss = st.session_state
ss.setdefault("step", 1)
ss.setdefault("decisions", {})
ss.setdefault("editor_version", 0)


def go(step):
    ss.step = step


def start_over():
    for key in list(ss.keys()):
        del ss[key]


@st.cache_data(show_spinner=False)
def read_sheet(data, name, sheet):
    if name.lower().endswith(".csv"):
        return pd.read_csv(BytesIO(data))
    return pd.read_excel(BytesIO(data), sheet_name=sheet)


@st.cache_data(show_spinner=False)
def sheet_names(data, name):
    if name.lower().endswith(".csv"):
        return [None]
    return pd.ExcelFile(BytesIO(data)).sheet_names


# ---------- sidebar ----------
with st.sidebar:
    st.markdown("### ⚙️ Settings")
    mode = st.segmented_control(
        "Checking mode", ["Claude AI", "Offline"], default="Claude AI", key="mode",
        help="Claude reads every post like a person. Offline uses word and name lists: free, but much weaker.",
    ) or "Claude AI"
    offline = mode == "Offline"
    api_key = ""
    model, effort, batch_size = "offline", "medium", 20
    if offline:
        st.info(
            "**Offline mode** is free and needs no key, but it misses most sarcasm and "
            "dialect, can't merge Arabic with English topics, and doesn't check whether "
            "a topic fits the text."
        )
    else:
        api_key = st.text_input(
            "API key", type="password", placeholder="sk-ant-...",
            help="From console.anthropic.com → API Keys. Not saved anywhere.",
        )
        model = MODELS[st.selectbox("Model", list(MODELS))]
        with st.expander("Advanced"):
            effort = st.select_slider(
                "Thinking effort", ["low", "medium", "high"], value="medium",
                help="Higher catches more sarcasm but is slower and costs more.",
            )
            batch_size = st.slider(
                "Rows per request", 5, 50, 20,
                help="How many rows go to Claude in one message. Smaller = more careful.",
            )
    has_key = offline or bool(api_key or os.environ.get("ANTHROPIC_API_KEY"))
    if not has_key:
        st.warning("Add an API key, or switch to Offline.")
    st.divider()
    if ss.get("file_name"):
        st.caption(f"📄 {ss.file_name}")
    st.button("↺ Start over", on_click=start_over, width="stretch")


# ---------- header ----------
ui.header()
ui.stepper(STEPS, ss.step)


# ---------- step 1: upload ----------
if ss.step == 1:
    with st.container(border=True):
        ui.section("Upload the sheet", "Excel (.xlsx) or CSV, straight from the other team.")
        uploaded = st.file_uploader("Excel file", type=["xlsx", "xls", "csv"], label_visibility="collapsed")
        if uploaded is not None:
            data = uploaded.getvalue()
            file_id = f"{uploaded.name}-{len(data)}"
            if ss.get("file_id") != file_id:
                # A new file: forget everything from the last one (but keep the mode).
                for key in [k for k in ss.keys() if k != "mode"]:
                    del ss[key]
                ss.step, ss.decisions, ss.editor_version = 1, {}, 0
                ss.file_id, ss.file_bytes, ss.file_name = file_id, data, uploaded.name
        if ss.get("file_bytes"):
            sheets = sheet_names(ss.file_bytes, ss.file_name)
            if len(sheets) > 1:
                current = ss.get("sheet", sheets[0])
                ss.sheet = st.selectbox("Sheet", sheets, index=sheets.index(current) if current in sheets else 0)
            else:
                ss.sheet = sheets[0]
            df = read_sheet(ss.file_bytes, ss.file_name, ss.sheet)
            if ss.get("df_sheet") != ss.sheet:
                ss.pop("columns", None)
            ss.df, ss.df_sheet = df, ss.sheet
            ui.chips([f"{len(df):,} rows", f"{len(df.columns)} columns", ss.file_name])
            with st.expander("Preview the first rows"):
                st.dataframe(df.head(20), width="stretch", hide_index=True)
    st.button("Next: columns →", type="primary", disabled="df" not in ss, on_click=go, args=(2,))


# ---------- step 2: columns ----------
elif ss.step == 2:
    df = ss.df
    if "columns" not in ss:
        ss.columns = qc_engine.guess_columns(df.columns)
    options = ["—"] + list(df.columns)
    chosen = {}
    with st.container(border=True):
        ui.section("Match the columns", "I guessed these from the headers. Fix any that are wrong.")
        grid = st.columns(3)
        for i, (role, (label, help_text)) in enumerate(ROLE_LABELS.items()):
            current = ss.columns.get(role)
            index = options.index(current) if current in options else 0
            pick = grid[i % 3].selectbox(label, options, index=index, help=help_text, key=f"pick_{role}")
            chosen[role] = None if pick == "—" else pick
        mapped = {ROLE_LABELS[r][0]: c for r, c in chosen.items() if c}
        if mapped:
            st.markdown("**How it looks**")
            preview = df[list(mapped.values())].head(5)
            preview.columns = list(mapped.keys())
            st.dataframe(preview, width="stretch", hide_index=True)
    if not chosen["text"]:
        st.warning("Pick the Text / Content column to continue.")

    def save_columns(step):
        ss.columns = chosen
        go(step)

    back, nxt, _ = st.columns([1, 1.4, 5])
    back.button("← Back", on_click=save_columns, args=(1,), width="stretch")
    nxt.button(
        "Next: setup →", type="primary", disabled=not chosen["text"],
        on_click=save_columns, args=(3,), width="stretch",
    )


# ---------- step 3: setup ----------
elif ss.step == 3:
    df = ss.df
    columns = ss.columns
    ss.setdefault("brands_base", pd.DataFrame(
        [{"Role": "Client", "Brand": "", "Other spellings & handles": ""}]
    ))
    left, right = st.columns([3, 2], gap="medium")
    with left, st.container(border=True):
        ui.section(
            "Client and competitors",
            "Sentiment is judged toward these brands, not the general mood of the post. "
            "Add Arabic spellings, nicknames and handles, separated by commas.",
        )
        brands_df = st.data_editor(
            ss.brands_base, key="brands_editor", num_rows="dynamic", hide_index=True,
            width="stretch",
            column_config={
                "Role": st.column_config.SelectboxColumn(
                    options=["Client", "Competitor"], required=True, default="Competitor", width="small",
                ),
                "Brand": st.column_config.TextColumn(help="Main name, e.g. STC", default=""),
                "Other spellings & handles": st.column_config.TextColumn(
                    help="e.g. اس تي سي, stc_ksa", default="",
                ),
            },
        )
        brands = [
            {
                "name": qc_engine.clean(r["Brand"]),
                "role": r["Role"] or "Competitor",
                "aliases": [
                    a.strip() for a in qc_engine.clean(r["Other spellings & handles"]).split(",") if a.strip()
                ],
            }
            for _, r in brands_df.iterrows() if qc_engine.clean(r["Brand"])
        ]
        if not brands:
            st.caption("No brands yet: sentiment will be the post's overall mood.")
    with right, st.container(border=True):
        ui.section("Topics", "Optional: your team's approved topic list, one per line.")
        topics_text = st.text_area(
            "Approved topics", value=ss.get("topics_text", ""), height=150,
            label_visibility="collapsed", placeholder="Customer Service\nPricing\nNetwork",
        )
    allowed_topics = [t.strip() for t in topics_text.splitlines() if t.strip()]

    with st.container(border=True):
        ui.section("Run", "Start with a small sample to check the quality (and cost), then run everything.")
        size = st.radio(
            "Rows to check", ["First 50 rows (test)", "All rows", "Custom"], horizontal=True,
            label_visibility="collapsed",
        )
        limit = {"First 50 rows (test)": 50, "All rows": len(df)}.get(size)
        if limit is None:
            limit = st.number_input("Number of rows", 1, len(df), min(200, len(df)))
        limit = min(limit, len(df))
        ui.chips([
            f"{limit:,} of {len(df):,} rows",
            "Offline rules" if offline else model,
            f"{len(brands)} brand(s)",
            f"{len(allowed_topics)} approved topic(s)",
        ])

    def leave_setup(step):
        ss.brands_base = brands_df
        ss.topics_text = topics_text
        go(step)

    back, run, _ = st.columns([1, 1.4, 5])
    back.button("← Back", on_click=leave_setup, args=(2,), width="stretch")
    if run.button("▶ Run QC", type="primary", disabled=not has_key, width="stretch"):
        bar = st.progress(0.0, text="Starting...")

        def show_progress(done, total, message):
            bar.progress(done / total if total else 1.0, text=message)

        try:
            client = offline_engine.OfflineClient() if offline else qc_engine.make_client(api_key or None)
            result, summary, topic_map, brand_df = qc_engine.run_qc(
                df.head(limit), columns, client, model=model, effort=effort,
                batch_size=batch_size, allowed_topics=allowed_topics, brands=brands,
                progress=show_progress,
            )
        except Exception as error:
            st.error(f"QC failed: {error}")
            st.stop()
        mode_label = "Offline rules (no AI)" if offline else model
        summary = pd.concat(
            [pd.DataFrame([("Checked with", None, mode_label)], columns=summary.columns), summary]
        )
        if offline:
            summary.loc[summary["Check"] == "Topic mismatches", "Note"] = "Not checked in offline mode"
        ss.qc = {
            "result": result, "summary": summary, "topic_map": topic_map,
            "brand_df": brand_df, "brands": brands, "offline": offline,
        }
        ss.decisions, ss.editor_version = {}, ss.editor_version + 1
        leave_setup(4)
        st.rerun()


# ---------- step 4: review & download ----------
elif ss.step == 4:
    if "qc" not in ss:
        go(3)
        st.rerun()
    qc = ss.qc
    columns = ss.columns
    result = qc["result"]
    if not qc["topic_map"].empty:
        mapping = dict(zip(qc["topic_map"]["Original_Topic"], qc["topic_map"]["Unified_Topic"]))
        result = qc_engine.apply_topic_map(result, columns, mapping)
    counts = qc_engine.review_counts(result, columns, ss.decisions)
    reviewed_items = sum(done for done, _ in counts.values())
    total_items = sum(total for _, total in counts.values())
    irrelevant = (result["QC_Relevant"] == "No").sum() if "QC_Relevant" in result else 0

    ui.metric_cards([
        ("Rows checked", f"{len(result):,}", "neutral"),
        ("Looks OK", f"{(result['QC_Status'] == 'OK').sum():,}", "good"),
        ("To check", f"{(result['QC_Status'] == 'Check').sum():,}", "warn"),
        ("Sarcastic", f"{(result['QC_Sarcasm'] == 'Yes').sum():,}", "neutral"),
        ("Irrelevant", f"{irrelevant:,}", "neutral"),
        ("Reviewed", f"{reviewed_items} / {total_items}", "good" if reviewed_items == total_items else "warn"),
    ])
    errors = (result["QC_Status"] == "Error").sum()
    if errors:
        st.warning(f"{errors} rows couldn't be checked. They're marked Error in the file; try running again.")
    if qc["offline"]:
        st.caption("Checked with offline rules. Treat the suggestions as hints, not answers.")

    tab_review, tab_brands, tab_topics, tab_all = st.tabs(
        [f"✅ Review ({total_items - reviewed_items} left)", "📊 Brands", "🏷️ Topics", "📋 All rows"]
    )

    # --- review ---
    with tab_review:
        if not counts:
            st.success("Nothing to review: every checked row matches. You can download the file below.")
        else:
            kinds = list(counts)
            kind = st.segmented_control(
                "What to review", kinds, default=kinds[0], key="review_kind",
                format_func=lambda k: f"{k} · {counts[k][1] - counts[k][0]} left"
                if counts[k][1] > counts[k][0] else f"{k} · done ✓",
                label_visibility="collapsed",
            ) or kinds[0]
            table = qc_engine.review_table(result, columns, kind)
            extra = []
            if kind == "Topic" and not qc["topic_map"].empty:
                extra = qc["topic_map"]["Unified_Topic"].tolist()
            options = [TO_REVIEW] + qc_engine.review_options(table, kind, extra)

            editor_key = f"review_{kind}_{ss.editor_version}"
            if editor_key not in ss:  # a fresh editor starts from the saved decisions
                ss[f"base_{kind}"] = dict(ss.decisions.get(kind, {}))
            base = table.copy()
            base["Final"] = [ss[f"base_{kind}"].get(i, TO_REVIEW) for i in base.index]

            def bulk(value_from):
                ss.decisions[kind] = (
                    {i: row[value_from] for i, row in table.iterrows() if row[value_from]}
                    if value_from else {}
                )
                ss.editor_version += 1

            st.caption(
                "Pick the **Final** value for each row. Rows left on *To review* keep their "
                "original value in the file."
            )
            b1, b2, b3, _ = st.columns([1.4, 1.4, 0.8, 3])
            b1.button("✓ Accept all suggestions", on_click=bulk, args=("Suggested",), width="stretch")
            b2.button("↩ Keep all originals", on_click=bulk, args=("Original",), width="stretch")
            b3.button("Clear", on_click=bulk, args=(None,), width="stretch")

            edited = st.data_editor(
                base, key=editor_key, hide_index=True, width="stretch",
                height=min(600, 40 + 35 * len(base)),
                disabled=["Row", "Text", "Original", "Suggested", "Reason"],
                column_config={
                    "Row": st.column_config.NumberColumn(width="small", help="Row number in the Excel file"),
                    "Text": st.column_config.TextColumn(width="large"),
                    "Original": st.column_config.TextColumn(width="small"),
                    "Suggested": st.column_config.TextColumn(width="small"),
                    "Reason": st.column_config.TextColumn(width="medium"),
                    "Final": st.column_config.SelectboxColumn(options=options, required=True, width="small"),
                },
            )
            ss.decisions[kind] = {
                i: v for i, v in edited["Final"].items() if qc_engine.clean(v) and v != TO_REVIEW
            }
            done = len(ss.decisions[kind])
            st.progress(done / len(table), text=f"{done} of {len(table)} reviewed")

    # --- brands ---
    with tab_brands:
        brand_df = qc["brand_df"]
        if brand_df.empty:
            st.info("Add a client and competitors in Setup to compare sentiment between brands.")
        else:
            roles = {b["name"]: b["role"] for b in qc["brands"]}
            ui.section("Sentiment by brand", "Share of each brand's mentions. Hover a bar for the counts.")
            st.altair_chart(ui.sentiment_chart(brand_df, roles), width="stretch")
            cols = ["Brand", "Positive", "Neutral", "Negative", "Mentions", "Net_Sentiment"]
            st.dataframe(brand_df[cols], hide_index=True, width="stretch")

    # --- topics ---
    with tab_topics:
        topic_map = qc["topic_map"]
        if topic_map.empty:
            st.info("No topic column was picked, so topics weren't checked.")
        else:
            ui.section(
                "Topic merges",
                "Each original label and the topic it was merged into. Edit the **Unified** "
                "column to rename or re-merge, then click Apply.",
            )
            edited_map = st.data_editor(
                topic_map, hide_index=True, width="stretch", key=f"topics_{ss.editor_version}",
                disabled=["Original_Topic", "Rows"],
                column_config={
                    "Original_Topic": st.column_config.TextColumn("Original"),
                    "Unified_Topic": st.column_config.TextColumn("Unified"),
                },
            )
            if st.button("Apply topic changes"):
                ss.qc["topic_map"] = edited_map
                ss.editor_version += 1
                st.rerun()
            st.caption(f"{topic_map['Original_Topic'].nunique()} labels → {topic_map['Unified_Topic'].nunique()} topics")

    # --- all rows ---
    with tab_all:
        show = st.segmented_control(
            "Show", ["All", "To check", "OK", "Error"], default="All", key="all_filter",
        ) or "All"
        status = {"To check": "Check"}.get(show, show)
        st.dataframe(result if show == "All" else result[result["QC_Status"] == status], width="stretch")

    # --- download ---
    summary = qc["summary"]
    if total_items:
        summary = pd.concat([summary, pd.DataFrame(
            [("Flagged items reviewed", reviewed_items, f"of {total_items}")], columns=summary.columns,
        )])
    with st.container(border=True):
        left, right = st.columns([3, 1.3], vertical_alignment="center")
        with left:
            ui.section(
                "Download",
                "**Final Data** has your decisions filled in, with changed cells in green. "
                "**QC Results** keeps every suggestion and reason.",
            )
            if reviewed_items < total_items:
                st.caption(
                    f"⚠️ {total_items - reviewed_items} flagged items aren't reviewed yet: "
                    "they keep their original values."
                )
        decisions = {kind: dict(chosen) for kind, chosen in ss.decisions.items()}
        topic_map, brand_df = qc["topic_map"], qc["brand_df"]

        def make_file():
            # Built only when Download is clicked, so editing the review stays fast.
            final_result, final_data = qc_engine.build_final(result, columns, decisions)
            return qc_engine.to_excel(final_result, summary, topic_map, columns, brand_df, final_data)

        right.download_button(
            "⬇ Download Excel",
            data=make_file,
            file_name=f"{ss.file_name.rsplit('.', 1)[0]}_QC.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary", width="stretch", on_click="ignore",
        )
    st.button("← Back to setup", on_click=go, args=(3,))
