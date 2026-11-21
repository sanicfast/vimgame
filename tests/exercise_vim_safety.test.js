// Exercise-safety guard.
//
// The game must never STEER a player toward a documented Vim divergence — i.e.
// suggest an action that real Vim allows but the simulator does something
// different/wrong with. Two invariants are enforced here:
//
//   1. TAUGHT PATHS ARE CLEAN: every challenge's canonical solution reaches the
//      target. (The same sequences are proven to match real Vim in
//      vim_equivalence.test.js, so a taught solution never depends on a
//      divergence — if it did, it would not reproduce the target here.)
//
//   2. ABSENT VIM IDIOMS ARE SAFE NO-OPS: the idiomatic-but-unimplemented Vim
//      moves a real-Vim user reaches for instinctively (visual mode, search,
//      word-search, substitute, macros) must leave the buffer byte-for-byte
//      UNCHANGED. They may print a status message or set a pending operator, but
//      they must never silently edit/corrupt text. So if a player tries one
//      because "that's the obvious Vim way", nothing wrong happens — they just
//      get no effect (and can pick the supported command instead).

function makeEl() {
    return { className: '', textContent: '', innerHTML: '', tabIndex: 0, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, focus() {} };
}
global.document = { getElementById() { return makeEl(); }, createElement() { return makeEl(); },
    addEventListener() {}, body: makeEl() };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    state, CHALLENGES, initChallenge, setMode, buffersMatch, handleKeyDown,
} = require('../script.js');
const { SOLUTIONS } = require('./canonical_solutions.js');

// Drive the global key dispatcher exactly like the browser would (routes
// command-line mode, text-object mode, insert mode, etc.).
function press(k) {
    handleKeyDown({ key: k, preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
}
const run = (tks) => { for (const t of tks) press(t); };

function load(name) {
    const i = CHALLENGES.findIndex((c) => c.name === name);
    assert.notEqual(i, -1, `challenge not found: ${name}`);
    initChallenge(i);
    setMode('normal');
    return i;
}
const snapshot = () => state.buffer.join('\n');

describe('exercise safety — taught paths are clean', () => {
    for (const name of Object.keys(SOLUTIONS)) {
        test(`"${name}" intended solution reaches the target (no divergence needed)`, () => {
            load(name);
            run(SOLUTIONS[name]);
            assert.ok(buffersMatch(), `"${name}" canonical solution did not reach target`);
        });
    }
});

describe('exercise safety — tempting-but-absent Vim idioms are safe no-ops', () => {
    // Each idiom is something a real-Vim user might instinctively try that the
    // simulator does not implement (visual mode, search, word-search, substitute,
    // macros). None may modify the buffer.
    const IDIOMS = [
        { name: 'visual-line + delete (V j d)', keys: ['V', 'j', 'd'] },
        { name: 'visual-char + delete (v l d)', keys: ['v', 'l', 'd'] },
        { name: 'block visual + delete (Ctrl-V ignored)', keys: ['\u0016', 'j', 'd'] },
        { name: 'word search forward (*)', keys: ['*'] },
        { name: 'word search backward (#)', keys: ['#'] },
        { name: 'search then jump (/ . <CR>)', keys: ['/', '.', 'Enter'] },
        { name: 'repeat search (n)', keys: ['n'] },
        { name: 'reverse repeat search (N)', keys: ['N'] },
        { name: 'substitute all (:%s/o/x/g)', keys: [':', '%', 's', '/', 'o', '/', 'x', '/', 'g', 'Enter'] },
        { name: 'macro record + stop (q q)', keys: ['q', 'q'] },
        { name: 'goto-and-repeat (G .)', keys: ['G', '.'] },
    ];

    for (const ch of CHALLENGES) {
        for (const idiom of IDIOMS) {
            test(`"${ch.name}": ${idiom.name} leaves the buffer unchanged`, () => {
                load(ch.name);
                const before = snapshot();
                run(idiom.keys);
                assert.equal(snapshot(), before,
                    `${idiom.name} silently modified "${ch.name}" buffer`);
            });
        }
    }
});
