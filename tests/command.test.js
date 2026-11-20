// Tests for the `:` command-line: entry/typing/exit and the `:wq`/`:x` "finish the
// challenge → next challenge" behavior (gated on completion, `!` overrides).

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { state, initChallenge, setMode, handleKeyDown, CHALLENGES } = require('../script.js');

// Drive the global key dispatcher exactly like the browser would.
function press(k) {
    handleKeyDown({ key: k, preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
}
const run = (tks) => { for (const t of tks) press(t); };
function load(i) { initChallenge(i); setMode('normal'); }

describe('command-line mode', () => {
    test(': enters command mode and typed chars echo in the status', () => {
        load(0);
        press(':');
        assert.equal(state.commandMode, true);
        assert.equal(state.statusMsg, ':');
        run(['w', 'q']);
        assert.equal(state.commandInput, 'wq');
        assert.equal(state.statusMsg, ':wq');
    });
    test('Escape cancels command mode', () => {
        load(0);
        run([':', 'w']);
        press('Escape');
        assert.equal(state.commandMode, false);
        assert.equal(state.commandInput, '');
        assert.equal(state.statusMsg, '');
    });
    test('Backspace past the colon exits command mode', () => {
        load(0);
        run([':', 'Backspace']);
        assert.equal(state.commandMode, false);
    });
    test('unknown command reports a vim-like error', () => {
        load(0);
        run([':', 'z', 'Enter']);
        assert.equal(state.commandMode, false);
        assert.equal(state.statusMsg, 'not an editor: :z');
    });
});

describe(':wq advances to the next challenge', () => {
    // Resolve by name so the assertions survive any reordering of CHALLENGES.
    const idx = (name) => CHALLENGES.findIndex((c) => c.name === name);
    // Solve "Swap Two Lines" (ddp), then :wq -> the next challenge.
    test(':wq advances when the challenge is solved', () => {
        const i = idx('Swap Two Lines');
        load(i);
        run(['d', 'd', 'p']);           // completes the swap challenge
        run([':', 'w', 'q', 'Enter']);
        assert.equal(state.commandMode, false);
        assert.equal(state.currentChallenge, i + 1);
    });
    test(':x is an alias for :wq', () => {
        const i = idx('Swap Two Lines');
        load(i);
        run(['d', 'd', 'p']);
        run([':', 'x', 'Enter']);
        assert.equal(state.currentChallenge, i + 1);
    });
    test(':wq is refused when not solved (stays on challenge)', () => {
        const i = idx('Set Every Value');   // left unsolved
        load(i);
        run([':', 'w', 'q', 'Enter']);
        assert.equal(state.currentChallenge, i);
        assert.match(state.statusMsg, /not solved/);
    });
    test(':wq! skips even when not solved', () => {
        const i = idx('Set Every Value');
        load(i);
        run([':', 'w', 'q', '!', 'Enter']);
        assert.equal(state.currentChallenge, i + 1);
    });
    test('wraps around after the last challenge', () => {
        load(CHALLENGES.length - 1);          // last challenge (index length-1)
        run([':', 'w', 'q', '!', 'Enter']);
        assert.equal(state.currentChallenge, 0);
    });
});
