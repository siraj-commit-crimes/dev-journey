"""Settings for the Trend Radar: regions, CARMA themes and the never-touch list.

Edit these lists to tune what the radar looks for. No code changes needed.
"""

# Google Trends countries to watch (daily trending searches).
TREND_REGIONS = {
    "AE": "UAE",
    "SA": "Saudi Arabia",
    "QA": "Qatar",
    "GB": "UK",
}

# Wikipedia editions to read "most viewed yesterday" from.
WIKI_PROJECTS = {
    "en.wikipedia": "English Wikipedia",
    "ar.wikipedia": "Arabic Wikipedia",
}

# News searches on GDELT (free global news index), one per CARMA theme.
# GDELT asks for at most one request every 5 seconds, so keep this list short.
NEWS_QUERIES = {
    "Reputation and crisis": '(reputation OR backlash OR boycott OR "PR crisis")',
    "AI and trust": '("artificial intelligence" OR chatbot OR "AI regulation") (trust OR fear OR safety)',
    "Gulf business and media": "(UAE OR Saudi OR Qatar OR Dubai OR Riyadh) (brand OR media OR campaign)",
    "Big events and sponsors": '(sponsor OR sponsorship) (tournament OR summit OR congress OR "Grand Prix")',
}

# Words that tie a trend to what CARMA analyses. Theme -> keywords (lower case,
# matched as whole words, so "ai" does not match "said").
THEMES = {
    "Reputation and crisis": [
        "reputation", "crisis", "backlash", "boycott", "scandal", "apology", "outage",
        "recall", "lawsuit", "controversy", "viral", "cancel", "hack", "cyberattack",
    ],
    "Brands and marketing": [
        "brand", "campaign", "ad", "ads", "advert", "launch", "rebrand", "logo", "marketing",
        "influencer", "sponsor", "commercial",
    ],
    "AI and technology": [
        "ai", "artificial intelligence", "chatgpt", "claude", "gemini", "openai",
        "chatbot", "robot", "autonomous", "deepfake", "algorithm",
    ],
    "Media and communications": [
        "media", "journalist", "newspaper", "press", "podcast", "broadcast",
        "misinformation", "fake news", "meme",
    ],
    "Gulf and region": [
        "uae", "dubai", "abu dhabi", "saudi", "riyadh", "jeddah", "qatar", "doha",
        "oman", "muscat", "kuwait", "bahrain", "gcc", "vision 2030", "ramadan", "eid",
    ],
    "Energy and economy": [
        "oil", "energy", "opec", "petroleum", "gas", "budget", "inflation", "interest rate",
        "economy", "data center",
    ],
    "Big events": [
        "world cup", "olympics", "grand prix", "formula 1", "f1", "expo", "summit",
        "congress", "cop", "festival", "awards", "asian cup",
    ],
}

# Themes where CARMA can usually add its own data quickly.
DATA_THEMES = {
    "Reputation and crisis", "Brands and marketing", "AI and technology",
    "Media and communications", "Big events", "Energy and economy",
}

# Never post about these, whatever the score. Agree the final list with the
# marketing manager. Matching is on whole words, case-insensitive.
NEVER_TOUCH = [
    # tragedy and violence
    "death", "dies", "died", "killed", "murder", "shooting", "attack", "bomb",
    "earthquake", "flood", "crash", "victims", "funeral", "terror",
    # religion
    "prophet", "quran", "church", "mosque", "religion", "religious",
    # leaders and royal families
    "king", "crown prince", "emir", "sheikh", "royal", "president", "prime minister",
    # sensitive politics
    "election", "protest",
]

# War and conflict topics are allowed, but only with an extra sign-off on top of the
# usual approval (CARMA's US-Iran media work is a good example). The brief marks them.
# Tragedy words above still block a topic, even when it is about a war.
NEEDS_SIGN_OFF = [
    "war", "conflict", "ceasefire", "missile", "military", "sanctions",
    "iran", "israel", "gaza",
]
SIGN_OFF_BY = "Paul"

# Everyday searches with no comms angle (scores, weather, TV times). Skipped before
# scoring to save time and API cost. Matched anywhere in the title, case-insensitive.
LOW_VALUE = [
    " vs ", " v ", " ضد ", "live score", "score", "table", "standings", "fixtures",
    "weather", "météo", "погода", "طقس", "what time", "lottery", "horoscope", "result",
]

# How many trends make the daily brief.
BRIEF_SIZE = 5
