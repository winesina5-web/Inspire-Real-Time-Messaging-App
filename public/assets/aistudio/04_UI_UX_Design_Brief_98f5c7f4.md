# 04 — UI/UX Design Brief
## Inspire — Real-Time Messaging App

> **Revision note:** This revision replaces the previous palette with the owner's requested identity: **pure white chat/app surfaces, Dark Royal Blue + Yellow for buttons and interactive elements, bold black text**, with a complete, equally considered dark-mode counterpart. This is not a WhatsApp green re-skin — it keeps Inspire's own bold, confident character while being unmistakably a messenger.

---

## 1. Design Style

A bold, confident, slightly playful messenger aesthetic — distinct from the generic "flat SaaS" look and distinct from WhatsApp's green identity. Clean white chat canvases, strong Dark Royal Blue + Yellow color blocking on interactive elements, bold black typography for anything the user needs to read quickly (names, headers, buttons, timestestamp labels where emphasis matters). Rounded, friendly shapes; generous whitespace in list views; dense-but-legible chat bubbles. Mobile-first at all times, but the layout must remain usable and well-proportioned on desktop/tablet widths (centered column, not full-bleed stretch).

Avoid: default unstyled browser form elements, visible sharp 90° corners on interactive elements, cramped touch targets, washed-out gray-on-gray text (text should read as confidently **black**, not muted gray, except for genuinely secondary metadata).

---

## 2. Color Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-primary` (Dark Royal Blue) | `#0E2A6E` | `#3D6FE0` | Primary buttons, sent-message bubbles, active nav states, links, header bars |
| `--color-primary-dark` | `#081B47` | `#1A4FBA` | Hover/active/pressed states on primary elements |
| `--color-accent` (Yellow) | `#FFD700` | `#FFD700` | FAB, highlights, unread badges, AI-feature accents, read-receipt accent, selection rings |
| `--color-bg` | `#FFFFFF` | `#0B0F1A` | App background **and** chat canvas — pure white in light mode, as requested, so the chat surface itself never reads as "gray app chrome" |
| `--color-surface` | `#FFFFFF` | `#161B2B` | Cards, received-message bubbles, headers, modals — in light mode this matches `--color-bg` exactly, so surfaces are separated by a 1px `--color-border` hairline and soft shadow rather than a background-color shift |
| `--color-text` | `#000000` | `#F5F7FA` | Primary text — pure black in light mode per spec; bold (600/700) for names, headers, button labels, and anything needing emphasis |
| `--color-text-muted` | `#4B5563` | `#9CA3AF` | Secondary text, timestamps, metadata only — never used for primary message content |
| `--color-border` | `#E5E7EB` | `#2A3348` | Dividers, input borders, the hairline that separates white-on-white surfaces |
| `--color-success` | `#16A34A` | `#22C55E` | Online dot, success toasts |
| `--color-danger` | `#DC2626` | `#EF4444` | Delete/block/destructive actions, error toasts |
| `--color-on-primary` | `#FFFFFF` | `#FFFFFF` | Text/icon color on top of Dark Royal Blue fills (buttons, sent bubbles) |
| `--color-on-accent` | `#1A1A2E` | `#1A1A2E` | Text/icon color on top of Yellow fills — always a dark color, never white or black-on-black, to keep AA contrast |

**Why `--color-bg` and `--color-surface` are the same white in light mode:** the brief asks for a genuinely white chat background, not the previous off-white/light-gray app chrome. To keep cards, headers, and bubbles from visually disappearing into that same white, every surface gets a `--color-border` hairline (`1px solid`) and a soft shadow instead of relying on a background-color difference. Dark mode keeps the earlier two-tone approach (`#0B0F1A` app bg vs `#161B2B` elevated surface) since a single flat dark color reads fine without needing the hairline trick.

Dark mode is a first-class requirement, not an afterthought — every screen must be designed and implemented with both themes from the start (CSS variables + a `data-theme` or `prefers-color-scheme` strategy), consistent with the "persisted per device" requirement in the PRD.

---

## 3. Typography

