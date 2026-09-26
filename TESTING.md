# Testing KasiDeposit

## Run it

```powershell
cd D:\KasiDeposit\KasiDepositUi
cp .env.example .env      # first time only; .env itself is gitignored
npx expo start
```

Open **Expo Go** on an Android phone on the same Wi-Fi, scan the QR code (or choose *Enter URL
manually* and type `exp://<your PC's Wi-Fi IP>:8081`). No Expo account is needed for LAN mode.

The default `.env` runs the app on the **fake API** (`EXPO_PUBLIC_USE_FAKE_API=true`). Each call is
logged in the terminal running Metro as `[fake-api] ...`. The log never contains the PIN or the
ShapID, only the scenario digit.

**Changing `.env` needs more than a server restart.** `EXPO_PUBLIC_*` values are baked into the JS
bundle once, at load time. Restart with `npx expo start --clear`, **and** fully reload the app on
the device itself (shake for the dev menu, tap Reload; or close and reopen it) — otherwise it keeps
running on the old bundle and nothing appears to have changed, which looks like a bug but isn't.

Checks that need no phone:

```powershell
npm test               # unit tests (pure logic)
npx tsc --noEmit       # strict type check
npx expo-doctor        # dependency and config check
```

## Demo scenarios: registering (fake API)

A fresh install opens **Register**: full names and SA ID number only. The app checks the ID
itself first (13 digits, a real birth date, the citizenship digit, the check digit, and 18 or
older), so bad ones never reach the fake. The **ID number's sequence digits** (positions 7-10)
pick the server's answer. Every ID works repeatedly.

| ID number | What should happen |
|---|---|
| `8001015009087` (or any other valid adult ID) | Registers. One haptic, then **How do you want to get paid?** |
| `8001010000081` | *We couldn't verify these details with Home Affairs...* under the form, details still filled in. |
| `8001010001089` | *This ID number is already registered with different details...* |
| `8001010003085` | *No connection. Check your data and try again.* Tap **Continue** again. |
| `8001015009088` | Never sent: *That isn't a valid SA ID number...* under the field (wrong check digit). |
| `0809275001083` | Never sent: *You must be 18 or older...* (18 on 27 Sep 2026; change the date to test the edge). |

Things to confirm: the ID number is not saved on the phone (only a session token and the names
are), and closing the app mid-registration just shows Register again. A phone that was set up
before this change opens Register once; its history is kept, its old saved number is not (add it
again as a payout method).

## Getting paid: PayShap or a bank account

Straight after registering: **How do you want to get paid?** with two cards, **PayShap** and
**Bank account**. Nothing is assumed; each is checked when it is added, and whichever one fails
offers the other. The first one added is what *Paying into* uses. Later, **Change** on the PIN
screen (or **Pay into a different account** on confirm) opens **Where your money goes**: every
saved number and account as a card. Tap a card to pay into it (it shows *Paying into* with a tick,
and you go back); **Remove** asks first. Up to 5.

