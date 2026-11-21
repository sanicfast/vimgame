// Differential (oracle) test: feed the simulator and a REAL Vim (Neovim) the same
// starting buffer and the same keystrokes, and require the resulting buffers to be
// identical. This turns real Vim into an independent check of the simulator.
//
// HARD-REQUIRES nvim: if Neovim is not found this file throws at load so the suite
// fails loudly (we would rather the test fail than silently pass on a no-op).
//
//   * MATCHES[]     — keystrokes that must produce an IDENTICAL buffer to real Vim.
//   * DIVERGENCES[] — cases that must DIFFER, keeping intentional/known differences honest.
function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, COLS, CHALLENGES, setMode,
    handleNormalKey, handleInsertKey, handleTextObjectKey } = require('../script.js');
const { SOLUTIONS } = require('./canonical_solutions.js');
const { findNvim, runVim, normalize } = require('./vim_oracle.js');

if (!findNvim()) {
    throw new Error(
        'vim_equivalence.test.js requires `nvim` (Neovim) on PATH as the real-Vim ' +
        'oracle, but it was not found. Install it (e.g. `brew install neovim`) or ' +
        'delete this test file. Refusing to run a vacuous comparison.'
    );
}

function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else if (state.mode === 'pending-text-object') handleTextObjectKey({ key: ch });
    else handleNormalKey({ key: ch });
}
function resetSim(startLines) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = startLines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.pendingG = false; state.pendingFind = null; state.pendingReplace = null;
    state.lastFind = null; state.inputBuffer = ''; state.commandMode = false;
    state.commandInput = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row: 0, col: 0 };
    state.lastChange = null; state.insertTouched = false; state.pendingInsertRecord = null;
    state.statusMsg = '';
}
function runSimulator(startLines, tokens) {
    resetSim(startLines);
    setMode('normal');
    for (const t of tokens) press(t);
    return normalize(state.buffer);
}

// ----- 1. Challenge solutions (name-keyed; also driven by challenge.test.js) -------
describe('challenge solutions match real Vim (Neovim oracle)', () => {
    for (const name of Object.keys(SOLUTIONS)) {
        test(`"${name}" matches real Vim`, () => {
            const c = CHALLENGES.find((x) => x.name === name);
            assert.ok(c, `challenge not found: ${name}`);
            const start = c.start.slice();
            const sim = runSimulator(start, SOLUTIONS[name]);
            const vim = normalize(runVim(start, SOLUTIONS[name]));
            assert.deepEqual(sim, vim,
                `mismatch for "${name}"\n  sim: ${JSON.stringify(sim)}\n  vim: ${JSON.stringify(vim)}`);
        });
    }
});

