# Design

The visual design is not decided yet. Use browser defaults and native HTML elements, and meet WCAG 2.2 AA. Do not invent a look: a new visual choice is a question for the owner.

The rules below are about behaviour, wording and sizes, not the look. Each names its source.

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

The iOS app runs this web code in a WebView, so Apple's Human Interface Guidelines (HIG) apply to every screen; one CSS pixel is one point. Pages read 2026-10-25.

- A tap target is at least 44×44 px, including its padding (HIG Buttons; Accessibility, Mobility). Leave about 12 px between bordered controls and 24 px around borderless ones, so a thumb doesn't hit the neighbour.
- Body text defaults to 17 px and nothing is under 11 px; avoid light weights (HIG Typography). Inputs use at least 16 px, or WebKit zooms the page on focus.
- Text follows the system text size: size it in `rem` from a root that uses `font: -apple-system-body` on Apple platforms, and check the layout at 200 %. Rows grow and side-by-side items stack instead of truncating (HIG Typography, Supporting Dynamic Type; Layout, Adaptability).
- Content stays inside the safe area: a layout that sets `viewport-fit=cover` pads with `env(safe-area-inset-*)` (HIG Layout, Guides and safe areas).
- Lay out by available width, not device or orientation, and keep the same functions at every width (HIG Layout, Size classes).
- Tap, swipe and drag mean what they mean everywhere. Every gesture has an on-screen alternative, such as a button beside swipe-to-delete, and nothing overrides the system edge swipes (HIG Gestures).
- A control that is unavailable looks unavailable, and the screen says why (HIG Gestures; Feedback).
- Custom controls show a pressed state (HIG Buttons). Button labels start with a verb. At most one or two prominent buttons per view, and a destructive action is never the prominent default (HIG Buttons, Role).
- Alerts are rare and actionable: never on launch, never just to inform, never for an undoable action. The title says what happened, the buttons name results, and "Avbryt" sits on the leading side (HIG Alerts).
- A sheet or dialog does one short task, names it in its title, has an obvious close and asks before discarding typed input. Never stack two (HIG Modality).
- Show something at once while loading, such as placeholders or the last known data with its age, and keep the rest of the app usable (HIG Loading).
- Status lives next to what it describes; confirm only significant completions, and always explain a failure (HIG Feedback). Don't rely on colour alone (HIG Accessibility, Vision).
- Fields have a visible label beyond the placeholder, the right `type`, `inputmode`, `autocomplete` and `enterkeyhint`, validation when the field is left, and amounts formatted as Swedish kronor (HIG Text fields; Virtual keyboards).
- Motion is brief, follows the finger and never carries meaning alone; under `prefers-reduced-motion`, fade instead of slide or zoom (HIG Motion; Accessibility, Cognitive).
- Follow the system's light or dark setting with no app-level switch, at 4.5:1 contrast in both (HIG Dark Mode).
- Avoid views that close on a timer; dismiss with an explicit action (HIG Accessibility, Cognitive).
- Ask for a permission (camera, notifications) only when the person starts the feature that needs it, with one sentence saying why. A screen before the system prompt has one button, which opens the prompt (HIG Privacy).
- Onboarding is short, skippable and teaches by doing; defaults work without setup (HIG Onboarding).
- Haptics, if added, only reinforce a visible event with the system pattern for its meaning, and can be turned off (HIG Playing haptics).
- The app does more than the website it wraps, or App Store review rejects it (App Store Review Guideline 4.2).
