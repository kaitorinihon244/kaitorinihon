# Request relay setup (Gmail + Telegram + receipt)

**Status (2 Nov 2026):** deployed and connected to the site. Gmail and receipts work.
Web app URL: https://script.google.com/macros/s/AKfycbxAG-kODT-6sITS7capta4vWqdATSkk-A4B3tsFSIExgvYe4Vil7yUWsDAKmHRli1kp/exec
Apps Script project: 「買取日本 受付リレー」 in the kaitorinihon777 Google account.
**To add Telegram later:** open the project, put the bot token on the `TELEGRAM_TOKEN` line of
`saveSettings` (top of the code), Ctrl+S, Run. Then message the bot in Telegram and Run once more —
the chat id is saved automatically ("Telegram is now connected"). No redeploy needed.

The site's 「写真を送って相談する」 form sends each request to this Google Apps Script.
The script emails your Gmail (photos attached), posts to your Telegram, saves the photos
to Google Drive, logs a row in a Google Sheet, and makes a printable receipt.
It runs in your own Google account, for free. About 10 minutes.

## Member sign-in (Member.gs, installed 3 Nov 2026)
Customers sign in from the header (会員登録・ログイン) with their email + a 6-digit code sent from the shop's
Gmail. No passwords are stored. Members are listed in the 会員 tab (sign-in tokens are stored only as hashes).
New sign-ups are announced in Telegram. Signed-in customers get autofill on the 買取申込 form and a マイページ
with their order/request history. Gmail's sending limit for a normal account is about 100 emails a day.

## Online sales (Bot.gs, installed 2 Nov 2026, deployment version 4)
In 販売 mode every product shows 在庫あり and can be ordered from the 購入カート (store pickup or delivery).
Orders get an `S-…` number, go to the 販売注文 tab, your Gmail and Telegram, and the customer gets a
confirmation email. Payment is bank transfer within 3 days (status starts as 入金待ち).
- **Bank details:** add a Script property `BANK_INFO` (bank, branch, account type, number, holder name,
  one per line) for the customer email, and put the same text in the site editor:
  テキスト → オンライン販売（銀行振込） → 振込先. Until then the email says the bank details will follow.
- Statuses for S- orders: 入金待ち → 入金確認 → 発送済 / 受取済, or キャンセル (`/status S-261102-1234 入金確認`).
- The 20:00 summary lists unpaid orders and any past their payment deadline.

## Orders & stock bot (Bot.gs, installed 2 Nov 2026)
The project has a second file (shown as `Untitled.gs` in the editor) with the order/stock bot.
Triggers are installed (pollTelegram every minute, dailySummary at 20:00) and the sheet has 注文 and 在庫 tabs.
Once the Telegram token is saved, send the bot `/register <ADMIN_KEY>` (the ADMIN_KEY Script property; run `repairSettings` to see it in the log), then `/help`. The old receipt key no longer works for /register.

| Command | What it does |
|---|---|
| `/orders` | open orders (KT-…) and requests (RQ-…) |
| `/order KT-261102-1234` | full details |
| `/status KT-261102-1234 確認済` | change status (受付 確認済 来店待ち 到着待ち 査定中 査定済 支払済 完了 キャンセル) |
| `/in iPhone 15 Pro 256GB \| 中古A \| 115000 \| 138000 \| メモ` | add stock (name required, rest optional) |
| `/sold ST0001 [price]` | mark sold (shows profit) |
| `/stock [word]` | list in-stock items |
| `/del ST0001` | remove a mistaken entry |
| `/summary` | today's numbers (also sent automatically at 20:00) |

In-stock items (name, condition, selling price) appear on the site in 販売 mode, with an 在庫あり badge on matching products.

## 1. Create the script
1. Open https://script.google.com and sign in with the Gmail account that should receive requests.
2. Click **New project**. Rename it to `買取日本 受付リレー`.
3. Delete everything in `Code.gs`, then paste the whole contents of `relay/Code.gs` from this folder. Save (Ctrl+S).

## 2. Add the settings (kept out of the code)
1. Left menu: **Project Settings** (gear) → scroll to **Script properties** → **Add script property**.
2. Add these:

| Property | Value |
|---|---|
| `NOTIFY_EMAIL` | the Gmail address to receive requests |
| `TELEGRAM_TOKEN` | your bot's token from @BotFather (the same bot you already use is fine) |
| `TELEGRAM_CHAT_ID` | leave empty for now (step 3) |
| `RECEIPT_KEY` | any long random text, e.g. `kaitori-8f3k2m9q7x` — keeps receipt links private |
| `SHOP_NAME` | `買取日本` (optional) |

