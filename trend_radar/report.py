"""Turn scored trends into the morning brief: HTML page, Markdown and a Teams card.

Teams: create a webhook with the Workflows app ("Post to a channel when a webhook
request is received") and put its URL in TEAMS_WEBHOOK_URL. The card is sent as a
standard Adaptive Card message.
"""

import html
import json
import urllib.request

ORANGE = "#F08A3C"


def _hours(item):
    hours = item.get("expires_in_hours", 24)
    return f"{hours}h" if hours < 72 else f"{hours // 24} days"


def _seen(item):
    extra = item.get("also_seen_in") or []
    where = f"{item['source']} ({item['region']})"
    return where + (f" + {', '.join(extra)}" if extra else "")


# ---------- Markdown ----------

def to_markdown(items, meta):
    lines = [
        f"# CARMA Trend Radar · {meta['date']}",
        "",
        f"{len(items)} topics worth a look today · scored by {meta['scorer']} · "
        f"{meta['candidates']} topics checked, {meta['blocked']} skipped by the never-touch list.",
        "",
    ]
    for rank, item in enumerate(items, 1):
        lines += [
            f"## {rank}. {item['title']}  ·  score {item['score']}/10",
            "",
            f"**Why it matters:** {item['why_it_matters']}",
            "",
            f"**Angle:** {item['angle']}  ",
            f"**Format:** {item['format']}  ·  **Post within:** {_hours(item)}  ·  "
            f"**Seen in:** {_seen(item)} ({item['signal_label']})",
            "",
            f"**Ask the analysts:** {item['data_request']}",
            "",
            f"**Draft caption (EN):** {item['caption_en']}",
            "",
            f"**Draft caption (AR):** {item['caption_ar']}",
            "",
            f"**Hashtags:** {' '.join(item['hashtags'])}",
            "",
        ]
        if item.get("sign_off"):
            lines += [f"> Extra sign-off needed: {item['sign_off_reason']}", ""]
        if item.get("safety") == "caution":
            lines += [f"> Caution: {item['safety_reason']}", ""]
    if meta.get("problems"):
        lines += ["---", "", "**Sources that failed today:** " + "; ".join(meta["problems"]), ""]
    lines += [
        "---",
        "",
        "Every number in a caption is a placeholder until an analyst checks it. "
        "Nothing is posted without approval.",
    ]
    return "\n".join(lines)


# ---------- HTML ----------

def to_html(items, meta):
    e = html.escape
    cards = []
    for rank, item in enumerate(items, 1):
        caution = (
            f'<p class="caution">Caution: {e(item["safety_reason"])}</p>'
            if item.get("safety") == "caution" else ""
        )
        if item.get("sign_off"):
            caution = f'<p class="signoff"><b>Extra sign-off needed.</b> {e(item["sign_off_reason"])}</p>' + caution
        tags = " ".join(f"<span>{e(h)}</span>" for h in item["hashtags"])
        cards.append(f"""
  <article>
    <header>
      <div class="rank">{rank}</div>
      <div>
        <h2>{e(item['title'])}</h2>
        <p class="meta">{e(item.get('theme', ''))} · {e(_seen(item))} · {e(item['signal_label'])}</p>
      </div>
      <div class="score">{item['score']}<small>/10</small></div>
    </header>
    <div class="pills">
      <span>Relevance {item['relevance']}</span><span>Data angle {item['data_angle']}</span>
      <span>Speed {item['velocity']}</span><span>{e(item['format'])}</span>
      <span class="hot">Post within {e(_hours(item))}</span>
    </div>
    <p><b>Why it matters.</b> {e(item['why_it_matters'])}</p>
    <p><b>Angle.</b> {e(item['angle'])}</p>
    <p class="ask"><b>Ask the analysts.</b> {e(item['data_request'])}</p>
    <div class="captions">
      <div><h3>Caption · English</h3><p>{e(item['caption_en'])}</p></div>
      <div dir="rtl" lang="ar"><h3>النص · عربي</h3><p>{e(item['caption_ar'])}</p></div>
    </div>
    <p class="tags">{tags}</p>
    {caution}
    <p class="links"><a href="{e(item['url'])}">Source</a></p>
  </article>""")
    problems = (
        f'<p class="problems">Sources that failed today: {e("; ".join(meta["problems"]))}</p>'
        if meta.get("problems") else ""
    )
    empty = "" if items else "<p>No topics passed the filters today. That is a normal day.</p>"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trend Radar {e(meta['date'])}</title>
