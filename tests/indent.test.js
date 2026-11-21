// Indent operators > < = : shift/auto-indent, counts, motions, text objects,
// dot-repeat and undo. Pure unit tests (no nvim). Policy: shift = 2 spaces.
function makeEl(){return{className:'',textContent:'',innerHTML:'',tabIndex:0,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},focus(){}};}
global.document={getElementById(){return makeEl();},createElement(){return makeEl();},addEventListener(){},body:makeEl()};
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, setMode, handleNormalKey, handleInsertKey, handleTextObjectKey } = require('../script.js');
function setup(lines, r=0, c=0){ state.buffer=[]; for(let i=0;i<ROWS;i++) state.buffer[i]=lines[i]||'';
  state.mode='normal'; state.pendingOperator=null; state.pendingTextObject=null; state.pendingG=false;
  state.pendingFind=null; state.pendingReplace=null; state.lastFind=null; state.inputBuffer='';
  state.commandMode=false; state.commandInput=''; state.register={text:null,linewise:false};
  state.undoStack=[]; state.redoStack=[]; state.cursor={row:r,col:c}; state.lastChange=null;
  state.insertTouched=false; state.pendingInsertRecord=null; state.statusMsg=''; }
function press(k){ if(state.mode==='insert')handleInsertKey({key:k}); else if(state.mode==='pending-text-object')handleTextObjectKey({key:k}); else handleNormalKey({key:k}); }
const run = t => { for (const k of t) press(k); };
const rows = n => state.buffer.slice(0, n);

describe('> indent right', () => {
    test('>> shifts the current line by two spaces', () => {
        setup(['abc']); run(['>','>']); assert.equal(state.buffer[0], '  abc');
    });
    test('2>> shifts two lines', () => {
        setup(['a','b','c']); run(['2','>','>']); assert.deepEqual(rows(3), ['  a','  b','c']);
    });
    test('>j shifts the current and next line', () => {
        setup(['a','b','c']); run(['>','j']); assert.deepEqual(rows(3), ['  a','  b','c']);
    });
    test('>G shifts to the last non-empty line', () => {
        setup(['a','b','c']); run(['>','G']); assert.deepEqual(rows(3), ['  a','  b','  c']);
    });
    test('> skips blank lines (adds nothing to an empty row)', () => {
        setup(['a','','b']); run(['>','G']); assert.deepEqual(rows(3), ['  a','','  b']);
    });
});

describe('< unindent left', () => {
    test('<< removes up to two leading spaces', () => {
        setup(['  abc']); run(['<','<']); assert.equal(state.buffer[0], 'abc');
    });
    test('<< on 4 spaces leaves 2', () => {
        setup(['    abc']); run(['<','<']); assert.equal(state.buffer[0], '  abc');
    });
    test('<< on a single leading space removes it', () => {
        setup([' abc']); run(['<','<']); assert.equal(state.buffer[0], 'abc');
    });
    test('<< on an unindented line is a no-op', () => {
        setup(['abc']); run(['<','<']); assert.equal(state.buffer[0], 'abc');
    });
});

describe('= auto-indent (brace depth)', () => {
    test('== collapses a flat over-indented line to column 0', () => {
        setup(['    abc']); run(['=','=']); assert.equal(state.buffer[0], 'abc');
    });
    test('=G indents a brace block', () => {
        setup(['function f() {','return 1;','}']); run(['=','G']);
        assert.deepEqual(rows(3), ['function f() {','  return 1;','}']);
    });
    test('=G nests correctly', () => {
        setup(['function f() {','if (x) {','return 1;','}','}','']); run(['=','G']);
        assert.deepEqual(rows(5), ['function f() {','  if (x) {','    return 1;','  }','}']);
    });
});

describe('indent via text object / motion', () => {
    test('>iw indents the current line', () => {
        setup(['foo bar']); run(['>','i','w']); assert.equal(state.buffer[0], '  foo bar');
    });
});

describe('indent dot-repeat & undo', () => {
    test('. repeats >> on the current line', () => {
        setup(['abc']); run(['>','>','.']); assert.equal(state.buffer[0], '    abc');
    });
    test('. repeats << (unindent)', () => {
        setup(['    abc']); run(['<','<','.']); assert.equal(state.buffer[0], 'abc');
    });
    test('. repeats == auto-indent (idempotent re-apply)', () => {
        setup(['function f() {','return 1;','}']);
        run(['=','G']);                                  // → ['function f() {','  return 1;','}']
        const once = rows(3);
        run(['.']);                                       // re-run auto-indent from row 0
        assert.deepEqual(rows(3), once);
    });
    test('> is a single undo unit', () => {
        setup(['a','b','c']); run(['2','>','>']); run(['u']);
        assert.deepEqual(rows(3), ['a','b','c']);
    });
});
