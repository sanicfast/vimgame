# Known differences from real Vim

This project is a **browser Vim-emulator for a game**, not a general-purpose editor.
It implements a deliberately small, well-tested subset of Vim. This file records where
its behavior **intentionally or pragmatically diverges** from real Vim, so contributors
don't mistake a known limitation for a fresh bug — and so any change to these behaviors
is a conscious decision.

Each "behavioral difference" is backed by an assertion in the test suite (cited), so if
the behavior changes the corresponding test fails and points back to this file.

Run the suite with `npm test`.

---

## 1. What *is* implemented (the baseline)

- **Modes:** `normal`, `insert`, plus internal `operator-pending` / `pending-text-object`.
  There is **no visual mode.**
- **Motions:** `h` `j` `k` `l`, `w` `b` `e`, `W` `B` `E`, `ge` `gE`, `0` `$`, `gg` `G`
  (`G` jumps to the last *non-empty* line, like Vim's end-of-file), `%` (match
  bracket, single-line — see §2.8), and `f` `F` `t` `T` (find-in-line, single-line,
  honoring a count for the Nth occurrence) with `;` / `,` repeat (same / opposite
  direction) — see §2.9.
- **Operators:** `d` (delete), `c` (change), `y` (yank), `x` (delete char), `p` / `P`
  (paste). Doubled forms `dd` / `cc` / `yy` work as line operations. Single-char edits
  `r{char}` (replace) and `s` (substitute → change + insert) are supported (see §2.10). In
  normal mode the `Del` key acts as `x` (deletes the char under the cursor).
- **Text objects:** `iw` / `aw` (word) and bracket blocks — `i(`/`a(`, `i{`/`a{`,
  `i[`/`a[` (with the `)`, `}`, `]`, `b`, `B` aliases) — usable with `d` / `c` / `y`.
- **Insert entry:** `i` `a` `I` `A`, and `o` / `O` (open line).
- **Insert editing:** printable chars, `Enter` (split line), `Backspace` (delete left /
  join at col 0), `Del` (delete right / join at EOL), `Esc`.
- **History:** `.` dot-repeat, `u` undo, `Ctrl-R` redo.
- **Counts:** numeric prefixes on operators and motions — including line jumps
  (`5G` / `5gg`) and repeated `2ge` / `2gE` (e.g. `2dw`, `3.`, `2dd`, `2p`).
- **Command-line:** `:` opens a minimal command line. This is a **game action**, not
  the Vim editor command: `:wq` / `:x` advance to the next challenge (only when the
  current one is solved; `:wq!` skips). `:q` / `:w` print friendly hints and anything
  else reports `not an editor: :<cmd>`.

Everything else below is a **gap or a difference.**

---

## 2. Implemented but behaves differently from real Vim

### 2.1 Text objects are strictly single-line
`iw` / `aw` and the bracket blocks (`i(`/`a(`, `i{`/`a{`, `i[`/`a[`) never cross a
newline. Notable consequences:

- `daw` on the **last word of a line** (no trailing space) deletes only the word and
  leaves an empty line. Real Vim grabs the trailing **newline** and **joins the lines**.
- `diw` at end-of-line / start-of-line stays on its own line.
- A bracket block must **open and close on the same line**. Vim matches multi-line
  blocks (e.g. a `{ … }` spanning many lines); here `di{` on a `{` whose `}` is on a
  later line finds no pair and aborts with no change.

*Why:* text-object range building (`innerWordRange` / `aWordRange` / `bracketRange` in
`script.js`) is scoped to a single line on purpose; cross-line semantics (indent handling,
nested pairs across lines) are ambiguous.
*Note:* charwise `dw` **does** join lines at EOL (matches Vim) — this difference is
specific to the **text-object** family.
*Asserted in:* `tests/textobjects.test.js` ("daw on an EOL word…") and
`tests/brackets.test.js` ("no matching pair on the line aborts with no change").

### 2.2 Insert-mode line-join by `Backspace` is not dot-reproducible
In insert mode, `Backspace` at column 0 **joins with the previous line**, and that works
live. But the join is **not recorded** in the dot-repeat buffer, so `.` cannot reproduce a
line-join from a recorded insert session. In-line backspaces **are** recorded (as a `\b`
marker) and **are** correctly reproduced by `.`.

*Why:* reproducing a cross-line join inside a `.` replay is a rare, complex edge and was
left out of scope.
*Asserted in:* `tests/insert.test.js` → "a cross-line join backspace is not recorded in typed".

### 2.3 `a` / `A` / `I` move the cursor even if you type nothing, and `Esc` does not undo that
Pressing `a` advances the cursor one column to enter insert-after; if you then press
`Esc` **without typing**, the cursor stays advanced (e.g. `a<Esc>` on `hello` from col 0
ends on col 1). Real Vim returns the cursor to its original column.