**PayShap number** (fake API: the last digit picks the scenario; on the real API, list the number
on the till page's *PayShap numbers (demo)* first — see the API README):

| Number ends in | What should happen |
|---|---|
| `082 555 1234`, or anything not listed below | Added in your own masked name, e.g. **T. Mokoena** for Thabo Mokoena, Capitec. |
| `...5` | *This PayShap number is registered to someone else...* and **Use a bank account instead**. |
| `...9` | *We couldn't find that number on PayShap...* and **Use a bank account instead**. |
| `...8` | *This account can't receive PayShap payments right now...* and **Use a bank account instead**. |
| `...7` | *...registered at more than one bank...* and the bank list appears; tap one to add it there. |
| `...6` | *No connection. Check your data and try again.* Never implies the number is wrong. |

**Bank account.** The holder is your registered name, shown and not editable. Choose a bank and
type the account number (grouped as you type). The account number's last digit picks the scenario:

| Account number ends in | What should happen |
|---|---|
| `...0` to `...7`, e.g. `1234 564 417` | Added as **Thabo Mokoena · Capitec · ••••4417**. |
| `...9` | *We couldn't find that account at that bank...* |
| `...8` | *This account is not in your name...* and **Use PayShap instead**. |

Confirm the full account number never shows again anywhere after adding (cards, confirm, status,
history all show `••••4417`). None of these messages say the money is safe: nothing has moved yet.
The fake forgets its saved methods when the app reloads; the phone's copy still shows *Paying
into*, and a deposit to it still works.

## Your deposits

**Your deposits** on the PIN screen lists deposits newest first: amount received, status in words
(*Sending*, *On its way*, *Paid*, *Not sent*), where it went, and when. Tap a row for the details:
amount received, voucher value, fee, paid into, sent at, and a selectable reference. A deposit
that hadn't finished when last seen checks its latest status on open and offers **Follow this
deposit**.

- The list merges the server's copy (`GET /v1/me/deposits`) with what the phone saved. In airplane
  mode it shows the phone's copy with *No connection. Showing what's saved on this phone.*
- The fake API only remembers deposits made since the app started. After a reload, the list is
  what the phone saved.
- The phone keeps the 20 most recent.

## Demo scenarios: voucher PIN (fake API)

The **last digit of the PIN** picks the scenario. Type or paste any 16 digits ending in it. Every
PIN below works repeatedly, because the fake hands out a fresh voucher on each lookup.

| PIN | Ends in | Voucher | What should happen |
|---|---|---|---|
| `1234 5678 9012 3450` | 0 | R500.00, fee R5.00 | Confirm shows **R495.00**. Status: *Sending your money*, then *On its way* (about 1.5 s), then **R495.00 is in your account** (about 3 s, plus a poll). One success haptic. |
| `1234 5678 9012 3451` | 1 | already used | Stays on the PIN screen: *This voucher has already been used.* PIN stays in the field. |
| `1234 5678 9012 3452` | 2 | R200.00 | Confirm **R195.00**. Ends *We couldn't send this deposit. We couldn't send this right now. Your money is safe and hasn't been lost.* with **Try again later**. |
| `1234 5678 9012 3453` | 3 | R1 000.00 | Confirm **R995.00**. Ends *We couldn't send this deposit. The bank is temporarily unavailable. Your money is safe and hasn't been lost.* with **Try again**. |
| `1234 5678 9012 3454` | 4 | no signal | *No connection. Check your data and try again.* on the PIN screen. Never says the voucher is bad. |
| `1234 5678 9012 3455` | 5 | R50.00 | Confirm **R45.00**. Stays *On its way*, becomes **Still processing** at 90 s (never "failed"), then **R45.00 is in your account** at about 101 s. |
| `1234 5678 9012 3456` | 6 | R8.00 | Lookup works. Confirm shows *This voucher is too small to deposit. The minimum is R10.00.* and a disabled **Can't send this voucher**. |
| `1234 5678 9012 3457` to `...3459` | 7, 8, 9 | not found | *We couldn't find that PIN. Check each digit against your till slip.* |

Both scenarios 2 and 3 end with the reassurance sentence: once a deposit exists, settlement was
attempted, so every outcome — however it fails — says the money is safe. Every status screen also
shows a selectable **Reference: KD-XXXXXX**.

## Scan a voucher

The PIN screen's **Scan voucher QR** button opens the camera. A scan never sends money by
itself: it does exactly what typing the PIN and tapping Continue does — look the voucher up,
then show the same confirm screen. Nothing is sent until Send is tapped.

- **Fake API.** Any QR generator can make one. Encode
  `kasideposit://redeem?pin=<16 digits>` — the PIN's last digit picks the fake scenario, exactly
  as for a typed PIN (see the table above).
- **Real API.** Sell a voucher at `https://kasidepositapi.onrender.com/till` and scan the QR on
  the slip next to the PIN.

Cases to walk through:

- **A good scan.** It reaches the confirm screen with the right amount, and nothing is sent
  until Send is tapped.
- **An already-used voucher.** Scan a QR for a voucher that has already been redeemed: the same
  *This voucher has already been used* message appears, and the camera resumes scanning.
- **A non-KasiDeposit QR.** Point it at any other QR code (a website, a WhatsApp contact, ...):
  *This isn't a KasiDeposit voucher...* appears without navigating anywhere, and scanning
  continues — try several in a row and confirm the screen never floods with repeated messages.
- **Camera permission denied.** Deny it once: the explanation appears with **Try again** and
  **Type the PIN instead**. Deny it so it can't be asked again (or turn it off in the phone's app
  settings first): **Open settings** appears instead of **Try again**.
- **Back button.** From the scan screen, Android back returns to the PIN screen.

