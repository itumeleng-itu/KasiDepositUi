# Testing KasiDeposit

## Run it

```powershell
cd D:\KasiDeposit\KasiDepositUi
npx expo start
```

Open **Expo Go** on an Android phone on the same Wi-Fi, scan the QR code (or choose *Enter URL
manually* and type `exp://<your PC's Wi-Fi IP>:8081`). No Expo account is needed for LAN mode.

The app runs on the **fake API** (`.env` has `EXPO_PUBLIC_USE_FAKE_API=true`). Each call is logged
in the terminal running Metro as `[fake-api] ...`. The log never contains the PIN, only the
scenario digit. After changing `.env`, restart with `npx expo start --clear`.

Checks that need no phone:

```powershell
npm test               # unit tests (pure logic)
npx tsc --noEmit       # strict type check
npx expo-doctor        # dependency and config check
```

## Demo scenarios (fake API)

The **last digit of the PIN** picks the scenario. Type or paste any 16 digits ending in it. Every
PIN below works repeatedly, because the fake hands out a fresh voucher on each lookup.

| PIN | Ends in | Voucher | What should happen |
|---|---|---|---|
| `1234 5678 9012 3450` | 0 | R500.00, fee R5.00 | Confirm shows **R495.00**. Status: *Sending your money*, then *On its way* (about 1.5 s), then **R495.00 is in your account** (about 3 s, plus a poll). One success haptic. |
| `1234 5678 9012 3451` | 1 | already used | Stays on the PIN screen: *This voucher has already been used.* PIN stays in the field. |
| `1234 5678 9012 3452` | 2 | R200.00 | Confirm **R195.00**. Ends *We couldn't send this deposit. Your bank didn't accept this account number. Your money is safe and hasn't been lost.* with **Change account details**. |
| `1234 5678 9012 3453` | 3 | R1 000.00 | Confirm **R995.00**. Ends *We couldn't send this right now. Your money is safe...* with **Try again later**. |
| `1234 5678 9012 3454` | 4 | no signal | *No connection. Check your data and try again.* on the PIN screen. Never says the voucher is bad. |
| `1234 5678 9012 3455` | 5 | R50.00 | Confirm **R45.00**. Stays *On its way*, becomes **Still processing** at 90 s (never "failed"), then **R45.00 is in your account** at about 101 s. |
| `1234 5678 9012 3456` | 6 | R8.00 | Lookup works. Confirm shows *This voucher is too small to deposit. The minimum is R10.00.* and a disabled **Can't send this voucher**. |
| `1234 5678 9012 3457` to `...3459` | 7, 8, 9 | not found | *We couldn't find that PIN. Check each digit against your till slip.* |

Every status screen shows a selectable **Reference: KD-XXXXXX**.

## Flows to walk through on the phone

**First run.** Fresh install opens *Where should your money go?* with no red errors. Enter a name,
pick a bank, type an account number, and confirm it wrongly. The mismatch appears only after you
leave the confirm field. While anything is missing, **Save details** is disabled and the line under
it says what is missing. Save, and you land on the PIN screen showing *Paying into ••••1234 · Bank*.

**Change details.** On the PIN screen tap **Change**. The four fields are prefilled, the title is
*Change where your money goes*, and **Cancel** returns without saving. Saving returns to the PIN
screen with the new details. From the confirm screen, **These aren't my details** does the same
but returns to the *same* voucher, still showing the right amount.

**PIN editing.** Type 16 digits (grouped as you go). Fix a digit in the middle: the cursor stays.
Backspace over a space: one digit goes. Paste `PIN: 1234-5678-9012-3456 thanks`: it is accepted.
Paste 17 digits: *That doesn't look like a 16-digit PIN* and nothing changes. Continue is disabled
until exactly 16.

**Resume after close.** Use scenario 5. Tap Send, then fully close the app (swipe it away) and
reopen it. It should land on the status screen mid-deposit, then finish. After the result has been
shown, reopening goes to the PIN screen.

**Double tap.** Tap **Send** twice quickly. The terminal must show exactly one
`createDeposit ... new deposit` line. Idempotency itself (same key, same deposit, two requests at
once, changed account) is covered by `src/api/fake.test.ts`.

