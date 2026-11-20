// Tests for the match-bracket command `%` (single-line), covering the normal-mode
// jump, the forward-scan-from-non-bracket behavior, operator integration (d%/c%/y%),
// dot-repeat, count-ignoring, and the no-match abort.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    state, ROWS, setMode, handleNormalKey, handleInsertKey, handleTextObjectKey,
    moveToMatchBracket,
} = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.inputBuffer = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row: row || 0, col: col || 0 };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = ''; state.pendingG = false;
}
function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else if (state.mode === 'pending-text-object') handleTextObjectKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };

describe('% normal-mode jump', () => {
    test('opener jumps to its matching closer', () => {
        setup(['foo (bar) baz'], 0, 4); // cursor on '('
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 8 }); // on ')'
    });
    test('closer jumps back to its matching opener', () => {
        setup(['foo (bar) baz'], 0, 8); // cursor on ')'
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 4 }); // on '('
    });
    test('from a non-bracket, scans forward to the first bracket and jumps to its mate', () => {
        // cursor on 'a' inside (bar): forward finds ')' then its mate '('
        setup(['foo (bar) baz'], 0, 6);
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 4 });
    });
    test('nested parens match the outer pair from the outermost opener', () => {
        setup(['((a))'], 0, 0); // outer '('
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 4 }); // outer ')'
    });
    test('nested parens: inner opener matches inner closer', () => {
        setup(['((a))'], 0, 1); // inner '('
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 3 }); // inner ')'
    });
    test('works with braces and square brackets', () => {
        setup(['{x:[y]}'], 0, 3); // cursor on '['
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 5 }); // ']'
        run(['%']); // back
        assert.deepEqual(state.cursor, { row: 0, col: 3 });
    });
    test('ignores a numeric count (does not repeat the jump)', () => {
        setup(['(ab)'], 0, 0);
        run(['3', '%']);
        assert.deepEqual(state.cursor, { row: 0, col: 3 }); // single jump, not 3
    });
    test('no matching bracket leaves cursor and reports it', () => {
        setup(['foo'], 0, 0);
        run(['%']);
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
        assert.equal(state.statusMsg, 'no matching bracket');
    });

describe('% with operators (inclusive span of both brackets)', () => {
    test('d% deletes from opener through closer (forward)', () => {
        setup(['(foo) x'], 0, 0); // cursor on '('
        run(['d', '%']);
        assert.equal(state.buffer[0], ' x');
        assert.equal(state.mode, 'normal');
    });
    test('d% deletes backward when starting on the closer', () => {
        setup(['(foo) x'], 0, 4); // cursor on ')'
        run(['d', '%']);
        assert.equal(state.buffer[0], ' x');
    });
    test('y% yanks the whole bracketed region and restores the cursor', () => {
        setup(['(foo) x'], 0, 0);
        run(['y', '%']);
        assert.equal(state.register.text, '(foo)');
        assert.equal(state.register.linewise, false);
        assert.equal(state.buffer[0], '(foo) x'); // unchanged
        assert.deepEqual(state.cursor, { row: 0, col: 0 }); // back at opener
    });
    test('c% deletes the region and enters insert mode', () => {
        setup(['(foo) x'], 0, 0);
        run(['c', '%']);
        assert.equal(state.mode, 'insert');
        assert.equal(state.buffer[0], ' x');
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
    test('d% on an unbalanced bracket aborts with no change', () => {
        setup(['(abc'], 0, 0);
        run(['d', '%']);
        assert.equal(state.buffer[0], '(abc');
        assert.equal(state.mode, 'normal');
        assert.equal(state.statusMsg, 'no matching bracket');
    });
});

describe('% dot-repeat', () => {
    test('. re-applies d% at the next bracketed group', () => {
        setup(['(ab)', '(cd)'], 0, 0);
        run(['d', '%']);                 // deletes (ab) on line 0
        assert.equal(state.buffer[0], '');
        run(['j']);                      // move to line 1, on '('
        run(['.']);                      // repeat d% → deletes (cd)
        assert.equal(state.buffer[1], '');
    });
    test('. re-applies c% (with the recorded typed text)', () => {
        setup(['(ab)', '(cd)'], 0, 0);
        run(['c', '%']);                 // delete (ab), enter insert
        for (const ch of 'X') press(ch);
        run(['Escape']);
        assert.equal(state.buffer[0], 'X');
        run(['j']);
        run(['.']);
        assert.equal(state.buffer[1], 'X');
    });
});

describe('moveToMatchBracket (pure)', () => {
    test('returns the mate for a balanced opener', () => {
        setup(['(foo)'], 0, 0);
        assert.deepEqual(moveToMatchBracket(state.cursor), { row: 0, col: 4 });
    });
    test('returns null for an unbalanced opener', () => {
        setup(['(foo'], 0, 0);
        assert.equal(moveToMatchBracket(state.cursor), null);
    });
    test('returns null when there is no bracket on the line', () => {
        setup(['no brackets here'], 0, 3);
        assert.equal(moveToMatchBracket(state.cursor), null);
    });
});

});
