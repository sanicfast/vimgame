// Unit tests for the vim motion functions in script.js.
// Run with: `npm test` (or directly: `node --test tests/`)
//
// These tests cover the four word motions: w, b, W, B. They verify the
// cursor position the user actually sees (i.e. after clampCursor), because
// several historical bugs only manifested after clamping.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    state,
    ROWS,
    clampCursor,
    moveToNextWord,
    moveToPrevWord,
    moveToNextBigWord,
    moveToPrevBigWord,
    moveToNextWordEnd,
    moveToNextBigWordEnd,
    moveToPrevWordEnd,
    moveToPrevBigWordEnd,
} = require('../script.js');

// Reset the singleton state with the given buffer lines. Anything past the
// supplied lines is left as empty rows (the engine treats those as '\n').
function setup(lines) {
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal';
    state.cursor = { row: 0, col: 0 };
}

// Run a motion from (row, col) and return where the cursor ends up
// AFTER clampCursor — i.e. what the user actually sees.
function landOn(motionFn, row, col) {
    state.cursor = { row, col };
    const dest = motionFn(state.cursor);
    state.cursor = { ...dest };
    clampCursor();
    return { row: state.cursor.row, col: state.cursor.col };
}

describe('w — forward by word (word/punct boundary)', () => {
    beforeEach(() => setup(['foo bar', 'baz', 'hello world']));

    test('lands on the next word start, not the trailing space', () => {
        assert.deepEqual(landOn(moveToNextWord, 0, 0), { row: 0, col: 4 });
    });
    test('from mid-word also lands on next word start', () => {
        assert.deepEqual(landOn(moveToNextWord, 0, 2), { row: 0, col: 4 });
    });
    test('crosses newline correctly when current word ends at EOL', () => {
        // Regression: this used to land on the last char of the line.
        assert.deepEqual(landOn(moveToNextWord, 0, 4), { row: 1, col: 0 });
    });
    test('crosses newline when cursor is on the very last char of a line', () => {
        assert.deepEqual(landOn(moveToNextWord, 0, 6), { row: 1, col: 0 });
    });
    test('skips an entire line when it has only one word', () => {
        assert.deepEqual(landOn(moveToNextWord, 1, 0), { row: 2, col: 0 });
    });
    test('within a line: from "h" of "hello" lands on "w" of "world"', () => {
        assert.deepEqual(landOn(moveToNextWord, 2, 0), { row: 2, col: 6 });
    });
    test('stops at a punct boundary (word -> punct)', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToNextWord, 0, 0), { row: 0, col: 3 });
    });
    test('punct followed by whitespace skips to next word', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToNextWord, 0, 3), { row: 0, col: 5 });
    });
    test('punct directly attached to next word (foo,bar)', () => {
        setup(['foo,bar']);
        assert.deepEqual(landOn(moveToNextWord, 0, 3), { row: 0, col: 4 });
    });
    test('at last char of buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToNextWord, 0, 2), { row: 0, col: 2 });
    });
});

describe('b — backward by word (word/punct boundary)', () => {
    beforeEach(() => setup(['foo bar', 'baz']));

    test('at the very start: stays put', () => {
        assert.deepEqual(landOn(moveToPrevWord, 0, 0), { row: 0, col: 0 });
    });
    test('from last char of bar to start of bar', () => {
        assert.deepEqual(landOn(moveToPrevWord, 0, 6), { row: 0, col: 4 });
    });
    test('from start of bar to start of foo', () => {
        assert.deepEqual(landOn(moveToPrevWord, 0, 4), { row: 0, col: 0 });
    });
    test('crosses newline backward', () => {
        assert.deepEqual(landOn(moveToPrevWord, 1, 0), { row: 0, col: 4 });
    });
});

describe('W — forward by WORD (whitespace-delimited)', () => {
    beforeEach(() => setup(['foo, bar; baz', 'next line']));

    test('skips the entire current WORD including punctuation', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 0, 0), { row: 0, col: 5 });
    });
    test('from inside the WORD still jumps to next WORD start', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 0, 1), { row: 0, col: 5 });
    });
    test('from whitespace jumps to next WORD start', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 0, 4), { row: 0, col: 5 });
    });
    test('chains correctly through consecutive WORDs', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 0, 5), { row: 0, col: 10 });
    });
    test('crosses newline to next line', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 0, 10), { row: 1, col: 0 });
    });
    test('continues within the next line', () => {
        assert.deepEqual(landOn(moveToNextBigWord, 1, 0), { row: 1, col: 5 });
    });
    test('at last char of buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToNextBigWord, 0, 2), { row: 0, col: 2 });
    });
});

describe('B — backward by WORD (whitespace-delimited)', () => {
    beforeEach(() => setup(['foo, bar; baz', 'next line']));

    test('at the very start: stays put', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 0, 0), { row: 0, col: 0 });
    });
    test('from inside a WORD walks back to its start', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 0, 6), { row: 0, col: 5 });
    });
    test('from end-of-WORD walks back to its start', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 0, 8), { row: 0, col: 5 });
    });
    test('from whitespace walks back across it', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 0, 9), { row: 0, col: 5 });
    });
    test('crosses newline backward to last WORD of previous line', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 1, 0), { row: 0, col: 10 });
    });
    test('within the next line: from "l" of "line" back to "n" of "next"', () => {
        assert.deepEqual(landOn(moveToPrevBigWord, 1, 5), { row: 1, col: 0 });
    });

