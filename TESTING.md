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

## Demo scenarios: PayShap number (fake API)

The **last digit of the cellphone number** picks the scenario, on the setup screen. `082 123 4567`
resolves normally; the table below covers every other digit. Every number works repeatedly.

| Number ends in | What should happen |
|---|---|
| `082 123 4560`, or anything not listed below | Resolves as **M. Mothiba**, Capitec. |
| `082 123 4567` | *This number is registered at more than one bank. Choose which bank should receive your money.* The bank picker appears below the field. |
| `082 123 4568` | *This account can't receive PayShap payments right now. Check with your bank.* |
| `082 123 4569` | *We couldn't find that number on PayShap. Check the digits, or register your number in your banking app.* |
| `082 123 4566` | *No connection. Check your data and try again.* Never implies the number is wrong. |

None of these messages say the money is safe — nothing has moved yet at this point. Contrast with
the voucher table below, where every listed failure happens *after* Send and always does.

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

## Flows to walk through on the phone

**First run, a good number.** Fresh install opens *Where should your money go?* with no red
errors and Continue disabled, with *Enter your cellphone number* underneath. Type
`082 123 4560` (or paste `0821234560`, or `+27 82 123 4560` — any format from the ShapID table in
the brief works). Continue enables once the number is valid; tap it. After the loading state
(*Checking your number*) you land on **Is this you?** showing **M. Mothiba** and **Capitec**.
Tap **No, change number**: you're back on the form with the number still there. Tap **Continue**
again, then **Yes, save this**: one haptic, then the PIN screen shows *Paying into 082 123 4567 ·
Capitec*.

**The ambiguous path.** Type a number ending in `7` (e.g. `082 123 4567`). Continue shows *This
number is registered at more than one bank* and a bank list appears underneath. Tap a bank (say
Capitec): it resolves immediately to **Is this you?** showing that bank. Save as above — the saved
destination is qualified to that bank, and reopening Change details later shows the same number.

**Not found and suspended.** A number ending in `9` shows *We couldn't find that number on
PayShap...* under the field; the number stays so a digit can be fixed. A number ending in `8`
shows *This account can't receive PayShap payments right now...* Neither stores anything, and
neither shows the "money is safe" sentence — nothing has moved.

**Offline on setup.** A number ending in `6` shows *No connection. Check your data and try again.*
It never implies the number itself is wrong.

**Change-number mode, including Cancel.** From the PIN screen tap **Change**. The field is
prefilled with the saved number (via its local display form, e.g. `082 123 4567`, never the raw
`+27...`). **Cancel** returns without saving or re-resolving. Typing a different number and saving
always re-resolves first — you always see **Is this you?** again before anything is overwritten,
even if you type the same number back.

**A full deposit end to end using a saved destination.** With a destination already saved, open
the app fresh: it goes straight to the PIN screen showing *Paying into ... · ...*. Enter a PIN
ending in `0`, confirm (voucher value and fee still show, above **You'll receive R495.00**, and
**Paid into** shows **M. Mothiba** / **Capitec · ••• ••• 4567**), send, and watch it complete.

**Clearing failure vs identity failure, side by side.** Do the not-found walkthrough above (setup,
number ending in `9`) and note the message never says the money is safe. Then do a full deposit
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

**Backgrounding during resolution.** On setup, type a valid number and tap Continue; while
*Checking your number* is showing, switch to another app for a few seconds and come back. It
should finish resolving once, not twice, and land on the same **Is this you?** panel. (There is no
scenario digit that makes resolution itself slow — this checks that backgrounding mid-request
doesn't duplicate the call, not a timing window.)

**Backgrounding elsewhere.** On the status screen with voucher scenario 5, go to the home screen
for 30 seconds and come back. It should poll straight away and carry on. On the PIN and setup
screens, switch apps and return: what you typed is still there.

**Back button (Android).**

| Screen | Back does |
|---|---|
| First-run setup, PIN screen | leaves the app |
| Setup, "Is this you?" panel | behaves as **No, change number** — never dismisses without a choice |
| Change details | cancel, no save |
| Confirm | returns to the PIN screen (blocked while Send is in flight) |
| Status | always goes to the PIN screen, never to confirm |

## Airplane mode

The fake API makes no network calls, so airplane mode changes nothing while it is on. Two ways to
see the offline behaviour:

1. **A number ending in 6** (setup) or **a PIN ending in 4** (deposit) simulates no signal.
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
  *495 rand*. A ShapID destination is spoken as *082 123 4567 at Capitec*; an account destination
  (the dormant fallback) as *account ending 4417 at Capitec* — neither is ever read as bullet
  characters. The "Is this you?" panel reads in order: the question, the name, the bank, then the
  two buttons.
- **130% font size.** Settings, Display, Font size. Every screen scrolls and nothing should clip or
  overlap, including the setup screen with the bank picker revealed and an error showing. The PIN
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

- **App killed mid-send, or mid-resolve.** If Android kills the app after Send (or after tapping
  Continue on setup) but before the reply arrives, the deposit — or the resolution — may have
  completed server-side while the app has no record of it. Reopening starts fresh either way: a
  new lookup gets a new idempotency key, and setup simply asks again. The real backend refusing a
  second redemption, or PayShap's own resolution being idempotent to repeat, is what keeps this
  safe.
- **Portrait lock and large screens.** Android 16 ignores orientation locks on screens 600 dp and
  wider. The layout is a centred column, so it still works.
- **Reset to first run.** There is no reset button. Use Change details, or clear Expo Go's storage
  (Settings, Apps, Expo Go, Storage, Clear data).
- **Fake API is per process.** It forgets which vouchers it has redeemed when the app restarts, but
  deposit status still works after a restart because the scenario and start time are in the id.
  `resolveShapId` has no state to forget: every call is a pure function of the number typed.
- **The masked scheme-name format, and the `@bank` suffix format**, are best-understanding
  assumptions, not verified against primary PayShap documentation. Flagged in code comments
  (`src/api/types.ts`, `src/api/wire.ts`) where they are relied on.
