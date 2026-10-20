"""Offline mode: checks rows with simple rules instead of Claude. Free, no API key.

OfflineClient pretends to be the Anthropic client and answers in the same JSON
format Claude would, so qc_engine.run_qc works the same way in both modes.

It is much weaker than Claude: it can't really understand sarcasm, dialect or
context. Use it to catch obvious mistakes, not as the final word.
"""

import json
import re
from difflib import SequenceMatcher
from types import SimpleNamespace

# ---------- word lists ----------
# Keep these lists in normalized form (see normalize() below): Arabic أ إ آ -> ا,
# ة -> ه, ى -> ي, lowercase English.

MALE_NAMES = """
mohammed mohamed muhammad mohammad mohamad ahmed ahmad abdullah abdallah abdulaziz abdulrahman
abdulrahim abdulkarim abdulmajeed abdulelah abdulmohsen khalid khaled fahad fahd faisal saud
sultan turki bandar nasser naser nawaf nayef mansour majed majid meshal mishal mutlaq saleh
salman saad sami samer omar umar othman uthman ali hassan hasan hussain hussein ibrahim
ismail yousef yousif youssef yusuf yasser yaser yazeed yazid ziyad ziad zaid zayed hamad
hamed hamza hamdan hatem hisham haitham waleed walid wael tariq tarek talal thamer adel adil
anas ayman bader badr bassam fawaz fares faris ghazi hani jaber jamal jasim jassim kareem
karim louay luay mazen marwan musa mousa mustafa mostafa nabil naif nader omar osama osamah
rakan rashed rashid riyadh riyad saeed said sameer shadi sharif suliman sulaiman sulaiman
tamer tameem tamim yahya yahia zakaria zakariya abdulhadi mishari meshari raed rayan
rayyan ryan mohanad muhannad husam hussam essam isam emad imad anwar ammar amr amer
john james michael david daniel chris christopher mark paul peter robert william thomas
alex andrew george jack ryan kevin brian adam matt matthew steve steven tom jason
محمد احمد عبدالله عبدالعزيز عبدالرحمن عبدالرحيم عبدالكريم عبدالمجيد عبدالاله
عبدالمحسن خالد فهد فيصل سعود سلطان تركي بندر ناصر نواف نايف منصور ماجد مشعل مطلق صالح
سلمان سعد سامي سامر عمر عثمان علي حسن حسين ابراهيم اسماعيل يوسف ياسر يزيد زياد زيد زايد
حمد حامد حمزه حمدان حاتم هشام هيثم وليد وائل طارق طلال ثامر عادل انس ايمن بدر بسام فواز
فارس غازي هاني جابر جمال جاسم كريم لؤي مازن مروان موسي مصطفي نبيل نادر اسامه راكان راشد
رياض سعيد سمير شادي شريف سليمان تامر تميم يحيي زكريا مشاري رائد ريان مهند حسام عصام عماد
انور عمار عمرو عامر
"""

FEMALE_NAMES = """
fatima fatimah fatma aisha aysha aishah khadija khadijah maryam mariam mariem noura nora
norah nourah nouf sara sarah reem rim hessa hissa hind hanan huda hoda lama lamya lamia
latifa latifah lulu lujain loujain maha manal mona muna mai may maram nada najla nawal
nadia nadya nasreen nesreen rana rania raniah rasha rawan razan reema rima ruba rahaf
shahad shaima shaimaa shatha shouq shoug sumaya somaya tahani wafa wejdan wijdan yasmin
yasmeen yara zainab zeinab zahra jana jood joud dana dalal deema dima ghada ghadeer
haifa haya hala afnan alaa amal amani amira ameera areej asma asmaa bushra dua duaa
eman iman abeer abrar arwa batool kholoud kholood lina leena lubna malak manar
mashael mashail mawadda mayar nouran reham salma samar samira sawsan
emily emma olivia sophia jessica jennifer sarah laura anna maria lisa kate katie
rachel rebecca hannah amy linda susan karen nancy elizabeth mary
فاطمه عائشه عايشه خديجه مريم نوره نورا نوف ساره ريم حصه هند حنان هدي لمي لمياء لطيفه
لولو لجين مها منال مني مي مرام ندي نجلاء نوال ناديه نسرين رنا رانيا رشا روان رزان ريما
ربي رهف شهد شيماء شذي شوق سميه تهاني وفاء وجدان ياسمين يارا زينب زهراء جنا جود دانه
دلال ديما غاده غدير هيفاء هيا هاله افنان الاء امل اماني اميره اريج اسماء بشري دعاء ايمان
عبير ابرار اروي بتول خلود لينا لبني ملاك منار مشاعل موده ميار نوران رهام سلمي سمر سميره سوسن
"""

