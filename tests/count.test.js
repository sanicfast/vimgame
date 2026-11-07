// Key-driven tests for numeric counts on line motions: 5G / 2gg jump to an
// absolute line, dG/yG honor counts as linewise operators, counts on ge/gE
// repeat, and a pending 'g' is cancelled by an unrelated key.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleNormalKey } = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.pendingG = false; state.inputBuffer = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row, col };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
const run = (toks) => { for (const k of toks) handleNormalKey({ key: k }); };

const SEVEN = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];

describe('G / gg honor a count', () => {
    test('5G jumps to line 5', () => {
        setup(SEVEN, 0, 0); run(['5', 'G']);
        assert.deepEqual(state.cursor, { row: 4, col: 0 });
    });
    test('2G jumps to line 2', () => {
        setup(SEVEN, 0, 0); run(['2', 'G']);
        assert.deepEqual(state.cursor, { row: 1, col: 0 });
    });
    test('G with no count still goes to the last non-empty line', () => {
        setup(SEVEN, 2, 0); run(['G']);
        assert.deepEqual(state.cursor, { row: 6, col: 0 });
    });
    test('a count beyond the buffer clamps to the last row', () => {
        setup(SEVEN, 0, 0); run(['9', '9', 'G']);
        assert.equal(state.cursor.row, ROWS - 1);
    });
    test('5gg jumps to line 5 (same as 5G)', () => {
        setup(SEVEN, 6, 0); run(['5', 'g', 'g']);
        assert.deepEqual(state.cursor, { row: 4, col: 0 });
    });
    test('count + G lands on the first non-blank of the target line', () => {
        setup(['   indented', 'x'], 0, 0); run(['2', 'G']);
        assert.deepEqual(state.cursor, { row: 1, col: 0 }); // line "x" starts at col 0
    });
});

describe('operator + count + G (linewise)', () => {
    test('d2G deletes from the cursor down/up to line 2', () => {
        setup(['a', 'b', 'c', 'd', 'e'], 4, 0); run(['d', '2', 'G']);
        assert.deepEqual(state.buffer.slice(0, 5), ['a', '', '', '', '']);
    });
    test('y2G yanks the spanning lines into a linewise register', () => {
        setup(['a', 'b', 'c', 'd'], 3, 0); run(['y', '2', 'G']);
        assert.equal(state.register.linewise, true);
        assert.ok(Array.isArray(state.register.text));
        assert.equal(state.register.text.length, 3); // lines 1..3
    });
});

describe('ge/gE count & pending-g cancel', () => {
    test('2ge moves back over two word-ends', () => {
        setup(['one two three'], 0, 12); run(['2', 'g', 'e']);
        assert.deepEqual(state.cursor, { row: 0, col: 2 }); // end of "one"
    });
    test('an unrelated key cancels a pending g (g v G == G)', () => {
        setup(SEVEN, 0, 0); run(['g', 'v', 'G']);
        assert.deepEqual(state.cursor, { row: 6, col: 0 }); // last non-empty, not line 6
    });
});
