// Tests for the Del key: forward-delete in insert mode, EOL line-join, the
// normal-mode Del->x alias, and dot-repeat of an insert session that used Del.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleNormalKey, handleInsertKey, handleTextObjectKey } = require('../script.js');

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
    else if (state.mode === 'pending-text-object') handleTextObjectKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };

describe('insert mode — Del (forward delete)', () => {
    test('deletes the char at the caret without moving the caret', () => {
        setup(['abcd'], 0, 1); // cursor on 'b'
        run(['i', 'Delete']);
        assert.equal(state.buffer[0], 'acd');
        assert.equal(state.cursor.col, 1); // caret stayed put
    });
    test('at end-of-line joins the next line up', () => {
        setup(['ab', 'cd'], 0, 2); // caret one past 'b' (valid in insert)
        run(['i', 'Delete']);
        assert.equal(state.buffer[0], 'abcd');
        assert.equal(state.buffer[1], '');
    });
    test('at end of the last content line (nothing to join) is a no-op', () => {
        setup(['ab', ''], 0, 2);
        run(['i', 'Delete']);
        assert.equal(state.buffer[0], 'ab'); // unchanged
    });
    test('on an empty line is a safe no-op', () => {
        setup([''], 0, 0);
        run(['i', 'Delete']);
        assert.equal(state.buffer[0], '');
    });
});

describe('normal mode — Del acts as x', () => {
    test('deletes the char under the cursor and fills the register', () => {
        setup(['hello'], 0, 0);
        run(['Delete']);
        assert.equal(state.buffer[0], 'ello');
        assert.equal(state.register.text, 'h');
        assert.equal(state.register.linewise, false);
    });
    test('honors a count prefix like x', () => {
        setup(['hello'], 0, 0);
        run(['2', 'Delete']);
        assert.equal(state.buffer[0], 'llo');
    });
});

describe('Del dot-repeat', () => {
    test('. reproduces an insert session that used an in-line forward delete', () => {
        // On each 'foo': type 'l' then Del (removes the leading 'f') → 'loo'
        setup(['foo', 'foo'], 0, 0);
        run(['i', 'l', 'Delete', 'Escape']);
        assert.equal(state.buffer[0], 'loo');
        run(['j']);
        run(['.']);
        assert.equal(state.buffer[1], 'loo');
    });
});
