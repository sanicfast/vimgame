// Fixed-grid width invariant: no buffer line may ever exceed COLS columns.
// These exercise the concatenation paths (charwise delete/change joins at EOL,
// the insert-mode Backspace join, and charwise paste) that could otherwise grow
// a line past the visible grid and push text off-screen. Overflow is clipped.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, COLS, handleNormalKey, handleInsertKey } = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.inputBuffer = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row, col };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };
const maxLine = () => Math.max(0, ...state.buffer.map((l) => l.length));
const withinGrid = () => state.buffer.every((l) => l.length <= COLS);

describe('fixed-grid width — overflow is clipped to COLS', () => {
    test('dw join at EOL clips the merged line to exactly COLS', () => {
        // Row0 is 80 wide ending in the word "y"; row1 has 10 more chars.
        // Joining would make 89; the result must be hard-clipped to 80.
        setup(['x'.repeat(COLS - 2) + ' y', 'z'.repeat(10)], 0, COLS - 1);
        run(['d', 'w']);
        assert.equal(state.buffer[0].length, COLS);
        assert.ok(withinGrid());
        // The first COLS chars are kept: head + first overflow char.
        assert.equal(state.buffer[0], 'x'.repeat(COLS - 2) + ' z');
    });

    test('insert-mode Backspace join at col 0 clips to COLS', () => {
        setup(['a'.repeat(60), 'b'.repeat(40)], 1, 0);
        run(['i', 'Backspace']);
        assert.ok(withinGrid());
        assert.equal(state.buffer[0].length, COLS);
        assert.equal(state.buffer[0], 'a'.repeat(60) + 'b'.repeat(20));
    });

    test('cw change join at EOL clips to COLS (and typing cannot exceed it)', () => {
        setup(['x'.repeat(COLS - 2) + ' y', 'z'.repeat(10)], 0, COLS - 1);
        run(['c', 'w', 'Q', 'Escape']); // "Q" cannot be inserted: line already at cap
        assert.ok(withinGrid());
        assert.equal(state.buffer[0].length, COLS);
    });

    test('charwise paste clips the resulting line to COLS', () => {
        setup(['a'.repeat(60), 'b'.repeat(50)], 1, 0);
        run(['y', '$']);      // yank the 50 "b" chars charwise
        run(['k']);           // move up to the 60-char line, col 0
        run(['p']);           // paste after col 0 -> would be 110 wide
        assert.ok(withinGrid());
        assert.equal(state.buffer[0].length, COLS);
        assert.ok(state.buffer[0].startsWith('a' + 'b'.repeat(50)));
    });

    test('when the merge FITS, lines join fully with no clipping', () => {
        setup(['foo', 'bar'], 0, 2);
        run(['d', 'w']);      // deletes last "o" and joins -> "fobar"
        assert.equal(state.buffer[0], 'fobar');
    });
});

describe('fixed-grid width — global invariant', () => {
    test('no line exceeds COLS after a sequence of joins, pastes, and edits', () => {
        const wide = 'q'.repeat(COLS);
        setup([wide, 'w'.repeat(COLS), 'tail'], 0, 0);
        // Backspace-join the two full-width rows from row 1.
        state.cursor = { row: 1, col: 0 };
        run(['i', 'Backspace', 'Escape']);
        // Paste wide content repeatedly.
        setup([wide, wide], 0, COLS - 1);
        run(['y', 'y', 'p']);
        for (const line of state.buffer) {
            assert.ok(line.length <= COLS, `line too long: ${line.length}`);
        }
        assert.ok(maxLine() <= COLS);
    });
});
