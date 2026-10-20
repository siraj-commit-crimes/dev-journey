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

You then **review** the flagged rows in the app (accept the suggestion, keep the
original, or pick another value) and download a new Excel file. Nothing in your
original file is overwritten. The download has:

| Sheet | What's in it |
|---|---|
| Summary | Which mode was used, how many rows are OK, mismatches per check, topic count before and after unifying, and how many flagged items you reviewed |
| Final Data | Your original sheet with your review decisions filled in. Cells that changed are green. This is the sheet to send back |
| QC Results | Your original columns plus every suggestion and reason (`QC_Gender`, `QC_Sentiment`, `QC_Sarcasm`, `QC_Topic`...), the `Final_*` values and `Review_Status`. Wrong original cells are red and suggestions are yellow |
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

## Three ways to check

Pick one under **How to check** in the sidebar:

| Mode | Needs | Cost | Quality |
|---|---|---|---|
| **Subscription** | Claude Code installed and logged in with your Claude Pro or Max account | Included in your plan, within its usage limits | Claude |
| **API key** | An API key from https://console.anthropic.com with credit | Pay per use | Claude |
| **Offline** | Nothing | Free | Word and name lists only: much weaker |

### Set up Subscription mode (one time, Windows)

1. Open **PowerShell** and install Claude Code:
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
2. Close PowerShell, open a new one, and run `claude`. Log in with your Claude account in
   the browser that opens, then type `/exit`.
3. In the app, pick **Subscription** and click **Check again**. It should say *Ready*.

On a Mac, use `curl -fsSL https://claude.ai/install.sh | bash` in step 1.

Each batch of rows is one Claude Code request and counts toward your plan's usage
limits, like chatting does. Big files can hit the limit: start with 50 rows, use
**Sonnet** or **Haiku** on Pro, and if rows come back as *Error* with "usage limit",
wait for the reset and run again. Requests run in an empty temporary folder with
Claude Code's file and command tools turned off, so post text can't make it run
anything on your computer.

## Setup by hand (if you prefer the terminal)

```bash
pip install -r excel_qc/requirements.txt
```

For **API key** mode, either paste the key in the app's sidebar, or set it once in
your terminal:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Run

```bash
streamlit run excel_qc/app.py
```

The page opens in your browser. Pick **Subscription**, **API key** or **Offline** in
the sidebar, then follow the four steps at the top:

1. **Upload**: drop in the `.xlsx` or `.csv` file and choose the sheet.
2. **Columns**: check the guesses (Text, Author, Handle, Gender, Sentiment, Topic,
   Brand / Query) and fix any that are wrong. The preview shows what each one holds.
3. **Setup**:
   - Add the client and competitors to the table, with Arabic spellings, nicknames
     and handles separated by commas (e.g. `STC` → `اس تي سي, stc_ksa`).
   - If the sheet has a column saying which brand each row is for, pick it under
     **Brand / Query** in step 2. Sentiment for each row is then judged toward that
     brand. Without it, the tool finds the brands in each post itself.
   - Optional: paste your team's approved topic list.
   - Choose **First 50 rows (test)** to check the quality and cost first, then run **All rows**.
4. **Review & download**:
   - The cards show how many rows are OK, to check, sarcastic and irrelevant.
   - **Review** tab: for each kind of flag (Gender, Sentiment, Topic, Irrelevant), set the
     **Final** value per row, or use **Accept all suggestions** / **Keep all originals**.
     Rows left on *To review* keep their original value.
   - **Brands** tab: sentiment share for the client and each competitor.
   - **Topics** tab: see which labels were merged; edit the Unified names and click Apply.
   - Click **Download Excel**.

## Offline mode (free, no API key)

Pick **Offline** under Checking mode in the sidebar. Instead of asking Claude, the
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
