"""Collect rising topics from free, public sources.

Every source returns a list of trend dicts with the same keys:
    id, title, source, region, signal, signal_label, velocity (0-10), url, headlines

A source that fails (network, rate limit, changed format) is reported, not fatal:
collect() returns the trends it got plus a list of problems for the brief.
"""

import datetime as dt
import hashlib
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import config

USER_AGENT = "CARMA-TrendRadar-prototype/0.1 (marketing research)"
TIMEOUT = 30
GDELT_PAUSE_SECONDS = 6  # GDELT allows one request every 5 seconds
HT = "{https://trends.google.com/trending/rss}"

# Wikipedia pages that are always "popular" and say nothing about trends.
WIKI_SKIP_PREFIXES = (
    "Main_Page", "Special:", "Wikipedia:", "File:", "Portal:", "Help:", "Category:", "Template:",
    "الصفحة_الرئيسية", "خاص:", "ويكيبيديا:", "ملف:", "بوابة:", "تصنيف:", "قالب:", "مساعدة:",
)
STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "at", "by", "with", "is", "are",
    "as", "from", "after", "over", "new", "says", "say", "its", "his", "her", "how", "why", "what",
}


def fetch(url, retries=2, wait=10):
    """GET a URL. On 429 (too many requests) waits and tries again."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == retries:
                raise
            delay = error.headers.get("Retry-After", "")
            time.sleep(int(delay) if delay.isdigit() else wait * (attempt + 1))


def make_id(*parts):
    return hashlib.sha1("|".join(parts).lower().encode("utf-8")).hexdigest()[:10]


def clamp(value, low=1.0, high=10.0):
    return round(max(low, min(high, value)), 1)


def parse_traffic(text):
    """'2,000+' -> 2000. Unknown -> 0."""
    digits = re.sub(r"[^0-9]", "", text or "")
    return int(digits) if digits else 0


# ---------- Google Trends: what people search ----------

def google_trends_velocity(traffic):
    # 200 searches -> 2.5, 2,000 -> 5, 20,000 -> 7.5, 200,000+ -> 10
    return clamp((math.log10(max(traffic, 20)) - 1.3) * 2.5)


def parse_google_trends(xml_bytes, region):
    root = ET.fromstring(xml_bytes)
    trends = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue
        traffic = parse_traffic(item.findtext(f"{HT}approx_traffic"))
        news = item.findall(f"{HT}news_item")
        headlines = [(n.findtext(f"{HT}news_item_title") or "").strip() for n in news]
        links = [(n.findtext(f"{HT}news_item_url") or "").strip() for n in news]
        trends.append({
            "id": make_id("gt", region, title),
            "title": title,
            "source": "Google Trends",
            "region": region,
            "signal": traffic,
            "signal_label": f"{traffic:,}+ searches" if traffic else "trending searches",
            "velocity": google_trends_velocity(traffic),
            "url": next((link for link in links if link), item.findtext("link") or ""),
            "headlines": [h for h in headlines if h][:3],
        })
    return trends


def google_trends(geo):
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    return parse_google_trends(fetch(url), config.TREND_REGIONS.get(geo, geo))


# ---------- GDELT: what the news is covering ----------

def title_words(title):
    words = re.findall(r"[\w']+", title.lower())
    return {w for w in words if len(w) > 2 and w not in STOPWORDS}


def group_headlines(articles, min_overlap=0.3):
    """Group articles whose titles share enough words. Biggest group first."""
    groups = []
    for article in articles:
        words = title_words(article.get("title", ""))
        if not words:
            continue
        for group in groups:
            overlap = len(words & group["words"]) / len(words | group["words"])
            if overlap >= min_overlap:
                group["articles"].append(article)
                group["words"] |= words
                break
        else:
            groups.append({"words": set(words), "articles": [article]})
    return sorted(groups, key=lambda g: len(g["articles"]), reverse=True)


def parse_gdelt(payload, theme):
    articles = payload.get("articles") or []
    trends = []
    for group in group_headlines(articles):
        first = group["articles"][0]
        count = len(group["articles"])
        domains = sorted({a.get("domain", "") for a in group["articles"] if a.get("domain")})
        trends.append({
            "id": make_id("gdelt", first.get("title", "")),
            "title": first.get("title", "").strip(),
            "source": "GDELT news",
            "region": first.get("sourcecountry") or "Global",
            "signal": count,
            "signal_label": f"{count} article{'s' if count > 1 else ''} in 24h ({', '.join(domains[:3])})",
            "velocity": clamp(2 + 2 * count),
            "url": first.get("url", ""),
            "headlines": [a.get("title", "").strip() for a in group["articles"][:3]],
            "theme_hint": theme,
        })
    return trends


def gdelt_news(theme, query, max_records=40):
    params = urllib.parse.urlencode({
        "query": f"{query} sourcelang:english",
        "mode": "artlist",
        "format": "json",
        "maxrecords": max_records,
        "timespan": "24h",
        "sort": "hybridrel",
    })
    raw = fetch(f"https://api.gdeltproject.org/api/v2/doc/doc?{params}")
    try:
        payload = json.loads(raw)
    except ValueError:
        # GDELT answers rate limits and bad queries with plain text.
        raise RuntimeError(raw.decode("utf-8", "replace")[:120])
    return parse_gdelt(payload, theme)


# ---------- Wikipedia: what people read ----------

def wiki_velocity(views):
    # 10k views -> 1, 100k -> 4, 300k -> 5.9, 1M -> 8
    return clamp((math.log10(max(views, 1)) - 4) * 4)


def parse_wikipedia(payload, project, limit=25):
    items = payload.get("items") or [{}]
    lang = project.split(".")[0]
    trends = []
    for row in items[0].get("articles", []):
        article = row.get("article", "")
        if not article or article.startswith(WIKI_SKIP_PREFIXES):
            continue
        title = article.replace("_", " ")
        views = int(row.get("views", 0))
        trends.append({
            "id": make_id("wiki", project, article),
            "title": title,
            "source": "Wikipedia",
            "region": config.WIKI_PROJECTS.get(project, project),
            "signal": views,
            "signal_label": f"{views:,} views yesterday",
            "velocity": wiki_velocity(views),
            "url": f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(article)}",
            "headlines": [],
        })
        if len(trends) >= limit:
            break
    return trends


def wikipedia_top(project, day=None):
    day = day or (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1))
    url = (
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/"
        f"{project}/all-access/{day:%Y/%m/%d}"
    )
    return parse_wikipedia(json.loads(fetch(url)), project)


# ---------- all sources ----------

def merge(trends):
    """Join the same topic seen by several sources and give it a small boost."""
    merged = {}
    for trend in trends:
        key = " ".join(sorted(title_words(trend["title"]))) or trend["id"]
        if key in merged:
            kept = merged[key]
            label = f"{trend['source']} ({trend['region']})"
            if label == f"{kept['source']} ({kept['region']})" or label in kept["also_seen_in"]:
                kept["velocity"] = max(kept["velocity"], trend["velocity"])
                continue  # same page twice from one source: no boost
            kept["also_seen_in"].append(label)
            kept["velocity"] = clamp(max(kept["velocity"], trend["velocity"]) + 1)
            kept["headlines"] = (kept["headlines"] + trend["headlines"])[:3]
        else:
            merged[key] = {**trend, "also_seen_in": []}
    return list(merged.values())


def collect(log=print, use_news=True):
    """Fetch every source. Returns (trends, problems)."""
    trends, problems = [], []

    def attempt(label, func, *args):
        try:
            found = func(*args)
            log(f"  {label}: {len(found)} topics")
            trends.extend(found)
        except Exception as error:  # one broken source must not stop the brief
            problems.append(f"{label}: {error}")
            log(f"  {label}: failed ({error})")

    for geo in config.TREND_REGIONS:
        attempt(f"Google Trends {geo}", google_trends, geo)
    for i, project in enumerate(config.WIKI_PROJECTS):
        if i:
            time.sleep(2)
        attempt(f"Wikipedia {project}", wikipedia_top, project)
    if use_news:
        for i, (theme, query) in enumerate(config.NEWS_QUERIES.items()):
            if i:
                time.sleep(GDELT_PAUSE_SECONDS)
            attempt(f"GDELT news: {theme}", gdelt_news, theme, query)
    return merge(trends), problems