- Primary typeface: **Inter** (Google Fonts), weights 400/500/600/700/800.
- Headings/app name: bold to extra-bold (700/800), slightly tight letter-spacing, always `--color-text` (pure black in light mode).
- Body/message text: 15–16px, comfortable line-height (1.4–1.5), weight 400–500 for normal message content; bumped to 600 (semi-bold) for the sender's own name in group/contact contexts, button labels, and anything acting as a label rather than prose.
- Timestamps/meta text: 10–11px, `--color-text-muted`, weight 400 — the one place text is deliberately **not** bold or black, since it must stay visually secondary.
- Avoid more than 2 weights on a single screen's primary content to keep hierarchy clean (typically 400/500 for body + 600/700 for emphasis).

---

## 4. Layout Principles

- **Mobile-first breakpoints:** base styles target ~375–430px width; scale up gracefully for tablet/desktop with a centered max-width container (e.g. `max-w-lg` for chat/profile, wider for admin tables).
- **Bottom navigation** (Chats / Profile) fixed at the bottom on mobile, present for authenticated non-admin routes. Active tab icon/label rendered in Dark Royal Blue with bold label text; inactive tabs in `--color-text-muted`.
- **Admin panel** uses a left sidebar on desktop/tablet width and a collapsible/drawer pattern on narrow mobile widths (admin is expected to be used more on larger screens, but must not break on mobile).
- Safe-area insets respected (`env(safe-area-inset-bottom)`) for PWA/notch devices on any fixed bottom element.

---

## 5. Components

### 5.1 Buttons
- Primary: solid **Dark Royal Blue** fill, white (`--color-on-primary`), bold (600/700) label text, fully rounded (pill) or large-radius rounded-rectangle, subtle shadow, scale-down micro-interaction on press (`active:scale-95`).
- Secondary/outline: transparent bg, Dark Royal Blue border + Dark Royal Blue bold text.
- Accent (FAB, highlight actions): solid **Yellow** fill with `--color-on-accent` (dark navy) text/icon — never white text on yellow, and never used for body copy per the contrast rule in Section 8.
- Destructive: outline style with `--color-danger` border/text by default; solid red reserved for a final confirmation step, not the first tap.
- Disabled state: reduced opacity, no pointer feedback.

### 5.2 Forms & Inputs
- Soft-filled inputs (very light gray bg, `#F5F7FA`, in light mode — distinct from the pure-white page bg so fields are visible on a white screen) that gain a Dark Royal Blue border + white bg on focus — not bare-bordered boxes.
- Input text is bold-leaning black (`--color-text`, weight 500) so it reads clearly against the soft-filled background; placeholder text uses `--color-text-muted` at normal weight.
- Inline validation messages directly under the relevant field, not only in a toast.
- Live-availability indicator pattern for `@username` (green check / red X / neutral while typing), carried over from the prior build's UX since it worked well.

