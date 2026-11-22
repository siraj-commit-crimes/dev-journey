"""Tests for the Trend Radar. Run with:  python -m pytest trend_radar"""

import json
from types import SimpleNamespace

import radar
import report
import scoring
import sources

GT_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
<item><title>outlook outage</title><ht:approx_traffic>20,000+</ht:approx_traffic>
<link>https://trends.google.com/trending/rss?geo=GB</link>
<ht:news_item><ht:news_item_title>Brands pile in with memes as Outlook goes down</ht:news_item_title>
<ht:news_item_url>https://example.com/outlook</ht:news_item_url></ht:news_item></item>
<item><title>earthquake today</title><ht:approx_traffic>200+</ht:approx_traffic></item>
</channel></rss>"""


def trend(title, headlines=(), source="Google Trends", region="UAE", velocity=5.0):
    return {
        "id": sources.make_id(source, region, title), "title": title, "source": source,
        "region": region, "signal": 1000, "signal_label": "1,000+ searches",
        "velocity": velocity, "url": "https://example.com", "headlines": list(headlines),
        "also_seen_in": [],
    }


def judgement(item, **changes):
    base = {
        "id": item["id"], "keep": True, "theme": "Brands and marketing", "relevance": 8,
        "data_angle": 8, "safety": "ok", "safety_reason": "", "why_it_matters": "w",
        "angle": "a", "format": "carousel", "data_request": "d", "caption_en": "[X] posts",
        "caption_ar": "[X] منشور", "hashtags": ["CARMA", "#PR"], "expires_in_hours": 24,
    }
    return {**base, **changes}


# ---------- sources ----------

def test_parse_google_trends_reads_traffic_and_headlines():
    found = sources.parse_google_trends(GT_XML, "UK")
    assert [t["title"] for t in found] == ["outlook outage", "earthquake today"]
    assert found[0]["signal"] == 20000
    assert found[0]["velocity"] == 7.5
    assert found[0]["headlines"] == ["Brands pile in with memes as Outlook goes down"]
    assert found[0]["url"] == "https://example.com/outlook"


def test_parse_wikipedia_skips_main_page_and_special_pages():
    payload = {"items": [{"articles": [
        {"article": "Main_Page", "views": 3_000_000},
        {"article": "Special:Search", "views": 600_000},
        {"article": "Grand_Theft_Auto_VI", "views": 393_338},
        {"article": "الصفحة_الرئيسية", "views": 500_000},
    ]}]}
    found = sources.parse_wikipedia(payload, "en.wikipedia")
    assert [t["title"] for t in found] == ["Grand Theft Auto VI"]
    assert found[0]["signal_label"] == "393,338 views yesterday"


def test_parse_gdelt_groups_similar_headlines():
    payload = {"articles": [
        {"title": "Brand faces boycott over new advert", "url": "u1", "domain": "a.com", "sourcecountry": "UK"},
        {"title": "Boycott grows over brand's new advert", "url": "u2", "domain": "b.com"},
        {"title": "Oil prices rise", "url": "u3", "domain": "c.com"},
    ]}
    found = sources.parse_gdelt(payload, "Reputation and crisis")
    assert found[0]["signal"] == 2
    assert found[0]["theme_hint"] == "Reputation and crisis"
    assert len(found) == 2


def test_merge_boosts_topics_seen_in_two_regions_but_not_duplicates():
    a = trend("Outlook outage", region="UAE", velocity=5.0)
    b = trend("outlook outage", region="UK", velocity=6.0)
    same = trend("Outlook outage", region="UAE", velocity=5.0)
    merged = sources.merge([a, b, same])
    assert len(merged) == 1
    assert merged[0]["also_seen_in"] == ["Google Trends (UK)"]
    assert merged[0]["velocity"] == 7.0


def test_collect_reports_a_broken_source_without_stopping(monkeypatch):
    names = {"AE": "dubai launch", "SA": "riyadh summit", "QA": "doha forum", "GB": "london budget"}
    monkeypatch.setattr(sources, "google_trends", lambda geo: [trend(names[geo], region=geo)])
    monkeypatch.setattr(sources, "wikipedia_top", lambda p: (_ for _ in ()).throw(RuntimeError("429")))
    monkeypatch.setattr(sources.time, "sleep", lambda s: None)
    found, problems = sources.collect(log=lambda *a: None, use_news=False)
    assert len(found) == len(sources.config.TREND_REGIONS)
    assert len(problems) == len(sources.config.WIKI_PROJECTS)


# ---------- scoring ----------

def test_never_touch_blocks_whole_words_only():
    assert scoring.never_touch_hit(trend("Earthquake hits city")) == "earthquake"
    assert scoring.never_touch_hit(trend("Brand apology", ["King of memes"])) == "king"
    # "warning" contains "war" but is not the word war
    assert scoring.never_touch_hit(trend("Weather warning for Dubai")) is None


def test_split_safe_drops_unsafe_and_everyday_searches():
    items = [trend("Brand boycott"), trend("Earthquake today"), trend("Liverpool vs Man Utd")]
    safe, blocked = scoring.split_safe(items)
    assert [t["title"] for t in safe] == ["Brand boycott"]
    assert blocked == 1


def test_match_themes_uses_whole_words():
    assert scoring.match_themes(trend("He said the plan failed")) == []
    assert "AI and technology" in scoring.match_themes(trend("AI chatbot backlash"))


def test_finish_ranks_and_removes_unsafe_judgements():
    good, risky, dropped = trend("Brand A rebrand"), trend("Brand B recall"), trend("Brand C")
    judgements = [
        judgement(good),
        judgement(risky, safety="caution", safety_reason="company in trouble"),
        judgement(dropped, keep=False),
    ]
    result = scoring.finish([good, risky, dropped], judgements)
    assert [r["title"] for r in result] == ["Brand A rebrand", "Brand B recall"]
    assert result[0]["score"] == round(0.35 * 8 + 0.40 * 8 + 0.25 * 5, 1)
    assert result[1]["score"] == result[0]["score"] - 2
    assert result[0]["hashtags"] == ["#CARMA", "#PR"]


def test_finish_blocks_never_touch_even_if_claude_keeps_it():
    item = trend("Brand ad", ["Royal family attends launch"])
    assert scoring.finish([item], [judgement(item)]) == []


def test_score_offline_keeps_relevant_topics():
    items = [trend("Dubai brand campaign backlash"), trend("Robert Pattinson")]
    result = scoring.score_offline(items)
    assert [r["title"] for r in result] == ["Dubai brand campaign backlash"]
    assert "[X]" in result[0]["caption_en"]


class FakeClient:
    def __init__(self, answer, stop_reason="end_turn"):
        self.answer, self.stop_reason, self.requests = answer, stop_reason, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **request):
        self.requests.append(request)
        block = SimpleNamespace(type="text", text=json.dumps(self.answer, ensure_ascii=False))
        return SimpleNamespace(stop_reason=self.stop_reason, content=[block])


def test_score_with_claude_sends_shortlist_and_reads_json():
    item = trend("AI chatbot backlash")
    client = FakeClient({"trends": [judgement(item)]})
    result = scoring.score_with_claude(client, [item], model="claude-opus-5-5")
    request = client.requests[0]
    assert request["output_config"]["format"]["schema"] == scoring.SCHEMA
    assert request["fallbacks"] == "default"
    sent = json.loads(request["messages"][0]["content"])["topics"]
    assert sent[0]["title"] == "AI chatbot backlash"
    assert result[0]["id"] == item["id"]


def test_score_with_claude_haiku_has_no_fallback_and_refusal_raises():
    item = trend("AI chatbot backlash")
    client = FakeClient({"trends": []}, stop_reason="refusal")
    try:
        scoring.score_with_claude(client, [item], model="claude-haiku-5-5")
    except RuntimeError as error:
        assert "declined" in str(error)
    else:
        raise AssertionError("expected a refusal error")
    assert "fallbacks" not in client.requests[0]


# ---------- brief and end to end ----------

def test_teams_card_is_an_adaptive_card_message():
    item = {**trend("Brand A"), **judgement(trend("Brand A")), "score": 7.5}
    meta = {"date": "2026-11-22", "scorer": "rules", "candidates": 10, "blocked": 1, "problems": []}
    card = report.to_teams_card([item], meta, link="https://example.com/brief")
    content = card["attachments"][0]["content"]
    assert content["type"] == "AdaptiveCard"
    assert content["actions"][0]["url"] == "https://example.com/brief"


def test_html_escapes_text_from_the_internet():
    item = {**trend("<script>alert(1)</script>"), **judgement(trend("x")), "score": 5}
    meta = {"date": "2026-11-22", "scorer": "rules", "candidates": 1, "blocked": 0, "problems": []}
    page = report.to_html([item], meta)
    assert "<script>alert" not in page
    assert "&lt;script&gt;" in page


def test_run_with_sample_offline_writes_all_files(tmp_path):
    args = radar.parse_args(["--sample", "--offline", "--out", str(tmp_path)])
    top, meta, files = radar.run(args, log=lambda *a: None)
    assert meta["candidates"] > 0
    for path in files.values():
        assert path.exists() and path.stat().st_size > 0
