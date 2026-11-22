# New exercise ideas

Concept cards (not full specs): **Name** — one-line goal. `cmds` — support tag.
Flesh any card into a level later by writing start/target/hint and verifying it against
the real-Vim oracle (VIM_DIFFERENCES.md §6) before shipping.

**Tags:** ✅ = uses only currently-supported commands (drillable now) · 🔧 needs X =
relies on an absent feature (drives engine work). Supported vocabulary:
`i I a A o O h j k l w b W B e ge E gE 0 $ gg G % f F t T ; , d dd y yy p P x r s D C Y S`
and `> >> < << = . (counts) u Ctrl-R`, text objects
`iw aw iW aW i" a" i' a' i\` a\` i( a( i[ a[ i{ a{ i< a<`.

**Design principle:** many cards deliberately MIX two already-taught tricks to build
pattern recognition — e.g. "strip the parens OUTSIDE, then delete the commas INSIDE."

> Seeds from the original author notes (kept): combine-a-couple-tricks-but-simple;
> a Remove-the-Dots variant that targets the token *after* the dot; and backwards-motion
> drills (`b/B/ge/gE`) that start the cursor at the end / last line. These are woven into
> the sections below (see §5, §7, §18).

---

## 1. Insert & open (`o O i a I A`, counts, `.`)

- **Open Below Twice** — add two new lines under line 1. `o o <text> Esc` — ✅
- **Type Inside, Stay Out** — add a word between existing quotes. `f" l i <text> Esc` — ✅
- **Numbered Insertion** — `o` a step line under each item, number by hand. — ✅
- **Fix the Missing Comma** — `f<w> i ,` inserts before a word. — ✅
- **Open Above the Loop** — `O` to add the `for` line above its body. — ✅
- **Prepend an Index** — `I 1. Esc`, `j`, retype digit, `.` shape. — ✅
- **Multi-line Block Insert** — type a 3-line comment via `o` + Enter twice. — ✅

## 2. Char & line delete (`x dd D`, counts)

- **Clear Two Lines** — `2dd` a blank+comment pair. — ✅
- **Cut the Wrap Brackets** — `x` head, `$ x` tail, repeat. — ✅
- **Erase the Whole Line** — `S` then type a replacement. — ✅
- **Kill Everything But 3 Chars** — `3 l` then `D`. — ✅
- **Delete Before the Cursor** — removing text left of caret. — 🔧 needs `X`

## 3. Replace / substitute (`r s`, counts)

- **Fix the Typo Letter** — `r` over the wrong letter, repeat below. — ✅
- **Blank the Field** — `s` a value then type nothing, `Esc` (delete-and-retype). — ✅
- **Rename One Letter** — `r` the variable's first char to fix casing. — ✅
- **Substitute a Digit** — `f<space> l r5` to change a count. — ✅
- **Two-at-once Replace** — `2r#` overwrites two chars (e.g. `==`→`##`). — ✅
- **Retype the Tail Char** — `$ r!` then `j .`. — ✅
- **r then Dot** — replace on line 1, `j .` to fix siblings. — ✅
- **Substitute then Continue Typing** — `s` a word and retype it fully. — ✅
- **Overwrite the Whitespace** — `r␉`? use `r` to replace a space with `-`. — ✅

## 4. Word / WORD motions with operators (`w W e E`, `d c y`)

- **Delete Two Words** — `2dw` then `j .`. — ✅
- **Yank the Next Word** — `yw` then `p` to duplicate it forward. — ✅
- **e then a space then text** — move word end, append a modifier. `e a <txt> Esc` — ✅
- **Next-Word Swap** — `yw` one word, `dw` it, place later. — ✅
- **Change Every Other Word** — `w cw <text> Esc w cw …` pattern. — ✅
- **Delete Last Word** — `$ be dw`? use `db`-free → `e $ ` combos. — ✅
- **Yank Word, Paste at End** — `yiw` then `A p Esc`. — ✅
- **WORD vs word quiz** — `daw` vs `daW` give different spans on `a.b c`. — ✅
- **Two Changes One Line** — `cw` one word, `w` over, `cw` another. — ✅
- **Trimmed Duplicate** — `yiw` then `P` to prepend the word. — ✅
- **Gap-Delete Pattern** — `w d2w` repeatedly (every third word gone). — ✅