3. Click **Save script properties**.

## 3. Find your Telegram chat id
1. In Telegram, open your bot and send it any message (e.g. `hello`).
   To get requests in a group instead, add the bot to the group and send a message there.
2. Back in the script editor, choose `findTelegramChatId` in the function menu at the top and click **Run**.
   Google will ask for permission the first time: choose your account → **Advanced** → **Go to 買取日本 受付リレー** → **Allow**.
3. The log at the bottom shows `chat id: 123456789`. Put that number into the `TELEGRAM_CHAT_ID` property and save.

## 4. Deploy it
1. Click **Deploy** → **New deployment** → gear icon → **Web app**.
2. Description: `受付リレー`. **Execute as: Me**. **Who has access: Anyone**.
3. Click **Deploy**, allow access if asked, and copy the **Web app URL** (ends with `/exec`).

## 5. Test it
1. In the editor, choose `sendTest` and click **Run**. You should get a Gmail and a Telegram message,
   each with a link to the receipt. Open the receipt link and press 印刷する to check the printer.
2. Send the Web app URL to Claude (or paste it into the site editor:
   テキスト → 未掲載商品のご相談 → 受付システムのURL) and the form goes live.

## Receipt printer
Each Gmail and Telegram message has a 受付票 link: a receipt sized for 80mm paper.
Open it on the shop PC or tablet that has the receipt printer and press 印刷する.
For fully automatic printing, find the printer's model (label on the bottom or back):
- **Epson TM series** with Server Direct Print, or **Star** with CloudPRNT: the printer can
  pick up receipts from this script on its own. Send Claude the model and it can add that.
- **USB printer on a Windows PC**: a small script on that PC can print each new request.

## Changing the script later
After editing `Code.gs`, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
The Web app URL stays the same.

## Where things are
- Requests log: Google Drive → `買取日本 未掲載商品の相談` (Sheet; mark 対応状況 as you go)
- Photos: Google Drive → `買取日本 未掲載商品の相談（写真）` → one folder per request

## Security (3 Nov 2026, deployment version 6)
- **Spreadsheet safety:** text from the forms that starts with `= + - @` is stored as plain text, never as a formula.
- **Admin access:** `/register` needs `ADMIN_KEY` (Script property), which is not part of any link. 5 wrong tries per hour per chat.
- **Receipt links:** each link has its own signature; a forwarded link opens only that one receipt. Links made before v6 no longer open.
- **Rate limits:** per customer (email/phone): 5 orders, 5 purchases, 5 photo requests per hour; sign-in codes 6 per 6 hours per email and 40 per hour in total; customer confirmation emails 3 per address per 6 hours and 60 per hour in total; plus the overall 300 requests per hour.
- **Customer emails:** links typed into names, notes or items are removed before we email the customer.
- **Size limits:** orders/sign-in over 60 KB and photo requests over 12 MB are refused.
- **Prices:** order totals come from the customer's browser. Shop notifications say so; check the price before confirming payment or shipping.
- **Own domain:** `kaitori-site.zip` includes `_headers` (Content-Security-Policy with pinned script fingerprints, no framing, HTTPS-only, nosniff). Rebuild it with `work/build-site.ps1` after any page change, or the fingerprints will not match and the page will not run.
- `saveSettings` no longer deletes other settings.

## Stock bot and sales book (4 Nov 2026)
A second Telegram bot for stock staff. It sees stock and sales numbers only, never customer details.
- Setup: put its token on the `STOCK_BOT_TOKEN` line of `saveSettings`, Ctrl+S, Run, then restore the placeholder. Register with `/register <STOCK_KEY>` (Script property; printed by `setupStockBot`).
- Commands: `/in`, `/stock`, `/place`, `/places`, `/price`, `/sold`, `/del`, `/month`, `/model`, `/excel`, `/help`.
- **機種別集計** tab: totals per model (sold, sales, average/highest/lowest price, cost, gross). B2 = year, B3 = month (blank for the whole year).
- **売上記録** tab: one row per product model (機種名, 状態・カラー, 数量, 単価, 売上, 仕入原価, 粗利), added automatically by `/sold` (either bot) and when an S- order becomes 入金確認/発送済/受取済. キャンセル removes it. Rows can also be typed by hand.
- **月次集計** tab: live totals per month (sales, cost, gross, margin, stock in). Yellow cells (経費, メモ) are typed by hand. Change B2 to see another year.
- **Excel:** `monthlyReport` runs on the 1st at 09:00 and emails/sends last month's numbers with an .xlsx (月次集計, 機種別集計, 在庫, 売上記録 only, no customer tabs). `/excel` sends one any time.
- Link stock to an online order: `/sold ST0001 S-261104-1234` records the cost on that order instead of adding a second sale.
- These run from the saved code, so no new deployment is needed.

