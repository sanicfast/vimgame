// Tests for find-in-line motions f / F / t / T: movement, counts, the search-char
// mini-state (incl. digit/special chars, Escape cancel), operator inclusivity
// (df" vs dt" vs dF" vs dT"), yank, change, and dot-repeat of operator finds.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, setMode, handleNormalKey, handleInsertKey, handleTextObjectKey,
    findInLine, findOpRange } = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.pendingG = false; state.pendingFind = null; state.inputBuffer = '';
    state.lastFind = null;
    state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row, col };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else if (state.mode === 'pending-text-object') handleTextObjectKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };

describe('find motion — plain jumps', () => {
    const L = ['the quick brown fox'];
    test('f lands ON the next occurrence', () => {
        setup(L, 0, 0);
        run(['f', 'k']);
        assert.equal(state.cursor.col, 8);
    });
    test('t lands just BEFORE the next occurrence', () => {
        setup(L, 0, 0);
        run(['t', 'k']);
        assert.equal(state.cursor.col, 7);
    });
    test('F lands ON the previous occurrence', () => {
        setup(L, 0, 14); // on the 'n' of brown
        run(['F', 'e']);
        assert.equal(state.cursor.col, 2);
    });
    test('T lands just AFTER the previous occurrence', () => {
        setup(L, 0, 14);
        run(['T', 'e']);
        assert.equal(state.cursor.col, 3);
    });
    test('count picks the Nth occurrence (2fo)', () => {
        setup(L, 0, 0);
        run(['2', 'f', 'o']);
        assert.equal(state.cursor.col, 17); // second 'o'
    });
    test('missing occurrence is a no-op and reports it', () => {
        setup(['abc'], 0, 0);
        run(['f', 'z']);
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
        assert.equal(state.statusMsg, 'pattern not found: z');
    });
    test('a digit can be the search char (not a count)', () => {
        setup(['a1b2c3'], 0, 0);
        run(['f', '2']);
        assert.equal(state.cursor.col, 3);
        assert.equal(state.pendingFind, null);
    });
    test('t to the immediately-next char does not move', () => {
        setup(['ab'], 0, 0);
        run(['t', 'b']);
        assert.equal(state.cursor.col, 0);
    });
    test('Escape while waiting cancels without moving', () => {
        setup(['hello'], 0, 0);
        run(['f', 'Escape']);
        assert.equal(state.pendingFind, null);
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('forward then back round-trips to the same char', () => {
        setup(L, 0, 0);
        run(['f', 'o']);   // to first 'o' (brown) col12
        assert.equal(state.cursor.col, 12);
        run(['F', 'o']);   // back to that same 'o'
        assert.equal(state.cursor.col, 12);
    });

describe('find motion — operator inclusivity', () => {
    const Q = ['"foo"bar']; // " 0 f1 o2 o3 "4 b5 a6 r7
    test('df" deletes THROUGH the found quote', () => {
        setup(Q, 0, 0);
        run(['d', 'f', '"']);
        assert.equal(state.buffer[0], 'bar');
        assert.equal(state.mode, 'normal');
    });
    test('dt" deletes UP TO but not including the found quote', () => {
        setup(Q, 0, 0);
        run(['d', 't', '"']);
        assert.equal(state.buffer[0], '"bar');
    });
    test('dF" deletes THROUGH the found quote (backward)', () => {
        setup(Q, 0, 7); // on the trailing 'r'
        run(['d', 'F', '"']);
        assert.equal(state.buffer[0], '"foor');
    });
    test('dT" deletes UP TO but not including (backward)', () => {
        setup(Q, 0, 7);
        run(['d', 'T', '"']);
        assert.equal(state.buffer[0], '"foo"r');
    });
    test('d2f" honors a count (two occurrences)', () => {
        setup(['"a"b"c'], 0, 0); // " 0 a1 "2 b3 "4 c5
        run(['d', '2', 'f', '"']);
        assert.equal(state.buffer[0], 'c');
    });
});

describe('find motion — yank and change', () => {
    test('yf" yanks through the quote and restores the cursor', () => {
        setup(['"foo"bar'], 0, 0);
        run(['y', 'f', '"']);
        assert.equal(state.register.text, '"foo"');
        assert.equal(state.buffer[0], '"foo"bar'); // unchanged
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('ct" deletes up to the quote and enters insert mode', () => {
        setup(['"foo"bar'], 0, 0);
        run(['c', 't', '"']);
        assert.equal(state.mode, 'insert');
        assert.equal(state.buffer[0], '"bar');
        for (const ch of 'X') press(ch);
        run(['Escape']);
        assert.equal(state.buffer[0], 'X"bar');
    });
});

describe('find motion — dot-repeat', () => {
    test('. re-applies an operator find at the new position', () => {
        setup(['"foo"bar', '"foo"bar'], 0, 0);
        run(['d', 'f', '"']);          // → 'bar' on line 0
        assert.equal(state.buffer[0], 'bar');
        run(['j']);                     // to line 1, on opening quote
        run(['.']);                     // repeat df"
        assert.equal(state.buffer[1], 'bar');
    });
    test('a plain find is not recorded as a change', () => {
        setup(['abc'], 0, 0);
        run(['f', 'c']);
        assert.equal(state.lastChange, null);
    });
});

describe('find helpers (pure)', () => {
    test('findInLine f lands on, t lands before', () => {
        setup(['the quick brown'], 0, 0);
        assert.deepEqual(findInLine(state.cursor, 'k', 'f', 1), { row: 0, col: 8 });
        assert.deepEqual(findInLine(state.cursor, 'k', 't', 1), { row: 0, col: 7 });
    });
    test('findInLine returns null when char absent', () => {
        setup(['abc'], 0, 0);
        assert.equal(findInLine(state.cursor, 'z', 'f', 1), null);
    });
    test('findOpRange forward is [start..dest]', () => {
        const r = findOpRange('f', { row: 0, col: 0 }, { row: 0, col: 4 });
        assert.deepEqual(r, { linewise: false, startRow: 0, startCol: 0, endRow: 0, endCol: 4 });
    });
    test('findOpRange backward is [dest..start-1]', () => {
        const r = findOpRange('F', { row: 0, col: 4 }, { row: 0, col: 0 });
        assert.deepEqual(r, { linewise: false, startRow: 0, startCol: 0, endRow: 0, endCol: 3 });
    });
});


describe('find repeat — ; and ,', () => {
    const L = ['aXbXcXd']; // a0 X1 b2 X3 c4 X5 d6

    test('; continues forward, , goes back, and ; stays forward', () => {
        setup(L, 0, 0);
        run(['f', 'X']);
        assert.equal(state.cursor.col, 1);
        run([';']);
        assert.equal(state.cursor.col, 3);
        run([';']);
        assert.equal(state.cursor.col, 5);
        run([',']);
        assert.equal(state.cursor.col, 3);
        run([';']); // does not flip to backward — still forward
        assert.equal(state.cursor.col, 5);
    });
    test('; honors a count (2; skips two)', () => {
        setup(L, 0, 0);
        run(['f', 'X']); // col1
        run(['2', ';']); // two more forward → col5
        assert.equal(state.cursor.col, 5);
    });
    test(', mirrors t to T and lands on the after-position', () => {
        setup(['a.X.b.X.c'], 0, 4); // cursor on 'b' (a0 .1 X2 .3 b4 .5 X6 .7 c8)
        run(['t', 'X']); // forward, land just before the X at col6
        assert.equal(state.cursor.col, 5);
        run([',']); // opposite of t is T → just after the previous X (col2)
        assert.equal(state.cursor.col, 3);
    });
    test('; repeats the exclusive motion from the cursor (adjacent target → no move)', () => {
        setup(['a.X.b.X.c'], 0, 0);
        run(['t', 'X']); // before first X (col2) → col1
        assert.equal(state.cursor.col, 1);
        run([';']); // t again from col1 re-finds the X at col2 → lands col1 (no move)
        assert.equal(state.cursor.col, 1);
        assert.equal(state.statusMsg, '');
    });
    test('d; uses the repeat as an operator motion', () => {
        setup(L, 0, 0);
        run(['d', 'f', 'X']); // delete 'aX' → 'bXcXd'
        assert.equal(state.buffer[0], 'bXcXd');
        run([';']); // jump to next X (col1)
        assert.equal(state.cursor.col, 1);
        run(['d', ';']); // delete through next X → 'bd'
        assert.equal(state.buffer[0], 'bd');
    });
    test('; / , with no prior find reports it and does nothing', () => {
        setup(['abc'], 0, 0);
        run([';']);
        assert.equal(state.statusMsg, 'no previous find');
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
        run([',']);
        assert.equal(state.buffer[0], 'abc');
    });
});

});