## 5. Backwards-motion drills (`b B ge gE`) — cursor STARTS at end / last line

- **Jump to Prev WORD** — `B`/`gE` back across `a.b` tokens. — ✅
- **Align Two Words** — `b` to a word, `yiw`, `e` forward, `p`. — ✅
- **Undo-by-Backspace-word** — `dw`-in-reverse via `db` from word start. — ✅
- **Rewind the Label** — `ge` to prev word end, `ciw` rename. — ✅
- **Back Over a Path** — `b`/`B` to hop `/`-separated segments. — ✅
- **Yank-Left Paste-Right** — `b yiw e p`. — ✅
- **Trim Leading Words from End** — start `$`, `b b d0`. — ✅
- **gE over Dots** — `gE` lands on prev WORD end through `x.y`. — ✅
- **Prev-Word Change, Repeat** — `be ciw <t> Esc` then move & repeat. — ✅
- **Walk Back & Comment** — `b` steps, `I// Esc`, repeat upward with `k`. — ✅
- **Reverse Column Drill** — `ge`-walk to column near start then append. — ✅

## 6. Line edges (`0 ^ $`, operators)

- **Delete to Line End** — `f/ D` cuts a comment tail. — ✅
- **Indent-Underline Head** — `0 I## ␣ Esc` to prefix. — ✅
- **Trim Line End Junk** — find the junk char then `D`. — ✅
- **Dollar-Delete Char** — `$ x` then `0` to reset. — ✅
- **Unquote the Whole Line** — `0 x $ x`. — ✅
- **Start to First Word** — `0` then `d2w`? vs `dw`; quiz the diff. — ✅
- **Append, Then Return to Start** — `A ,` then `0` to continue. — ✅

## 7. Find family (`f F t T ; ,`)

- **Find & Delete Forward** — `f#` jump then `x` each marker. — ✅
- **Back to the Quote** — `F"` then `T` step to edit before it. — ✅
- **Semicolon Hop** — `f. x ; x ; x` (Remove-the-Dots core). — ✅
- **Comma-Hop Delete** — `f, x ; x ; ,` mixing `,` reverse. — ✅
- **Span Between Marks** — `f| d/|`? use `f| df|` between pipes. — ✅
- **Find Back + Delete Back** — `F-` then `dT-`? use `dt-` from front; backward combo `dT-`. — ✅
- **T-then-Change** — `t"` then `ci"`? use `t"` land before quote, edit. — ✅
- **Find·Yank·Paste** — `f:` jump, value starts there, `y$` then place. — ✅
- **Two Targets Per Line** — `f=a f,b` then act (find-then-find). — ✅
- **Hop and Indent** — `f{` jump onto brace, `>` it. — ✅
- **Find Backwards to Start** — `F,` to a comma, then `D`. — ✅
- **Exclusive Bracket Delete** — `t( d T)`? drill `d i` vs `t`. — ✅
- **Find, Dot-Repeat Find** — `fx`, act, then `;` re-find on next line. — ✅
- **Between Two Dots** — `f. dt.` (Delete After the Dot core). — ✅
- **Multi-Char Skip** — `3f. x` (third dot). — ✅
- **Wrap the Found Span** — `f)` walk back, wrap token in quotes. — ✅

## 8. Match bracket (`%`)

- **Jump to Match** — `f(` then `%` lands on `)` (inspection). — ✅
- **Yank the Group** — `y%` then `p` duplicates the call. — ✅
- **Angle Tag Hop** — `%` between `<`/`>`. — ✅
- **Nested Outer Match** — `(( ))`, `%` matches the OUTER pair. — ✅
- **Change Args, Keep Calls** — `ci(` on each `fn(...)`. — ✅
- **Duplicate Inside** — `yi(` yank args, `%` out, `p`. — ✅

