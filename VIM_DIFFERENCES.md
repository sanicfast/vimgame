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
  (`G` jumps to the last *non-empty* line, like Vim's end-of-file).
- **Operators:** `d` (delete), `c` (change), `y` (yank), `x` (delete char), `p` / `P`
  (paste). Doubled forms `dd` / `cc` / `yy` work as line operations.
- **Text objects:** `iw` / `aw` (word) and bracket blocks — `i(`/`a(`, `i{`/`a{`,
  `i[`/`a[` (with the `)`, `}`, `]`, `b`, `B` aliases) — usable with `d` / `c` / `y`.
- **Insert entry:** `i` `a` `I` `A`, and `o` / `O` (open line).
- **Insert editing:** printable chars, `Enter` (split line), `Backspace`, `Esc`.
- **History:** `.` dot-repeat, `u` undo, `Ctrl-R` redo.
- **Counts:** numeric prefixes on operators and motions — including line jumps
  (`5G` / `5gg`) and repeated `2ge` / `2gE` (e.g. `2dw`, `3.`, `2dd`, `2p`).

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

---


## 3. Not implemented (feature / command gaps)

These are **absent from the source**, so the keys are effectively no-ops. Common
workarounds:

| Vim | Status | Workaround in this emulator |
|-----|--------|------------------------------|
| `D` (delete to EOL) | no-op | `d$` |
| `C` (change to EOL) | no-op | `c$` |
| `Y` (yank line) | no-op | `yy` |
| `s` (substitute char) | no-op | `cl` |
| `S` (substitute line) | no-op | `cc` |
| Visual / Select (`v`, `V`, `Ctrl-V`) | absent | (none) |
| Search (`/`, `?`, `n`, `N`) | absent | (none) |
| Find-in-line (`f`, `F`, `t`, `T`, `;`, `,`) | absent | (none) |
| Match bracket (`%`) | absent | (none) |
| Marks (`m`, backtick, `'`) | absent | (none) |
| Indent operators (`>`, `<`, `=`) | absent | (none) |
| Other text objects (`i"` `ip` `it` …) | only `iw`/`aw` + bracket blocks | (none) |
| Named / special registers (`"a`, `"_`, `"+`) | only unnamed | (single register) |
| Macros (`q`) | absent | (none) |

Only `d`, `c`, `y` act as operators (plus `x`, `p`, `P`). Uppercase `D` / `C` / `Y` and
`s` / `S` are **not** wired as operator shortcuts.

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
