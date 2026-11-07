// Insert-mode tests: session-undo collapse, char/Enter/Backspace editing,
// the Escape-cursor-lands-on-last-typed-char rule, and dot-repeat of insert
// sessions (including recorded backspaces). Needs the DOM stub.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleNormalKey, handleInsertKey, undo } = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.pendingG = false; state.inputBuffer = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row, col };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };
// Run a command; capture the first lines, cursor and lastChange after it.
function act(lines, row, col, keys) {
    setup(lines, row, col);
    run(keys);
    return { lines: state.buffer.slice(0, 4), cursor: { ...state.cursor },
        lastChange: state.lastChange ? JSON.parse(JSON.stringify(state.lastChange)) : null,
        mode: state.mode };
}

describe('insert session — one undo unit', () => {
    test('typing many chars is a single undo step', () => {
        setup(['hello'], 0, 0);
        run(['i', 'a', 'b', 'c', 'Escape']);
        assert.equal(state.buffer[0], 'abchello');
        assert.equal(state.undoStack.length, 1);
        undo();
        assert.equal(state.buffer[0], 'hello');
    });
    test('typing + backspace in one session is still one undo step', () => {
        setup(['orig'], 0, 4);
        run(['i', 'X', 'Y', 'Backspace', 'Escape']);
        assert.equal(state.buffer[0], 'origX');
        assert.equal(state.undoStack.length, 1);
        undo();
        assert.equal(state.buffer[0], 'orig');
    });
    test('untyped i<Esc> creates no undo entry and no lastChange', () => {
        setup(['keep'], 0, 2);
        run(['i', 'Escape']);
        assert.equal(state.undoStack.length, 0);
        assert.equal(state.lastChange, null);
        assert.deepEqual(state.cursor, { row: 0, col: 2 });
    });
});