## 9. Text objects × operator (`d c y` × `iw aw iW aW i" i' i\` i( i[ i{ i<`)

- **Inner Angle** — `ci<` change a tag's body. — ✅
- **Yank Inner Parens** — `yi(` grab args to reuse. — ✅
- **Yank Inner Word** — `yiw` a variable to clone. — ✅
- **Change Then Duplicate** — `ciw <t> Esc` then move & `p`? (register reuse). — ✅
- **Swap Two Inner Groups** — `y i (` one, `c i (` other, `p`. — ✅
- **Change Tag Then Attrs** — `ci<` body, then `ci"` attribute value. — ✅
- **Yank Then Paste into Quotes** — `yiw` a word, `ci"`, then paste. — ✅
- **Strip All Containers** — wipe inside `[ ] { } ( )` on consecutive lines. — ✅
- **Text-object + Dot** — `ci( 42 Esc j .` fill every call. — ✅
- **Choose Right Object** — same line, choose `di"` vs `ci(` — pick correct. — ✅

## 10. Operator + motion (`d c y` × motions)

- **Delete to Bracket** — `d%` or `df)`. — ✅
- **Change a Sentence-ish Span** — `dt.` up to a period. — ✅
- **Yank to End** — `y$` then `p` to append the tail. — ✅
- **Delete Two Words** — `d2w`. — ✅
- **Change to Match** — `c%` the parenthetical. — ✅
- **Yank a Word, Two Pastes** — `yiw p p`. — ✅
- **Delete Find-Back** — `dT"` cuts before a quote. — ✅
- **Change Inside + Repeat** — `ci( … j .`. — ✅
- **Line-range Delete** — `d2j` spans two lines (cross-line check). — ✅
- **Yank Line, Paste Below** — `yy p` (Duplicate the Line). — ✅
- **Yank Line, Paste Above** — `yy P`. — ✅
- **Change Whole Line** — `cc <text> Esc`. — ✅
- **Change Rest of Line** — `C <text> Esc`. — ✅
- **Paste-after Char** — `p` inserts after cursor (vs `P` before). — ✅
- **Yank Span Between Pipes** — `f| y f|`? need `yt|`; drill `d` then `p`. — ✅
- **Move a Word** — `daw` then reposition then `P`. — ✅
- **Move a Whole Line** — `dd` `j` `p` (swap). — ✅
- **Duplicate a Span** — `y%` `p` (call copy). — ✅
- **Cut Tail, Paste Up** — `D` then `k P`? line-join check. — ✅
- **Yank Args, Another Call** — `ci(` to overwrite with pasted args. — ✅
- **Change Number, Dot** — `ciw` a value, `j .`. — ✅
- **Span Swap** — delete span A, paste into span B, and vice versa. — ✅

## 11. Linewise ops (`dd yy cc D C Y S`, counts)

- **Change Two Lines** — `2cc` to collapse a pair into one line. — ✅
- **Duplicate a Line Block** — `2yy p` to copy two rows. — ✅
- **Reverse Two Lines** — `dd k p`? then re-check swap. — ✅
- **Delete the Comment Lines** — `dd`/`2dd` on scattered comments. — ✅
- **Re-indent-then-retype** — `cc`, type with indentation. — ✅
- **Blank the Whole File** — `V`? no → `gg G d G`? use counts. — 🔧 needs `dG` line-grammar / visual
- **Two D-edges** — `2D` deletes through next line's end. — ✅
- **S then Dot** — `S<text>Esc` then `j .` to overwrite siblings. — ✅

## 12. Yank & paste (`y yy yiw yMotion`, `p P`, counts, char vs line)

