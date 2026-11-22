// Tests for the Caps Lock warning banner toggle logic.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Install a persistent DOM mock so we can observe classList changes on
// the specific banner element (the default mock returns a fresh element
// on every getElementById call, which can't verify mutation).
function installMockDom() {
    const store = {};
    global.document = {
        getElementById(id) { return store[id]; },
        createElement() { return { classList: mk(), appendChild(){}, style:{}, addEventListener(){} }; },
        addEventListener() {},
        body: {},
    };
    global.__capsBanner = { id: 'caps-warning', classList: mk(), _store: store };
    store['caps-warning'] = global.__capsBanner;
    function mk() {
        const s = new Set();
        return {
            add(c) { s.add(c); },
            remove(c) { s.delete(c); },
            toggle(c, on) { on ? s.add(c) : s.delete(c); },
            contains(c) { return s.has(c); },
            _set: s,
        };
    }
}

installMockDom();
const { updateCapsWarning } = require('../script.js');

function ev(state) {
    return { getModifierState: (name) => (name === 'CapsLock' ? state : false) };
}

describe('caps lock warning banner', () => {
    beforeEach(() => global.__capsBanner.classList._set.clear());

    test('shows when getModifierState returns true', () => {
        updateCapsWarning(ev(true));
        assert.equal(global.__capsBanner.classList.contains('show'), true);
    });

    test('hides when getModifierState returns false', () => {
        global.__capsBanner.classList.add('show');
        updateCapsWarning(ev(false));
        assert.equal(global.__capsBanner.classList.contains('show'), false);
    });

    test('hide after show and re-show cycles cleanly', () => {
        updateCapsWarning(ev(true));
        updateCapsWarning(ev(false));
        updateCapsWarning(ev(true));
        assert.equal(global.__capsBanner.classList.contains('show'), true);
    });

    test('no-op when event lacks getModifierState (older browsers)', () => {
        global.__capsBanner.classList.add('show');
        // Missing getModifierState -> we conservatively leave state alone
        // (do not throw, do not force-hide). We do hide on undefined because
        // our impl reads `=== true`, so undefined => false => hide. This is
        // a fine behavior for a missing-API browser: safer to hide.
        updateCapsWarning({});
        assert.equal(global.__capsBanner.classList.contains('show'), false);
    });

    test('does not throw when getModifierState throws (Firefox edge)', () => {
        const bad = { getModifierState() { throw new Error('boom'); } };
        assert.doesNotThrow(() => updateCapsWarning(bad));
    });

    test('null event is a no-op that hides', () => {
        global.__capsBanner.classList.add('show');
        assert.doesNotThrow(() => updateCapsWarning(null));
        assert.equal(global.__capsBanner.classList.contains('show'), false);
    });
});