# Words that mean the account is a brand, outlet or organization -> gender Unknown.
ORG_WORDS = """
news official store shop company co ltd inc bank gov ministry media tv radio channel
magazine agency group club team hospital clinic university college school academy
restaurant cafe hotel mall market brand support care service services sa ksa app
اخبار الرسمي رسمي متجر شركه بنك وزاره قناه اذاعه مجله وكاله مجموعه نادي فريق مستشفي
عياده جامعه كليه مدرسه اكاديميه مطعم مقهي فندق مول سوق خدمه هيئه امانه بلديه
"""

MALE_PREFIXES = ["abu", "abo", "ابو", "bin", "بن"]
FEMALE_PREFIXES = ["umm", "um", "om", "ام", "bint", "بنت"]

POSITIVE_WORDS = """
good great excellent amazing awesome love loved loving like best perfect fantastic wonderful
nice happy thanks thank thx beautiful brilliant recommend recommended fast helpful easy
smooth satisfied impressive incredible superb outstanding enjoy enjoyed favorite favourite
proud glad pleased
ممتاز ممتازه رائع رائعه جميل جميله حلو حلوه زين زينه احب حبيت اعجبني عجبني افضل احسن
شكرا مشكورين يعطيكم العافيه مبدع مبدعين روعه خرافي خرافيه تحفه سريع سريعه
سهل مريح راضي مرتاح فخور سعيد مبسوط انصح انصحكم كفو يستاهل يستاهلون ابداع
mumtaz helw 7elw 7lw zain zeen shukran mashallah
ماشاء ماشاءالله تبارك
"""

NEGATIVE_WORDS = """
bad worst terrible awful horrible hate hated poor slow broken scam fraud disappointed
disappointing disappointment angry annoying annoyed useless rude problem problems issue
issues fail failed failure waste expensive overpriced never complaint complain refund
delay delayed down outage cancel cancelled bug bugs unacceptable ridiculous
سيء سيئ سيئه اسوا زفت خايس خايسه تعبان فاشل فاشله اكره كرهت بطيء بطيئه بطي غالي غاليه نصب
نصابين احتيال خربان خربانه مشكله مشاكل معطل عطل تاخير متاخر زعلان محبط مقرف قرف مزعج
وقح شكوي استرجاع الغاء انقطاع ضعيف ضعيفه حسبي للاسف مخيب
zift khayes ta3ban
"""

NEGATIONS = {"not", "no", "never", "dont", "don't", "isn't", "wasn't", "ما", "مو", "مب",
             "مش", "لا", "ليس", "مهوب", "موب", "غير"}

