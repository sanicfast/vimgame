// Text-object tests (`iw` / `aw` with operators). Driven through the real key
// handlers (needs the DOM stub for the change/insert paths).

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
// Run a command from (row,col); return {line, cursor, register, mode, status}.
function act(lines, row, col, keys) {
    setup(lines, row, col);
    run(keys);
    return {
        line: state.buffer[0],
        lines: state.buffer.slice(0, 3),
        cursor: { ...state.cursor },
        register: { ...state.register },
        mode: state.mode,
        status: state.statusMsg,
    };
}

describe('diw — delete inner word', () => {
    test('from start / middle / end of the word deletes the whole word', () => {
        for (const c of [0, 1, 2]) {
            const r = act(['foo bar'], 0, c, ['d', 'i', 'w']);
            assert.equal(r.line, ' bar');
            assert.equal(r.register.text, 'foo');
            assert.equal(r.mode, 'normal');
        }
    });
    test('is class-aware: stops at punctuation (does not include ",")', () => {
        const r = act(['foo,bar'], 0, 1, ['d', 'i', 'w']);
        assert.equal(r.line, ',bar');
        assert.equal(r.register.text, 'foo');
    });
    test('on punctuation deletes just the punct run', () => {
        const r = act(['foo,bar'], 0, 3, ['d', 'i', 'w']);
        assert.equal(r.line, 'foobar');
        assert.equal(r.register.text, ',');
    });
    test('on whitespace deletes the whitespace run', () => {
        const r = act(['foo bar'], 0, 3, ['d', 'i', 'w']);
        assert.equal(r.line, 'foobar');
        assert.equal(r.register.text, ' ');
    });
    test('cursor lands at the start of the deleted region', () => {
        const r = act(['foo bar'], 0, 0, ['d', 'i', 'w']);
        assert.deepEqual(r.cursor, { row: 0, col: 0 });
    });
    test('single-word line: empties the line and registers the word', () => {
        const r = act(['hi'], 0, 0, ['d', 'i', 'w']);
        assert.equal(r.line, '');
        assert.equal(r.register.text, 'hi');
    });
});

describe('daw — delete a word (with adjacent whitespace)', () => {
    test('prefers trailing whitespace', () => {
        const r = act(['foo bar'], 0, 0, ['d', 'a', 'w']);
        assert.equal(r.line, 'bar');
        assert.equal(r.register.text, 'foo ');
    });
    test('uses leading whitespace when there is no trailing space', () => {
        const r = act(['foo bar'], 0, 4, ['d', 'a', 'w']);
        assert.equal(r.line, 'foo');
        assert.equal(r.register.text, ' bar');
    });
    test('consumes a run of trailing spaces', () => {
        const r = act(['foo  bar'], 0, 0, ['d', 'a', 'w']);
        assert.equal(r.line, 'bar');
        assert.equal(r.register.text, 'foo  ');
    });
    test('middle word: deletes word + trailing space', () => {
        const r = act(['foo bar baz'], 0, 5, ['d', 'a', 'w']);
        assert.equal(r.line, 'foo baz');
    });
    test('lone word with no surrounding space: deletes just the word', () => {
        const r = act(['foo'], 0, 0, ['d', 'a', 'w']);
        assert.equal(r.line, '');
        assert.equal(r.register.text, 'foo');
    });
    test('from whitespace before a word: deletes space + word', () => {
        const r = act(['  foo'], 0, 0, ['d', 'a', 'w']);
        assert.equal(r.line, '');
        assert.equal(r.register.text, '  foo');
    });
    test('from whitespace between words: deletes space + next word', () => {
        const r = act(['foo bar'], 0, 3, ['d', 'a', 'w']);
        assert.equal(r.line, 'foo');
        assert.equal(r.register.text, ' bar');
    });
    test('from trailing whitespace (no word to right): deletes prev word + space', () => {
        const r = act(['foo   '], 0, 3, ['d', 'a', 'w']);
        assert.equal(r.line, '');
        assert.equal(r.register.text, 'foo   ');
    });
});