*Why:* `a`/`A`/`I` place the caret on entry; only *typed* sessions adjust the caret on
`Esc` (an untyped session is treated as a no-op that must not push an undo step).
*Note:* this is cosmetic and low-impact.

### 2.4 Dot-repeat of an insert session reproduces the *net* typed text
`.` re-inserts the net result of the session (including in-line backspaces), not a
keystroke-by-keystroke macro. After leaving insert, `Esc` leaves the cursor on the **last
typed character** (matches Vim); so `ciw<X><Esc>` followed by `.` re-applies on that same
word, and you use `w.` to change the next word.
*Asserted in:* `tests/insert.test.js` (dot-repeat with backspace) and
`tests/repeat.test.js` → "ciw + replacement then w. changes the next inner word too".

### 2.5 Charwise joins and paste clip at 80 columns (nothing goes off-screen)
Vim keeps the whole line when it joins two lines (`dw` at end-of-line, `J`) or when it
pastes, and lets lines be arbitrarily long (wrapping only visually). This emulator
enforces a hard invariant: **no line is ever longer than `COLS` (80).** When a charwise
join or paste would exceed the width, the merge still happens (Vim-like) but the line is
**hard-clipped to 80 columns and the overflowing characters are dropped**, so nothing can
ever render past the visible grid.

Paths that clip: charwise `d` / `c` joins at EOL, the insert-mode `Backspace` join at
column 0, and charwise `p` / `P`. (Insert *typing* already stops at column 80.)

*Why:* arcade rule — content must never go off-screen. This was chosen over the
alternatives ("refuse the merge when it would overflow" and "wrap onto the next line")
for simplicity and consistency. The trade-off is silent loss of characters past column 80.
*Asserted in:* `tests/width.test.js`.

### 2.6 `x` with a count does not wrap across a line break
`x` honors a count (`3x` deletes three characters, register holds the last one, `.`
repeats it), matching Vim — **except** it stops at end-of-line instead of consuming the
line break. In Vim, `x` on the last character of a line deletes the newline and joins the
lines; here a counted (or single) `x` simply stops, leaving the line break in place. This
is consistent with the single-line scoping elsewhere and keeps the row count stable.
*Asserted in:* `tests/grid.test.js` → "a count larger than the line deletes to
end-of-line (no crash)".

### 2.7 Arrow keys move the caret in insert mode (intentional enhancement)
In real Vim, arrow keys in Insert mode are unreliable by default (they can insert raw
escape sequences unless terminal key-codes are handled). Here `← → ↑ ↓` in insert mode
immediately move the caret — left/right wrap across line ends, up/down keep the column
(clamped to the target line) — without inserting anything and without ending the insert
session, so you can reposition and keep typing. This is a deliberate convenience for the
game UI, not a behavior to match Vim.
*Asserted in:* `tests/insert.test.js` → "insert mode — arrow keys move the caret".

### 2.8 `%` (match bracket) is strictly single-line
`%` jumps between matching `()`, `{}`, `[]`. Like the bracket text objects (§2.1), the
pair must **open and close on the same line**; a bracket whose mate is on another line
is treated as unbalanced and `%` does nothing (it reports `no matching bracket` and, in
operator-pending, aborts the operator with no change).

Behavioral notes:
- When the cursor sits **on a bracket**, `%` goes to that bracket's depth-balanced mate.
- When the cursor sits **elsewhere**, `%` scans **forward on the line** for the first
  bracket that has a mate, then jumps to that mate's partner (this can land *behind* the
  cursor, e.g. `%` inside `(foo)` jumps to the `(`). This mirrors Vim's default forward
  search, restricted to the current line.
- A **numeric count is ignored** — `3%` is a single jump, unlike motions that repeat.
- As an operator motion (`d%` / `c%` / `y%`) the span is **inclusive of both brackets**,
  matching Vim (`d%` on `(foo)` removes `(foo)`). Dot-repeat (`.`) re-applies at the
  current cursor.

*Why:* consistent single-line scoping across the whole bracket family; multi-line `%`
would need buffer-spanning balance tracking (and is ambiguous with unmatched lines).
*Asserted in:* `tests/matchbracket.test.js`.

### 2.9 `f` / `F` / `t` / `T` (find-in-line) are strictly single-line
`f{char}` / `F{char}` move onto the next / previous `{char}` on the **current line**;
`t{char}` / `T{char}` land one character short of it (forward: just before; backward:
just after). A numeric count picks the Nth occurrence (`3fx` → third `x` forward). As
operator motions they are inclusive in the usual Vim sense: `df"` deletes **through**
the found quote, `dt"` deletes **up to but not including** it (same for `dF"` / `dT"`
backward). A missing occurrence is a no-op that reports `pattern not found`.

Differences from real Vim:
- **Single-line only** — the search never wraps to the next line (Vim's `f`/`t` are also
  line-bound, so this matches; but unlike Vim there is no `cpoptions` line-scope toggle).