// ----- 2. Feature coverage beyond the challenges ----------------------------------
// Cursor starts at (0,0); position is reached with explicit keys (the driver applies
// input via `:normal!`, which begins each line at column 0).
const MATCHES = [
    { name: 'yank word + paste before',  start: ['alpha beta'],       keys: ['y', 'w', 'P'] },
    { name: 'yank word + paste after',   start: ['alpha beta'],       keys: ['y', 'w', 'p'] },
    { name: 'yank line + paste above',   start: ['x', 'y'],           keys: ['y', 'y', 'P'] },
    { name: 'delete line + paste x2',    start: ['one', 'two'],       keys: ['d', 'd', '2', 'p'] },
    { name: 'delete to found space',     start: ['hello world'],      keys: ['d', 'f', ' '] },
    { name: 'delete up to comma',        start: ['hello, world'],     keys: ['d', 't', ','] },
    { name: 'delete to EOL (d$)',        start: ['hello world x'],    keys: ['d', '$'] },
    { name: 'change to EOL (c$)',        start: ['hello world x'],    keys: ['c', '$', '!', 'Escape'] },
    { name: 'delete to end of word (de)',start: ['hello world'],      keys: ['d', 'e'] },
    { name: 'delete a word (daw)',       start: ['cat dog'],          keys: ['d', 'a', 'w'] },
    { name: 'change a word (caw)',       start: ['cat dog'],          keys: ['c', 'a', 'w', 'X', 'Escape'] },
    { name: 'delete 2 words (d2w)',      start: ['a b c d'],          keys: ['d', '2', 'w'] },
    { name: 'delete up-to char (dtX)',   start: ['aXbXc'],            keys: ['d', 't', 'X'] },
    { name: 'change up-to char (ctX)',   start: ['aXbXc'],            keys: ['c', 't', 'X', 'Z', 'Escape'] },
    { name: 'delete back to char (dT)',  start: ['aXbXc'],            keys: ['l', 'l', 'd', 'T', 'X'] },
    { name: 'delete inside brackets',    start: ['xs[ab]y'],          keys: ['d', 'i', '['] },
    { name: 'change inside parens',      start: ['v=(1+2)'],          keys: ['f', '(', 'c', 'i', '(', '9', 'Escape'] },
    { name: 'change inside curly',       start: ['m={k:1}'],          keys: ['f', '{', 'c', 'i', '{', 'Z', 'Escape'] },
    { name: 'delete inner WORD (diW)',   start: ['foo.bar baz'],      keys: ['d', 'i', 'W'] },
    { name: 'delete a WORD (daW)',       start: ['foo.bar baz'],      keys: ['d', 'a', 'W'] },
    { name: 'change inner WORD (ciW)',   start: ['foo.bar baz'],      keys: ['c', 'i', 'W', 'X', 'Escape'] },
    { name: 'delete inner angle (di<)',  start: ['a<b>c'],            keys: ['l', 'l', 'd', 'i', '<'] },
    { name: 'change inner angle (ci<)',  start: ['a<b>c'],            keys: ['l', 'l', 'c', 'i', '<', 'X', 'Escape'] },
    { name: 'delete inner quote (di")',  start: ['s="hello"'],        keys: ['l', 'l', 'l', 'd', 'i', '"'] },
    { name: 'delete a quote (da")',      start: ['s="hello"'],        keys: ['l', 'l', 'l', 'd', 'a', '"'] },
    { name: 'change inner quote (ci")',  start: ['s="hi"'],           keys: ['f', '"', 'c', 'i', '"', 'X', 'Escape'] },
    { name: 'change inner single-quote', start: ["p='ab'"],           keys: ['f', "'", 'c', 'i', "'", 'Y', 'Escape'] },
    { name: 'delete 2 chars (2dl)',      start: ['abcdef'],           keys: ['2', 'd', 'l'] },
    { name: 'delete 2 lines (2dd)',      start: ['a', 'b', 'c', 'd'], keys: ['2', 'd', 'd'] },
    { name: 'open line below (o)',       start: ['aa', 'bb', 'cc'],   keys: ['j', 'o', 'b', 'a', 'z', 'Escape'] },
    { name: 'open line above (O)',       start: ['aa', 'bb'],         keys: ['O', 'X', 'Escape'] },
    { name: 'replace char (r)',          start: ['abcd'],             keys: ['r', 'Z'] },
    { name: 'replace count (2r)',        start: ['abcd'],             keys: ['2', 'r', 'Z'] },
    { name: 'substitute char (s)',       start: ['abcdef'],           keys: ['l', 'l', 'l', 's', 'Z', 'Escape'] },
    { name: 'substitute count (2s)',     start: ['abcdef'],           keys: ['l', '2', 's', 'Z', 'Escape'] },
    { name: 'insert + backspace',        start: ['abc'],              keys: ['i', 'X', 'Backspace', 'Escape'] },
    { name: 'change word drops trailing space (cw)',  start: ['cat dog end'],  keys: ['c', 'w', 'X', 'Escape'] },
    { name: 'change 2 words drops trailing space (c2w)', start: ['one two three'], keys: ['c', '2', 'w', 'X', 'Escape'] },
    { name: 'change 2 WORDs drops trailing space (c2W)', start: ['a.b c d'],    keys: ['c', '2', 'W', 'X', 'Escape'] },
    { name: 'delete to EOL shortcut (D)',        start: ['hello world'],        keys: ['l', 'l', 'l', 'D'] },
    { name: 'D keeps a blank line at col 0',     start: ['pre', 'aaa', 'bbb', 'post'], keys: ['j', 'D'] },
    { name: 'D with count spans lines (2D)',     start: ['pre', 'aaa', 'bbb', 'ccc', 'post'], keys: ['j', '2', 'D'] },
    { name: 'change to EOL shortcut (C)',        start: ['hello world'],        keys: ['l', 'l', 'l', 'C', 'X', 'Escape'] },
    { name: 'C with count spans lines (2C)',     start: ['pre', 'aaa', 'bbb', 'ccc', 'post'], keys: ['j', '2', 'C', 'X', 'Escape'] },
    { name: 'yank line shortcut (Y)',            start: ['hello'],              keys: ['Y', 'p'] },
    { name: 'yank 2 lines (2Y)',                 start: ['a', 'b', 'c'],        keys: ['2', 'Y', 'p'] },
    { name: 'substitute line shortcut (S)',      start: ['hello world'],        keys: ['S', 'Z', 'Escape'] },
    { name: 'substitute 2 lines (2S)',           start: ['a', 'b', 'c'],        keys: ['2', 'S', 'Z', 'Escape'] },
    { name: 'cw on a line-final word (no join)', start: ['aaa', 'bbb'],         keys: ['c', 'w', 'X', 'Escape'] },
    { name: 'cw spans to a 2nd-line word',       start: ['a b c', 'd e'],       keys: ['c', '3', 'w', 'X', 'Escape'] },
    { name: 'cw on a blank run',                 start: ['one  two'],           keys: ['l', 'l', 'l', 'c', 'w', 'X', 'Escape'] },
    { name: 'cw on a lone word',                 start: ['hello'],              keys: ['c', 'w', 'X', 'Escape'] },
    { name: 'indent line (>>)',          start: ['abc'],          keys: ['>', '>'] },
    { name: 'indent 2 lines (2>>)',      start: ['a', 'b', 'c'],  keys: ['2', '>', '>'] },
    { name: 'indent with motion (>j)',   start: ['a', 'b', 'c'],  keys: ['>', 'j'] },
    { name: 'indent to bottom (>G)',     start: ['a', 'b', 'c'],  keys: ['>', 'G'] },
    { name: 'unindent line (<<)',        start: ['  abc'],        keys: ['<', '<'] },
    { name: 'unindent 4sp to 2 (<<)',    start: ['    abc'],      keys: ['<', '<'] },
    { name: 'unindent 2 lines (2<<)',    start: ['  a', '  b', 'c'], keys: ['2', '<', '<'] },
    { name: 'indent via text object (>iw)', start: ['foo bar'],   keys: ['>', 'i', 'w'] },
    { name: 'auto-indent brace block (=G)', start: ['function f() {', 'return 1;', '}'], keys: ['=', 'G'] },
    { name: 'auto-indent nested (=G)',   start: ['function f() {', 'if (x) {', 'return 1;', '}', '}'], keys: ['=', 'G'] },
    { name: 'auto-indent single line (==)', start: ['x', '  y'],  keys: ['j', '=', '='] },
];
describe('feature coverage matches real Vim', () => {
    for (const c of MATCHES) {
        test(`"${c.name}" matches real Vim`, () => {
            const sim = runSimulator(c.start, c.keys);
            const vim = normalize(runVim(c.start, c.keys));
            assert.deepEqual(sim, vim,
                `mismatch for "${c.name}"\n  sim: ${JSON.stringify(sim)}\n  vim: ${JSON.stringify(vim)}`);
        });
    }
});

