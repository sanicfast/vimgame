// Broad behavioral coverage: undo/redo DEPTH (multiple steps, redo-cleared-on-new-
// mutation, out-of-range safety), repeated `p`/`P` (charwise + linewise + counts),
// and an all-empty-buffer "nothing crashes / invariants hold" pass.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, COLS, handleNormalKey, handleInsertKey, handleTextObjectKey, undo, redo } = require('../script.js');

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

describe('undo / redo depth', () => {
    test('each mutation is a separate undo step, restored in reverse', () => {
        setup(['aaa'], 0, 0);
        run(['x', 'x', 'x']); // three single-undo deletes
        assert.equal(state.buffer[0], '');
        assert.equal(state.undoStack.length, 3);
        assert.equal(state.redoStack.length, 0);
        undo(); assert.equal(state.buffer[0], 'a');
        undo(); assert.equal(state.buffer[0], 'aa');
        undo(); assert.equal(state.buffer[0], 'aaa');
    });
    test('undo then redo steps forward again symmetrically', () => {
        setup(['aaa'], 0, 0);
        run(['x', 'x', 'x']);
        undo(); undo();               // -> "aa"
        assert.equal(state.buffer[0], 'aa');
        redo();                        // -> "a"
        assert.equal(state.buffer[0], 'a');
        redo();                        // -> ""
        assert.equal(state.buffer[0], '');
    });
    test('a new mutation clears the redo stack', () => {
        setup(['aaa', 'bbb'], 0, 0);
        run(['x']);                    // delete a char (pushes undo)
        undo();
        assert.equal(state.redoStack.length, 1);
        run(['d', 'd']);               // new mutation should discard redo
        assert.equal(state.redoStack.length, 0);
    });
    test('u honors a count prefix (3u undoes three)', () => {
        setup(['aaa'], 0, 0);
        run(['x', 'x', 'x']);
        assert.equal(state.buffer[0], '');
        run(['3', 'u']);
        assert.equal(state.buffer[0], 'aaa');
    });
    test('undo at the bottom and redo at the top are safe no-ops', () => {
        setup(['a'], 0, 0);
        undo(); undo();
        assert.equal(state.buffer[0], 'a');
        assert.match(state.statusMsg, /nothing to undo/);
        redo(); redo();
        assert.match(state.statusMsg, /nothing to redo/);
    });
});

describe('repeated paste', () => {
    test('charwise p inserts a copy and advances the cursor; repeated p adds more', () => {
        setup(['foo bar'], 0, 0);
        run(['y', 'i', 'w']); // yank "foo" charwise
        assert.equal(state.register.text, 'foo');
        assert.equal(state.register.linewise, false);
        run(['p']);
        assert.equal(state.buffer[0], 'ffoooo bar');
        assert.deepEqual(state.cursor, { row: 0, col: 3 });
        run(['p']);
        assert.equal(state.buffer[0], 'ffoofoooo bar'); // a further copy inserted
    });
    test('a count on p (2p) equals pressing p twice', () => {
        setup(['foo bar'], 0, 0);
        run(['y', 'i', 'w', '2', 'p']);
        const withCount = state.buffer[0];
        setup(['foo bar'], 0, 0);
        run(['y', 'i', 'w', 'p', 'p']);
        assert.equal(withCount, state.buffer[0]);
    });
    test('linewise p inserts whole lines below, repeatedly', () => {
        setup(['aa', 'bb'], 0, 0);
        run(['y', 'y', 'p', 'p']); // yank "aa", paste below twice
        assert.deepEqual(state.buffer.slice(0, 4), ['aa', 'aa', 'aa', 'bb']);
    });
    test('linewise P inserts whole lines above', () => {
        setup(['aa', 'bb'], 1, 0);
        run(['y', 'y', 'P']); // yank "bb", paste above row 1
        assert.deepEqual(state.buffer.slice(0, 3), ['aa', 'bb', 'bb']);
    });
    test('p records a paste lastChange for dot-repeat', () => {
        setup(['foo bar'], 0, 0);
        run(['y', 'i', 'w', 'p']);
        assert.deepEqual(state.lastChange, { kind: 'paste', before: false });
    });
});

describe('empty buffer robustness', () => {
    test('a long mix of commands on an all-empty buffer never crashes', () => {
        setup(['', '', ''], ROWS - 1, 0);
        const cmds = ['d', 'w', 'd', 'd', 'd', 'e', 'd', '$', 'x', '2', 'x', 'c', 'w', 'Escape',
            'o', 'x', 'Escape', 'u', 'u', 'y', 'y', 'p', 'P', '.', 'i', 'E', 'Enter', 'Escape',
            'g', 'g', 'G', '0', 'i', 'a', 'w', 'p', 'v', 'q', '/'];
        assert.doesNotThrow(() => run(cmds));
        // The fixed-grid invariants must hold throughout.
        assert.equal(state.buffer.length, ROWS);
        for (const line of state.buffer) assert.ok(line.length <= COLS);
    });
});