- **Yank Line Paste Below** — `yy p`. — ✅
- **Yank Word, Paste after** — `yiw p`. — ✅
- **Move via Yank** — `yiw`, move, `p`, then delete original. — ✅
- **Yank Tail** — `y$` then go `k` line, `p`. — ✅
- **Yank to Bracket** — `y%` then place. — ✅
- **Reuse Across Lines** — `yiw` a value, `j`, `ciw`, paste it. — ✅
- **Swap Registers by Hand** — yank A, paste at B; yank B, paste at A. — ✅
- **Copy a Row in a Table** — `yy p` then `ciw` edit a field. — ✅
- **Paste at Line Start** — `0 P` (charwise nuance). — ✅
- **Paste after Line End** — `$ p`. — ✅
- **Carry a Word Down** — yank line1 word, `j`, paste over line2 word (`cw` paste). — ✅
- **Triple Paste** — `2yy 3p` to duplicate two rows ×3. — ✅
- **Yank Inner, Change Inner** — `yi(` one, `ci(` other, paste. — ✅
- **Line vs Char Quiz** — `yy`/`p` (new line) vs `yiw`/`p` (inline). — ✅
- **Move Two Lines** — `2dd`, `2j`, `p`. — ✅
- **Duplicate then Edit** — `yy p`, then `ciw` on the copy. — ✅
- **Rebuild from Yanks** — reconstruct a line purely from pasted spans. — ✅

## 13. Indent (`>> << =`, `>motion`)

- **Auto-indent a Block** — `==` brace-depth. — ✅
- **Auto-indent All** — `gg=G` whole buffer. — ✅
- **Fix Mixed Indent** — `>` some, `<` others to level siblings. — ✅
- **Indent Then Comment** — `>>` then `I//` on same line. — ✅
- **Over-indent Then Fix** — intentionally add, then `<<` back (teaches reversibility). — ✅

## 14. Counts everywhere

- **Find 2nd Target** — `2f.` then act. — ✅
- **Move Down 3** — `3j` then edit. — ✅
- **Yank 2, Paste 3** — `2yy 3p`. — ✅
- **Change 2 Words** — `c2w`. — ✅
- **Append to 3rd Word** — `3w a`. — ✅
- **From-Top by Count** — `5gg`? (count+gg), edit. — ✅
- **Repeat Find by Count** — `2;` (third occurrence). — ✅
- **Back by Count** — `3b` then `D`. — ✅
- **Substitute Then Count-Dot** — `s<txt>Esc`, `3j .`. — ✅

## 15. Dot-repeat across lines (`.` after one trick)

- **One Fix Per Row** — a per-row `ciw`, dot to siblings. — ✅
- **Wrap-and-repeat** — `I(Esc $ A)Esc j .`. — ✅
- **Comment-and-repeat** — `I//<sp>Esc j .`. — ✅
- **Erase-and-repeat** — `$ x j .` trailing char. — ✅
- **Replace-and-repeat** — `r- j .`. — ✅
- **Find-delete-repeat** — `f, x` then need `0 f, ; x` on next — pattern. — ✅
- **Substitute-line repeat** — `S<text>Esc j .`. — ✅
- **Yank-free rebuild** — dot a small macro of edits across identical rows. — ✅
- **Dot after Find-op** — `df,` then `j 0 .`. — ✅
- **Change-digit repeat** — `r` then dot where value is constant. — ✅
- **Two-op Dot** — one combined edit (find+delete) repeated down. — ✅
- **Repair a Wrong Dot** — `u` then re-do with proper repositioning before `.`. — ✅

## 16. Vertical movement (`j k gg G Nj Nk`)

- **Top to Bottom Edit** — `G` last line, edit. — ✅
- **Up to Header** — `k` to the title, `I` to prefix. — ✅
- **Bottom to Top Move** — `G dd gg p` (Move Last Line to Top). — ✅
- **Relativenumber Count** — use gutter to `Nj` to a target (Count the Jumps). — ✅
- **Scroll-free Bottom** — `G` on a 19-line block to the last. — ✅

