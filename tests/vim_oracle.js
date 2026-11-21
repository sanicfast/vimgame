'use strict';
// Driver for the real-Vim (Neovim) oracle used by vim_equivalence.test.js.
// Spawns `nvim --headless` running vim_oracle.lua against a start buffer and a
// Normal-mode key sequence, and returns the resulting buffer lines.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Returns true if `nvim` is available on PATH.
function findNvim() {
    const probe = spawnSync('nvim', ['--version'], { encoding: 'utf8' });
    return !probe.error && probe.status === 0;
}

// Map the token arrays used by the simulator tests to a Vim Normal-mode key
// string. Single characters pass through; the named keys become control bytes.
const CONTROL = { Escape: '\u001b', Enter: '\r', Backspace: '\b', Tab: '\t', Space: ' ' };
function tokensToVimKeys(tokens) {
    return tokens.map((t) => (CONTROL[t] != null ? CONTROL[t] : t)).join('');
}

// Run `tokens` against `startLines` in real Vim; return the resulting lines.
// `cursor` is an optional 0-based { row, col } to place before applying keys.
function runVim(startLines, tokens, cursor) {
    const keys = tokensToVimKeys(tokens);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vimgame-vim-'));
    const jobPath = path.join(tmp, 'job.json');
    const driver = path.join(__dirname, 'vim_oracle.lua');
    fs.writeFileSync(jobPath, JSON.stringify({ startLines, keys, cursor }));
    const args = ['--headless', '-u', 'NONE', '-n', '-i', 'NONE', '-l', driver, jobPath];
    const res = spawnSync('nvim', args, { encoding: 'utf8' });
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    if (res.error) throw new Error('failed to run nvim: ' + res.error.message);
    if (res.status !== 0) {
        throw new Error(`nvim exited ${res.status}\nstderr: ${res.stderr}\nstdout: ${res.stdout}`);
    }
    const out = res.stdout.trim();
    try {
        return JSON.parse(out);
    } catch (e) {
        throw new Error(`unparseable nvim output ${JSON.stringify(out)}: ${e.message}`);
    }
}

// Normalize buffer lines for comparison between the two engines:
//   * drop trailing whitespace on each line (engines may differ on trailing cols)
//   * drop trailing blank lines (the simulator pads to a fixed row count; Vim ends
//     at the last real line). Interior blank lines are preserved.
function normalize(lines) {
    const t = lines.map((s) => s.replace(/[ \t]+$/, ''));
    while (t.length && t[t.length - 1] === '') t.pop();
    return t;
}

module.exports = { findNvim, runVim, normalize, tokensToVimKeys };
