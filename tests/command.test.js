// Tests for the `:` command-line: entry/typing/exit and the `:wq`/`:x` "finish the
// challenge → next challenge" behavior (gated on completion, `!` overrides).

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { state, initChallenge, setMode, handleKeyDown, CHALLENGES } = require('../script.js');

// Neutralize the 1.5s "✓ Solved!" flash timer for the whole file so :wq tests
// don't leave pending real timers (which would delay exit / fire mid-suite).
// Tests that need to observe the reveal call mock.timers.tick(1500).
mock.timers.enable({ apis: ['setTimeout'] });
after(() => mock.timers.reset());

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
    test(':wq shows a Solved banner, then reveals the hint after 1.5s', () => {
        const i = idx('Swap Two Lines');
        load(i);
        run(['d', 'd', 'p']);           // completes the swap challenge
        run([':', 'w', 'q', 'Enter']);
        // Immediately: a solved banner naming the challenge we just cleared.
        assert.match(state.statusMsg, /✓ Solved!/);
        assert.doesNotMatch(state.statusMsg, /not solved/);
        // After the flash window: the new challenge's hint takes over,
        // matching what the dropdown shows when you pick it directly.
        mock.timers.tick(1500);
        assert.equal(state.statusMsg, CHALLENGES[i + 1].hint);
    });
    test(':wq hint reveal does not clobber a status the player already typed', () => {
        const i = idx('Swap Two Lines');
        load(i);
        run(['d', 'd', 'p']);
        run([':', 'w', 'q', 'Enter']);   // -> banner "✓ Solved! ..."
        // Player starts another action before the timer fires (sets a prompt).
        run(['d']);                       // operator-pending: statusMsg "d ..."
        mock.timers.tick(1500);
        // The reveal must NOT overwrite their newer status message.
        assert.doesNotMatch(state.statusMsg, /^✓ Solved!/);
        assert.notEqual(state.statusMsg, CHALLENGES[i + 1].hint);
    });
    test('wraps around after the last challenge', () => {
        load(CHALLENGES.length - 1);          // last challenge (index length-1)
        run([':', 'w', 'q', '!', 'Enter']);
        assert.equal(state.currentChallenge, 0);
    });
});

describe(':bn / :bp navigate exercises', () => {
    test(':bn goes to the next challenge', () => {
        load(0);
        run([':', 'b', 'n', 'Enter']);
        assert.equal(state.currentChallenge, 1);
    });
    test(':bp goes to the previous challenge', () => {
        load(2);
        run([':', 'b', 'p', 'Enter']);
        assert.equal(state.currentChallenge, 1);
    });
    test(':bn wraps from the last to the first', () => {
        load(CHALLENGES.length - 1);
        run([':', 'b', 'n', 'Enter']);
        assert.equal(state.currentChallenge, 0);
    });
    test(':bp wraps from the first to the last', () => {
        load(0);
        run([':', 'b', 'p', 'Enter']);
        assert.equal(state.currentChallenge, CHALLENGES.length - 1);
    });
    test(':bn needs no completion (works unsolved)', () => {
        const i = CHALLENGES.findIndex(c => c.name === 'Set Every Value'); // left unsolved on purpose
        load(i);
        run([':', 'b', 'n', 'Enter']);
        assert.equal(state.currentChallenge, (i + 1) % CHALLENGES.length);
    });
    test(':bn leaves the new challenge loaded (hint shown, buffer reset)', () => {
        load(0);
        run([':', 'b', 'n', 'Enter']);
        assert.equal(state.statusMsg, CHALLENGES[1].hint);
        assert.deepEqual(state.buffer[0], (CHALLENGES[1].start[0] || '').slice(0, 80));
    });
});