- `;` repeats the last find in the **same** direction and `,` in the **opposite** direction
  (f↔F, t↔T), both honoring a count (e.g. `2;`). The stored last-find is set only by an
  explicit `f`/`F`/`t`/`T` — pressing `;`/`,` does not change the stored direction, so
  `;` and `,` can be freely alternated (matching Vim).
- Repeating an **exclusive** motion (`t`/`T`) with `;` re-searches from the current
  cursor, so if the target is immediately adjacent it re-finds that same character and
  does not move (the landing is one short of it). This is the direct consequence of
  "repeat = issue the same command again from the cursor"; use `f`/`F` to hop cleanly
  between occurrences of a character.
- A **plain** `f`/`t` jump is not itself dot-repeatable (matching Vim: it's not a change);
  an **operator** form (`dfx`, `ctx`, …) **is** dot-repeated (`.`), re-running the find at
  the current cursor.

*Why:* consistent single-line scoping with the rest of the motion set; the find char is
captured in a `pendingFind` mini-state and reused by dot-repeat via a dedicated `op-find`
record.
*Asserted in:* `tests/find.test.js`.

---

### 2.10 `r` / `s` — single-character edits

`r{char}` overwrites the character (or `[count]` characters) under the cursor with
`{char}` and stays in normal mode, leaving the cursor on the **last** replaced char. It is
one undo unit and is dot-repeatable (`.` re-applies the same replacement). It never
crosses a line boundary and stops at end-of-line (so `5rz` on a 2-char line replaces just
the available chars). Consistent with Vim, `r` does **not** modify the unnamed register.

`s` deletes `[count]` chars under the cursor and enters insert mode (Vim's `s` == `cl`). The
delete and the subsequently typed text form a **single** undo unit, and `s` + typing is
dot-repeatable.

Divergences from real Vim:
- **`s` at/beyond end-of-line** enters insert mode at the cursor *without deleting* (Vim
  raises `E486`/errors there). This keeps the key forgiving rather than erroring.
- **`r` at/beyond end-of-line** is a no-op (nothing to replace), matching Vim's refusal.

*Why:* both reuse the existing change/insert pipeline (`s` records an `op-chars` change;
`r` a `replace` change) so counts, undo and dot-repeat fall out of the same machinery.
*Asserted in:* `tests/replace.test.js`, and exercised by the "Fix the Typo" challenge.

---


## 3. Not implemented (feature / command gaps)

These are **absent from the source**, so the keys are effectively no-ops. Common
workarounds:

| Vim | Status | Workaround in this emulator |
|-----|--------|------------------------------|
| `D` (delete to EOL) | no-op | `d$` |
| `C` (change to EOL) | no-op | `c$` |
| `Y` (yank line) | no-op | `yy` |
| `S` (substitute line) | no-op | `cc` |
| Visual / Select (`v`, `V`, `Ctrl-V`) | absent | (none) |
| Search (`/`, `?`, `n`, `N`) | absent | (none) |
| Marks (`m`, backtick, `'`) | absent | (none) |
| Indent operators (`>`, `<`, `=`) | absent | (none) |
| Other text objects (`i"` `ip` `it` …) | only `iw`/`aw` + bracket blocks | (none) |
| Named / special registers (`"a`, `"_`, `"+`) | only unnamed | (single register) |
| Macros (`q`) | absent | (none) |

Only `d`, `c`, `y` act as operators (plus `x`, `p`, `P`, and the single-char `r` / `s`).
Uppercase `D` / `C` / `Y` and `S` are **not** wired as operator shortcuts.

---

## 4. Editor-model constraints (game/terminal design)

These stem from the fixed browser-grid model rather than Vim semantics:

- **Fixed 20 × 80 grid** (`ROWS = 20`, `COLS = 80`). The buffer is always exactly 20
  lines, padded with blanks.
  - **No scrolling / no auto-grow.** `o` and insert-mode `Enter` at the **bottom row are
    refused (no-op)** — there is nowhere to put a new row, so the last line is left
    unchanged and the buffer stays exactly 20 rows. (`O` at the bottom still clears the
    current line, since it inserts *above* rather than growing downward.)
  - **Hard line width of 80 columns** — enforced on every edit. Insert-typing past
    column 80 is a no-op, and charwise joins / paste are **clipped** to 80 with overflow
    dropped (see §2.5). Vim lines are unbounded.
- **Single unnamed register.** Yanks/deletes all overwrite one register; there are no
  named, black-hole (`"_`), or clipboard (`"+`) registers.
- **Snapshot undo.** Undo/redo is a flat list of whole-buffer snapshots (one entry per
  operation/insert-session), not Vim's persistent, time-grouped undo tree.

---

## 5. Add-to-this-file checklist

When you fix or intentionally accept a divergence, update this file **and** add/adjust a
test that pins the behavior, citing it here. Search the tests for `KNOWN LIMITATION`
comments, which mark the ones encoded directly in the suite.
