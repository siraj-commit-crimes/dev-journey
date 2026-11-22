# CARMA Trend Radar (prototype)

A morning brief of rising topics CARMA could post about today. For each topic the
brief says why it matters, the angle, what to ask the analysts for, and draft
LinkedIn captions in English and Arabic. Numbers stay as `[X]` until an analyst
checks them. Nothing is posted automatically.

See [`example/`](example/) for a real brief made from topics trending on 22 Nov 2026.

## How it works

1. **Listen.** Collects rising topics from free public sources:
   - Google Trends daily searches for the UAE, Saudi Arabia, Qatar and the UK
   - Wikipedia's most viewed pages yesterday (English and Arabic)
   - GDELT news searches for CARMA themes (reputation, AI, Gulf business, events)
2. **Filter.** Drops everyday searches (scores, weather) and anything on the
   never-touch list (tragedy, religion, royal families, elections). This
   check runs in code, before and after Claude. War and conflict topics stay in,
   but the brief marks them as needing an extra sign-off from Paul.
3. **Score.** Claude rates each topic on relevance, data angle (can CARMA add its own
   numbers within 24 hours?) and safety, then writes the angle, the analyst request and
   the captions. Score = 35% relevance + 40% data angle + 25% speed.
4. **Brief.** Saves an HTML page, Markdown, a Microsoft Teams card and the raw topics
   to `output/`, and can post the card to a Teams channel.

## Run it

```bash
cd trend_radar
pip install -r requirements.txt
```

Pick one way to score:

```bash
python radar.py --subscription      # Claude via Claude Code and your Pro/Max plan, no API key
python radar.py                     # Claude via the API (set ANTHROPIC_API_KEY)
python radar.py --offline           # keyword rules only: free, but much less smart
```

Useful options:

- `--sample` uses the saved topics in `sample_trends.json` instead of the internet
- `--no-news` skips GDELT, the slowest source
- `--size 3` changes how many topics make the brief (default 5)
- `--teams` posts the brief to Teams (see below)

Then open `output/brief-<date>.html`.

## Post to Teams

1. In Teams, open the channel, then **Workflows** → "Post to a channel when a webhook
   request is received". Copy the webhook URL it gives you.
2. Set it and run with `--teams`:

```bash
export TEAMS_WEBHOOK_URL="<the URL from Workflows>"
python radar.py --subscription --teams
```

## Tune it

Everything is in `config.py`: regions, CARMA themes and keywords, the never-touch
list, the everyday-search filter and the brief size. Agree the never-touch list
with the marketing manager before using the brief for real posts.

## Limits of the prototype

- **Sources.** Free sources are a stand-in. The real version should read CARMA's own
  monitoring platform and Noor, which see coverage spikes before they trend. Google
  News RSS (personal use only) and Reddit (needs an approved app) are left out on purpose.
- **GDELT** allows one request every 5 seconds and refuses busy shared networks; the
  brief lists any source that failed.
- **One request.** Claude reads the top 30 candidates in one request. Most days only
  1 to 3 topics are worth posting, and that is the point.

## Tests

```bash
python -m pytest trend_radar
```
