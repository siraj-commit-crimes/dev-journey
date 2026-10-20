# Excel QC

A small web page for QC'ing social media monitoring sheets. Upload an Excel file and
Claude checks every row for:

- **Gender** (Male / Female / Unknown) from the author name and handle. Brands, news
  outlets and unclear accounts come back as Unknown.
- **Sentiment** (Positive / Negative / Neutral) from the Text/Content column, judged
  **toward your client or competitor**, not the general mood of the post. It reads
  emojis and catches sarcasm, in Arabic (including Gulf dialects), English and Arabizi.
- **Brands**: which of your client and competitors each post mentions, the sentiment
  toward each one, and posts that are **Irrelevant** (noise that isn't about any of them).
- **Topic**: merges labels that mean the same thing (e.g. `customer service`,
  `Customer Service` and `خدمة العملاء`) and flags rows whose topic doesn't match the text.

Nothing in your file is overwritten. You get back a new Excel file with:

| Sheet | What's in it |
|---|---|
| Summary | How many rows are OK, how many mismatches per check, and the topic count before and after unifying |
| QC Results | Your original columns plus `QC_Status`, `QC_Flags`, `QC_Gender`, `QC_Sentiment`, `QC_Sarcasm`, `QC_Topic`, `Unified_Topic` and a short reason for each. Wrong original cells are red and suggestions are yellow |
| Topic Mapping | Each original topic → its unified topic |
| Brand Sentiment | Positive / Negative / Neutral counts and net sentiment for the client and each competitor |

## Quick start: double-click

You need Python 3.10+ from https://www.python.org/downloads/ (on Windows, tick
**"Add python.exe to PATH"** in the installer).

- **Mac:** double-click `Start Excel QC (Mac).command`
- **Windows:** double-click `Start Excel QC (Windows).bat`

The first time, it sets everything up, which takes a minute or two. After that, it opens the
app in your browser straight away. Close the window that pops up to stop the app.

**Windows shortcut:** double-click `Create Shortcut (Windows).bat` once. It adds an
**Excel QC** icon to your desktop and Start menu, so you can press the Windows key, type
`Excel QC` and press Enter. To pin it to the taskbar, right-click the desktop icon →
**Show more options** → **Pin to taskbar**.

**Mac shortcut:** right-click `Start Excel QC (Mac).command` → **Make Alias**, then drag the
alias to the desktop.

If macOS says the file "can't be opened", right-click it → **Open** → **Open** (only needed once).

## Setup by hand (if you prefer the terminal)

```bash
pip install -r excel_qc/requirements.txt
```

You need an Anthropic API key from https://console.anthropic.com. Either paste it in
the app's sidebar, or set it once in your terminal:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Run

```bash
streamlit run excel_qc/app.py
```

The page opens in your browser. Then:

1. Upload the `.xlsx` (or `.csv`) file and choose the sheet.
2. Check the column guesses. The tool guesses from the headers; fix any that are wrong.
3. Start with the first 50 rows to see the quality and cost, then set it to 0 to run the whole file.
4. Add the client and competitors in the sidebar, one per line, with other spellings
   and handles after the name:
   ```
   Client: STC, اس تي سي, stc_ksa
   Competitor: Mobily, موبايلي
   Competitor: Zain, زين
   ```
   If the sheet has a column saying which brand each row is for (Brand, Query,
   Keyword...), pick it under **Brand / Query**. Sentiment for each row is then judged
   toward that brand. Without that column, the tool finds the brands in each post itself
   and compares your Sentiment column with the sentiment toward the client.
5. Optional: paste your team's approved topic list in the sidebar so every topic maps onto it.
6. Click **Run QC**, review the "Rows to check" table, then download the Excel file.

## Offline mode (free, no API key)

Pick **Offline rules (free, no AI)** in the Model menu. Instead of asking Claude, the
tool uses fixed rules from `offline_engine.py`:

- **Gender**: looks up the first name in lists of common Arabic and English names, and
  spots `abu_` / `um_` handles. Accounts with words like news, official, store, اخبار or
  الرسمي, or that match a brand from your list, are Unknown.
- **Sentiment**: counts positive and negative words and emojis (ممتاز, زفت, 😍, 😡...),
  flipping a word after a negation (ما عجبني = negative). Praise next to a mocking emoji
  (🙄 🤡), or 👏 next to a complaint, is marked as possible sarcasm.
- **Brands**: finds your brand names in the text and scores the part of the sentence
  about each one ("A better than B", "...بس...").
- **Topics**: merges labels that are spelled almost the same (`customer service` =
  `Customer Services`).

It's much weaker than Claude: it misses most sarcasm, dialect and context, can't merge
Arabic and English topics, and doesn't check whether a topic fits the text. Use it to
catch obvious mistakes. To teach it new words or names, add them to the lists at the top
of `offline_engine.py`.

## Cost and privacy

- Each request sends about 20 rows. Opus 5.5 gives the best results. Sonnet 5.5 and
  Haiku 5.5 are cheaper, so try them on a sample and compare.
- The row text, names and handles go to the Anthropic API. Check that your team is OK
  with that before uploading client data.

## Tests

```bash
cd excel_qc && python -m pytest
```

The tests use a fake Claude, so they need no API key.
