// Fixed-height grid invariant (buffer is always exactly ROWS rows) and the
// `x` count behavior. Both were latent bugs found by probing: `o`/`Enter` at the
// bottom row grew the buffer past ROWS (an invisible 21st row), and `x` ignored
// its count while leaking the count prefix into the next command.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleNormalKey, handleInsertKey } = require('../script.js');

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
const rowsOk = () => state.buffer.length === ROWS;

describe('fixed-height grid — always exactly ROWS rows', () => {
    test('o at the bottom row is refused (no-op, stays normal, no 21st row)', () => {
        const lines = new Array(ROWS).fill('');
        lines[ROWS - 1] = 'tail';
        setup(lines, ROWS - 1, 0);
        run(['o']);
        assert.ok(rowsOk(), `buffer length ${state.buffer.length} != ${ROWS}`);
        assert.equal(state.mode, 'normal');
        assert.equal(state.buffer[ROWS - 1], 'tail');
    });
    test('o at a non-bottom row still opens a line below', () => {
        setup(['top'], 0, 0);
        run(['o']);
        assert.ok(rowsOk());
        assert.equal(state.mode, 'insert');
        assert.deepEqual(state.buffer.slice(0, 2), ['top', '']);
        assert.deepEqual(state.cursor, { row: 1, col: 0 });
    });
    test('Enter at the bottom row is refused (line unchanged)', () => {
        const lines = new Array(ROWS).fill('');
        lines[ROWS - 1] = 'tail';
        setup(lines, ROWS - 1, 0);
        run(['i', 'Enter', 'Escape']);
        assert.ok(rowsOk());
        assert.equal(state.buffer[ROWS - 1], 'tail');
    });
    test('Enter mid-buffer still splits the line', () => {
        setup(['abcd'], 0, 2);
        run(['i', 'Enter', 'Escape']);
        assert.ok(rowsOk());
        assert.deepEqual(state.buffer.slice(0, 2), ['ab', 'cd']);
    });
    test('O at the bottom row keeps the row count', () => {
        setup(['a', 'b'], ROWS - 1, 0);
        run(['O', 'Escape']);
        assert.ok(rowsOk());
    });
    test('dd / 2dd at the bottom row keeps the row count', () => {
        setup(['a', 'b', 'c'], ROWS - 1, 0);
        run(['d', 'd']);
        assert.ok(rowsOk());
        setup(['a', 'b', 'c'], ROWS - 1, 0);
        run(['2', 'd', 'd']);
        assert.ok(rowsOk());
    });
    test('linewise paste (p / P) at the bottom row keeps the row count', () => {
        setup(['x'], ROWS - 1, 0);
        run(['y', 'y', 'p']);
        assert.ok(rowsOk());
        run(['P']);
        assert.ok(rowsOk());
    });
});

describe('x honors its count', () => {
    test('2x deletes two characters', () => {
        setup(['abcdef'], 0, 0);
        run(['2', 'x']);
        assert.equal(state.buffer[0], 'cdef');
    });
    test('the register holds the last deleted character', () => {
        setup(['abcdef'], 0, 0);
        run(['2', 'x']);
        assert.equal(state.register.text, 'b');
        assert.equal(state.register.linewise, false);
    });
    test('the count prefix is consumed (does not leak into the next command)', () => {
        setup(['abcdef'], 0, 0);
        run(['2', 'x']);
        assert.equal(state.inputBuffer, '');
    });
    test('a count larger than the line deletes to end-of-line (no crash)', () => {
        setup(['abc'], 0, 1);
        run(['9', 'x']);
        assert.equal(state.buffer[0], 'a');
        assert.ok(state.cursor.col <= state.buffer[0].length);
    });
    test('x on an empty line is a safe no-op and still clears the count', () => {
        setup(['', 'abc'], 0, 0);
        run(['2', 'x']);
        assert.equal(state.buffer[0], '');
        assert.equal(state.inputBuffer, '');
    });
    test('one x is one undo step regardless of count', () => {
        setup(['abcdef'], 0, 0);
        run(['3', 'x']);
        assert.equal(state.undoStack.length, 1);
    });
    test('. repeats the counted delete', () => {
        setup(['abcdef'], 0, 0);
        run(['2', 'x']);      // -> "cdef"
        run(['.']);           // repeats 2x -> "ef"
        assert.equal(state.buffer[0], 'ef');
    });
});
