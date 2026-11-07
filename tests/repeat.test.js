// Dot-repeat (`.`) tests. We drive REAL key sequences through the key
// handlers so we exercise how each command records `lastChange` AND how
// `.` replays it. Needs the DOM stub (insert-mode/change paths call setMode).

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
const rows = () => state.buffer.slice(0, 6);
// Run a command then `.` N times; return the line buffer after.
function cmdThenDots(lines, start, command, dots = ['.']) {
    setup(lines, start[0], start[1]);
    run(command);
    const afterCmd = state.buffer.slice(0, 6);
    run(dots);
    return { afterCmd, afterDots: state.buffer.slice(0, 6) };
}

describe('dot-repeat — operator motions', () => {
    test('dw then . repeats the delete-word at the new position', () => {
        const r = cmdThenDots(['foo bar baz'], [0, 0], ['d', 'w']);
        assert.equal(r.afterCmd[0], 'bar baz');
        assert.equal(r.afterDots[0], 'baz');
    });
    test('dgE then . repeats backward WORD-end delete', () => {
        const r = cmdThenDots(['foo, bar; baz'], [0, 12], ['d', 'g', 'E']);
        assert.equal(r.afterCmd[0], 'foo, barz');
        assert.equal(r.afterDots[0], 'fooz');
    });
    test('dd then . deletes the next line', () => {
        const r = cmdThenDots(['a', 'b', 'c', 'd'], [1, 0], ['d', 'd']);
        assert.deepEqual(r.afterCmd, ['a', 'c', 'd', '', '', '']);
        assert.deepEqual(r.afterDots, ['a', 'd', '', '', '', '']);
    });
});

describe('dot-repeat — simple mutations', () => {
    test('x then . deletes successive chars', () => {
        const r = cmdThenDots(['abcd'], [0, 0], ['x']);
        assert.equal(r.afterCmd[0], 'bcd');
        assert.equal(r.afterDots[0], 'cd');
    });
    test('paste then . pastes again (charwise register)', () => {
        const r = cmdThenDots(['hello'], [0, 0], ['y', '$', 'p']);
        assert.equal(r.afterCmd[0], 'hhelloello');
        assert.equal(r.afterDots[0], 'hhellohelloello');
    });
});

describe('dot-repeat — count handling', () => {
    test('d2w records count and . repeats the same count', () => {
        const r = cmdThenDots(['a b c d e f'], [0, 0], ['d', '2', 'w']);
        assert.equal(r.afterCmd[0], 'c d e f');
        assert.equal(r.afterDots[0], 'e f');
        assert.equal(state.lastChange.count, 2);
    });
    test('2dw (count before operator) equals d2w', () => {
        setup(['a b c d e f'], 0, 0);
        run(['2', 'd', 'w']);
        assert.equal(state.buffer[0], 'c d e f');
        assert.equal(state.lastChange.count, 2);
    });
    test('2dd deletes two lines and records count', () => {
        setup(['1', '2', '3', '4', '5', '6'], 0, 0);
        run(['2', 'd', 'd']);
        assert.deepEqual(rows(), ['3', '4', '5', '6', '', '']);
        assert.equal(state.lastChange.count, 2);
    });
    test('3. repeats the last change three times', () => {
        const r = cmdThenDots(['a b c d e f g h'], [0, 0], ['d', 'w'], ['3', '.']);
        assert.equal(r.afterCmd[0], 'b c d e f g h');
        assert.equal(r.afterDots[0], 'e f g h');
    });
    test('Escape clears a pending count (3<Esc>dw deletes one word)', () => {
        setup(['a b c d e f'], 0, 0);
        run(['3', 'Escape', 'd', 'w']);
        assert.equal(state.buffer[0], 'b c d e f');
        assert.equal(state.lastChange.count, 1);
    });
});

describe('dot-repeat — insert-mode entries', () => {
    test('i + text then . re-inserts the typed text', () => {
        const r = cmdThenDots(['foo'], [0, 0], ['i', 'X', 'Escape']);
        assert.equal(r.afterCmd[0], 'Xfoo');
        assert.equal(r.afterDots[0], 'XXfoo');
    });
    test('I + text then . re-inserts at first non-blank', () => {
        const r = cmdThenDots(['   foo'], [0, 0], ['I', '>', 'Escape']);
        assert.equal(r.afterCmd[0], '   >foo');
        assert.equal(r.afterDots[0], '   >>foo');
    });
    test('A + text then . re-appends at end of line', () => {
        const r = cmdThenDots(['foo'], [0, 0], ['A', '!', 'Escape']);
        assert.equal(r.afterCmd[0], 'foo!');
        assert.equal(r.afterDots[0], 'foo!!');
    });
    test('o + text then . opens another line with the same text', () => {
        const r = cmdThenDots(['line1'], [0, 0], ['o', 'N', 'Escape']);
        assert.deepEqual(r.afterCmd, ['line1', 'N', '', '', '', '']);
        assert.deepEqual(r.afterDots, ['line1', 'N', 'N', '', '', '']);
    });
    test('ciw + replacement then w. changes the next inner word too', () => {
        // After leaving insert, Esc places the cursor on the last typed char.
        // So a bare `.` re-applies ciw on that word (no-op), while `w.` moves to
        // the next word and changes it — the expected vim behavior.
        const r = cmdThenDots(['foo bar baz'], [0, 0], ['c', 'i', 'w', 'Z', 'Escape'], ['w', '.']);
        assert.equal(r.afterCmd[0], 'Z bar baz');
        assert.equal(r.afterDots[0], 'Z Z baz');
    });
});

describe('dot-repeat — lastChange shape contract', () => {
    const shape = (lines, start, command) => {
        setup(lines, start[0], start[1]);
        run(command);
        return state.lastChange;
    };
    test('operator+motion', () => {
        assert.deepEqual(shape(['a b c'], [0, 0], ['d', 'w']),
            { kind: 'op-motion', op: 'd', motion: 'w', count: 1 });
    });
    test('operator linewise', () => {
        assert.deepEqual(shape(['a', 'b'], [0, 0], ['d', 'd']),
            { kind: 'op-linewise', op: 'd', count: 1 });
    });
    test('x', () => {
        assert.deepEqual(shape(['ab'], [0, 0], ['x']), { kind: 'x', count: 1 });
        assert.deepEqual(shape(['abcd'], [0, 0], ['3', 'x']), { kind: 'x', count: 3 });
    });
    test('paste', () => {
        assert.deepEqual(shape(['hello'], [0, 0], ['y', '$', 'p']),
            { kind: 'paste', before: false });
    });
    test('insert (i / I / A directions)', () => {
        assert.deepEqual(shape(['foo'], [0, 0], ['i', 'X', 'Escape']),
            { kind: 'insert', direction: 'before', typed: 'X' });
        assert.deepEqual(shape(['  foo'], [0, 0], ['I', '>', 'Escape']),
            { kind: 'insert', direction: 'I', typed: '>' });
        assert.deepEqual(shape(['foo'], [0, 0], ['A', '!', 'Escape']),
            { kind: 'insert', direction: 'A', typed: '!' });
    });
    test('open (o)', () => {
        assert.deepEqual(shape(['line1'], [0, 0], ['o', 'N', 'Escape']),
            { kind: 'open', direction: 'below', typed: 'N' });
    });
    test('text object (ciw)', () => {
        assert.deepEqual(shape(['foo bar'], [0, 0], ['c', 'i', 'w', 'Z', 'Escape']),
            { kind: 'op-text-object', op: 'c', prefix: 'i', obj: 'w', typed: 'Z' });
    });
});