// Unit tests for computeRange — the operator range engine (used by d/c/y).
// It is DOM-free: it only reads state.buffer via prevPos/nextPos and the
// MOTION_INFO table. So we can call it directly. The returned charwise range
// is an INCLUSIVE [start..end] span; linewise ranges carry {linewise:true}.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { state, ROWS, MOTION_INFO, computeRange, prevPos, nextPos } = require('../script.js');

function setup(lines) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal';
    state.cursor = { row: 0, col: 0 };
}

// P = shorthand for a position.
const P = (row, col) => ({ row, col });
const range = (motion, start, end) => computeRange(motion, start, end);

// charwise range helper for assertions (drops linewise flag)
const cw = (sr, sc, er, ec) => ({ linewise: false, startRow: sr, startCol: sc, endRow: er, endCol: ec });
const lw = (sr, er) => ({ linewise: true, startRow: sr, endRow: er });

describe('computeRange — forward exclusive (w W l)', () => {
    beforeEach(() => setup(['foo bar']));

    test('dw deletes through the trailing space: [0..3]', () => {
        assert.deepEqual(range('w', P(0, 0), P(0, 4)), cw(0, 0, 0, 3));
    });
    test('dl deletes exactly one char: [0..0]', () => {
        assert.deepEqual(range('l', P(0, 0), P(0, 1)), cw(0, 0, 0, 0));
    });
    test('dW deletes through the trailing space: [0..3]', () => {
        assert.deepEqual(range('W', P(0, 0), P(0, 4)), cw(0, 0, 0, 3));
    });
});

// Change + a forward word motion drops the motion's trailing whitespace, like
// Vim (cw ≡ ce). See VIM_DIFFERENCES.md §2.11. Only for op === 'c' on w/W;
// delete/yank and other motions are unaffected.
describe('computeRange — change trims trailing blanks (§2.11)', () => {
    beforeEach(() => setup(['foo bar']));

    test("c + w excludes the trailing space: [0..2]", () => {
        assert.deepEqual(computeRange('w', P(0, 0), P(0, 4), 'c'), cw(0, 0, 0, 2));
    });
    test('c + W excludes the trailing space: [0..2]', () => {
        assert.deepEqual(computeRange('W', P(0, 0), P(0, 4), 'c'), cw(0, 0, 0, 2));
    });
    test('d + w still includes the trailing space: [0..3]', () => {
        assert.deepEqual(computeRange('w', P(0, 0), P(0, 4), 'd'), cw(0, 0, 0, 3));
    });
    test('y + w still includes the trailing space: [0..3]', () => {
        assert.deepEqual(computeRange('w', P(0, 0), P(0, 4), 'y'), cw(0, 0, 0, 3));
    });
    test('c + l is unaffected (not a word motion): [0..0]', () => {
        assert.deepEqual(computeRange('l', P(0, 0), P(0, 1), 'c'), cw(0, 0, 0, 0));
    });
    test('c + e is unaffected (inclusive word end): [0..2]', () => {
        assert.deepEqual(computeRange('e', P(0, 0), P(0, 2), 'c'), cw(0, 0, 0, 2));
    });
    test('multi-word run: c + 2w trims the final run of blanks only', () => {
        setup(['one two three']);
        // end after 2w is col 8 (start of "three"); exclusive end col 7 is the
        // space, trimmed back to col 6 (end of "two").
        assert.deepEqual(computeRange('w', P(0, 0), P(0, 8), 'c'), cw(0, 0, 0, 6));
    });
    // cross-line clamp, word-end fallback, and blank-run (§2.11).
    test('c + w that reached a later line clamps to end of the start line', () => {
        setup(['aaa', 'bbb']);
        // `w` from col0 lands at (1,0); change clamps to the last char of line 0.
        assert.deepEqual(computeRange('w', P(0, 0), P(1, 0), 'c'), cw(0, 0, 0, 2));
    });
    test('c + w with no following word changes to end of the current word', () => {
        setup(['foo bar']);
        // motion did not advance (end === start) → fall back to end-of-word.
        assert.deepEqual(computeRange('w', P(0, 0), P(0, 0), 'c'), cw(0, 0, 0, 2));
    });
    test('c + w on a blank start keeps the whole blank run (no trim)', () => {
        setup(['one  two']);
        // cursor on the space run (col 3..4); end is next word start (col 5).
        assert.deepEqual(computeRange('w', P(0, 3), P(0, 5), 'c'), cw(0, 3, 0, 4));
    });
});