## Flows to walk through on the phone

**First run.** Register with `8001015009087` and your own names. **How do you want to get
paid?** opens with no back button. Tap **PayShap**, type `082 555 1234` (or paste `0825551234`, or
`+27 82 555 1234`). **Add** enables once the number is valid; tap it. After *Checking with PayShap*,
one haptic, then the PIN screen shows *Paying into 082 555 1234 · Capitec*.

**Someone else's number, then an account.** Register, choose PayShap and type a number ending in
`5`: *This PayShap number is registered to someone else...* Tap **Use a bank account instead**:
the account screen opens with your name as holder. Add `1234 564 417` at any bank: the PIN screen
shows *Paying into ••••4417 · <bank>*.

**The ambiguous path.** Add a number ending in `7`: the bank list appears under the message. Tap a
bank: it is added at that bank without retyping the number.

**Switching and removing.** From the PIN screen tap **Change**. Add a second method with the
buttons at the bottom; it becomes *Paying into*. Tap the other card: back on the PIN screen, *Paying
into* follows. Remove the one in use: the other becomes *Paying into*. Remove the last one: the
list says so, and the PIN screen sends you to add one before a deposit.

**A full deposit end to end.** With a payout method added, open the app fresh: it goes straight to
the PIN screen showing *Paying into ... · ...*. Enter a PIN ending in `0`, confirm (voucher value
and fee still show, above **You'll receive R495.00**, and **Paid into** shows **T. Mokoena** /
**Capitec · ••• ••• 1234**), send, and watch it complete.

**Clearing failure vs identity failure, side by side.** Add a PayShap number ending in `9` and note the message never says the money is safe. Then do a full deposit
with PIN ending in `3` (bank_unavailable) and note the status screen's message *does* say it.
Same underlying rule, opposite phases: nothing had moved in the first case, something was
attempted in the second.

**PIN editing.** Type 16 digits (grouped as you go). Fix a digit in the middle: the cursor stays.
Backspace over a space: one digit goes. Paste `PIN: 1234-5678-9012-3456 thanks`: it is accepted.
Paste 17 digits: *That doesn't look like a 16-digit PIN* and nothing changes. Continue is disabled
until exactly 16. (Unchanged by the ShapID migration — verify it still works exactly as before.)

**Resume after close.** Use voucher scenario 5. Tap Send, then fully close the app (swipe it away)
and reopen it. It should land on the status screen mid-deposit, then finish. After the result has
been shown, reopening goes to the PIN screen.

**Double tap.** Tap **Send** twice quickly. The terminal must show exactly one
`createDeposit ... new deposit` line. Idempotency itself (same key, same deposit, two requests at
once, changed destination) is covered by `src/api/fake.test.ts`.

**Backgrounding while adding.** Type a valid number and tap **Add**; while *Checking with PayShap*
is showing, switch to another app for a few seconds and come back. It should finish once, not
twice, and land on the PIN screen (or the list).

**Backgrounding elsewhere.** On the status screen with voucher scenario 5, go to the home screen
for 30 seconds and come back. It should poll straight away and carry on. On the PIN and add
screens, switch apps and return: what you typed is still there.

**Back button (Android).**

| Screen | Back does |
|---|---|
| Register, first-run "How do you want to get paid?", PIN screen | leaves the app |
| Adding a PayShap number or account | back to the choice or the list, nothing saved |
| Where your money goes | back to where it was opened from, *Paying into* unchanged |
| Confirm | returns to the PIN screen (blocked while Send is in flight) |
| Status | always goes to the PIN screen, never to confirm |
| Scan | returns to the PIN screen (its default stack parent — no special handling needed) |

## Airplane mode

The fake API makes no network calls, so airplane mode changes nothing while it is on. Two ways to
see the offline behaviour:

1. **A PayShap number ending in 6** (adding) or **a PIN ending in 4** (deposit) simulates no signal.
2. **Real client:** set `EXPO_PUBLIC_USE_FAKE_API=false` and `EXPO_PUBLIC_API_BASE_URL` to any
   unreachable address (for example `http://10.255.255.1`), restart with `--clear`, and try
   resolving a number, or enter any PIN. After up to 15 seconds you should see *No connection.
   Check your data and try again.* On confirm the message also says your money is safe, and
   pressing Send again reuses the same idempotency key. On the status screen, turn airplane mode
   on mid-deposit: the status stays, and a small *No connection — we'll keep trying* line appears
   and goes away when the signal returns.

