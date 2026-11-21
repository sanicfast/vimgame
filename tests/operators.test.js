// D / C / Y / S uppercase operator shortcuts (== d$ / c$ / yy / cc), counts,
// register, undo, and dot-repeat. Pure unit tests (no nvim needed).
function makeEl(){return{className:'',textContent:'',innerHTML:'',tabIndex:0,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},focus(){}};}
global.document={getElementById(){return makeEl();},createElement(){return makeEl();},addEventListener(){},body:makeEl()};
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, setMode, handleNormalKey, handleInsertKey, handleTextObjectKey } = require('../script.js');

function setup(lines, r = 0, c = 0) {
    state.buffer = []; for (let i = 0; i < ROWS; i++) state.buffer[i] = lines[i] || '';
    state.mode = 'normal'; state.pendingOperator = null; state.pendingTextObject = null;
    state.pendingG = false; state.pendingFind = null; state.pendingReplace = null; state.lastFind = null;
    state.inputBuffer = ''; state.commandMode = false; state.commandInput = '';
    state.register = { text: null, linewise: false }; state.undoStack = []; state.redoStack = [];
    state.cursor = { row: r, col: c }; state.lastChange = null; state.insertTouched = false;
    state.pendingInsertRecord = null; state.statusMsg = '';
}
function press(k){ if(state.mode==='insert')handleInsertKey({key:k}); else if(state.mode==='pending-text-object')handleTextObjectKey({key:k}); else handleNormalKey({key:k}); }
const run = t => { for (const k of t) press(k); };
const line = n => state.buffer[n];

describe('D — delete to end of line (d$)', () => {
    test('deletes from cursor to EOL, keeps head', () => {
        setup(['hello world'], 0, 3); run(['D']);
        assert.equal(line(0), 'hel');
        assert.equal(state.mode, 'normal');
    });
    test('D at col 0 empties the line (does not join)', () => {
        setup(['abc', 'def'], 0, 0); run(['D']);
        assert.deepEqual(state.buffer.slice(0, 2), ['', 'def']);
    });
    test('2D deletes to EOL and the following whole line', () => {
        setup(['pre', 'aaa', 'bbb', 'ccc'], 1, 0); run(['2', 'D']);
        assert.deepEqual(state.buffer.slice(0, 2), ['pre', 'ccc']);
    });
    test('2D after a char keeps the head line', () => {
        setup(['pre', 'xaaa', 'xbbb', 'ccc'], 1, 1); run(['2', 'D']);
        assert.deepEqual(state.buffer.slice(0, 3), ['pre', 'x', 'ccc']);
    });
    test('fills the register with deleted text', () => {
        setup(['hello'], 0, 2); run(['D']);
        assert.equal(state.register.text, 'llo');
    });
});

describe('C — change to end of line (c$)', () => {
    test('changes to EOL and enters insert', () => {
        setup(['hello world'], 0, 3); run(['C', 'X', 'Escape']);
        assert.equal(line(0), 'helX');
        assert.equal(state.mode, 'normal');
    });
    test('2C at col 0 replaces the span, leaves one line to type', () => {
        setup(['pre', 'aaa', 'bbb', 'ccc'], 1, 0); run(['2', 'C', 'X', 'Escape']);
        assert.deepEqual(state.buffer.slice(0, 3), ['pre', 'X', 'ccc']);
    });
});

describe('Y — yank line(s) (yy)', () => {
    test('Y yanks the current line and pastes below with p', () => {
        setup(['one', 'two'], 0, 0); run(['Y', 'p']);
        assert.deepEqual(state.buffer.slice(0, 3), ['one', 'one', 'two']);
    });
    test('2Y yanks two lines', () => {
        setup(['a', 'b', 'c'], 0, 0); run(['2', 'Y', 'p']);
        assert.deepEqual(state.buffer.slice(0, 5), ['a', 'a', 'b', 'b', 'c']);
    });
    test('Y leaves the cursor in place', () => {
        setup(['one', 'two'], 0, 0); run(['Y']);
        assert.deepEqual(state.cursor, { row: 0, col: 0 });
    });
});

describe('S — substitute line(s) (cc)', () => {
    test('S clears the line and enters insert', () => {
        setup(['hello world'], 0, 0); run(['S', 'Z', 'Escape']);
        assert.equal(line(0), 'Z');
    });
    test('2S replaces two lines with one typed line', () => {
        setup(['a', 'b', 'c'], 0, 0); run(['2', 'S', 'Z', 'Escape']);
        assert.deepEqual(state.buffer.slice(0, 2), ['Z', 'c']);
    });
});

describe('D/C/Y/S — dot-repeat & undo', () => {
    test('. repeats D at the next line', () => {
        setup(['hello', 'world', 'again'], 0, 2); run(['D', 'j', '.']);
        // D leaves the caret on the last remaining char; j keeps that column, so
        // the repeat deletes from col 1 ("w"). Matches real Vim's d$ + . .
        assert.deepEqual(state.buffer.slice(0, 3), ['he', 'w', 'again']);
    });
    test('. repeats C + typed text on the next line', () => {
        setup(['foo bar', 'baz qux'], 0, 3); run(['C', '!', 'Escape', 'j', '.']);
        assert.deepEqual(state.buffer.slice(0, 2), ['foo!', 'baz!']);
    });
    test('S then . re-applies on the next line', () => {
        setup(['one', 'two', 'three'], 0, 0); run(['S', 'X', 'Escape', 'j', '.']);
        assert.deepEqual(state.buffer.slice(0, 2), ['X', 'X']);
    });
    test('D is one undo unit', () => {
        setup(['hello world'], 0, 3); run(['D']);
        run(['u']);
        assert.equal(line(0), 'hello world');
    });
});