// ----- 3. Documented divergences (must DIFFER) ------------------------------------
const DIVERGENCES = [
    { name: '80-column cap (fixed grid)', start: ['a'.repeat(COLS)], keys: ['A', 'Z', 'Escape'],
      note: 'simulator clips a line at 80 cols; Vim grows past it (VIM_DIFFERENCES 4)' },
    { name: 'fixed 20-row grid (no scroll)',
      start: Array.from({ length: ROWS }, (_, i) => 'L' + i), keys: ['G', 'o', 'X', 'Escape'],
      note: '`o` at the last row is refused; Vim appends a 21st row (VIM_DIFFERENCES 4)' },
    { name: 'count-indent past the last line', start: ['a', 'b'], keys: ['j', '2', '>', '>'],
      note: "Vim refuses `2>` when it would run past its last line; the simulator's fixed" +
            " 20-row grid shifts the available line(s) instead (VIM_DIFFERENCES 4)." },
];
describe('documented divergences from real Vim', () => {
    for (const c of DIVERGENCES) {
        test(`"${c.name}" differs from real Vim (as documented)`, () => {
            const sim = runSimulator(c.start, c.keys);
            const vim = normalize(runVim(c.start, c.keys));
            assert.notDeepEqual(sim, vim,
                `expected a difference but they matched for "${c.name}": ${JSON.stringify(sim)}\n  (${c.note})`);
        });
    }
});