## 17. Undo / redo (`u`, `Ctrl-R`)

- **Oops, Undo** — wrong `dd`, then `u`. — ✅
- **Redo a Change** — `u` then `Ctrl-R`. — ✅
- **Multi-undo** — `u u u` back three edits. — ✅
- **Undo Insert Session** — one `u` reverts a whole typed line. — ✅
- **Undo then Different Path** — `u`, then fix the right way. — ✅
- **Undo a Wrong Dot** — `u` to erase a bad `.` cascade. — ✅
- **Redo Chain** — `u u` then `Ctrl-R Ctrl-R`. — ✅
- **Checkpoint Drill** — make edits, `u` one, redo, then continue. — ✅

## 18. Combos / mini-puzzles (2–3 taught tricks on one line) — PATTERN RECOGNITION

> Each line here is built to require noticing TWO different shapes and applying two
> different learned moves. Tag M = the mash-up being reinforced.

  `0 x` + ` di(` or `f( d%` then `f, x ; x`. **M: %/x + f/x** — ✅
- **Unquote Then Comma-Clean** — `0 x $ x` to unquote a CSV cell, then `f, x` delimiters. — ✅
- **Comment Then Reflow** — `D` the trailing comment, then `J`-equivalent via `0`+join? — 🔧 needs `J`
- **Move A Word Into A Call** — `daw` a word, `f( l p` paste inside parens. — ✅
- **Rename, Requote** — `ciw` rename var, then `ci"` fix its string. — ✅
- **Hop-Dot-Delete Combo** — `f. ; x ; x` then `j` and `0 f. ; x ; x` (dots variant). — ✅
- **Yank Across Containers** — `yi{` object one, `ci{` object two, paste. — ✅
- **Find-Delete-Then-Add** — `f, x` remove a comma, then `i,` re-add elsewhere. — ✅
- **Dedent-Out And Re-indent** — `<<` to unindent, delete a stray token, `>>` again. — ✅
- **Number, Then Sort-Move** — renumber via `r`, move a line via `dd p`. — ✅
- **Two Containers, Wipe The Smaller** — `di(` here, `di[` there, one left intact. — ✅
- **Search-free Jump-Fill** — `f=` jump to value slot, `ciw` new value, `j .`. — ✅
- **Inner-Replace + Line-Move** — `ci(` a value, `dd` a wrong line, `p` it later. — ✅
- **Three Marks One Line** — `x` a `*`, `f, x` a comma, `ci( ` clear args — all per line. — ✅
- **Autoindent Then Fix-Strings** — `gg=G`, then `ci"` normalize two strings. — ✅
- **Cut-Word Into-Parens Wrap** — `diw` cut a word, paste, wrap `(...)`. — ✅

## 19. Real-world micro-tasks (short realistic text)

- **JSON Trailing Comma Fix** — `$ x` the last comma (Make It Valid). — ✅
- **Add Units To Values** — `A px Esc j .` to CSS numbers. — ✅
- **Path Basename** — keep text after last `/`: `0 d F/`? use `F/` then `d0`. — ✅
- **Email Local-Part** — `f@ D` (Trim the Email). — ✅
- **Numbered List Bullet** — `f. D` keep the title, `I- ` bullet. — ✅
- **Toggle Comment** — `I//` on, `0 x x` off (drill both). — ✅
- **Arg Rename** — `ci(` replace an argument name in each call. — ✅
- **Fix The Off-By-One** — `f1 r0`? edit a single index digit (`r`). — ✅
- **Wrap Table Cells** — `I\|`+`A\|` pipe-delimit each row. — ✅
- **Markdown Bullet→Checkbox** — `I- [ ]` then `x x`? reformat `- ` to `- [ ] `. — ✅
- **Strip The `TODO:`** — `f: d w`? delete `TODO:` token, keep note. — ✅
- **Re-quote The Author** — `ci"` fix a string literal. — ✅
- **Trim Whitespace Run** — `f<sp>` then `d`? kill double-space (note the raw edge). — ✅
- **Sort-By-Move Lines** — reorder three lines via `dd`/`p` only. — ✅
- **Split A Field** — insert `\|` to divide one field into two (`i`). — ✅
- **Normalize Arrow** — `r`/`s` fix `=` to `=>` in lambdas. — ✅

