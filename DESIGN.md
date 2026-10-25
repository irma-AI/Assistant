# Design

Meet WCAG 2.2 AA. The look below was chosen by the owner on 2026-10-25; a change to it, or any visual choice it does not cover, is a question for the owner. It borrows only the colours and type of the owner's Voice app, never Voice's product concepts.

## Look

Calm and premium: one idea per panel, white type on deep navy, and one warm accent only on what needs the owner.

**Colour.** The app follows the phone's light or dark setting; both themes are complete.

| Role | Dark | Light |
|---|---|---|
| Ground | Deep sea `#0B1322` under a Blue hour `#1A2A44` radial falloff from the top right | Sea mist `#E9EDF2` |
| Panel | white at 4 % over the ground, 1px edge `#2A3447` | white `#FFFFFF`, 1px edge `#D3D9E1` |
| Text | white `#FFFFFF` | Deep sea `#0B1322` |
| Secondary text | white at 72 % | `#4C5566` |
| Accent (Cable light) | `#F5D9A8`; button text Deep sea | button Deep sea with white text; accent text `#7A4E0E` |

- Cable light marks only what needs the owner or can be tapped: the main button, the active tab, a question on a draft. Never decoration, never a finished item.
- Stay clear of competitors' brand colours (PRODUCT.md, Brand Commitments). No pure black.
- Measured 2026-10-25: every text pair passes 4.5:1 in both themes (lowest 6.4:1). Panel and tile edges are decorative; a control's edge must reach 3:1.

**Type.** Newsreader (serif) at weight 400 or more for the company name and panel headings; Schibsted Grotesk for everything you read as data or operate, amounts included, with tabular figures. Never a weight under 400.

**Shape.** Panels 14px corners; buttons are full pills, at least 48px tall; no shadows or glow.

**Home screen.** Date and company name; "Snart dags" with Datumblock rows (a date tile, day large and month small, then what is due, the amount and "om N dagar"); "På banken" with its sync time, and "Resultat i år"; "Att godkänna" rows; one Cable light pill; the bottom tab bar.

**Large text.** At 200 %: rows stack (the amount drops under the name), the money panels stack, Swedish words hyphenate except names, the company name's size is capped by screen width so it wraps only at spaces, and tab-bar labels keep their size as on iOS.

The rules below are about behaviour, wording and sizes. Each names its source.

## Trust

The app holds a company's money, books and BankID login, so a screen must look competent, behave predictably and be honest about what it does, costs and risks.

- Content has no errors: no typos, broken links or stale dates, and every total on screen adds up (Stanford Web Credibility guideline 10; NN/G 4 credibility factors).
- Show prices, fees and what data we collect, and why, before asking for anything (NN/G 4 credibility factors).
- Who runs the service, how to reach a person, the terms and the privacy notice are one tap away from every screen (Stanford 2, 5).
- A figure from outside shows its source and age ("Bank synkad 10:42") and opens the records behind it. A failed or stale sync looks stale (Stanford 1, 8).
- One way to do one thing, one word for one thing, and no promotion inside the product (Stanford 6, 9).
- At BankID, payment and bank-connection steps, name the party involved and say what happens next (Baymard, perceived security).
- No dark patterns: no fake urgency or timers, no pre-ticked consent, no shaming opt-outs, no harder way out than in, no decoy hierarchy between accept and decline (DSA art. 25).
- Plain Swedish at CEFR B2 or simpler; explain a term the first time it appears (PTSFS 2024:6; lag 2023:254, EN 301 549).
- Every action gets feedback at once, long work shows progress, and a finished action says what happened. A failed save never looks saved (NN/G 10 usability heuristics).
- Prefer undo to a confirmation. Confirm only what can't be undone, and name the action on the button ("Radera kontot"), never "OK" or "Bekräfta" (NN/G confirmation dialogs).
- Before an irreversible action (book a voucher, send an invoice, pay, submit a declaration), show exactly what will be recorded or sent, to whom and the total; afterwards, show how to correct it.
- Error messages sit next to the field, in plain words, blame the system rather than the person, keep what was typed and say how to fix it (NN/G error message guidelines).
- Notify only about what the person asked for or must act on (NN/G Trust or Bust).

### AI and agents

Aim for calibrated trust: people rely on a suggestion exactly as much as it deserves (Microsoft Guidelines for Human-AI Interaction, G1–G18; Google PAIR, Explainability + Trust).

- Say what the feature can do and how often it is right (G1, G2), and show the evidence behind each suggestion (G11).
- A suggestion is a draft: accepting, rejecting and correcting each take one action, and nothing is booked or sent without the person (G7–G9).
- When unsure, ask or offer options instead of guessing (G10). Say what accepting will do (G16).
- One setting turns each AI feature off (G17). Announce changes in how it behaves (G14, G18), and let corrections improve later suggestions (G15).
- An agent acts with the person's permissions only, and its actions are logged and shown as done by the assistant or the named client.

## Touch

The iOS and Android apps run this web code in a WebView, and they share **one design**. Where Apple's Human Interface Guidelines (HIG) and Google's Material Design 3 or Android core app quality guidelines differ, follow the rule that satisfies both. Don't imitate either platform's look, such as iOS-style switches or Material ripples. Native HTML controls (`select`, date and file inputs) open each platform's own picker, and that is fine. Only system behaviour differs per platform, such as Android's back button. One CSS pixel is one iOS point and one Android dp. Pages read 2026-10-25.