# Space-separated because some emojis are two characters (❤️ = ❤ + a style mark).
POSITIVE_EMOJIS = "😍 🥰 😘 ❤ 💕 💖 💗 💯 👍 🙌 🔥 ⭐ 🌟 😊 😁 😀 😃 ☺ 🤩 ✨ 💪 🎉 👌 🥳 💙 💚 💛 🤍".split()
NEGATIVE_EMOJIS = "😡 🤬 😠 😤 👎 💔 😢 😭 😞 😔 😩 😫 🤮 🤢 😒 🙄 🤦 😑 🤡 💩".split()
# Sarcasm clues: mocking emojis, or 👏 / 🙂 next to a complaint.
MOCKING_EMOJIS = "🙄 🤡 😒 🤦".split()
IRONIC_EMOJIS = "👏 🙂 😂 🤣".split()
COMPLAINT_WORDS = """
waited waiting hours again still yet ever another
انتظرت انتظار ساعه ساعات للحين كالعاده مره ثانيه بعد
"""

CONTRAST_WORDS = r"\bbut\b|\bhowever\b|بس|لكن|ولكن|الا ان"
COMPARISON = r"(better than|افضل من|احسن من|ارخص من|اسرع من)"


# ---------- text helpers ----------

def normalize(text):
    """Lowercase and unify Arabic letter forms so spellings match."""
    text = str(text or "").lower()
    text = re.sub("[أإآ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي").replace("ـ", "")
    text = re.sub("[ً-ْ]", "", text)  # remove tashkeel
    return text


def words_of(text):
    return re.findall(r"[a-z0-9']+|[؀-ۿ]+", normalize(text))


def strip_prefix(word):
    """Arabic words stick prefixes on: والخدمه -> خدمه. Try a few common ones."""
    forms = [word]
    for prefix in ("وال", "فال", "بال", "لل", "ال", "و", "ف", "ب"):
        if word.startswith(prefix) and len(word) - len(prefix) >= 2:
            forms.append(word[len(prefix):])
    return forms


def word_set(block):
    return set(normalize(block).split())


MALE = word_set(MALE_NAMES)
FEMALE = word_set(FEMALE_NAMES)
ORGS = word_set(ORG_WORDS)
POSITIVE = word_set(POSITIVE_WORDS)
NEGATIVE = word_set(NEGATIVE_WORDS)
COMPLAINTS = word_set(COMPLAINT_WORDS)


def name_parts(text):
    """Split a name or handle into pieces: '@abu_khalid99' -> ['abu', 'khalid']."""
    text = normalize(text).lstrip("@")
    text = re.sub(r"[_.\-0-9]+", " ", text)
    return [p for p in re.findall(r"[a-z]+|[؀-ۿ]+", text) if p]


def contains_name(text, name):
    """True if name (a brand or alias) appears in text as a whole word."""
    text, name = normalize(text), normalize(name).lstrip("@")
    if not name:
        return False
    if re.search(r"[a-z0-9]", name):
        return re.search(rf"(?<![a-z0-9]){re.escape(name)}(?![a-z0-9])", text) is not None
    # Arabic: allow prefixes like و / ب / ال in front of the name.
    return re.search(rf"(^|[^؀-ۿ])(و|ف|ب|ل|ال|وال|بال)?{re.escape(name)}", text) is not None


# ---------- the checks ----------

def guess_gender(author, handle, brand_names):
    for source, value in (("name", author), ("handle", handle)):
        parts = name_parts(value)
        if not parts:
            continue
        if any(p in ORGS for p in parts) or any(contains_name(value, b) for b in brand_names):
            return "Unknown", f"Looks like an organization ({source})"
        for i, part in enumerate(parts):
            if part in MALE_PREFIXES and i + 1 < len(parts):
                return "Male", f"'{part} {parts[i + 1]}' in {source}"
            if part in FEMALE_PREFIXES and i + 1 < len(parts):
                return "Female", f"'{part} {parts[i + 1]}' in {source}"
            for form in strip_prefix(part) if i == 0 else [part]:
                if form in MALE:
                    return "Male", f"'{form}' is a male name ({source})"
                if form in FEMALE:
                    return "Female", f"'{form}' is a female name ({source})"
            # Handles are often glued together: "umsara", "nourasaad" -> check the start.
            if source == "handle" and i == 0:
                for prefixes, gender in ((MALE_PREFIXES, "Male"), (FEMALE_PREFIXES, "Female")):
                    for prefix in prefixes:
                        rest = part[len(prefix):]
                        if part.startswith(prefix) and (rest in MALE or rest in FEMALE):
                            return gender, f"handle starts with '{prefix}' + a name"
                for name in sorted(MALE | FEMALE, key=len, reverse=True):
                    if len(name) >= 4 and part.startswith(name):
                        gender = "Male" if name in MALE else "Female"
                        return gender, f"handle starts with '{name}'"
    return "Unknown", "Name not in the name lists"


