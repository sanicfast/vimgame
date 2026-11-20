// Tests for `r` (replace char) and `s` (substitute char → change + insert).
function makeEl(){return{className:'',textContent:'',innerHTML:'',tabIndex:0,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},focus(){}};}
global.document={getElementById(){return makeEl();},createElement(){return makeEl();},addEventListener(){},body:makeEl()};
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, ROWS, handleNormalKey, handleInsertKey, handleTextObjectKey, setMode } = require('../script.js');
function setup(lines,row,col){
  state.buffer=[]; for(let i=0;i<ROWS;i++) state.buffer[i]=lines[i]||'';
  state.mode='normal'; state.pendingOperator=null; state.pendingTextObject=null; state.pendingG=false;
  state.pendingFind=null; state.pendingReplace=null; state.lastFind=null; state.inputBuffer='';
  state.commandMode=false; state.commandInput=''; state.register={text:null,linewise:false};
  state.undoStack=[]; state.redoStack=[]; state.cursor={row:row||0,col:col||0}; state.lastChange=null;
  state.insertTouched=false; state.pendingInsertRecord=null; state.statusMsg='';
}
function press(ch){ if(state.mode==='insert') handleInsertKey({key:ch}); else if(state.mode==='pending-text-object') handleTextObjectKey({key:ch}); else handleNormalKey({key:ch}); }
const run=t=>{for(const x of t)press(x);};

describe('r — replace char', () => {
  test('replaces the char under the cursor and stays in normal mode', () => {
    setup(['abc'],0,1); run(['r','x']);
    assert.equal(state.buffer[0],'axc'); assert.equal(state.mode,'normal');
  });
  test('cursor lands on the last replaced char', () => {
    setup(['abcd'],0,1); run(['r','x']);
    assert.deepEqual(state.cursor,{row:0,col:1});
  });
  test('honors a count (2rz replaces two chars)', () => {
    setup(['abcd'],0,1); run(['2','r','z']);
    assert.equal(state.buffer[0],'azzd'); assert.deepEqual(state.cursor,{row:0,col:2});
  });
  test('count stops at end of line', () => {
    setup(['ab'],0,1); run(['5','r','z']);
    assert.equal(state.buffer[0],'az');
  });
  test('can replace with a space', () => {
    setup(['a-b'],0,1); run(['r',' ']);
    assert.equal(state.buffer[0],'a b');
  });
  test('Escape cancels the pending replace', () => {
    setup(['abc'],0,1); run(['r','Escape']);
    assert.equal(state.buffer[0],'abc'); assert.equal(state.pendingReplace,null);
  });
  test('dot-repeat replays the same replacement elsewhere', () => {
    setup(['abc','efg'],0,1); run(['r','x']);           // 'axc'
    run(['j','0','l','.']);                              // 'exg'
    assert.equal(state.buffer[1],'exg');
  });
});

describe('s — substitute char (change + insert)', () => {
  test('deletes the char under the cursor and enters insert mode', () => {
    setup(['abc'],0,1); run(['s']);
    assert.equal(state.mode,'insert'); assert.equal(state.buffer[0],'ac');
  });
  test('typed text replaces the deleted char; Esc returns to normal', () => {
    setup(['abc'],0,1); run(['s','X','Y','Escape']);
    assert.equal(state.buffer[0],'aXYc'); assert.equal(state.mode,'normal');
  });
  test('honors a count (2s deletes two then inserts)', () => {
    setup(['abcd'],0,1); run(['2','s','Z','Escape']);
    assert.equal(state.buffer[0],'aZd');
  });
  test('at/beyond end of line behaves like insert (no delete)', () => {
    setup(['ab'],0,2); run(['s','X','Escape']);
    assert.equal(state.buffer[0],'abX');
  });
  test('dot-repeat replays the change+type on the next line', () => {
    setup(['abc','efg'],0,1); run(['s','X','Escape']);    // 'aXc'
    run(['j','0','l','.']);                                // 'eXg'
    assert.equal(state.buffer[1],'eXg');
  });
  test('one undo step reverts the whole substitute', () => {
    setup(['abc'],0,1); run(['s','X','Y','Escape']);
    assert.equal(state.buffer[0],'aXYc');
    run(['u']);
    assert.equal(state.buffer[0],'abc');
  });
});
