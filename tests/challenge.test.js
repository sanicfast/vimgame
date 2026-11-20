// Tests for the challenge/target-buffer system: initChallenge, computeDiff,
// buffersMatch, and integration with the editing engine.
// Challenge references are by NAME (not index) so the suite survives reordering.

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
    state, ROWS, COLS, CHALLENGES, initChallenge, computeDiff, buffersMatch,
    setMode, handleNormalKey, handleInsertKey, handleTextObjectKey,
} = require('../script.js');

// Resolve a challenge index by its name.
const idx = (name) => {
    const i = CHALLENGES.findIndex((c) => c.name === name);
    assert.notEqual(i, -1, `challenge not found: ${name}`);
    return i;
};

function press(ch) {
    if (state.mode === 'insert') handleInsertKey({ key: ch });
    else if (state.mode === 'pending-text-object') handleTextObjectKey({ key: ch });
    else handleNormalKey({ key: ch });
}
const run = (toks) => { for (const t of toks) press(t); };

describe('initChallenge', () => {
    test('loads start buffer and target buffer from challenge data', () => {
        const i = idx('Rename & Refactor');
        initChallenge(i);
        assert.equal(state.buffer.length, ROWS);
        assert.equal(state.targetBuffer.length, ROWS);
        assert.equal(state.buffer[0], 'function fibonacci(n) {');
        assert.equal(state.targetBuffer[0], 'function fib(n) {');
        assert.equal(state.currentChallenge, i);
    });
    test('resets cursor, undo/redo stacks, register, and lastChange', () => {
        state.undoStack = [{ buffer: [], cursor: { row: 5, col: 5 } }];
        state.redoStack = [{ buffer: [], cursor: { row: 3, col: 3 } }];
        state.register = { text: 'junk', linewise: true };
        state.lastChange = { kind: 'x', count: 2 };
        initChallenge(idx('Close the Calls'));
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
        assert.equal(state.undoStack.length, 0);
        assert.equal(state.redoStack.length, 0);
        assert.equal(state.register.text, null);
        assert.equal(state.lastChange, null);
    });
    test('sets status message to the hint text', () => {
        initChallenge(idx('Rename & Refactor'));
        assert.ok(state.statusMsg.includes('ciw'));
    });
    test('falls back to challenge 0 for out-of-range index', () => {
        initChallenge(999);
        assert.equal(state.buffer[0], CHALLENGES[0].start[0]);
    });
    test('Fix the Bugs loads with the expected buggy/target lines', () => {
        const i = idx('Fix the Bugs');
        initChallenge(i);
        assert.equal(state.buffer[1], '  if (n <= 0) return n;');
        assert.equal(state.targetBuffer[1], '  if (n <= 1) return n;');
    });
});

describe('computeDiff', () => {
    test('identical buffers yield 0 diff cells', () => {
        initChallenge(idx('Rename & Refactor'));
        state.buffer = [...state.targetBuffer];
        const diff = computeDiff();
        assert.equal(diff.totalCells - diff.matchCount, 0);
    });
    test('per-character granularity on mismatched lines', () => {
        state.buffer = []; state.targetBuffer = [];
        for (let i = 0; i < ROWS; i++) { state.buffer[i] = ''; state.targetBuffer[i] = ''; }
        state.buffer[0] = 'abc';
        state.targetBuffer[0] = 'axc';
        const diff = computeDiff();
        assert.equal(diff.grid[0][0], 'match');
        assert.equal(diff.grid[0][1], 'diff');
        assert.equal(diff.grid[0][2], 'match');
        assert.equal(diff.matchCount, 2);
        assert.equal(diff.totalCells, 3);
    });
    test('extra chars in active buffer count as diff', () => {
        state.buffer = []; state.targetBuffer = [];
        for (let i = 0; i < ROWS; i++) { state.buffer[i] = ''; state.targetBuffer[i] = ''; }
        state.buffer[0] = 'abcd';
        state.targetBuffer[0] = 'abc';
        const diff = computeDiff();
        assert.equal(diff.matchCount, 3);
        assert.equal(diff.totalCells, 4);
        assert.equal(diff.grid[0][3], 'diff');
    });
    test('empty cells beyond both lines are not counted', () => {
        state.buffer = []; state.targetBuffer = [];
        for (let i = 0; i < ROWS; i++) { state.buffer[i] = ''; state.targetBuffer[i] = ''; }
        const diff = computeDiff();
        assert.equal(diff.totalCells, 0);
    });
});

describe('buffersMatch', () => {
    test('returns true when buffers are identical', () => {
        initChallenge(idx('Rename & Refactor'));
        state.buffer = [...state.targetBuffer];
        assert.ok(buffersMatch());
    });
    test('returns false when any line differs', () => {
        initChallenge(idx('Rename & Refactor'));
        state.buffer = [...state.targetBuffer];
        state.buffer[5] = 'different';
        assert.ok(!buffersMatch());
    });
    test('start does not match target', () => {
        initChallenge(idx('Rename & Refactor'));
        assert.ok(!buffersMatch());
    });
});