def score_text(text):
    """Return (score, hits). Positive score = positive sentiment."""
    score = 0
    hits = []
    tokens = words_of(text)
    for i, token in enumerate(tokens):
        negated = i > 0 and tokens[i - 1] in NEGATIONS
        for form in strip_prefix(token):
            value = 1 if form in POSITIVE else -1 if form in NEGATIVE else 0
            if value:
                if negated:
                    value = -value
                score += value
                hits.append(("not " if negated else "") + form)
                break
    for emoji in POSITIVE_EMOJIS:
        if emoji in text:
            score += text.count(emoji)
            hits.append(emoji)
    for emoji in NEGATIVE_EMOJIS:
        if emoji in text:
            score -= text.count(emoji)
            hits.append(emoji)
    return score, hits


def judge_sentiment(text):
    score, hits = score_text(text)
    positive_words = any(h in POSITIVE for h in hits)
    complaint = any(h in NEGATIVE or h.startswith("not ") for h in hits) or any(
        form in COMPLAINTS for w in words_of(text) for form in strip_prefix(w)
    )
    sarcasm = positive_words and (
        any(e in text for e in MOCKING_EMOJIS)
        or (complaint and any(e in text for e in IRONIC_EMOJIS))
    )
    if sarcasm:
        return "Negative", True, f"Praise with mocking emoji ({', '.join(hits[:4])}) - check"
    if score > 0:
        return "Positive", False, f"Positive cues: {', '.join(hits[:4])}"
    if score < 0:
        return "Negative", False, f"Negative cues: {', '.join(hits[:4])}"
    if hits:
        return "Neutral", False, f"Mixed cues cancel out: {', '.join(hits[:4])}"
    return "Neutral", False, "No opinion words or emojis found"


def brand_sentiment(text, brand, other_brands):
    """Sentiment toward one brand: look only at the part of the text about it."""
    norm = normalize(text)
    names = [brand["name"], *brand["aliases"]]
    # "A better than B": A positive, B negative.
    match = re.search(COMPARISON, norm)
    if match:
        before, after = norm[:match.start()], norm[match.end():]
        if any(contains_name(before, n) for n in names):
            return "Positive"
        if any(contains_name(after, n) for n in names):
            others = [o for o in other_brands if o is not brand]
            if any(contains_name(before, n) for o in others for n in [o["name"], *o["aliases"]]):
                return "Negative"
    parts = [p for p in re.split(CONTRAST_WORDS + r"|[.!?؟\n]", text) if p and p.strip()]
    mine = [p for p in parts if any(contains_name(p, n) for n in names)]
    sentiment, _, _ = judge_sentiment(" ".join(mine) if mine else text)
    return sentiment