## Accessibility and layout

- **Screen reader (TalkBack).** Every button, bank row and field is announced with a role and
  label. The PIN field announces *Voucher PIN, N of 16 digits entered*. Amounts are spoken as
  *495 rand*. A PayShap number is spoken as *082 555 1234 at Capitec*; an account as *account
  ending 4417 at Capitec* — neither is ever read as bullet characters. Each card on **Where your
  money goes** reads its kind, name and where, says *paying into this one* when selected, and is a
  radio button; **Remove** is its own button.
- **130% font size.** Settings, Display, Font size. Every screen scrolls and nothing should clip or
  overlap, including the add-PayShap screen with the bank picker revealed and an error showing. The PIN
  text deliberately stays at 24 sp (see below) and everything else scales.
- **320 dp width.** On a phone or emulator, set the display to 320 dp wide (for example
  `adb shell wm size 640x1136` and `adb shell wm density 320`, undo with `wm size reset` and
  `wm density reset`). The PIN must sit on one line.
- **Reduce motion.** With *Remove animations* on, the status fade is skipped.
- **Sunlight.** Text pairs meet WCAG AA (checked in `src/theme.test.ts`), but only your eyes outdoors
  can say whether it is comfortable.

## The checklist: what is guaranteed by code, and what needs a device

| Item | Covered by | Still needs a phone |
|---|---|---|
| Roles and labels on everything interactive | every control goes through `Button`, `TextField` or `BankList`, which set them | TalkBack pass |
| PIN announces digit count | label is `Voucher PIN, N of 16 digits entered` | TalkBack pass |
| Amounts spoken as "495 rand"; destinations never read the mask | `spokenRand`, `spokenAmounts`, `describeDestination`'s `spokenOneLine`, all tested | TalkBack pass |
| Contrast, touch targets, spacing | `src/theme.test.ts` | sunlight |
| 320 dp and 130% font | every screen scrolls, text wraps, PIN width worked out at 24 sp | **yes** |
| Safe areas | every screen is inside `Screen` (safe-area-context) | notched device |
| Android back, incl. the confirmation panel | per screen, see table | **yes** |
| Rotation | **locked to portrait** (`app.json`): on a small phone a landscape keyboard leaves about 100 dp of screen, unusable for PIN entry | none |
| Backgrounding, incl. mid-resolution | state is React state; a ref guards `resolveShapId` and `createDeposit` against a duplicate call the same way Send already is; polling pauses and resumes | **yes** |
| Airplane mode, no crash or blank | network errors map to the message; screens never wait on a failed load; a render crash shows a recovery screen | **yes** (real client) |
| No unhandled rejections | every promise is awaited in a try/catch or has a catch | watch the Metro log |
| No console warnings | none known | watch the Metro log |
| PIN and ShapID never stored or logged in the clear | PIN only in component state; the ShapID is only logged as its scenario digit, never the number | none |
| Identity failures never say "safe"; clearing failures always do | `src/copy.test.ts`'s loop over every `FailureReason`, and `src/errorMessage.test.ts` | none |

## Known limits

- **App killed mid-send, or mid-add.** If Android kills the app after Send (or after tapping Add)
  but before the reply arrives, the deposit — or the payout method — may exist server-side while
  the app has no record of it. Reopening starts fresh either way: a new lookup gets a new
  idempotency key, and adding the same number or account again returns the one already saved. The
  real backend refusing a second redemption is what keeps this safe.
- **Portrait lock and large screens.** Android 16 ignores orientation locks on screens 600 dp and
  wider. The layout is a centred column, so it still works.
- **Reset to first run.** There is no reset button. Clear Expo Go's storage
  (Settings, Apps, Expo Go, Storage, Clear data).
- **Fake API is per process.** It forgets which vouchers it has redeemed when the app restarts, but
  deposit status still works after a restart because the scenario and start time are in the id.
  `resolveShapId` has no state to forget: every call is a pure function of the number typed.
- **The masked scheme-name format, and the `@bank` suffix format**, are best-understanding
  assumptions, not verified against primary PayShap documentation. Flagged in code comments
  (`src/api/types.ts`, `src/api/wire.ts`) where they are relied on.