## Payment and customer emails (5 Nov 2026, deployment version 8)
Store pickup (deployment version 11): the customer pays at the store by cash, credit card, barcode payment and so on, with no bank details. The order starts as 来店待ち, is held for 3 days (`PAY_DAYS`), and is finished with `/status 番号 受取済`, which adds it to the sales log. `/paid` and `/ship` refuse these orders.

Out-of-stock items (deployment version 12): in 販売 mode, iPhones, Samsungs at or above `sell.stockMin` and anything on the stock sheet show 在庫あり. Everything else shows 在庫切れ・取り寄せ1〜2週間 and can still be ordered. Those orders are marked in the item lines, emails and Telegram, and staff must contact pickup customers when the item arrives.

Delivery orders (S-) are paid by bank transfer. The customer gets three emails:
1. **Order placed:** automatic, with the bank details from `BANK_INFO` and the payment deadline.
2. **Payment confirmed:** `/paid S-261105-1234 [入金額]` in the order bot. A different amount is refused and nothing is sent. `/status 番号 入金確認` does the same. The number can also be typed as it appears on the bank statement (`S2611051234`).
3. **Shipped:** `/ship S-261105-1234 ヤマト 123456789012` (ヤマト, 佐川 or 日本郵便) saves the tracking number and emails it with a tracking link. It needs payment confirmed first. A different number sends a correction email. Pickup orders have no third email: use `/status 番号 受取済`.

The order bot accepts `paid`, `ship`, `status`, `order`, `orders` and `help` with or without the slash, in any case. Each command a bot receives is written to the execution log (command and first word only).

Mail-in buyback (KT- 郵送買取) orders email the customer automatically with the order details and the shipping address (`MAIL_TO` in Bot.gs and in the page, deployment version 9). The Telegram alert says whether it was sent. The 予約承認メール is still sent by staff. In-store orders get no customer email.

Mail-in orders must include the customer's bank account (deployment version 10). The full details are only in the 注文 tab, columns P–T. Emails, Telegram alerts and `/order` show the last 4 digits. Limit who can open that sheet.

Changing the 状態 cell in the sheet by hand does not send anything. 販売注文 columns R–U hold the carrier, tracking number and when each email was sent. If an email fails, the bot says so and gives the command to resend. The stock bot never sees customer details, so these commands are on the order bot only.

## RJP codes (4 Nov 2026, deployment version 7)
Every product on the site has an RJP code (RJP-000001…). The JAN stays in the data, hidden from customers.
- **商品マスタ** tab: RJP code, model, category, JAN and buy prices, pushed from the site's data. After products or prices change, re-run it with `work/sync-master.ps1 -Site work\site.json -Key <ADMIN_KEY>` (the script has Japanese comments, so save a copy with a UTF-8 BOM if PowerShell complains). The tab is replaced on each sync; don't type into it.
- **Stock:** send one line to the stock bot, such as `RJP-000005 ブラック 新品`. `/in` is optional, the words can be in any order and `rjp5` also works. Numbers are the buy then selling price: `RJP-000005 ブラック 新品 190000 225000`. Stock has no locations, because it's shared across all stores (在庫 column K is hidden and unused). `/price ST0002 140000` changes every in-stock unit with the same code and 状態. With no buy price, 新品/未開封 and 中古 use the listed price from 商品マスタ. An unknown code is refused. Items with no code use `/in 商品名 | 状態 | 買取価格 | 販売価格 | 場所 | メモ`. 在庫 column L holds the code.
- **Sales:** 売上記録 column E and 機種別集計 column A hold the code. Online orders carry it in the item lines as `[RJP-000005] 機種名（カラー） ×1 ¥230,000`, so it also shows in order emails and Telegram.
- `/model RJP-000005` and `/stock RJP-000005` search by code. The Excel file now includes 商品マスタ.