def check_row(row, brands):
    text = row["text"]
    names = [n for b in brands for n in [b["name"], *b["aliases"]]]
    gender, gender_reason = guess_gender(row["author"], row["handle"], names)

    mentioned = [b for b in brands if any(contains_name(text, n) for n in [b["name"], *b["aliases"]])]
    brand_sents = [{"brand": b["name"], "sentiment": brand_sentiment(text, b, brands)} for b in mentioned]

    row_brand = row.get("brand", "")
    if row_brand:
        target = row_brand
    else:
        clients = [b for b in mentioned if b["role"] == "Client"]
        target = (clients or mentioned or [{"name": ""}])[0]["name"]

    sentiment, sarcasm, reason = judge_sentiment(text)
    target_info = next((b for b in brands if normalize(b["name"]) == normalize(target)), None)
    if target_info and target_info in mentioned:
        sentiment = next(s["sentiment"] for s in brand_sents if s["brand"] == target_info["name"])
        reason = f"Toward {target_info['name']}: " + reason

    if brands:
        relevant = bool(mentioned) or (bool(row_brand) and contains_name(text, row_brand))
    elif row_brand:
        relevant = contains_name(text, row_brand)
    else:
        relevant = True

    return {
        "id": row["id"],
        "gender": gender,
        "gender_reason": "Offline: " + gender_reason,
        "sentiment": sentiment,
        "sarcasm": sarcasm,
        "sentiment_reason": "Offline: " + reason,
        "target_brand": target,
        "brands_mentioned": [b["name"] for b in mentioned],
        "brand_sentiments": brand_sents,
        "relevant": relevant,
        # Offline mode can't judge whether a topic fits the text.
        "topic_fits": True,
        "suggested_topic": row["topic"],
    }


# ---------- topics ----------

def topic_key(label):
    key = normalize(label)
    key = re.sub(r"[^\w\s]", " ", key)
    words = []
    for word in key.split():
        if word.startswith("ال") and len(word) > 4:
            word = word[2:]
        if re.fullmatch(r"[a-z]{4,}s", word):
            word = word[:-1]  # plurals: prices -> price
        words.append(word)
    return " ".join(words)


def similar_topics(a, b):
    """Rough match: nearly the same spelling, one inside the other, or same word start."""
    a, b = topic_key(a), topic_key(b)
    if not a or not b:
        return False
    if a == b or SequenceMatcher(None, a, b).ratio() >= 0.85:
        return True
    if (a in b or b in a) and min(len(a), len(b)) >= 4:
        return True
    first_a, first_b = a.split()[0], b.split()[0]
    return len(a.split()) == len(b.split()) == 1 and first_a[:4] == first_b[:4] and len(first_a) >= 4


def unify_topics(labels, allowed_topics):
    """Group labels that are spelled almost the same. Biggest label names the group."""
    mapping = {}
    if allowed_topics:
        for label in labels:
            best = max(allowed_topics, key=lambda t: SequenceMatcher(None, topic_key(label), topic_key(t)).ratio())
            if not similar_topics(label, best):
                best = next((t for t in allowed_topics if similar_topics(label, t)), label)
            mapping[label] = best
        return mapping
    groups = []  # list of (key, display name)
    for label in labels:  # labels come sorted by row count, biggest first
        key = topic_key(label)
        for group_key, display in groups:
            if key == group_key or SequenceMatcher(None, key, group_key).ratio() >= 0.85:
                mapping[label] = display
                break
        else:
            display = label.strip().title() if re.search("[a-z]", label) else label.strip()
            groups.append((key, display))
            mapping[label] = display
    return mapping


# ---------- the fake client ----------

class OfflineMessages:
    def create(self, **request):
        payload = json.loads(request["messages"][0]["content"])
        if "topics" in payload:
            labels = [t["label"] for t in sorted(payload["topics"], key=lambda t: -t["rows"])]
            mapping = unify_topics(labels, payload.get("allowed_topics") or [])
            answer = {"mapping": [{"original": k, "unified": v} for k, v in mapping.items()]}
        else:
            brands = payload.get("brand_list") or []
            answer = {"results": [check_row(row, brands) for row in payload["rows"]]}
        block = SimpleNamespace(type="text", text=json.dumps(answer, ensure_ascii=False))
        return SimpleNamespace(stop_reason="end_turn", content=[block])


class OfflineClient:
    """Drop-in stand-in for anthropic.Anthropic() that uses the rules above."""

    def __init__(self):
        self.beta = SimpleNamespace(messages=OfflineMessages())
