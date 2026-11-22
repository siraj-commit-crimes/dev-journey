"""CARMA Trend Radar: the morning brief of topics CARMA could post about today.

Examples:
    python radar.py                  # live sources, Claude scoring (needs an API key)
    python radar.py --offline        # live sources, keyword rules, no API key
    python radar.py --sample --offline   # saved sample topics, works without internet
    python radar.py --teams          # also post the brief to Teams (TEAMS_WEBHOOK_URL)

The brief is saved to output/ as HTML, Markdown, the Teams card and the raw topics.
"""

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

import config
import report
import scoring
import sources

HERE = Path(__file__).parent
SAMPLE = HERE / "sample_trends.json"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="CARMA Trend Radar daily brief")
    parser.add_argument("--offline", action="store_true", help="score with keyword rules instead of Claude")
    parser.add_argument("--subscription", action="store_true",
                        help="run Claude through Claude Code with your Pro/Max plan (no API key)")
    parser.add_argument("--sample", action="store_true", help="use sample_trends.json instead of the internet")
    parser.add_argument("--no-news", action="store_true", help="skip GDELT news (it is the slowest source)")
    parser.add_argument("--teams", action="store_true", help="post the brief to TEAMS_WEBHOOK_URL")
    parser.add_argument("--model", default=scoring.DEFAULT_MODEL)
    parser.add_argument("--effort", default="medium", choices=["low", "medium", "high", "xhigh", "max"])
    parser.add_argument("--size", type=int, default=config.BRIEF_SIZE, help="topics in the brief")
    parser.add_argument("--out", default=str(HERE / "output"))
    return parser.parse_args(argv)


def run(args, log=print):
    today = dt.date.today().isoformat()
    log("Collecting topics...")
    if args.sample:
        trends, problems = json.loads(SAMPLE.read_text(encoding="utf-8")), []
        log(f"  sample file: {len(trends)} topics")
    else:
        trends, problems = sources.collect(log=log, use_news=not args.no_news)

    safe, blocked = scoring.split_safe(trends)
    candidates = scoring.shortlist(safe)
    log(f"{len(trends)} topics, {blocked} skipped by the never-touch list, {len(candidates)} shortlisted")

    if args.offline:
        scorer = "keyword rules"
        scored = scoring.score_offline(candidates)
    else:
        scorer = f"Claude ({args.model})"
        client = scoring.make_subscription_client() if args.subscription else scoring.make_client()
        log(f"Asking {scorer}...")
        scored = scoring.score_with_claude(client, candidates, args.model, args.effort)

    top = scored[: args.size]
    meta = {
        "date": today, "scorer": scorer, "candidates": len(trends),
        "blocked": blocked, "problems": problems,
    }
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "html": out / f"brief-{today}.html",
        "markdown": out / f"brief-{today}.md",
        "teams": out / f"teams-card-{today}.json",
        "topics": out / f"topics-{today}.json",
    }
    card = report.to_teams_card(top, meta)
    files["html"].write_text(report.to_html(top, meta), encoding="utf-8")
    files["markdown"].write_text(report.to_markdown(top, meta), encoding="utf-8")
    files["teams"].write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
    files["topics"].write_text(json.dumps(trends, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.teams:
        url = os.environ.get("TEAMS_WEBHOOK_URL")
        if not url:
            raise SystemExit("Set TEAMS_WEBHOOK_URL to post to Teams.")
        log(f"Posted to Teams (status {report.post_to_teams(url, card)})")

    log(f"Done: {len(top)} topics in the brief")
    for name, path in files.items():
        log(f"  {name}: {path}")
    return top, meta, files


if __name__ == "__main__":
    try:
        run(parse_args())
    except KeyboardInterrupt:
        sys.exit(1)
