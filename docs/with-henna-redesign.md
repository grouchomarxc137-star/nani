# With Henna mobile redesign

Approved Creative & Distinctive direction for Nani: warm parchment, acqua and henna accents, ink outlines, flat shadows, editorial headings and a custom vector Henna.

The UI prioritizes the phone experience. Home retains both people, five logging choices, Undo, pending/offline feedback, rotating facts and a daily gauge. Detailed pace/bottle information is expandable. History retains month navigation and editable/deletable entries. Settings retain intake sizes, bottle presets, reminders, timezone and account switching.

Principessa's display copy is personalized for Amira; account keys and stored profile names stay unchanged. Approved messages include “Buongiorno Amira💛”, “Ciao Principessa”, “Look at her😍”, “That's my Princess💛”, and the two personal reminder messages. Principe keeps separate copy.

PIN entry uses a real masked password input with `inputMode="numeric"`, digit filtering and automatic submission after six digits. There is no in-app keypad. Real phone keyboard appearance remains OS-controlled and needs physical-device review.

## Deployment baseline

Railway runs this app through CLI uploads rather than GitHub auto-deployments. The existing live service already used SQLite on its `/data` volume, while the older GitHub baseline still described PostgreSQL and the retired Store.

Before publishing the approved UI, the live Dockerfile, deployment configuration, package manifests/lockfile, schema, and both applied migration checksums were verified against the local deployment baseline. All matched. The branch now records that already-deployed SQLite baseline so future builds reproduce the live app. This does not introduce a new production migration, reset, seed, variable change or database-provider switch.

The approved three-tab app retains Home, History and Settings. The Store-removal migration in this repository had already been applied to the live database before the redesign deployment.

## Verification

- The locally reviewed app passed its tests, TypeScript checks and frontend/API production build.
- Additional tests cover personal greetings, recipient isolation, goal reminder suppression and offline persistence/replay.
- The initial UI-only commit passed 78 tests against the older committed stack. The exact final Railway release, using the existing live SQLite baseline, passed a clean install, all 72 current tests, both TypeScript checks, and the frontend/API production build.
- Actual mobile screenshots are in `design-proposals/implementation/`: Home, History, Settings and PIN entry, captured in Chrome phone emulation at 393 × 852. A small-phone Home screenshot is included.
- Physical Safari/Android keyboard behavior and live push permissions/delivery remain on-device review items.

Use the existing repository setup instructions for the committed database stack. The local screenshot session used an isolated demo database and disabled notifications; it never connected to production.