<style>
  :root {{ --orange:{ORANGE}; --ink:#1c1c1e; --grey:#6b6b70; --line:#eadfd6; --peach:#fff5ee; --bg:#f6f3f0; --card:#fff; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --ink:#f2f2f2; --grey:#a9a9ad; --line:#3a3533; --peach:#2a2420; --bg:#141414; --card:#1e1e1f; }} }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  main {{ max-width:860px; margin:0 auto; padding:24px 16px 48px; }}
  .top h1 {{ margin:0; font-size:28px; }} .top h1 em {{ color:var(--orange); font-style:normal; }}
  .top p {{ color:var(--grey); margin:6px 0 20px; }}
  article {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin:0 0 16px; }}
  article header {{ display:flex; gap:14px; align-items:flex-start; }}
  .rank {{ flex:none; width:32px; height:32px; border-radius:50%; background:var(--orange); color:#fff; display:grid; place-items:center; font-weight:700; }}
  h2 {{ margin:2px 0 2px; font-size:19px; }} .meta {{ margin:0; color:var(--grey); font-size:13px; }}
  .score {{ margin-left:auto; font-size:26px; font-weight:800; color:var(--orange); white-space:nowrap; }} .score small {{ font-size:13px; color:var(--grey); }}
  .pills {{ display:flex; flex-wrap:wrap; gap:6px; margin:12px 0; }}
  .pills span {{ font-size:12px; border:1px solid var(--line); border-radius:999px; padding:3px 10px; }}
  .pills .hot {{ background:var(--orange); color:#fff; border-color:var(--orange); }}
  .ask {{ background:var(--peach); border-left:3px solid var(--orange); padding:8px 12px; border-radius:0 8px 8px 0; }}
  .captions {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
  .captions div {{ border:1px solid var(--line); border-radius:10px; padding:10px 12px; }}
  .captions h3 {{ margin:0 0 4px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--orange); }}
  .captions p {{ margin:0; }}
  .tags span {{ color:var(--orange); margin-right:8px; font-size:13px; }}
  .caution {{ color:#b45309; }}
  .signoff {{ border:1px solid #b45309; color:#b45309; border-radius:8px; padding:8px 12px; }} .links a {{ color:var(--orange); font-size:13px; }}
  .problems, footer {{ color:var(--grey); font-size:13px; }}
  @media (max-width:640px) {{ .captions {{ grid-template-columns:1fr; }} }}
</style></head>
<body><main>
  <div class="top">
    <h1>CARMA <em>Trend Radar</em> · {e(meta['date'])}</h1>
    <p>{len(items)} topics worth a look · scored by {e(meta['scorer'])} · {meta['candidates']} topics checked, {meta['blocked']} skipped by the never-touch list</p>
  </div>
  {empty}{''.join(cards)}
  {problems}
  <footer>Every number in a caption is a placeholder until an analyst checks it. Nothing is posted without approval.</footer>
</main></body></html>"""


# ---------- Teams ----------

def to_teams_card(items, meta, link=""):
    body = [
        {"type": "TextBlock", "text": f"CARMA Trend Radar · {meta['date']}", "weight": "Bolder", "size": "Large"},
        {"type": "TextBlock", "isSubtle": True, "wrap": True,
         "text": f"{len(items)} topics worth a look · {meta['candidates']} checked · {meta['blocked']} skipped for safety"},
    ]
    for rank, item in enumerate(items, 1):
        body += [
            {"type": "TextBlock", "text": f"{rank}. {item['title']} · {item['score']}/10",
             "weight": "Bolder", "wrap": True, "spacing": "Large", "separator": True},
            {"type": "TextBlock", "text": item["angle"], "wrap": True},
            {"type": "FactSet", "facts": [
                {"title": "Format", "value": item["format"]},
                {"title": "Post within", "value": _hours(item)},
                {"title": "Ask analysts", "value": item["data_request"]},
            ]},
            *([{"type": "TextBlock", "text": f"Extra sign-off needed: {item['sign_off_reason']}",
                "wrap": True, "color": "Warning"}] if item.get("sign_off") else []),
            {"type": "TextBlock", "text": item["caption_en"], "wrap": True, "isSubtle": True},
        ]
    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": body,
    }
    if link:
        card["actions"] = [{"type": "Action.OpenUrl", "title": "Open the full brief", "url": link}]
    return {
        "type": "message",
        "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "content": card}],
    }


def post_to_teams(webhook_url, message):
    data = json.dumps(message).encode("utf-8")
    request = urllib.request.Request(
        webhook_url, data=data, headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.status