describe('text objects — change & yank', () => {
    test('yiw yanks the word, mutates nothing, leaves cursor in place', () => {
        const r = act(['foo bar'], 0, 2, ['y', 'i', 'w']);
        assert.equal(r.line, 'foo bar');
        assert.equal(r.register.text, 'foo');
        assert.deepEqual(r.cursor, { row: 0, col: 2 });
        assert.equal(r.mode, 'normal');
    });
    test('ciw replaces the word and enters insert mode (then typed text)', () => {
        const r = act(['foo bar'], 0, 0, ['c', 'i', 'w', 'Z', 'Escape']);
        assert.equal(r.line, 'Z bar');
        assert.equal(r.register.text, 'foo');
    });
    test('caw replaces word + adjacent space', () => {
        const r = act(['foo bar'], 0, 0, ['c', 'a', 'w', 'X', 'Escape']);
        assert.equal(r.line, 'Xbar');
        assert.equal(r.register.text, 'foo ');
    });
});

describe('text objects — single-line contract (do not cross newlines)', () => {
    test('diw on the last word of a line does not reach into the next line', () => {
        const r = act(['foo', 'bar'], 0, 2, ['d', 'i', 'w']);
        assert.deepEqual(r.lines, ['', 'bar', '']);
        assert.deepEqual(r.cursor, { row: 0, col: 0 });
    });
    test('diw at the start of a line stays on that line', () => {
        const r = act(['foo', 'bar'], 1, 0, ['d', 'i', 'w']);
        assert.deepEqual(r.lines, ['foo', '', '']);
        assert.deepEqual(r.cursor, { row: 1, col: 0 });
    });
    // KNOWN LIMITATION (documented, intentional single-line scope): real vim's
    // `daw` on the final word of a line (no trailing space) also consumes the
    // newline and joins the lines. Our text objects are single-line, so the
    // newline is left in place. Asserting current behavior so a future change
    // to cross-line text-object semantics must consciously update this.
    test('daw on an EOL word deletes only the word, leaving the empty line', () => {
        const r = act(['foo', 'bar'], 0, 0, ['d', 'a', 'w']);
        assert.deepEqual(r.lines, ['', 'bar', '']);
    });
});

describe('text objects — cancellation & integration', () => {
    test('unknown text object cancels with no mutation and a status message', () => {
        const r = act(['foo'], 0, 0, ['d', 'i', 'q']);
        assert.equal(r.line, 'foo');
        assert.equal(r.mode, 'normal');
        assert.match(r.status, /unknown text object/);
    });
    test('diw fills the register so p can paste it elsewhere', () => {
        setup(['foo bar'], 0, 0);
        run(['d', 'i', 'w']);        // delete "foo", register "foo", cursor @0
        run(['l']);                   // move onto "b" of "bar"
        run(['p']);                   // paste "foo" after "b"
        assert.equal(state.buffer[0], ' bfooar');
    });
    test('operator-pending i/a is chosen over insert-mode i/a', () => {
        // "d i w" must delete inner-word, NOT enter insert mode.
        const r = act(['foo bar'], 0, 0, ['d', 'i', 'w']);
        assert.equal(r.mode, 'normal');
        assert.equal(r.line, ' bar');
    });
});