**Size and text**
- A tap target is at least 48×48 px, including its padding. Leave at least 12 px between bordered controls and 24 px around borderless ones (Material Accessibility, Target sizes; Android quality Touch_Target_Size; HIG Accessibility, Mobility; Apple's 44 pt fits inside).
- Body text is 17 px, nothing is under 11 px, and light weights are avoided (HIG Typography; Material's 16 px body fits). Inputs use at least 16 px, or iOS zooms the page on focus.
- Text follows the system text size: size it in `rem` from a root that uses `font: -apple-system-body` on Apple platforms. Check every screen at 200 % on iOS (Larger Text) and Android 14+ (font size 200 %). Rows grow and side-by-side items stack instead of truncating (HIG Typography, Supporting Dynamic Type; Android 14 non-linear font scaling).
- Contrast is at least 4.5:1 for text and 3:1 for large text and icons, in light and dark (Android quality Visual_Contrast; HIG Accessibility). Don't rely on colour alone.

**Layout and navigation**
- Content and tap targets stay clear of the status bar, notch, home indicator and Android navigation bar: pad with `env(safe-area-inset-*)`, and check on Android 15+, where the app targets SDK 36 and is always edge to edge (HIG Layout, Guides and safe areas; Android Edge-to-edge).
- Lay out by available width: compact under 600 px, medium 600–839 px, expanded 840 px and up. Every width and both orientations offer the same functions, and rotating keeps state (Material Window size classes; HIG Layout, Size classes; Android quality Orientation_Transitions).
- Top-level sections sit in a bottom bar of three to five destinations, each with an icon and a label, always visible, in fixed positions. With fewer than three, use no bar (Material Navigation bar; HIG Tab bars).
- Every screen below the top level has an on-screen back control in its top bar. Android's back button and back gesture do the same thing: close the topmost dialog or sheet first, then go up one screen. Never show "tryck igen för att avsluta" (HIG Gestures; Android quality Back_Button_Nav, Back_Gesture_Nav; Predictive back).
- Leaving the app and coming back restores exactly where the person was, including typed input. Leaving a form with unsaved input by any route asks first or keeps a draft (Android quality State_Preservation; HIG Modality).

**Interaction**
- Tap, long press, swipe and drag mean what they mean everywhere. Every gesture has an on-screen alternative, such as a button beside swipe-to-delete. Nothing claims the screen edges, which both systems use for back and home (HIG Gestures; Material Gestures; Android Edge-to-edge, system gesture insets).
- Custom controls show a pressed state. Labels start with a verb. At most one or two prominent buttons per view, and a destructive action is never the prominent default (HIG Buttons; Material Buttons).
- An unavailable control looks unavailable, and the screen says why (HIG Gestures; Feedback).
- Dialogs are rare and only for a decision or critical information: never on launch, never just to inform, never for an undoable action. The title is a specific statement or question, never "Är du säker?". There are at most two buttons, named for their result: the confirming one on the trailing side, "Avbryt" on the leading side (HIG Alerts; Material Dialogs).
- A sheet or full-screen dialog does one short task, names it in its title, has an obvious close and asks before discarding input. Never stack two (HIG Modality; Material Dialogs, Full-screen dialog).
- Errors sit inline next to their field, all at once. Only a failure unrelated to a field, such as no network, goes in a dialog (Material Dialogs, Error messages; HIG Feedback).
- A short message (snackbar) appears one at a time at the bottom, above the navigation bar, with at most one action such as "Ångra". It never carries information found nowhere else: the same result shows inline, such as a button changing to "Sparat", because a message that disappears on a timer is missed by many (Material Snackbar, accessibility; HIG Accessibility, Cognitive).
- Show something at once while loading, such as placeholders or the last known data with its age, and keep the rest of the app usable. A start-up over 2 seconds shows progress, and progress is determinate once its length is known (HIG Loading; Android quality App_Startup_Time; Material Progress indicators).
- Fields have a label that is always visible, not only a placeholder. Use the right `type`, `inputmode`, `autocomplete` and `enterkeyhint`, validate when the field is left, and format amounts as Swedish kronor (HIG Text fields; Material Text fields).
- Motion is brief, follows the finger and never carries meaning alone; under `prefers-reduced-motion`, fade instead of slide or zoom. Scrolling and animation hold 60 frames per second (HIG Motion; Android quality Rendering_Performance).
- Follow the system's light or dark setting, with no setting of our own, and support both fully (HIG Dark Mode; Android quality, dark theme).
- Haptics, if added, only reinforce a visible event with the platform's pattern for its meaning, and can be turned off (HIG Playing haptics).

**Permissions, notifications and stores**
- Ask for the fewest permissions, only when the person starts the feature that needs them, with one sentence saying why. When they say no, the rest still works and the feature explains how to turn it on later. A screen before the system prompt has one button, which opens the prompt (HIG Privacy; Android quality Runtime_Permissions, Minimize_Permissions; Request runtime permissions).
- Notifications are off on Android 13+ until the person allows them. Ask when they turn on a notification they want, never at launch. Notify only about their own business, never promotion; give each kind its own channel so one can be muted, and group several into one (Android Notification runtime permission; Android quality Notification_Quality).
- Onboarding is short, skippable and teaches by doing; defaults work without setup (HIG Onboarding).
- The app does more than the website it wraps, or App Store review rejects it (App Store Review Guideline 4.2).
