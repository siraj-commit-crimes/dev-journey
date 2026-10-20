"""Look and feel for the Excel QC app: fonts, header, step indicator, cards."""

from html import escape

import altair as alt
import streamlit as st

# Diverging pair: blue = positive, red = negative, gray = neutral in the middle.
SENTIMENT_COLORS = {"Positive": "#2a78d6", "Neutral": "#b4b2a9", "Negative": "#e34948"}

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

.stApp, .stApp p, .stApp label, .stApp input, .stApp textarea, .stApp button,
.stApp h1, .stApp h2, .stApp h3, .stApp h4 {
    font-family: 'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif;
}
.block-container { padding-top: 2rem; max-width: 1200px; }
[data-testid="stSidebar"] { border-right: 1px solid #e6e8f0; }

/* header */
.qc-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.qc-logo {
    width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center;
    background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; font-size: 24px;
    box-shadow: 0 6px 16px rgba(79, 70, 229, .25);
}
.qc-title { font-size: 1.6rem; font-weight: 700; line-height: 1.1; color: #1e293b; }
.qc-subtitle { color: #64748b; font-size: .92rem; }

/* step indicator */
.qc-steps { display: flex; gap: 8px; margin: 4px 0 22px; flex-wrap: wrap; }
.qc-step {
    flex: 1; min-width: 140px; display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 12px; background: #f4f6fb; color: #94a3b8;
    font-weight: 500; font-size: .92rem; border: 1px solid transparent;
}
.qc-step .num {
    width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
    background: #e2e8f0; color: #64748b; font-size: .82rem; font-weight: 700; flex: none;
}
.qc-step.current { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }
.qc-step.current .num { background: #4f46e5; color: white; }
.qc-step.done { color: #334155; }
.qc-step.done .num { background: #c7d2fe; color: #3730a3; }

/* section titles inside cards */
.qc-section { margin-bottom: 10px; }
.qc-section h4 { margin: 0 0 2px; font-size: 1.08rem; font-weight: 600; color: #1e293b; padding: 0; }
.qc-section p { margin: 0; color: #64748b; font-size: .9rem; }

/* chips */
.qc-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 10px; }
.qc-chip {
    background: #f1f5f9; color: #334155; border-radius: 999px; padding: 4px 12px;
    font-size: .85rem; font-weight: 500;
}

/* number cards */
.qc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 18px; }
.qc-card {
    background: white; border: 1px solid #e6e8f0; border-radius: 14px; padding: 14px 16px;
    border-top: 4px solid #cbd5e1;
}
.qc-card.good { border-top-color: #0ca30c; }
.qc-card.warn { border-top-color: #fab219; }
.qc-card .value { font-size: 1.6rem; font-weight: 700; color: #1e293b; line-height: 1.2; }
.qc-card .label { color: #64748b; font-size: .85rem; }

/* buttons */
.stButton button, .stDownloadButton button { border-radius: 10px; font-weight: 500; }
</style>
"""


def style():
    st.markdown(CSS, unsafe_allow_html=True)


def header():
    st.markdown(
        """
        <div class="qc-header">
            <div class="qc-logo">✓</div>
            <div>
                <div class="qc-title">Excel QC</div>
                <div class="qc-subtitle">Gender · Sentiment · Brands · Topics, checked and reviewed in one place</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def stepper(steps, current):
    items = []
    for number, name in enumerate(steps, start=1):
        state = "current" if number == current else "done" if number < current else ""
        mark = "✓" if number < current else str(number)
        items.append(f'<div class="qc-step {state}"><span class="num">{mark}</span>{escape(name)}</div>')
    st.markdown(f'<div class="qc-steps">{"".join(items)}</div>', unsafe_allow_html=True)


def section(title, subtitle=""):
    # The subtitle may use **bold** markdown, so render it with st.markdown below the title.
    st.markdown(f'<div class="qc-section"><h4>{escape(title)}</h4></div>', unsafe_allow_html=True)
    if subtitle:
        st.caption(subtitle)


def chips(labels):
    html = "".join(f'<span class="qc-chip">{escape(str(label))}</span>' for label in labels)
    st.markdown(f'<div class="qc-chips">{html}</div>', unsafe_allow_html=True)


def metric_cards(cards):
    """cards: list of (label, value, tone) where tone is good / warn / neutral."""
    html = "".join(
        f'<div class="qc-card {tone}"><div class="value">{escape(value)}</div>'
        f'<div class="label">{escape(label)}</div></div>'
        for label, value, tone in cards
    )
    st.markdown(f'<div class="qc-cards">{html}</div>', unsafe_allow_html=True)


def sentiment_chart(brand_df, roles):
    """100% stacked bars: share of Positive / Neutral / Negative mentions per brand."""
    order = list(SENTIMENT_COLORS)
    long = brand_df.melt(id_vars=["Brand"], value_vars=order, var_name="Sentiment", value_name="Posts")
    long["Label"] = long["Brand"].map(lambda b: f"{b} ({roles.get(b, 'Brand')})")
    long["Rank"] = long["Sentiment"].map(order.index)
    return alt.Chart(long).mark_bar(cornerRadius=4, stroke="white", strokeWidth=2).encode(
        x=alt.X("Posts:Q", stack="normalize",
                axis=alt.Axis(format="%", title=None, grid=False, tickCount=4, domain=False)),
        y=alt.Y("Label:N", title=None, sort=list(dict.fromkeys(long["Label"])),
                axis=alt.Axis(labelFontSize=13, labelColor="#334155", ticks=False, domain=False, labelLimit=240),
                scale=alt.Scale(paddingInner=0.35)),
        color=alt.Color(
            "Sentiment:N", sort=order,
            scale=alt.Scale(domain=order, range=list(SENTIMENT_COLORS.values())),
            legend=alt.Legend(orient="top", title=None),
        ),
        order=alt.Order("Rank:Q"),
        tooltip=["Brand", "Sentiment", "Posts"],
    ).properties(height=alt.Step(44))
