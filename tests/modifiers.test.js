// Real key-dispatch tests through handleKeyDown — the browser entry point where a
// bare Shift keydown (typing a capital like the "E" in gE) used to slip into the
// command handlers and wipe a pending `g` prefix / count. Tests go through
// handleKeyDown (not handleNormalKey) so they exercise the exact production path.

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleKeyDown } = require('../script.js');

function setup(lines, row, col) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.inputBuffer = ''; state.register = { text: null, linewise: false };
    state.undoStack = []; state.redoStack = []; state.cursor = { row, col };
    state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
// Build a fake KeyboardEvent (keydown). Shift+E arrives as key:'E' + shiftKey:true,
// and pressing Shift by itself arrives as a separate keydown with key:'Shift'.
const kd = (key, opts = {}) => ({
    key, shiftKey: !!opts.shift, ctrlKey: !!opts.ctrl, metaKey: !!opts.meta,
    altKey: !!opts.alt, preventDefault() {},
});
const send = (...keys) => { for (const k of keys) handleKeyDown(k); };

describe('modifier keydowns must not corrupt command state', () => {
    test('gE works even when Shift is pressed between g and E (real key sequence)', () => {
        setup(['one two three'], 0, 12);
        // Realistic: g, (press Shift) down, then E with shift held.
        send(kd('g'), kd('Shift', { shift: true }), kd('E', { shift: true }));
        // gE = back to end of previous WORD: "one two three" from col 12 -> col 6.
        assert.deepEqual(state.cursor, { row: 0, col: 6 });
    });
    test('a lone Shift keydown does not break a capital motion (gE == E is wrong)', () => {
        // With the bug, "g Shift E" behaved like forward "E" (WORD end), not gE.
        setup(['one two three'], 0, 12);
        send(kd('g'), kd('Shift', { shift: true }), kd('E', { shift: true }));
        assert.notDeepEqual(state.cursor, { row: 0, col: 12 }); // did not act like forward E
    });
    test('a pending count survives a Shift keydown (2 Shift E == 2 E)', () => {
        setup(['one two three four'], 0, 0);
        send(kd('2'), kd('E'));
        const noShift = { ...state.cursor };
        setup(['one two three four'], 0, 0);
        send(kd('2'), kd('Shift', { shift: true }), kd('E', { shift: true }));
        assert.deepEqual(state.cursor, noShift);   // count 2 preserved
        assert.deepEqual(state.cursor, { row: 0, col: 6 }); // 2 WORD-ends -> end of "two"
    });
    test('lone modifier/lock keydowns do nothing to the buffer, mode, or cursor', () => {
        setup(['abc def'], 0, 1);
        send(kd('Shift', { shift: true }), kd('Control', { ctrl: true }), kd('Alt', { alt: true }),
            kd('Meta', { meta: true }), kd('CapsLock'));
        assert.equal(state.buffer[0], 'abc def');
        assert.equal(state.mode, 'normal');
        assert.deepEqual(state.cursor, { row: 0, col: 1 });
    });
    test('Shift during insert inserts no text', () => {
        setup([''], 0, 0);
        send(kd('i'), kd('Shift', { shift: true }), kd('a'), kd('Escape'));
        assert.equal(state.buffer[0], 'a'); // only "a", not "Shift" text
    });
});