describe('insert mode — entering & typing', () => {
    test('i on empty line types text and advances the caret', () => {
        const r = act([''], 0, 0, ['i', 'h', 'i']);
        assert.equal(r.lines[0], 'hi');
        assert.equal(r.mode, 'insert');
        assert.deepEqual(r.cursor, { row: 0, col: 2 }); // caret sits past the caret glyph
    });
    test('I inserts at first non-blank', () => {
        const r = act(['   foo'], 0, 5, ['I', '>']);
        assert.equal(r.lines[0], '   >foo');
    });
    test('A appends at end of line', () => {
        const r = act(['foo'], 0, 0, ['A', '!']);
        assert.equal(r.lines[0], 'foo!');
    });
    test('o opens a new line below and types there', () => {
        const r = act(['line1'], 0, 0, ['o', 'N']);
        assert.deepEqual(r.lines.slice(0, 2), ['line1', 'N']);
        assert.deepEqual(r.cursor, { row: 1, col: 1 });
    });

describe('Escape — cursor lands on the last typed character', () => {
    test('typing mid-line leaves the cursor on the last typed char', () => {
        const r = act(['abcd'], 0, 2, ['i', 'X', 'Escape']);
        assert.equal(r.lines[0], 'abXcd');
        assert.deepEqual(r.cursor, { row: 0, col: 2 }); // on the inserted "X"
    });
    test('typing at end-of-line leaves the cursor on the last typed char', () => {
        const r = act([''], 0, 0, ['i', 'h', 'i', '!', 'Escape']);
        assert.equal(r.lines[0], 'hi!');
        assert.deepEqual(r.cursor, { row: 0, col: 2 }); // on the "!"
    });
    test('A + type lands on the appended char', () => {
        const r = act(['foo'], 0, 0, ['A', '!', 'Escape']);
        assert.equal(r.lines[0], 'foo!');
        assert.deepEqual(r.cursor, { row: 0, col: 3 });
    });
    test('untyped i<Esc> does not move the cursor', () => {
        const r = act(['hello'], 0, 2, ['i', 'Escape']);
        assert.deepEqual(r.cursor, { row: 0, col: 2 });
    });
    test('o<Esc> with no typing stays at the start of the new line', () => {
        const r = act(['ab', 'cd'], 0, 0, ['o', 'Escape']);
        assert.deepEqual(r.cursor, { row: 1, col: 0 });
    });
});

describe('Enter — split the line', () => {
    test('splits at the caret (col 0)', () => {
        const r = act(['abcd'], 0, 0, ['i', 'Enter']);
        assert.deepEqual(r.lines.slice(0, 2), ['', 'abcd']);
        assert.deepEqual(r.cursor, { row: 1, col: 0 });
    });
    test('splits mid-line', () => {
        const r = act(['abcd'], 0, 2, ['i', 'Enter']);
        assert.deepEqual(r.lines.slice(0, 2), ['ab', 'cd']);
    });
    test('splits at end-of-line', () => {
        const r = act(['abcd'], 0, 4, ['i', 'Enter']);
        assert.deepEqual(r.lines.slice(0, 2), ['abcd', '']);
    });
    test('records an embedded newline in typed for dot-repeat', () => {
        const r = act(['abcd'], 0, 2, ['i', 'Enter', 'X']);
        assert.deepEqual(r.lines.slice(0, 2), ['ab', 'Xcd']);
        assert.equal(r.lastChange.typed, '\nX');
    });
});

describe('Backspace — in insert mode', () => {
    test('deletes the character before the caret', () => {
        const r = act([''], 0, 0, ['i', 'X', 'Y', 'Backspace']);
        assert.equal(r.lines[0], 'X');
    });
    test('at column 0 joins with the previous line', () => {
        const r = act(['ab', 'cd'], 1, 0, ['i', 'Backspace']);
        assert.deepEqual(r.lines.slice(0, 2), ['abcd', '']);
        assert.deepEqual(r.cursor, { row: 0, col: 2 }); // caret at the seam
    });
    test('at start of file is a no-op', () => {
        const r = act(['ab'], 0, 0, ['i', 'Backspace']);
        assert.equal(r.lines[0], 'ab');
        assert.deepEqual(r.cursor, { row: 0, col: 0 });
    });
    test('records a backspace marker in typed (net effect preserved)', () => {
        const r = act([''], 0, 0, ['i', 'X', 'Y', 'Backspace', 'Escape']);
        assert.equal(r.lastChange.typed, 'XY\b');
    });
});

describe('dot-repeat — reproduces net typed text (incl. backspaces)', () => {
    test('a recorded backspace deletes during replay, not literally as a char', () => {
        setup(['zz', 'YY'], 0, 0);
        run(['i', 'A', 'X', 'Y', 'Backspace', 'Escape']); // net typed "AX"
        assert.equal(state.buffer[0], 'AXzz');
        assert.equal(state.lastChange.typed, 'AXY\b');
        state.cursor = { row: 1, col: 0 };
        run(['.']);
        assert.equal(state.buffer[1], 'AXYY'); // "AX" inserted, NOT "AXY"
    });
    // KNOWN LIMITATION (documented): a cross-line backspace (line join) is not
    // recorded in `typed`, so `.` cannot reproduce it. Asserting current behavior
    // so a future cross-line-repeat implementation must consciously update this.
    test('a cross-line join backspace is not recorded in typed', () => {
        const r = act(['ab', 'cd'], 1, 0, ['i', 'Backspace', 'Escape']);
        assert.deepEqual(r.lines.slice(0, 2), ['abcd', '']); // join happened
        assert.equal(r.lastChange.typed, ''); // but nothing was recorded
    });
});

describe('insert mode — arrow keys move the caret', () => {
    test('ArrowLeft then typing inserts to the left', () => {
        const r = act(['ab'], 0, 2, ['i', 'ArrowLeft', 'X']);
        assert.equal(r.lines[0], 'aXb');
    });
    test('ArrowRight at end of line wraps to the next line start', () => {
        const r = act(['ab', 'cd'], 0, 2, ['i', 'ArrowRight']);
        assert.deepEqual(r.cursor, { row: 1, col: 0 });
    });
    test('ArrowLeft at column 0 wraps to the previous line end', () => {
        const r = act(['ab', 'cd'], 1, 0, ['i', 'ArrowLeft']);
        assert.deepEqual(r.cursor, { row: 0, col: 2 });
    });
    test('ArrowDown moves down and clamps the column to the shorter line', () => {
        const r = act(['ab', 'c'], 0, 1, ['i', 'ArrowDown', 'Z']);
        assert.deepEqual(r.lines.slice(0, 2), ['ab', 'cZ']);
    });
    test('arrows at the buffer edges are safe no-ops', () => {
        assert.deepEqual(act(['ab'], 0, 0, ['i', 'ArrowUp']).cursor, { row: 0, col: 0 });
        assert.deepEqual(act(['ab'], 0, 0, ['i', 'ArrowLeft']).cursor, { row: 0, col: 0 });
    });
    test('arrow keys never insert literal text', () => {
        const r = act(['hello'], 0, 0, ['i', 'ArrowRight', 'X', 'Escape']);
        assert.equal(r.lines[0], 'hXello'); // only "X" was inserted
    });
    test('caret moves are not a separate undo unit (typing after a move is)', () => {
        setup(['ab'], 0, 2);
        run(['i', 'ArrowLeft']);           // move only → no undo snapshot yet
        assert.equal(state.undoStack.length, 0);
        run(['X']);                         // now mutate → one snapshot
        assert.equal(state.undoStack.length, 1);
    });
});


});