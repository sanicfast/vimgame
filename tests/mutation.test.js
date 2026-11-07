// Tests for the buffer-mutation layer (delete / change / yank / paste +
// undo/redo). These paths call setMode()/render(), which touch `document`, so
// we install a minimal DOM stub before requiring the module. `node --test`
// runs each test file in its own process, so this stub stays scoped to here.

function makeEl() {
    return {
        className: '', textContent: '', innerHTML: '', tabIndex: 0,
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {},
    };
}
global.document = {
    getElementById() { return makeEl(); },
    createElement() { return makeEl(); },
    addEventListener() {},
    body: makeEl(),
};

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { state, ROWS, executeMovement, applyPaste, undo, redo } = require('../script.js');

function setup(lines) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal';
    state.pendingOperator = null;
    state.inputBuffer = '';
    state.register = { text: null, linewise: false };
    state.undoStack = [];
    state.redoStack = [];
    state.cursor = { row: 0, col: 0 };
    state.lastChange = null;
    state.statusMsg = '';
}

// Drive `op<motion>` from (row,col): d/e/c/y + a motion, end to end.
function op(lines, row, col, motion, operator) {
    setup(lines);
    state.mode = 'operator-pending';
    state.pendingOperator = operator;
    state.cursor = { row, col };
    executeMovement(motion);
}
// First few buffer rows as an array (the grid beyond them is '').
const rows = () => state.buffer.slice(0, 5);

describe('delete (charwise)', () => {
    test('dw deletes word + trailing space', () => {
        op(['foo bar'], 0, 0, 'w', 'd');
        assert.equal(state.buffer[0], 'bar');
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('de deletes the word only (keeps trailing space)', () => {
        op(['foo bar'], 0, 0, 'e', 'd');
        assert.equal(state.buffer[0], ' bar');
    });
    test('dl deletes exactly one character', () => {
        op(['abc'], 0, 0, 'l', 'd');
        assert.equal(state.buffer[0], 'bc');
    });
    test('d$ deletes to end of line', () => {
        op(['foo bar'], 0, 3, '$', 'd');
        assert.equal(state.buffer[0], 'foo');
        assert.deepEqual(state.cursor, { row: 0, col: 2 });
    });
    test('d0 deletes to start of line', () => {
        op(['foo bar'], 0, 4, '0', 'd');
        assert.equal(state.buffer[0], 'bar');
    });
});

describe('delete (cross-line charwise) — line joining', () => {
    test('dw whose next word starts the next line JOINS the lines (vim)', () => {
        op(['ab', 'cd'], 0, 1, 'w', 'd');
        assert.equal(state.buffer[0], 'acd');
        assert.equal(state.buffer[1], '');
    });
    test('de within a line does not join', () => {
        op(['foo', 'bar'], 0, 0, 'e', 'd');
        assert.equal(state.buffer[0], '');
        assert.equal(state.buffer[1], 'bar');
    });
});

describe('delete (linewise)', () => {
    test('dj deletes current + next line', () => {
        op(['a', 'b', 'c'], 0, 0, 'j', 'd');
        assert.deepEqual(rows(), ['c', '', '', '', '']);
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('dk deletes current + previous line', () => {
        op(['a', 'b', 'c'], 1, 0, 'k', 'd');
        assert.deepEqual(rows(), ['c', '', '', '', '']);
    });
    test('dG deletes from cursor to last line', () => {
        op(['a', 'b', 'c'], 0, 0, 'G', 'd');
        assert.deepEqual(rows(), ['', '', '', '', '']);
    });
    test('dgg deletes from top to cursor line', () => {
        op(['a', 'b', 'c'], 2, 0, 'gg', 'd');
        assert.deepEqual(rows(), ['', '', '', '', '']);

describe('yank + paste', () => {
    test('yank records charwise text and does not mutate buffer/cursor', () => {
        op(['hello world'], 0, 0, 'e', 'y');
        assert.deepEqual(state.register, { text: 'hello', linewise: false });
        assert.equal(state.buffer[0], 'hello world');
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('p pastes after cursor and lands on last pasted char', () => {
        setup(['HELLO']);
        state.cursor = { row: 0, col: 0 };
        state.register = { text: 'hi', linewise: false };
        applyPaste(1, false);
        assert.equal(state.buffer[0], 'HhiELLO');
        assert.deepEqual(state.cursor, { row: 0, col: 2 });
    });
    test('P pastes before cursor', () => {
        setup(['HELLO']);
        state.cursor = { row: 0, col: 4 };
        state.register = { text: 'hi', linewise: false };
        applyPaste(1, true);
        assert.equal(state.buffer[0], 'HELLhiO');
        assert.deepEqual(state.cursor, { row: 0, col: 5 });
    });
    test('count repeats the paste', () => {
        setup(['x']);
        state.cursor = { row: 0, col: 0 };
        state.register = { text: '-', linewise: false };
        applyPaste(3, false);
        assert.equal(state.buffer[0], 'x---');
    });
    test('linewise p inserts a line BELOW the cursor', () => {
        setup(['a', 'b', 'c']);
        state.cursor = { row: 1, col: 0 };
        state.register = { text: ['b'], linewise: true };
        applyPaste(1, false);
        assert.deepEqual(rows(), ['a', 'b', 'b', 'c', '']);
        assert.deepEqual(state.cursor, { row: 2, col: 0 });
    });
    test('linewise P inserts a line ABOVE the cursor', () => {
        setup(['a', 'b', 'c']);
        state.cursor = { row: 1, col: 0 };
        state.register = { text: ['b'], linewise: true };
        applyPaste(1, true);
        assert.deepEqual(rows(), ['a', 'b', 'b', 'c', '']);
        assert.deepEqual(state.cursor, { row: 1, col: 0 });
    });
    test('paste with empty register is a no-op (sets status)', () => {
        setup(['a']);
        state.register = { text: null, linewise: false };
        applyPaste(1, false);
        assert.equal(state.buffer[0], 'a');
        assert.equal(state.statusMsg, 'register is empty');
    });
});

describe('change', () => {
    test('ce deletes the range and enters insert mode at the start', () => {
        op(['foo bar'], 0, 0, 'e', 'c');
        assert.equal(state.buffer[0], ' bar');
        assert.equal(state.mode, 'insert');
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('change across two lines replaces them with one blank line', () => {
        op(['a', 'b', 'c'], 0, 0, 'j', 'c');
        assert.equal(state.buffer[0], '');
        assert.equal(state.buffer[1], 'c');
        assert.equal(state.mode, 'insert');
    });
});

describe('undo / redo of mutations', () => {
    test('undo restores buffer + cursor; redo re-applies', () => {
        op(['foo bar'], 0, 0, 'w', 'd');
        assert.equal(state.buffer[0], 'bar');
        undo();
        assert.equal(state.buffer[0], 'foo bar');
        assert.deepEqual(state.cursor, { row: 0, col: 4 });
        redo();
        assert.equal(state.buffer[0], 'bar');
    });
    test('undo of a linewise delete restores all lines', () => {
        op(['a', 'b', 'c'], 0, 0, 'j', 'd');
        assert.deepEqual(rows(), ['c', '', '', '', '']);
        undo();
        assert.deepEqual(rows(), ['a', 'b', 'c', '', '']);
    });
});

    });
});