## 20. Endurance / mass-rep (identical rows, one trick) — "mindless drilling"

- **20 Semicolons** — same `A; j .` down 20 rows. — ✅
- **Clear 15 Fields** — `ci( ` × 15 rows. — ✅
- **Unwrap 12 Lines** — `0 x $ x j .` a long column. — ✅
- **Strip Commas Wall** — `f, x ; x ; x` across many dense rows. — ✅
- **Indent A Long Body** — `>>`/`.` down ~15 lines. — ✅
- **Quote 20 Words** — wrap each via `ciw` + type quotes. — ✅
- **Delete The Tag ×15** — `da<` down a list of tags. — ✅
- **Find-Dot Marathon** — `f. ; ; ; x` many dots per line, many lines. — ✅
- **Rename A Variable Repeatedly** — `ciw` → same word, ~20 sites. — ✅
- **EOL Char Wall** — `$ x` down 20 lines. — ✅
- **Replace Digit Field** — `r` same digit down many rows. — ✅
- **Yank-Paste Assembly** — build a block by `yy p` repeated edits. — ✅
- **Dual-Edge Quote** — wrap 18 lines `I"`+`A"` with dots. — ✅
- **Purge Debug Lines** — hunt & `dd` among 20 rows. — ✅
- **Normalize Operators** — `f+ r -` across an expression column. — ✅
- **Triple-Per-Line Drill** — three finds + three deletes, repeat 12 rows. — ✅

## 21. "Weird edge" teaching (real-Vim gotchas, handled deliberately)

- **The Linger Space** — delete a `(note)`, land ON the prior space so `D` eats it. — ✅
- **Trailing-Comma Trap** — `f, D` then notice a leftover space; teach `0`→`$ x`. — ✅
- **Glued vs Spaced** — two lines, one `f@D` clean, one leaves a space (contrast). — ✅
- **Word-End vs Next-Word** — `cw` vs `dw` end differently (teach `cw`=`ce`). — ✅
- **Delete To Self** — `dt<same char>` no-op lesson. — ✅
- **Indent Past EOF** — `5>>` near last line edge (documented divergence). — ✅
- **Dot-Reposition Gotcha** — `dw j .` misfires on short lines; teach reposition. — ✅
- **The Jump That Stays** — `;` repeating a `t` with adjacent target (no move). — ✅
- **Change Across A Line** — `c2w` must NOT eat the newline (beats Vim). — ✅

---

## 22. Combo recipes (pure mash-ups, brainstorm fuel)

Pair any LEFT move with any RIGHT move to mint a new two-trick level:

- `f<char>` + `ci(` · `f<char>` + `di[` · `gg/G` + `dd`+`p` · `%` + `di(`/`da(`/`d%`
- `ciw` (rename) + `ci"` (requote) · `I`+`A` (wrap) + `>>` (indent)
- `daw` (remove word) + `p` (reinsert elsewhere) · `dt<char>` + `f<char> x`
- `yy p` (clone line) + `ciw` (edit the clone) · `Y P` (line before) + `I`
- `2{count}{motion}` + `.` (repeat) · `S` (retype line) + `u`/`Ctrl-R` (repair)
- `0 x $ x` (unwrap) + `ci,` (field edit) · `f<char> D` (trim tail) + `0 d2w` (trim head)
- `%` (jump to inspect) + `w`/`e` reposition + `.` (then repeat a sibling)

> Combinatorially this alone yields hundreds; pick pairs where BOTH moves are already
> taught, vary the data shape (code / CSV / paths / prose), and each becomes a fresh
> "recognize which two tricks apply" card.