describe('challenge integration — solving via vim commands', () => {
    test('Rename & Refactor is solvable: ciw on fibonacci to fib on line 0', () => {
        initChallenge(idx('Rename & Refactor'));
        setMode('normal');
        run(['w']);
        run(['c', 'i', 'w']);
        assert.equal(state.mode, 'insert');
        for (const ch of 'fib') press(ch);
        run(['Escape']);
        assert.equal(state.buffer[0], 'function fib(n) {');
    });
});

describe('all challenges — shape', () => {
    test('every challenge is well-formed and is an actual puzzle', () => {
        assert.ok(CHALLENGES.length >= 19, 'expected at least 19 challenges');
        CHALLENGES.forEach((ch, i) => {
            assert.ok(typeof ch.name === 'string' && ch.name.length, `challenge ${i} name`);
            assert.ok(typeof ch.hint === 'string' && ch.hint.length, `challenge ${i} hint`);
            assert.ok(Array.isArray(ch.start) && Array.isArray(ch.target), `challenge ${i} arrays`);
            assert.ok(ch.start.length <= ROWS && ch.target.length <= ROWS, `challenge ${i} fits grid`);
            ch.start.concat(ch.target).forEach((ln) => assert.ok(ln.length <= COLS, `challenge ${i} line width`));
            assert.notDeepEqual(ch.start, ch.target, `challenge ${i} start must differ from target`);
        });
    });
    test('names are unique', () => {
        const seen = new Set();
        CHALLENGES.forEach((ch) => {
            assert.ok(!seen.has(ch.name), `duplicate name: ${ch.name}`);
            seen.add(ch.name);
        });
    });
});

describe('all challenges — solvable via canonical solutions', () => {
    // One known-good keystroke sequence per challenge, keyed by NAME so it is
    // robust to reordering. Proves each puzzle is completable; guards regressions.
    const solutions = {
        'Open a New Line': ['o', 'b', 'e', 't', 'a', 'Escape'],
        'Close the Calls': ['A', '"', ')', 'Escape', 'j', '.'],
        'Add Semicolons': ['$', 'A', ';', 'Escape', 'j', '.', 'j', '.'],
        'Make It a List': ['I', '-', ' ', 'Escape', 'j', '.', 'j', '.'],
        'Duplicate the Line': ['y', 'y', 'p'],
        'Swap Two Characters': ['l', 'x', 'p', 'j', 'h', 'x', 'p'],
        'Fix the Typo': ['f', ':', 'r', ';', 'j', '.'],
        'Rewrite the Lines': ['c', 'c', '/', '/', ' ', 'd', 'o', 'n', 'e', 'Escape', 'j', '.'],
        'Reword the Comment': ['c', 'c', '#', ' ', 'c', 'a', 'l', 'c', 'u', 'l', 'a', 't', 'e', ' ', 't', 'o', 't', 'a', 'l', 'Escape', 'j', 'c', 'c', '#', ' ', 'a', 's', 's', 'e', 'm', 'b', 'l', 'e', ' ', 'i', 'n', 'p', 'u', 't', 'Escape'],
        'Delete Two Words': ['2', 'd', 'w', 'j', '.'],
        'Remove the Dots': ['f', '.', 'x', ';', 'x', ';', 'x', 'j', '0', 'f', '.', 'x', ';', 'x', ';', 'x'],
        'Swap Two Lines': ['d', 'd', 'p'],
        'Delete the Dead Code': ['j', '2', 'd', 'd', 'j', 'd', 'd'],
        'Set Every Value': ['c', 'i', '(', '4', '2', 'Escape', 'j', '.', 'j', '.', 'j', '.'],
        'Fill the Quotes': ['f', '"', 'l', 'i', 'a', 'l', 'i', 'c', 'e', 'Escape', 'j', '0', 'f', '"', 'l', 'i', 'b', 'o', 'b', 'Escape'],
        'Empty the Containers': ['0', 'f', '[', 'd', 'i', '[', 'j', '0', 'f', '{', 'd', 'i', '{', 'j', '0', 'f', '(', 'd', 'i', '('],
        'Trim the Tail': ['f', '|', 'd', '$', 'j', '0', 'f', '|', 'd', '$', 'j', '0', 'f', '|', 'd', '$'],
    };
    for (const name of Object.keys(solutions)) {
        test(`"${name}" is solvable`, () => {
            initChallenge(idx(name));
            setMode('normal');
            run(solutions[name]);
            assert.ok(buffersMatch(), `"${name}" should match its target`);
        });
    }
});

