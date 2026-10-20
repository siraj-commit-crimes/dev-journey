"""Tests for offline mode (rule-based checks, no AI)."""

import pandas as pd

import offline_engine as offline
import qc_engine


def test_gender_rules():
    assert offline.guess_gender("Noura", "@noura_99", [])[0] == "Female"
    assert offline.guess_gender("سارة", "", [])[0] == "Female"
    assert offline.guess_gender("", "@abu_khalid", [])[0] == "Male"
    assert offline.guess_gender("", "@umsara", [])[0] == "Female"
    assert offline.guess_gender("Ali Al-Harbi", "", [])[0] == "Male"
    assert offline.guess_gender("", "@nourasaad", [])[0] == "Female"
    assert offline.guess_gender("أخبار الرياض", "@riyadh_news", [])[0] == "Unknown"
    assert offline.guess_gender("STC", "@stc_ksa", ["STC"])[0] == "Unknown"
    assert offline.guess_gender("Zx", "@qq", [])[0] == "Unknown"


def test_sentiment_rules():
    def sentiment(text):
        return offline.judge_sentiment(text)[:2]

    assert sentiment("خدمة ممتازة 😍") == ("Positive", False)
    assert sentiment("الخدمه زفت والتطبيق بطيء") == ("Negative", False)
    assert sentiment("ما عجبني التطبيق") == ("Negative", False)       # negation
    assert sentiment("Love it ❤️") == ("Positive", False)
    assert sentiment("الطقس حار اليوم") == ("Neutral", False)
    assert sentiment("Great job 👏") == ("Positive", False)
    assert sentiment("Great service, waited 3 hours 👏") == ("Negative", True)
    assert sentiment("شكراً STC على السرعة 🙄") == ("Negative", True)


def test_brand_rules():
    brands = qc_engine.parse_brands("Client: STC, اس تي سي\nCompetitor: Mobily, موبايلي")

    def check(text):
        return offline.check_row(
            {"id": 0, "text": text, "author": "", "handle": "", "brand": "", "topic": ""}, brands
        )

    row = check("STC is way better than Mobily 👌")
    assert row["target_brand"] == "STC"
    assert row["brand_sentiments"] == [
        {"brand": "STC", "sentiment": "Positive"},
        {"brand": "Mobily", "sentiment": "Negative"},
    ]
    row = check("موبايلي سيئة بس اس تي سي ممتازة")
    assert (row["target_brand"], row["sentiment"]) == ("STC", "Positive")
    assert check("Mobily down again 😡")["sentiment"] == "Negative"
    assert check("الطقس حار اليوم")["relevant"] is False


def test_topic_rules():
    mapping = offline.unify_topics(
        ["Customer Service", "customer service", "Customer services", "Prices", "Price", "Network"], []
    )
    assert mapping["customer service"] == mapping["Customer services"] == "Customer Service"
    assert mapping["Price"] == "Prices"
    assert mapping["Network"] == "Network"

    mapping = offline.unify_topics(
        ["customer service", "Prices", "Network Coverage", "Roaming"],
        ["Customer Service", "Pricing", "Network"],
    )
    assert mapping == {
        "customer service": "Customer Service", "Prices": "Pricing",
        "Network Coverage": "Network", "Roaming": "Roaming",
    }


def test_full_run_offline():
    df = pd.DataFrame({
        "Author": ["Noura", "Khalid", "STC Official"],
        "Content": ["STC ممتازة 😍", "Great service STC, waited 3 hours 👏", "عرض جديد من STC"],
        "Gender": ["Male", "Male", "Unknown"],
        "Sentiment": ["Positive", "Positive", "Neutral"],
        "Topic": ["Service", "service", "Offers"],
    })
    columns = qc_engine.guess_columns(df.columns)
    brands = qc_engine.parse_brands("Client: STC")
    result, summary, topic_map, brand_df = qc_engine.run_qc(
        df, columns, offline.OfflineClient(), model="offline", brands=brands
    )
    assert list(result["QC_Status"]) == ["Check", "Check", "OK"]
    assert result.loc[0, "QC_Flags"] == "Gender"
    assert result.loc[1, "QC_Flags"] == "Sentiment"
    assert result.loc[1, "QC_Sarcasm"] == "Yes"
    assert set(result["Unified_Topic"]) == {"Service", "Offers"}
    assert brand_df.set_index("Brand").loc["STC", "Mentions"] == 3