describe('e — forward to END of word (inclusive)', () => {
    beforeEach(() => setup(['foo bar', 'baz', 'hello world']));

    test('from start of "foo" lands on last char of foo', () => {
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 0), { row: 0, col: 2 });
    });
    test('from mid-word also lands on end of current word', () => {
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 1), { row: 0, col: 2 });
    });
    test('from end of current word jumps to end of next word', () => {
        // Regression: cursor at last char of "foo" -> "e" should jump to "r" of "bar".
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 2), { row: 0, col: 6 });
    });
    test('crosses newline: end of "bar" jumps to end of "baz"', () => {
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 6), { row: 1, col: 2 });
    });
    test('within "hello world" from "h" lands on "o" of hello', () => {
        assert.deepEqual(landOn(moveToNextWordEnd, 2, 0), { row: 2, col: 4 });
    });
    test('chains: from "o" of hello ends on "d" of world', () => {
        assert.deepEqual(landOn(moveToNextWordEnd, 2, 4), { row: 2, col: 10 });
    });
    test('word->punct boundary: in "foo, bar" from "f" lands on last "o"', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 0), { row: 0, col: 2 });
    });
    test('from end of word, e lands on the trailing punct', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 2), { row: 0, col: 3 });
    });
    test('from punct, e jumps to end of next word', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 3), { row: 0, col: 7 });
    });
    test('at last char of buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToNextWordEnd, 0, 2), { row: 0, col: 2 });
    });
});

describe('E — forward to END of WORD (inclusive)', () => {
    beforeEach(() => setup(['foo, bar; baz', 'next line']));

    test('from "f" of "foo," lands on the "," (end of WORD)', () => {
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 0), { row: 0, col: 3 });
    });
    test('from mid-WORD also lands on the WORD end', () => {
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 1), { row: 0, col: 3 });
    });
    test('from end of WORD jumps to end of next WORD', () => {
        // bar; is a single WORD, so its end is the ';' at col 8.
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 3), { row: 0, col: 8 });
    });
    test('chains through consecutive WORDs', () => {
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 8), { row: 0, col: 12 });
    });
    test('crosses newline: end of last WORD jumps to first WORD of next line', () => {
        // Start on the actual last WORD char ('z' at col 12).
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 12), { row: 1, col: 3 });
    });
    test('continues within the next line', () => {
        assert.deepEqual(landOn(moveToNextBigWordEnd, 1, 0), { row: 1, col: 3 });
    });
    test('at last char of buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToNextBigWordEnd, 0, 2), { row: 0, col: 2 });
    });
});


describe('ge — backward to END of previous word (inclusive)', () => {
    beforeEach(() => setup(['foo bar baz', 'next']));

    test('from end of last word to end of previous word', () => {
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 10), { row: 0, col: 6 });
    });
    test('chains: end of "bar" to end of "foo"', () => {
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 6), { row: 0, col: 2 });
    });
    test('from start of word to end of previous word', () => {
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 4), { row: 0, col: 2 });
    });
    test('from mid-word to end of previous word', () => {
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 5), { row: 0, col: 2 });
    });
    test('at buffer start: stays put', () => {
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 0), { row: 0, col: 0 });
    });
    test('punct counts as its own word: "foo, bar" from r lands on ","', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 7), { row: 0, col: 3 });
    });
    test('from punct to end of preceding word', () => {
        setup(['foo, bar']);
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 3), { row: 0, col: 2 });
    });
    test('crosses newline: row 1 col 2 → end of "foo" on row 0', () => {
        setup(['foo', 'bar']);
        assert.deepEqual(landOn(moveToPrevWordEnd, 1, 2), { row: 0, col: 2 });
    });
    test('skips empty line: "foo\\n\\nbar" row 2 col 2 → end of foo', () => {
        setup(['foo', '', 'bar']);
        assert.deepEqual(landOn(moveToPrevWordEnd, 2, 2), { row: 0, col: 2 });
    });
    test('single-word buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToPrevWordEnd, 0, 2), { row: 0, col: 2 });
    });
});

describe('gE — backward to END of previous WORD (inclusive)', () => {
    beforeEach(() => setup(['foo, bar; baz', 'next line']));

    test('from end of last WORD to end of previous WORD (the ";")', () => {
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 0, 12), { row: 0, col: 8 });
    });
    test('chains: end of "bar;" to end of "foo," (the ",")', () => {
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 0, 8), { row: 0, col: 3 });
    });
    test('from start of WORD walks back to end of prev WORD', () => {
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 0, 5), { row: 0, col: 3 });
    });
    test('crosses newline: row 1 col 0 → end of "baz" on row 0', () => {
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 1, 0), { row: 0, col: 12 });
    });
    test('at buffer start: stays put', () => {
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 0, 0), { row: 0, col: 0 });
    });
    test('single-word buffer: stays put', () => {
        setup(['foo']);
        assert.deepEqual(landOn(moveToPrevBigWordEnd, 0, 0), { row: 0, col: 0 });
    });
});

});