**Backgrounding.** On the status screen with scenario 5, go to the home screen for 30 seconds and
come back. It should poll straight away and carry on. On the PIN and setup screens, switch apps and
return: what you typed is still there.

**Back button (Android).**

| Screen | Back does |
|---|---|
| First-run setup, PIN screen | leaves the app |
| Change details | cancel, no save |
| Confirm | returns to the PIN screen (blocked while Send is in flight) |
| Status | always goes to the PIN screen, never to confirm |

## Airplane mode

The fake API makes no network calls, so airplane mode changes nothing while it is on. Two ways to
see the offline behaviour:

1. **Scenario 4** simulates no signal on lookup.
2. **Real client:** set `EXPO_PUBLIC_USE_FAKE_API=false` and `EXPO_PUBLIC_API_BASE_URL` to any
   unreachable address (for example `http://10.255.255.1`), restart with `--clear`, and enter any
   PIN. After up to 15 seconds you should see *No connection. Check your data and try again.*
   On confirm the message also says your money is safe, and pressing Send again reuses the same
   idempotency key. On the status screen, turn airplane mode on mid-deposit: the status stays, and
   a small *No connection — we'll keep trying* line appears and goes away when the signal returns.

## Accessibility and layout

- **Screen reader (TalkBack).** Every button, bank row and field is announced with a role and label.
  The PIN field announces *Voucher PIN, N of 16 digits entered*. Amounts are spoken as
  *495 rand*, and accounts as *ending 4417*.
- **130% font size.** Settings, Display, Font size. Every screen scrolls and nothing should clip or
  overlap. The PIN text deliberately stays at 24 sp (see below) and everything else scales.
- **320 dp width.** On a phone or emulator, set the display to 320 dp wide (for example
  `adb shell wm size 640x1136` and `adb shell wm density 320`, undo with `wm size reset` and
  `wm density reset`). The PIN must sit on one line.
- **Reduce motion.** With *Remove animations* on, the status fade is skipped.
- **Sunlight.** Text pairs meet WCAG AA (checked in `src/theme.test.ts`), but only your eyes outdoors
  can say whether it is comfortable.

## The §7 checklist: what is guaranteed by code, and what needs a device

| Item | Covered by | Still needs a phone |
|---|---|---|
| Roles and labels on everything interactive | every control goes through `Button`, `TextField` or `BankList`, which set them | TalkBack pass |
| PIN announces digit count | label is `Voucher PIN, N of 16 digits entered` | TalkBack pass |
| Amounts spoken as "495 rand" | `spokenRand` and `spokenAmounts`, tested | TalkBack pass |
| Contrast, touch targets, spacing | `src/theme.test.ts` | sunlight |
| 320 dp and 130% font | every screen scrolls, text wraps, PIN width worked out at 24 sp | **yes** |
| Safe areas | every screen is inside `Screen` (safe-area-context) | notched device |
| Android back | per screen, see table | **yes** |
| Rotation | **locked to portrait** (`app.json`): on a small phone a landscape keyboard leaves about 100 dp of screen, unusable for PIN entry | none |
| Backgrounding | state is React state; polling pauses and resumes; one request at a time; Send is guarded by a ref and an idempotency key | **yes** |
| Airplane mode, no crash or blank | network errors map to the message; screens never wait on a failed load; a render crash shows a recovery screen | **yes** (real client) |
| No unhandled rejections | every promise is awaited in a try/catch or has a catch | watch the Metro log |
| No console warnings | none known | watch the Metro log |
| PIN never stored or logged | only in component state; not in params, storage or logs | none |

## Known limits

- **App killed mid-send.** If Android kills the app after Send but before the reply arrives, the
  deposit may exist while the app has no record of it. Reopening starts fresh. The idempotency key
  is in memory only, so a new lookup gets a new key. The real backend refusing a second redemption
  is what keeps the money safe.
- **Portrait lock and large screens.** Android 16 ignores orientation locks on screens 600 dp and
  wider. The layout is a centred column, so it still works.
- **Reset to first run.** There is no reset button. Use Change details, or clear Expo Go's storage
  (Settings, Apps, Expo Go, Storage, Clear data).
- **Fake API is per process.** It forgets which vouchers it has redeemed when the app restarts, but
  deposit status still works after a restart because the scenario and start time are in the id.
