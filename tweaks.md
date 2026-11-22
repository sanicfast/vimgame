# Tweaks — changes to EXISTING exercises / engine (not new levels)

See ideas.md for brand-new exercise concepts. This file is only for modifying what already
exists: the 39 shipped levels, the engine, hints, or UX.

## Hints / wording
- [done] *Edit Both Ends* — hint now mentions the 2-space indent the target needs.
- *Change a Word* — hint could note `cw` stops at word end (so `j`/`0` is needed before `.`).
- *Count the Jumps* — hint says "relative line numbers"; consider "use the gutter (count = jump size)" since the gutter already shows the exact `N`.
- Standardize the em-dash hint voice across #29–38 (some are terse, some chatty).

## Content / difficulty tuning
- *Delete Every Other Word* — `one two three four five` is abstract filler; swap to a CSV-ish row for realism.
- *Edit Both Ends* — content is language-mixed (Python `True` + C `{ }` + indent); pick one language.
- *Drop the Parenthetical* (the deliberate raw edge) and *Trim the Email* (the clean case) are now an adjacent good pair — keep them together when content shifts.

## Ordering (deprioritized by choice)
- The two capstones (#27 Fix the Bugs, #28 Rename & Refactor) sit mid-list; #29–38 ramp back
  up. Fine as an "advanced extras" tier, but if a strict ramp is ever wanted, float
  *Unwrap Lines* / *Wrap Lines in Parens* / *Fix the Indent* up and push the 4 stretch
  levels + capstones to the end. Safe: all tests resolve challenges by NAME, not index.

## Engine gaps that unlock idea.md cards (priority order)
Each of these turns a batch of `🔧` cards into `✅`:
1. **`^`** (first non-blank) — many line-edge/indent cards lean on it; `0` isn't equivalent on indented lines.
2. **`X`** (delete before cursor) — back-of-line delete cards.
3. **`J`** (join lines) — split/join & reflow cards (currently only via insert newline).
4. **Search `/` `?` `n` `N`** — a large family of "jump to text" cards; also a poor-man's substitute.
5. **`%s` substitute** — "fix every row in one command" endurance cards (advanced tier).
6. **Visual mode `v`/`V`** — block select+delete/move cards (off the beginner path; optional).
7. **`~`** (toggle case) — casing drills.
8. **macros `q`** — only if you want a true "automate the repetition" finale tier.

## Quick wins already supported that deserve MORE drills (from ideas.md demand)
- `=` auto-indent (only lightly drilled) · `;`/`,` on operator forms · `=`/`==` over real
  nested braces · `P` line-paste-above · counts before `f`/`r`/`x`/`w` as dedicated mini-levels.

## Divergences discovered while building ideas (blocks certain idea cards)
Each of these makes an "obvious" idea-card solution DIFFER from real Vim, so those cards
must NOT be built until the engine is fixed (or the card re-specced). Found by the
real-Vim oracle during the batch build-out:
1. `f<char>` then `x` then `;` then `x` (repeat-find-and-delete endurance). After `x`, the
   `;` re-find lands on a different column than Vim, so `f, x ; x ; x` diverges. Blocks many
   \u00a720 endurance cards. (Single `f<char> x` is fine; it is the repeated `;`+delete that breaks.)
2. `ci<` (change inside angle brackets) places/edits differently from Vim. Blocks Inner Angle.
3. `yi(` / `y%` + `%` + `p` (yank-args, jump outside, paste) — paste placement after the match
   diverges. Blocks Duplicate Inside / Yank Inner Parens variants.
4. `.` cannot replay a two-insertion wrap (`I(..` then `A..)`) as one change \u2014 dot only
   repeats the last change. Blocks Wrap-and-repeat as written.
5. `N>>` / `5G` near the grid edge clamp differently from Vim (already noted in VIM_DIFFERENCES
   \u00a72.12) \u2014 blocks Indent Past EOF / Past-the-end edge cards.