describe('WORD text objects (iW / aW) — whitespace-delimited', () => {
    test('diW selects the whole non-space run (punctuation included)', () => {
        const r = act(['foo.bar baz'], 0, 0, ['d', 'i', 'W']);
        assert.equal(r.line, ' baz');
        assert.equal(r.register.text, 'foo.bar');
    });
    test('daW extends to the trailing space too', () => {
        const r = act(['foo.bar baz'], 0, 0, ['d', 'a', 'W']);
        assert.equal(r.line, 'baz');
        assert.equal(r.register.text, 'foo.bar ');
    });
    test('iW keeps punctuation that iw would stop at', () => {
        // contrast: diw on "foo,bar" deletes only "foo"; diW deletes "foo,bar".
        const w = act(['foo,bar'], 0, 1, ['d', 'i', 'w']);
        const W = act(['foo,bar'], 0, 1, ['d', 'i', 'W']);
        assert.equal(w.line, ',bar');
        assert.equal(W.line, '');
    });
    test('ciW replaces the whole WORD then enters insert', () => {
        const r = act(['a=b+c'], 0, 2, ['c', 'i', 'W', 'X', 'Escape']);
        assert.equal(r.line, 'X');
        assert.equal(r.mode, 'normal');
    });
    test('daW on a lone word deletes it (no trailing space)', () => {
        const r = act(['alone'], 0, 0, ['d', 'a', 'W']);
        assert.equal(r.line, '');
        assert.equal(r.register.text, 'alone');
    });
    test('iW on whitespace selects the run of spaces', () => {
        const r = act(['a   b'], 0, 2, ['d', 'i', 'W']);
        assert.equal(r.line, 'ab');
        assert.equal(r.register.text, '   ');
    });
    test('yiW + p round-trips a WORD (register preserved)', () => {
        setup(['foo.bar baz'], 0, 0);
        run(['y', 'i', 'W']);           // yank "foo.bar"
        run(['$', 'p']);                // go to EOL, paste after -> append
        assert.equal(state.buffer[0], 'foo.bar bazfoo.bar');
    });
});

describe('quoted-string text objects (i" / a", also i\' and i`)', () => {
    test('di" deletes the inner text, keeps the quotes', () => {
        const r = act(['s="hello"'], 0, 4, ['d', 'i', '"']);   // cursor inside
        assert.equal(r.line, 's=""');
        assert.equal(r.register.text, 'hello');
    });
    test('da" deletes the quotes and the content', () => {
        const r = act(['s="hello"'], 0, 4, ['d', 'a', '"']);
        assert.equal(r.line, 's=');
        assert.equal(r.register.text, '"hello"');
    });
    test('ci" replaces inner text and enters insert', () => {
        const r = act(['s="hi"'], 0, 3, ['c', 'i', '"', 'X', 'Escape']);
        assert.equal(r.line, 's="X"');
        assert.equal(r.mode, 'normal');
    });
    test('from before the string, selects the next pair (forward search)', () => {
        const r = act(['x = "hi"'], 0, 0, ['c', 'i', '"', 'Z', 'Escape']);
        assert.equal(r.line, 'x = "Z"');
    });
    test('works with single quotes', () => {
        const r = act(["p='ab'"], 0, 3, ["c", "i", "'", 'Y', 'Escape']);
        assert.equal(r.line, "p='Y'");
    });
    test('two strings on a line: acts on the enclosing one', () => {
        const r = act(['k="a" j="b"'], 0, 3, ['d', 'i', '"']);   // cursor in first
        assert.equal(r.line, 'k="" j="b"');
    });
    test('empty string "" yields a no-op inner delete', () => {
        const r = act(['s=""'], 0, 2, ['d', 'i', '"']);
        assert.equal(r.line, 's=""');
    });
    test('no quotes on the line -> unknown text object (no change)', () => {
        const r = act(['plain text'], 0, 0, ['d', 'i', '"']);
        assert.equal(r.line, 'plain text');
        assert.match(r.status, /unknown text object/);
    });
});

describe('angle-bracket text objects (i< / a<)', () => {
    test('di< deletes inner text, keeps the brackets', () => {
        const r = act(['a<b>c'], 0, 2, ['d', 'i', '<']);   // cursor on '<'
        assert.equal(r.line, 'a<>c');
        assert.equal(r.register.text, 'b');
    });
    test('da< deletes the brackets and the content', () => {
        const r = act(['a<b>c'], 0, 2, ['d', 'a', '<']);
        assert.equal(r.line, 'ac');
        assert.equal(r.register.text, '<b>');
    });
    test('ci< replaces inner text and enters insert', () => {
        const r = act(['x=<hi>'], 0, 3, ['c', 'i', '<', 'Z', 'Escape']);
        assert.equal(r.line, 'x=<Z>');
        assert.equal(r.mode, 'normal');
    });
    test('no angle pair on the line -> unknown text object', () => {
        const r = act(['a > b'], 0, 2, ['d', 'i', '<']);   // '>' with no '<' opener
        assert.equal(r.line, 'a > b');
        assert.match(r.status, /unknown text object/);
    });
});
