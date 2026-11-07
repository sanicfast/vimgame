// Bracket text objects: i( a( i{ a{ i[ a[ (plus the ) } ] b B aliases), used with
// d / c / y and dot-repeat. All single-line. Driven through the real key handlers.

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
    state.inputBuffer = ''; state.register = { text: null, linewise: false };
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
function act(lines, row, col, keys) {
    setup(lines, row, col);
    run(keys);
    return { line: state.buffer[0], cursor: { ...state.cursor },
        register: { ...state.register }, mode: state.mode, status: state.statusMsg };
}

describe('inner bracket block (i) — ci / di / yi', () => {
    test('di( deletes the text between parentheses', () => {
        const r = act(['foo(bar)baz'], 0, 5, ['d', 'i', '(']);
        assert.equal(r.line, 'foo()baz');
        assert.equal(r.register.text, 'bar');
    });
    test('ci( replaces the inner text and lands on the last typed char', () => {
        const r = act(['foo(bar)baz'], 0, 5, ['c', 'i', '(', 'Z', 'Escape']);
        assert.equal(r.line, 'foo(Z)baz');
        assert.deepEqual(r.cursor, { row: 0, col: 4 });
    });
    test('yi( yanks the inner text without mutating the buffer', () => {
        const r = act(['foo(bar)baz'], 0, 5, ['y', 'i', '(']);
        assert.equal(r.line, 'foo(bar)baz');
        assert.equal(r.register.text, 'bar');
        assert.equal(r.mode, 'normal');
    });
    test('i) and ib are aliases for i(', () => {
        assert.equal(act(['foo(bar)baz'], 0, 5, ['d', 'i', ')']).line, 'foo()baz');
        assert.equal(act(['foo(bar)baz'], 0, 5, ['d', 'i', 'b']).line, 'foo()baz');
    });
    test('braces: di{ and ci{ operate on {...}', () => {
        assert.equal(act(['x{abc}y'], 0, 3, ['d', 'i', '{']).line, 'x{}y');
        assert.equal(act(['x{abc}y'], 0, 3, ['c', 'i', '{', 'Q', 'Escape']).line, 'x{Q}y');
    });
    test('square brackets: di] alias and ci[ work', () => {
        assert.equal(act(['arr[i]'], 0, 4, ['d', 'i', ']']).line, 'arr[]');
        assert.equal(act(['arr[i]'], 0, 4, ['c', 'i', '[', 'Q', 'Escape']).line, 'arr[Q]');
    });
    test('empty pair () is a safe no-op', () => {
        assert.equal(act(['()'], 0, 0, ['d', 'i', '(']).line, '()');
    });
});

describe('bracket block — cursor placement & nesting', () => {
    test('cursor on the opening delimiter still selects the inner text', () => {
        assert.equal(act(['foo(bar)baz'], 0, 3, ['d', 'i', '(']).line, 'foo()baz');
    });
    test('cursor on the closing delimiter still selects the inner text', () => {
        // Regression: a left-scan would scan past this pair and pick the wrong one.
        assert.equal(act(['foo(bar)baz'], 0, 7, ['d', 'i', '(']).line, 'foo()baz');
    });
    test('nested parens: selects the innermost enclosing pair', () => {
        const r = act(['(a(bc)d)'], 0, 3, ['d', 'i', '(']); // cursor on "bc"
        assert.equal(r.line, '(a()d)');
        assert.equal(r.register.text, 'bc');
    });
    test('nested parens: cursor between outer open and inner selects the outer block', () => {
        const r = act(['(a(bc)d)'], 0, 1, ['d', 'i', '(']);
        assert.equal(r.line, '()');
        assert.equal(r.register.text, 'a(bc)d');
    });
    test('cursor before any pair selects the next pair on the line (forward search)', () => {
        assert.equal(act(['x (hi) y'], 0, 0, ['d', 'i', '(']).line, 'x () y');
    });
});


describe('a-bracket block (a) — block plus surrounding whitespace', () => {
    test('da( consumes trailing whitespace when present', () => {
        const r = act(['foo(bar) baz'], 0, 4, ['d', 'a', '(']);
        assert.equal(r.line, 'foobaz');
        assert.equal(r.register.text, '(bar) ');
    });
    test('da( falls back to leading whitespace when there is no trailing space', () => {
        assert.equal(act(['foo (bar)'], 0, 5, ['d', 'a', '(']).line, 'foo');
    });
    test('da( with no surrounding whitespace deletes just the block', () => {
        assert.equal(act(['foo(bar)'], 0, 4, ['d', 'a', '(']).line, 'foo');
    });
    test('da{ consumes trailing whitespace', () => {
        assert.equal(act(['x {a} y'], 0, 3, ['d', 'a', '{']).line, 'x y');
    });
});

describe('bracket objects — abort & dot-repeat', () => {
    test('no matching pair on the line aborts with no change', () => {
        const r = act(['foo bar'], 0, 2, ['d', 'i', '(']);
        assert.equal(r.line, 'foo bar');
        assert.match(r.status, /unknown text object/);
    });
    test('dot-repeat re-applies a di( on the next parenthesized group', () => {
        setup(['aaa(bbb)ccc(ddd)eee'], 0, 4);
        run(['d', 'i', '(']);                 // -> "aaa()ccc(ddd)eee"
        state.cursor = { row: 0, col: 10 };    // move inside the (ddd) group
        run(['.']);
        assert.equal(state.buffer[0], 'aaa()ccc()eee');
    });
    test('dot-repeat re-applies a ci( (with the same typed text)', () => {
        setup(['p(q) r(s)'], 0, 2);
        run(['c', 'i', '(', 'X', 'Escape']);   // -> "p(X) r(s)"
        state.cursor = { row: 0, col: 6 };      // inside (s)
        run(['.']);
        assert.equal(state.buffer[0], 'p(X) r(X)');
    });
});