### 5.3 Chat Bubbles
- **Sent messages:** Dark Royal Blue bg, white (`--color-on-primary`) text, right-aligned, `rounded-br-sm` (flat corner toward the tail side) for a directional feel.
- **Received messages:** white bg (same white as the chat canvas) with a `--color-border` hairline + soft shadow so it still reads as a distinct bubble, black text, left-aligned, `rounded-bl-sm`.
- Max width ~80% of the chat column.
- Media bubbles (image/video) show the media directly with rounded corners, max dimensions, and a subtle loading shimmer while the signed download URL resolves.
- Voice note bubbles: custom player — circular play/pause button in Dark Royal Blue (white on sent bubbles stays white-on-blue; on received bubbles the button itself is filled Dark Royal Blue so it's always readable), a waveform-style progress track, duration label in bold.
- Reactions render as small pill chips anchored to the bottom edge of the bubble, overlapping slightly onto the message area below; chip background is Yellow with dark navy emoji/count text.
- Reply-quote preview: a slightly indented, left-bordered (Yellow accent bar) mini-preview of the original message rendered above the new bubble's content.
- Deleted messages: italic, muted, bordered "ghost" bubble reading "Message deleted" — never fully removed from the layout (preserves conversation flow/timestamps); this is the one bubble type allowed to use muted (non-black, non-bold) text, since it is deliberately de-emphasized.

### 5.4 Cards & Modals
- Cards: rounded-2xl/3xl, `--color-border` hairline + soft shadow (not a background-color shift, per Section 2), white surface, bold black headings inside.
- Modals (Add Contact, Reaction confirmation, destructive-action confirmations): bottom-sheet style on mobile (slides up, rounded top corners), centered dialog on desktop — consistent with the prior build's pattern. Modal primary action always Dark Royal Blue; destructive modal action uses the red outline-then-solid pattern from Section 5.1.

### 5.5 AI-Feature UI
- AI-generated content/suggestions are visually distinguished with a small **Yellow** accent marker or icon (e.g. a small sparkle glyph, dark navy on yellow) so users always know when something is AI-assisted — never blended indistinguishably with regular UI.
- Smart Reply chips: pill-shaped, Dark Royal Blue outline on white, bold label text, horizontally scrollable row above the composer.
- Translation/Transcript/Summary: shown as an expandable inline block directly under/within the relevant message or chat header — not a separate disruptive modal for quick actions (Summarize can be a modal since it's a deliberate, less frequent action).

### 5.6 Admin UI
- Data-dense but clean: white tables with sticky Dark Royal Blue headers (bold white header text), clear row hover states (very light blue tint), compact action buttons/icons per row.
- Stat cards on the dashboard: large bold black number, small muted label, small trend indicator (green/red) where applicable; a thin Yellow accent bar along the top edge of each stat card for visual rhythm.
- Destructive admin actions (suspend, delete message, maintenance mode) always require an explicit confirmation dialog stating the consequence in plain, bold language.

---

## 6. Responsive Behavior

- Chat list and chat view: single-column stacked on mobile; on desktop, an optional two-column layout (list + active chat side-by-side) is a nice-to-have, not required — single-column-with-navigation is acceptable for v1 if time-constrained, but must remain genuinely usable at desktop widths (not just a stretched mobile layout).
- Admin tables: horizontally scrollable on narrow widths rather than broken/overflowing layouts.
- Images/videos scale responsively within their bubble max-width; never overflow the viewport.

---

## 7. Animations

- Keep subtle and purposeful, not decorative-heavy: fade/slide-in for toasts and modals (~150–250ms), scale feedback on button press, a gentle pulse on the recording indicator, a typing-indicator animation (three bouncing dots in Dark Royal Blue), smooth auto-scroll on new messages.
- Respect `prefers-reduced-motion` where feasible.

---

## 8. Accessibility

- Minimum tappable target 44×44px on mobile for all icon buttons (mic, attach, send, reactions).
- Color contrast: text/background combinations must meet at least WCAG AA in both light and dark themes. Pure black text (`#000000`) on pure white (`#FFFFFF`) exceeds AAA, by design. The Yellow accent (`#FFD700`) must **never** be used as a text color on a white/light background (insufficient contrast); it is reserved for backgrounds/accents/borders, always paired with `--color-on-accent` (dark navy) text on top of it, never white or black-on-yellow-as-text-color elsewhere.
- All images (avatars, shared media) have meaningful `alt` text; decorative icons use `aria-hidden`.
- Form inputs have associated `<label>`s, not placeholder-only labeling.
- Focus states visible on all interactive elements (a visible Dark Royal Blue focus ring, not suppressed via `outline: none` without a replacement).

---

## 9. Image & Icon Direction

- Icons: emoji-based for primary actions (💬, 👤, 📎, 🎤, ➤, 📷, 🎬, 🎵) consistent with the prior build's friendly tone — keeps the app dependency-light (no icon font/library required) while remaining visually clear. Admin panel may use a small consistent icon set (emoji or a lightweight library such as `lucide-react`) for a slightly more "tool-like" feel appropriate to that context, rendered in Dark Royal Blue by default.
- App icon/logo: a simple rounded-square mark combining the Dark Royal Blue background with a Yellow speech-bubble motif (consistent with the PWA manifest icons).
- No stock photography required for v1; avatars default to initials-on-colored-circle when no photo is uploaded (deterministic color per user, drawn from a small palette of Dark Royal Blue / Yellow / supporting tints, as in the prior build).