describe('computeRange — forward inclusive (e E $)', () => {
    test('de deletes the word only: [0..2]', () => {
        setup(['foo bar']);
        assert.deepEqual(range('e', P(0, 0), P(0, 2)), cw(0, 0, 0, 2));
    });
    test('dE deletes the whole WORD incl punct: [0..3]', () => {
        setup(['foo, bar']);
        assert.deepEqual(range('E', P(0, 0), P(0, 3)), cw(0, 0, 0, 3));
    });
    test('d$ deletes to end of line: [2..6]', () => {
        setup(['foo bar']);
        assert.deepEqual(range('$', P(0, 2), P(0, 6)), cw(0, 2, 0, 6));
    });
});

describe('computeRange — backward inclusive (b B 0 h ge gE)', () => {
    beforeEach(() => setup(['foo bar']));

    test('db deletes back through the word: [0..3]', () => {
        assert.deepEqual(range('b', P(0, 4), P(0, 0)), cw(0, 0, 0, 3));
    });
    test('d0 deletes to start of line: [0..3]', () => {
        assert.deepEqual(range('0', P(0, 4), P(0, 0)), cw(0, 0, 0, 3));
    });
    test('dh deletes the single char before cursor: [3..3]', () => {
        assert.deepEqual(range('h', P(0, 4), P(0, 3)), cw(0, 3, 0, 3));
    });
    test('dge deletes back to the previous word end: [2..3]', () => {
        // cursor at "bar" (col4); ge dest is the last char of "foo" (col2)
        assert.deepEqual(range('ge', P(0, 4), P(0, 2)), cw(0, 2, 0, 3));
    });
});

describe('computeRange — linewise (j k gg G)', () => {
    beforeEach(() => setup(['aaa', 'bbb', 'ccc']));

    test('dj spans current+next line, ordered', () => {
        assert.deepEqual(range('j', P(0, 0), P(1, 0)), lw(0, 1));
    });
    test('dk spans current+prev line, ordered (min/max)', () => {
        assert.deepEqual(range('k', P(2, 0), P(1, 0)), lw(1, 2));
    });
    test('dgg spans from top to cursor line', () => {
        assert.deepEqual(range('gg', P(2, 0), P(0, 0)), lw(0, 2));
    });
    test('dG spans cursor to last line', () => {
        assert.deepEqual(range('G', P(0, 0), P(2, 0)), lw(0, 2));
    });
});

describe('computeRange — prevPos / nextPos boundaries', () => {
    test('prevPos wraps to last char of previous line', () => {
        setup(['ab', 'cd']);
        assert.deepEqual(prevPos(P(1, 0)), P(0, 1));
    });
    test('prevPos over an EMPTY previous line lands on (row-1, 0)', () => {
        setup(['', 'cd']);
        assert.deepEqual(prevPos(P(1, 0)), P(0, 0));
    });
    test('prevPos at very start returns null', () => {
        setup(['ab']);
        assert.equal(prevPos(P(0, 0)), null);
    });
    test('nextPos wraps to start of next line', () => {
        setup(['ab', 'cd']);
        assert.deepEqual(nextPos(P(0, 1)), P(1, 0));
    });
    test('nextPos at the last cell of the last grid row returns null', () => {
        setup(['ab']); // grid rows 1..ROWS-1 are empty
        assert.equal(nextPos(P(ROWS - 1, 0)), null);
    });
});

describe('computeRange — degenerate (no-op motion)', () => {
    // A no-op forward motion yields start === end. The operator should then
    // affect NOTHING (a null range), not a reversed span.
    test('dw on the last char (w is a no-op) must NOT produce a reversed range', () => {
        setup(['foo']);
        const r = range('w', P(0, 2), P(0, 2));
        const reversed = r && (r.endRow < r.startRow ||
            (r.endRow === r.startRow && r.endCol < r.startCol));
        assert.ok(!reversed, 'expected no reversed range, got ' + JSON.stringify(r));
    });
    test('db at the very first char (b is a no-op) returns null', () => {
        setup(['foo']);
        assert.equal(range('b', P(0, 0), P(0, 0)), null);
    });
});