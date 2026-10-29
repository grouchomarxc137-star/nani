# With Henna mobile redesign

Approved Creative & Distinctive direction for Nani: warm parchment, acqua and henna accents, ink outlines, flat shadows, editorial headings and a custom vector Henna.

The UI prioritizes the phone experience. Home retains both people, five logging choices, Undo, pending/offline feedback, rotating facts and a daily gauge. Detailed pace/bottle information is expandable. History retains month navigation and editable/deletable entries. Settings retain intake sizes, bottle presets, reminders, timezone and account switching.

Principessa's display copy is personalized for Amira; account keys and stored profile names stay unchanged. Approved messages include “Buongiorno Amira💛”, “Ciao Principessa”, “Look at her😍”, “That's my Princess💛”, and the two personal reminder messages. Principe keeps separate copy.

PIN entry uses a real masked password input with `inputMode="numeric"`, digit filtering and automatic submission after six digits. There is no in-app keypad. Real phone keyboard appearance remains OS-controlled and needs physical-device review.

## Commit scope

This branch contains the approved interface and companion-copy changes. It preserves the repository's committed database provider, migration history, reward accounting and deployment configuration. Separate uncommitted local SQLite and Store-removal infrastructure changes were deliberately excluded. No production environment variables or data were modified.

The dormant legacy Store implementation is retained in the repository; the approved three-tab interface does not expose it. No tables or stored records are removed by this branch.

## Verification

- The locally reviewed app passed its tests, TypeScript checks and frontend/API production build.
- Additional tests cover personal greetings, recipient isolation, goal reminder suppression and offline persistence/replay.
- The exact staged commit passed a separate clean install, all 78 tests across 8 files, both TypeScript checks, and the frontend/API production build before pushing.
- Actual mobile screenshots are in `design-proposals/implementation/`: Home, History, Settings and PIN entry, captured in Chrome phone emulation at 393 × 852. A small-phone Home screenshot is included.
- Physical Safari/Android keyboard behavior and live push permissions/delivery remain on-device review items.

Use the existing repository setup instructions for the committed database stack. The local screenshot session used an isolated demo database and disabled notifications; it never connected to production.
