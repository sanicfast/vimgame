// ============================================================
// VIM SIMULATOR — Core Engine
// Architecture: mode state machine with operator-pending support
// ============================================================

const ROWS = 20;
const COLS = 80;

// --- Challenge Data ---
// Each challenge provides a `start` buffer (what the player sees) and a `target`
// buffer (the text they must produce with vim motions). Lines are padded to ROWS
// automatically by initChallenge().
const CHALLENGES = [
    {
        name: 'Open a New Line',
        hint: 'o opens a line below and drops you into insert mode — type the new line, then Esc',
        start: [
            'alpha',
            'omega',
        ],
        target: [
            'alpha',
            'beta',
            'omega',
        ],
    },
    {
        name: 'Close the Calls',
        hint: 'A appends at end of line — type ")" to close each call, then j and . to repeat',
        start: [
            'print("bye',
            'log("hi',
        ],
        target: [
            'print("bye")',
            'log("hi")',
        ],
    },
    {
        name: 'Add Semicolons',
        hint: 'A appends at the end of a line — type ; then Esc, then j and . to repeat it on every line',
        start: [
            'let a = 1',
            'let b = 2',
            'let c = 3',
        ],
        target: [
            'let a = 1;',
            'let b = 2;',
            'let c = 3;',
        ],
    },
    {
        name: 'Make It a List',
        hint: 'I inserts at the first non-blank — type "- " then Esc, then j and . to bullet each line',
        start: [
            '  one',
            '  two',
            '  three',
        ],
        target: [
            '  - one',
            '  - two',
            '  - three',
        ],
    },
    {
        name: 'Duplicate the Line',
        hint: 'yy copies the whole line (yank), then p pastes a duplicate just below it',
        start: [
            'first',
            'second',
            'third',
        ],
        target: [
            'first',
            'first',
            'second',
            'third',
        ],
    },
    {
        name: 'Swap Two Characters',
        hint: 'Stand on the wrong char: x cuts it, p pastes it after the next one — fixes teh->the',
        start: [
            'teh cat',
            'mroe time',
        ],
        target: [
            'the cat',
            'more time',
        ],
    },
    {
        name: 'Fix the Typo',
        hint: 'r replaces the char under the cursor — f: finds the colon, r; swaps it for ;, j then . repeats',
        start: [
            'x = 1:',
            'y = 2:',
        ],
        target: [
            'x = 1;',
            'y = 2;',
        ],
    },
    {
        name: 'Rewrite the Lines',
        hint: 'cc wipes a whole line and lets you retype it — Esc, then j and . to rewrite the next one too',
        start: [
            'TODO fix',
            'TODO clean',
        ],
        target: [
            '// done',
            '// done',
        ],
    },
    {
        name: 'Reword the Comment',
        hint: 'cc wipes and retypes a whole line — do it on each line (they differ, so no repeat needed)',
        start: [
            '# compute result',
            '# build data',
        ],
        target: [
            '# calculate total',
            '# assemble input',
        ],
    },
    {
        name: 'Delete Two Words',
        hint: '2dw deletes two words at once — then j and . to do the same thing on the next line',
        start: [
            'alpha beta gamma',
            'delta eps zeta',
        ],
        target: [
            'gamma',
            'zeta',
        ],
    },
    {
        name: 'Remove the Dots',
        hint: 'f. jumps to the next dot, x deletes it, and ; hops to the following one — repeat till clean',
        start: [
            'd.o.g.',
            'c.a.t.',
        ],
        target: [
            'dog',
            'cat',
        ],
    },
    {
        name: 'Swap Two Lines',
        hint: 'dd cuts the line and p pastes it below the next one — together, ddp swaps two lines',
        start: [
            'let b = 2;',
            'let a = 1;',
            'console.log(a + b);',
        ],
        target: [
            'let a = 1;',
            'let b = 2;',
            'console.log(a + b);',
        ],
    },
    {
        name: 'Delete the Dead Code',
        hint: 'dd deletes a line, 2dd deletes two — remove the commented-out lines',
        start: [
            'function add(a, b) {',
            '  // return a - b;',
            '  // old buggy version',
            '  return a + b;',
            '  // debug only',
            '}',
        ],
        target: [
            'function add(a, b) {',
            '  return a + b;',
            '}',
        ],
    },
    {
        name: 'Set Every Value',
        hint: 'ci( changes just the text inside the parentheses — type a value, then j and . to repeat below',
        start: [
            'setValue(0)',
            'setValue(0)',
            'setValue(0)',
            'setValue(0)',
        ],
        target: [
            'setValue(42)',
            'setValue(42)',
            'setValue(42)',
            'setValue(42)',
        ],
    },
    {
        name: 'Fill the Quotes',
        hint: 'f" jumps to the quote, l steps onto the closing one, i lets you type between them',
        start: [
            'name = ""',
            'city = ""',
        ],
        target: [
            'name = "alice"',
            'city = "bob"',
        ],
    },
    {
        name: 'Empty the Containers',
        hint: 'put the cursor on a bracket, then di[ / di{ / di( wipes everything inside it',
        start: [
            'let coords = [1, 2, 3];',
            'let point = {x: 0, y: 0};',
            'let wrapped = (old value);',
        ],
        target: [
            'let coords = [];',
            'let point = {};',
            'let wrapped = ();',
        ],
    },
    {
        name: 'Trim the Tail',
        hint: 'f| jumps to the | delimiter and d$ deletes from there to the end of the line',
        start: [
            'apple|12345',
            'banana|6789',
            'cherry|24680',
        ],
        target: [
            'apple',
            'banana',
            'cherry',
        ],
    },
    {
        name: 'Open Above',
        hint: 'O opens a line ABOVE the cursor (o opens below) — type a header, Esc, then do the next line',
        start: [
            'sum = 0',
            'total = 0',
        ],
        target: [
            '// init',
            'sum = 0',
            '// init',
            'total = 0',
        ],
    },
    {
        name: 'Change a Word',
        hint: 'cw erases from the cursor to the end of the word — type the new word, then 0 and . on the next line',
        start: [
            'enable cache',
            'enable logging',
        ],
        target: [
            'disable cache',
            'disable logging',
        ],
    },
    {
        name: 'Substitute a Letter',
        hint: 's deletes the char under the cursor and starts typing — s then - overwrites +, then . repeats below',
        start: [
            '+12',
            '+34',
        ],
        target: [
            '-12',
            '-34',
        ],
    },
    {
        name: 'Drop the Parenthetical',
        hint: 'D deletes from the cursor to end of line — f( then h onto the space, then D drops the rest',
        start: [
            'Total (incl tax)',
            'Size (in pixels)',
        ],
        target: [
            'Total',
            'Size',
        ],
    },
    {
        name: 'Inside the Quotes',
        hint: 'ci" changes just the text inside the quotes — type it, Esc, then repeat on the next line',
        start: [
            'msg = ""',
            'tag = ""',
        ],
        target: [
            'msg = "hi"',
            'tag = "ok"',
        ],
    },
    {
        name: 'Drop the Argument',
        hint: '% jumps to the matching bracket — stand on ( and type d% to delete the whole group',
        start: [
            'sum(filter(data))',
            'max(items)',
        ],
        target: [
            'sum',
            'max',
        ],
    },
    {
        name: 'Indent This',
        hint: '>> indents the current line — j down then . to indent each line of the body',
        start: [
            'if ready:',
            'go()',
            'wait()',
            'stop()',
        ],
        target: [
            'if ready:',
            '  go()',
            '  wait()',
            '  stop()',
        ],
    },
    {
        name: 'Around the Word',
        hint: 'daw deletes a whole word plus the space around it — then j and . to do the next line',
        start: [
            'the quick fox',
            'the lazy dog',
        ],
        target: [
            'quick fox',
            'lazy dog',
        ],
    },
    {
        name: 'Fix the Bugs',
        hint: 'three bugs to fix — an off-by-one, a missing slice, and a string that wants backticks',
        start: [
            'function fibonacci(n) {',
            '  if (n <= 0) return n;',
            '  return fibonacci(n - 1) + fibonacci(n - 2);',
            '}',
            '',
            'const result = fibonacci(10);',
            "console.log('fib(10) = ' + result);",
            '',
            '// TODO: implement memoization',
            '',
            'function quickSort(arr) {',
            '  if (arr.length <= 1) return arr;',
            '  const pivot = arr[0];',
            '  const left = arr.filter(x => x < pivot);',
            '  const right = arr.filter(x => x >= pivot);',
            '  return [...quickSort(left), pivot, ...quickSort(right)];',
            '}',
            '',
            'console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));',
        ],
        target: [
            'function fibonacci(n) {',
            '  if (n <= 1) return n;',
            '  return fibonacci(n - 1) + fibonacci(n - 2);',
            '}',
            '',
            'const result = fibonacci(10);',
            'console.log(`fib(10) = ${result}`);',
            '',
            '// TODO: implement memoization',
            '// TODO: add input validation',
            'function quickSort(arr) {',
            '  if (arr.length <= 1) return arr;',
            '  const pivot = arr[0];',
            '  const left = arr.slice(1).filter(x => x < pivot);',
            '  const right = arr.slice(1).filter(x => x >= pivot);',
            '  return [...quickSort(left), pivot, ...quickSort(right)];',
            '}',
            '',
            'console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));',
        ],
    },
    {
        name: 'Rename & Refactor',
        hint: 'ciw changes the whole word under the cursor — use it to rename fibonacci→fib and result→output',
        start: [
            'function fibonacci(n) {',
            '  if (n <= 1) return n;',
            '  return fibonacci(n - 1) + fibonacci(n - 2);',
            '}',
            '',
            'const result = fibonacci(10);',
            'console.log(`fib(10) = ${result}`);',
            '',
            '// TODO: implement memoization',
            '// TODO: add input validation',
            'function quickSort(arr) {',
            '  if (arr.length <= 1) return arr;',
            '  const pivot = arr[0];',
            '  const left = arr.slice(1).filter(x => x < pivot);',
            '  const right = arr.slice(1).filter(x => x >= pivot);',
            '  return [...quickSort(left), pivot, ...quickSort(right)];',
            '}',
            '',
            'console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));',
        ],
        target: [
            'function fib(n) {',
            '  if (n <= 1) return n;',
            '  return fib(n - 1) + fib(n - 2);',
            '}',
            '',
            'const output = fib(10);',
            'console.log(`fib(10) = ${output}`);',
            '',
            '// TODO: implement memoization',
            '// TODO: add input validation',
            'function quickSort(arr) {',
            '  if (arr.length <= 1) return arr;',
            '  const pivot = arr[0];',
            '  const left = arr.slice(1).filter(x => x < pivot);',
            '  const right = arr.slice(1).filter(x => x >= pivot);',
            '  return [...quickSort(left), pivot, ...quickSort(right)];',
            '}',
            '',
            'console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));',
        ],
    },
];

// --- State ---
const state = {
    buffer: [],
    cursor: { row: 0, col: 0 },
    mode: 'normal',        // 'normal' | 'insert' | 'operator-pending' | 'pending-text-object'
    pendingOperator: null, // 'd' | 'c' | 'y' | null — for future operators
    pendingTextObject: null, // 'i' | 'a' — set while waiting for object char (e.g. 'w')
    pendingG: false,         // true while waiting for the 2nd key of gg/ge/gE (kept out of inputBuffer so a count can coexist)
    pendingFind: null,       // { motion, count } while waiting for the find char of f/F/t/T
    pendingReplace: null,    // count (number) while waiting for the replacement char of r
    lastFind: null,          // { motion, char } of the last f/F/t/T (used by ; and ,)
    commandMode: false,      // true while typing a `:` command-line
    commandInput: '',        // buffer for the `:` command being typed
    register: { text: null, linewise: false }, // unnamed register
    undoStack: [],         // array of { buffer, cursor } snapshots
    redoStack: [],         // array of { buffer, cursor } snapshots
    insertTouched: false,  // tracks whether current insert session has mutated buffer (so it's one undo unit)
    lastChange: null,      // shape varies by kind — see repeatLastChange() for the cases
    pendingInsertRecord: null, // for `i`/`a` sessions: gets promoted to lastChange on first keystroke
    statusMsg: '',
    inputBuffer: '',       // accumulates keys for multi-key commands
    targetBuffer: [],      // the reference text the player must match
    currentChallenge: 0,   // index into CHALLENGES
};

// --- Initialize Buffer ---
function initBuffer() {
    const lines = [
        'function fibonacci(n) {',
        '  if (n <= 1) return n;',
        '  return fibonacci(n - 1) + fibonacci(n - 2);',
        '}',
        '',
        'const result = fibonacci(10);',
        'console.log(`fib(10) = ${result}`);',
        '',
        '// TODO: implement memoization',
        '// TODO: add input validation',
        'function quickSort(arr) {',
        '  if (arr.length <= 1) return arr;',
        '  const pivot = arr[0];',
        '  const left = arr.slice(1).filter(x => x < pivot);',
        '  const right = arr.slice(1).filter(x => x >= pivot);',
        '  return [...quickSort(left), pivot, ...quickSort(right)];',
        '}',
        '',
        'console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));',
    ];
    state.buffer = [];
    for (let i = 0; i < ROWS; i++) {
        state.buffer[i] = lines[i] || '';
    }
}

// --- Challenge / Target Buffer ---
function initChallenge(index) {
    const ch = CHALLENGES[index] || CHALLENGES[0];
    state.currentChallenge = index;
    state.buffer = [];
    state.targetBuffer = [];
    for (let i = 0; i < ROWS; i++) {
        state.buffer[i] = (ch.start[i] || '').slice(0, COLS);
        state.targetBuffer[i] = (ch.target[i] || '').slice(0, COLS);
    }
    state.cursor = { row: 0, col: 0 };
    state.undoStack = [];
    state.redoStack = [];
    state.lastChange = null;
    state.register = { text: null, linewise: false };
    state.lastFind = null;
    state.pendingReplace = null;
    state.statusMsg = ch.hint;
}

// Compare active buffer to target cell-by-cell.
// Returns { grid: string[][], matchCount, totalCells }
// grid[r][c] = 'match' | 'diff'
function computeDiff() {
    const grid = [];
    let matchCount = 0;
    let totalCells = 0;
    for (let r = 0; r < ROWS; r++) {
        const aLine = state.buffer[r] || '';
        const tLine = state.targetBuffer[r] || '';
        const rowDiff = [];
        const maxLen = Math.max(aLine.length, tLine.length);
        for (let c = 0; c < COLS; c++) {
            if (c >= maxLen) {
                rowDiff.push('empty');
            } else {
                totalCells++;
                const aCh = c < aLine.length ? aLine[c] : '';
                const tCh = c < tLine.length ? tLine[c] : '';
                if (aCh === tCh) {
                    rowDiff.push('match');
                    matchCount++;
                } else {
                    rowDiff.push('diff');
                }
            }
        }
        grid.push(rowDiff);
    }
    return { grid, matchCount, totalCells };
}

// Quick check: does the active buffer exactly match the target?
function buffersMatch() {
    for (let r = 0; r < ROWS; r++) {
        if ((state.buffer[r] || '') !== (state.targetBuffer[r] || '')) return false;
    }
    return true;
}

// --- Utilities ---
function isWordChar(ch) {
    return /[a-zA-Z0-9_]/.test(ch);
}

function endOfLine(row) {
    return Math.max(0, (state.buffer[row] || '').length - 1);
}

function lastNonEmptyRow() {
    for (let r = ROWS - 1; r >= 0; r--) {
        if ((state.buffer[r] || '').length > 0) return r;
    }
    return 0;
}

function firstNonBlank(row) {
    const line = state.buffer[row] || '';
    const match = line.match(/\S/);
    return match ? match.index : 0;
}

function clampCursor() {
    const c = state.cursor;
    c.row = Math.max(0, Math.min(ROWS - 1, c.row));
    const line = state.buffer[c.row] || '';
    const maxCol = state.mode === 'insert' ? line.length : Math.max(0, line.length - 1);
    c.col = Math.max(0, Math.min(maxCol, c.col));
}

// Fixed-grid invariant helper: a line may never exceed COLS columns. Any edit
// that concatenates text (charwise joins, paste) runs its result through this so
// nothing can spill past the visible grid. Overflow characters are dropped
// (arcade rule: nothing goes off-screen; this intentionally differs from vim,
// which keeps the full untruncated line). See VIM_DIFFERENCES.md.
function clipCols(s) {
    return s.length > COLS ? s.slice(0, COLS) : s;
}

// --- Movement Functions (pure — return new pos, ready for operator ranges) ---

function flattenBuffer() {
    const result = [];
    for (let r = 0; r < ROWS; r++) {
        const line = state.buffer[r] || '';
        for (let c = 0; c < line.length; c++) {
            result.push({ row: r, col: c, ch: line[c] });
        }
        if (r < ROWS - 1) {
            result.push({ row: r, col: line.length, ch: '\n' });
        }
    }
    return result;
}

function posToIndex(row, col) {
    let idx = 0;
    for (let r = 0; r < row; r++) {
        idx += (state.buffer[r] || '').length + 1;
    }
    return idx + col;
}

function moveToNextWord(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx + 1 >= flat.length) return { row: cur.row, col: cur.col };
    let idx = curIdx + 1;

    // Classify the char at the cursor: 'ws' | 'word' | 'punct'
    const curCh = flat[curIdx].ch;
    const curCls = isWhitespaceCh(curCh) ? 'ws' : (isWordChar(curCh) ? 'word' : 'punct');

    // If the cursor sits inside a word/punct token, skip past the rest of it.
    // Stops at whitespace OR at a class change (e.g. word -> punct boundary like 'foo,').
    if (curCls !== 'ws') {
        while (idx < flat.length) {
            const ch = flat[idx].ch;
            if (isWhitespaceCh(ch)) break;
            const cls = isWordChar(ch) ? 'word' : 'punct';
            if (cls !== curCls) break;
            idx++;
        }
    }
    // Then skip whitespace (spaces + newlines) to land at the start of the next token.
    while (idx < flat.length && isWhitespaceCh(flat[idx].ch)) idx++;
    // No next token exists — vim keeps the cursor where it is.
    if (idx >= flat.length) return { row: cur.row, col: cur.col };
    return { row: flat[idx].row, col: flat[idx].col };
}

function moveToPrevWord(cur) {
    const flat = flattenBuffer();
    let idx = posToIndex(cur.row, cur.col) - 1;
    if (idx < 0) return { row: 0, col: 0 };

    // skip whitespace backwards
    while (idx >= 0 && (flat[idx].ch === ' ' || flat[idx].ch === '\n')) idx--;
    if (idx < 0) return { row: 0, col: 0 };

    // go to start of word/punct block
    const type = isWordChar(flat[idx].ch) ? 'word' : 'punct';
    while (idx > 0) {
        const prev = flat[idx - 1].ch;
        if (prev === ' ' || prev === '\n') break;
        if (type === 'word' && !isWordChar(prev)) break;
        if (type === 'punct' && isWordChar(prev)) break;
        idx--;
    }
    return { row: flat[idx].row, col: flat[idx].col };
}

// WORD motions: a "WORD" is any contiguous run of non-whitespace.
// W jumps to the start of the next WORD; B jumps to the start of the previous WORD.
function isWhitespaceCh(ch) {
    return ch === ' ' || ch === '\n' || ch === '\t';
}

function moveToNextBigWord(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx + 1 >= flat.length) return { row: cur.row, col: cur.col };
    let idx = curIdx + 1;

    // If cursor is inside a WORD (non-whitespace), skip the rest of this WORD first.
    // If cursor is on whitespace, jump straight to next WORD start.
    const curCh = flat[curIdx].ch;
    if (!isWhitespaceCh(curCh)) {
        while (idx < flat.length && !isWhitespaceCh(flat[idx].ch)) idx++;
    }
    // Then skip whitespace to land at the next WORD start.
    while (idx < flat.length && isWhitespaceCh(flat[idx].ch)) idx++;
    // No next WORD exists — vim keeps the cursor where it is.
    if (idx >= flat.length) return { row: cur.row, col: cur.col };
    return { row: flat[idx].row, col: flat[idx].col };
}

function moveToPrevBigWord(cur) {
    const flat = flattenBuffer();
    let idx = posToIndex(cur.row, cur.col) - 1;
    if (idx < 0) return { row: 0, col: 0 };

    // Skip whitespace backwards
    while (idx >= 0 && isWhitespaceCh(flat[idx].ch)) idx--;
    if (idx < 0) return { row: 0, col: 0 };

    // Walk back to the start of this WORD
    while (idx > 0 && !isWhitespaceCh(flat[idx - 1].ch)) idx--;
    return { row: flat[idx].row, col: flat[idx].col };
}

// e / E: forward to the END of a word / WORD (inclusive motion). If the cursor
// is mid-token, land on the last char of the current token. If the cursor is
// already at the end of a token (or on whitespace), advance to the next token
// and land on its last char.
function moveToNextWordEnd(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx + 1 >= flat.length) return { row: cur.row, col: cur.col };

    const classify = (ch) =>
        isWhitespaceCh(ch) ? 'ws' : (isWordChar(ch) ? 'word' : 'punct');

    // Walk forward from startIdx through chars of the same class; return idx
    // of the last char of that token block.
    const tokenEnd = (startIdx, cls) => {
        let i = startIdx;
        while (i + 1 < flat.length && classify(flat[i + 1].ch) === cls) i++;
        return i;
    };

    const curCls = classify(flat[curIdx].ch);
    if (curCls !== 'ws' && classify(flat[curIdx + 1].ch) === curCls) {
        const endIdx = tokenEnd(curIdx, curCls);
        return { row: flat[endIdx].row, col: flat[endIdx].col };
    }
    // At token boundary or on whitespace: advance to next non-ws token, then
    // walk to its last char.
    let idx = curIdx + 1;
    while (idx < flat.length && isWhitespaceCh(flat[idx].ch)) idx++;
    if (idx >= flat.length) return { row: cur.row, col: cur.col };
    const endIdx = tokenEnd(idx, classify(flat[idx].ch));
    return { row: flat[endIdx].row, col: flat[endIdx].col };
}

function moveToNextBigWordEnd(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx + 1 >= flat.length) return { row: cur.row, col: cur.col };

    const wordEnd = (startIdx) => {
        let i = startIdx;
        while (i + 1 < flat.length && !isWhitespaceCh(flat[i + 1].ch)) i++;
        return i;
    };

    const curCh = flat[curIdx].ch;
    if (!isWhitespaceCh(curCh) && !isWhitespaceCh(flat[curIdx + 1].ch)) {
        const endIdx = wordEnd(curIdx);
        return { row: flat[endIdx].row, col: flat[endIdx].col };
    }
    let idx = curIdx + 1;
    while (idx < flat.length && isWhitespaceCh(flat[idx].ch)) idx++;
    if (idx >= flat.length) return { row: cur.row, col: cur.col };
    const endIdx = wordEnd(idx);
    return { row: flat[endIdx].row, col: flat[endIdx].col };
}

// ge / gE: backward to the END of the previous word / WORD (inclusive).
// Walks backward looking for the previous "word-end position", where a
// word-end at i means flat[i] is non-whitespace and flat[i+1] is either
// whitespace, a different class (for ge), or end-of-buffer.
function moveToPrevWordEnd(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx < 1) return { row: cur.row, col: cur.col };

    const clsAt = (i) => {
        if (i >= flat.length) return 'ws'; // end-of-buffer behaves like ws boundary
        const c = flat[i].ch;
        return isWhitespaceCh(c) ? 'ws' : (isWordChar(c) ? 'word' : 'punct');
    };

    let i = curIdx - 1;
    while (i >= 0) {
        if (clsAt(i) === 'ws') { i--; continue; }
        // flat[i] is non-ws. Is it a word-end? Only if next is ws or different class.
        if (clsAt(i + 1) !== clsAt(i)) return { row: flat[i].row, col: flat[i].col };
        // Mid-token: walk to the start of this token, then step past it.
        while (i > 0 && clsAt(i - 1) === clsAt(i)) i--;
        i--;
    }
    return { row: cur.row, col: cur.col };
}

function moveToPrevBigWordEnd(cur) {
    const flat = flattenBuffer();
    const curIdx = posToIndex(cur.row, cur.col);
    if (curIdx < 1) return { row: cur.row, col: cur.col };

    const nonWs = (i) => i < flat.length && !isWhitespaceCh(flat[i].ch);

    let i = curIdx - 1;
    while (i >= 0) {
        if (!nonWs(i)) { i--; continue; }
        // WORD-end iff next position is ws (or end-of-buffer).
        if (!nonWs(i + 1)) return { row: flat[i].row, col: flat[i].col };
        // mid-WORD: walk to WORD start, then step past it.
        while (i > 0 && nonWs(i - 1)) i--;
        i--;
    }
    return { row: cur.row, col: cur.col };
}

// --- Mode Management ---
function setMode(mode) {
    state.mode = mode;
    state.pendingOperator = null;
    state.pendingTextObject = null;
    state.pendingG = false;
    state.pendingFind = null;
    state.pendingReplace = null;
    state.inputBuffer = '';
    state.commandMode = false;
    state.commandInput = '';
    // Leaving insert without typing: discard the deferred insert record so `.` doesn't replay an empty no-op
    if (mode !== 'insert') state.pendingInsertRecord = null;
    updateModeDisplay();
}

function updateModeDisplay() {
    const badge = document.getElementById('mode-badge');
    let label;
    if (state.mode === 'operator-pending') {
        label = state.pendingOperator.toUpperCase() + ' pending';
    } else if (state.mode === 'pending-text-object') {
        label = state.pendingOperator.toUpperCase() + ' ' + state.pendingTextObject + ' ...';
    } else {
        label = state.mode.toUpperCase();
    }
    badge.textContent = label;
    badge.className = 'mode-badge ' +
        ((state.mode === 'operator-pending' || state.mode === 'pending-text-object') ? 'normal' : state.mode);
}

// --- Motion Metadata ---
// Each motion classified for operator range computation.
// "charwise" motions define a text span; "linewise" motions operate on whole lines.
const MOTION_INFO = {
    'h':  { dir: 'backward', inclusive: true,  linewise: false },
    'l':  { dir: 'forward',  inclusive: false, linewise: false },
    'w':  { dir: 'forward',  inclusive: false, linewise: false },
    'b':  { dir: 'backward', inclusive: true,  linewise: false },
    'W':  { dir: 'forward',  inclusive: false, linewise: false },
    'B':  { dir: 'backward', inclusive: true,  linewise: false },
    'e':  { dir: 'forward',  inclusive: true,  linewise: false },
    'E':  { dir: 'forward',  inclusive: true,  linewise: false },
    'ge': { dir: 'backward', inclusive: true,  linewise: false },
    'gE': { dir: 'backward', inclusive: true,  linewise: false },
    '0':  { dir: 'backward', inclusive: true,  linewise: false },
    '$':  { dir: 'forward',  inclusive: true,  linewise: false },
    'j':  { dir: 'forward',  inclusive: true,  linewise: true },
    'k':  { dir: 'backward', inclusive: true,  linewise: true },
    'gg': { dir: 'backward', inclusive: true,  linewise: true },
    'G':  { dir: 'forward',  inclusive: true,  linewise: true },
};

// --- Range Computation ---
// Given start position (before motion) and end position (after motion),
// compute the affected text range. Returns { linewise, startRow, endRow, startCol, endCol }.
// For charwise: [startRow.startCol .. endRow.endCol] inclusive.
// For linewise: whole rows from startRow to endRow.
// `op` is the pending operator ('d' | 'c' | 'y' | undefined). It only matters
// for the change + forward-word-motion case, where Vim drops the motion's
// trailing whitespace (cw ≡ ce). See VIM_DIFFERENCES.md §2.11.
function computeRange(motion, start, end, op) {
    // `%` is an inclusive motion spanning the two matching brackets on one line.
    // The jump may be forward or backward, so the span is order-independent. A
    // no-match repeat leaves start === end, which yields no range (nothing to do).
    if (motion === '%') {
        if (!end || start.row !== end.row || start.col === end.col) return null;
        return { linewise: false, startRow: start.row, endRow: start.row,
                 startCol: Math.min(start.col, end.col), endCol: Math.max(start.col, end.col) };
    }
    const info = MOTION_INFO[motion];
    if (!info) return null;

    if (info.linewise) {
        return {
            linewise: true,
            startRow: Math.min(start.row, end.row),
            endRow: Math.max(start.row, end.row),
        };
    }

    // Character-wise
    if (info.dir === 'forward') {
        // Vim: with the CHANGE operator, a forward word motion behaves like the
        // word-end motion (`cw` ≡ `ce`): it NEVER crosses a line break, drops the
        // motion's trailing whitespace when starting on a word (so `c2w` on
        // "one two three" changes "one two"), but keeps a whitespace run when the
        // cursor starts on whitespace (so `cw` on a space deletes the blank run).
        // See VIM_DIFFERENCES.md §2.11.
        if (op === 'c' && (motion === 'w' || motion === 'W')) {
            let cEnd = prevPos(end);                 // exclusive end -> inclusive
            const noAdvance = !cEnd || cEnd.row < start.row ||
                              (cEnd.row === start.row && cEnd.col < start.col);
            if (noAdvance) {
                // `w` reached no following word (line's only/last word): `cw` still
                // changes to the end of the current word / blank run on this line.
                const col = endOfWordInLine(start.row, start.col, motion === 'W');
                return { linewise: false, startRow: start.row, startCol: start.col,
                         endRow: start.row, endCol: col };
            }
            if (cEnd.row > start.row) {              // word reached a later line:
                const sLine = state.buffer[start.row] || '';
                cEnd = { row: start.row, col: Math.max(start.col, sLine.length - 1) };
            }
            const sCh = (state.buffer[start.row] || '')[start.col];
            const blankStart = (sCh === undefined || sCh === ' ' || sCh === '\t');
            if (!blankStart) cEnd = trimTrailingBlanks(start, cEnd);
            return { linewise: false, startRow: start.row, startCol: start.col,
                     endRow: cEnd.row, endCol: cEnd.col };
        }
        // Forward: from start to (end - 1) if exclusive, end if inclusive
        let endAdj;
        if (info.inclusive) {
            endAdj = end;
        } else if (end.col === 0 && end.row > start.row) {
            // Exclusive end sits at the start of a LATER line (e.g. `dw` whose
            // next word begins the next line). The motion spans the line break,
            // so the affected text must too. prevPos(end) would wrap the end back
            // onto the previous row and drop the newline; instead mark endCol -1
            // so deleteChars/changeChars join the lines (matches vim).
            endAdj = { row: end.row, col: -1 };
        } else {
            endAdj = prevPos(end);
        }
        if (!endAdj) return null; // would go before start
        // A no-op forward motion (e.g. `w` already at end of buffer) leaves
        // end === start; for an exclusive motion endAdj = prevPos(end) then
        // falls strictly before start, which would be a reversed span. No text
        // is affected, so report no range (mirrors vim affecting nothing).
        if (!info.inclusive &&
            (endAdj.row < start.row ||
             (endAdj.row === start.row && endAdj.col < start.col))) {
            return null;
        }
        return { linewise: false, startRow: start.row, startCol: start.col,
                 endRow: endAdj.row, endCol: endAdj.col };
    } else {
        // Backward inclusive: the deleted text is [dest, start-1].
        // (All current backward motions are inclusive; if a backward-exclusive
        // motion is ever added, start should be nextPos(end) instead.)
        const startAdj = info.inclusive ? end : nextPos(end);
        const endAdj = prevPos(start);
        if (!startAdj || !endAdj) return null;
        // Ensure order: startAdj should come before endAdj
        return { linewise: false, startRow: startAdj.row, startCol: startAdj.col,
                 endRow: endAdj.row, endCol: endAdj.col };
    }
}

// Helper: previous position in flattened text
function prevPos(pos) {
    if (pos.col > 0) return { row: pos.row, col: pos.col - 1 };
    if (pos.row > 0) {
        const prevLine = state.buffer[pos.row - 1] || '';
        if (prevLine.length === 0) return { row: pos.row - 1, col: 0 };
        return { row: pos.row - 1, col: prevLine.length - 1 };
    }
    return null;
}

// Helper: next position in flattened text
function nextPos(pos) {
    const line = state.buffer[pos.row] || '';
    if (pos.col < line.length - 1) return { row: pos.row, col: pos.col + 1 };
    if (pos.row < ROWS - 1) return { row: pos.row + 1, col: 0 };
    return null;
}

// Walk an inclusive end position back over a run of spaces/tabs, stopping at the
// first non-blank or at `start` (never before it). Used so `c` + a word motion
// excludes trailing whitespace, like Vim (cw ≡ ce). Returns { row, col }.
function trimTrailingBlanks(start, end) {
    let row = end.row, col = end.col;
    for (;;) {
        const line = state.buffer[row] || '';
        const ch = (col >= 0 && col < line.length) ? line[col] : null;
        if (ch !== ' ' && ch !== '\t') break; // non-blank (or OOB) → stop
        let prow, pcol;
        if (col > 0) { prow = row; pcol = col - 1; }
        else if (row > start.row) { prow = row - 1; pcol = (state.buffer[prow] || '').length - 1; }
        else break;
        if (prow < start.row || (prow === start.row && pcol < start.col)) break;
        row = prow; col = pcol;
    }
    return { row, col };
}

// Inclusive column of the end of the word (bigWord=WORD when true) that starts at
// (row, col) — or of the whitespace run when the cursor is on whitespace. Stays on
// the line. Used as the `c`+w fallback when there is no following word (so `cw`
// on a line's only/last word still changes to end-of-word). VIM_DIFFERENCES §2.11.
function endOfWordInLine(row, col, bigWord) {
    const line = state.buffer[row] || '';
    if (col >= line.length) return col; // at/after EOL
    const isBlank = ch => ch === ' ' || ch === '\t';
    if (isBlank(line[col])) {
        let i = col;
        while (i + 1 < line.length && isBlank(line[i + 1])) i++;
        return i; // last blank of the run
    }
    if (bigWord) {
        let i = col;
        while (i + 1 < line.length && !isBlank(line[i + 1])) i++;
        return i; // last non-space of the WORD
    }
    const wordish = ch => isWordChar(ch);
    const cls = wordish(line[col]) ? 1 : 0; // word run vs punctuation run
    let i = col;
    while (i + 1 < line.length && (wordish(line[i + 1]) ? 1 : 0) === cls) i++;
    return i; // last char of this word run
}

// --- Position comparison (a before or equal to b) ---
function posBeforeOrEqual(a, b) {
    if (a.row < b.row) return true;
    if (a.row > b.row) return false;
    return a.col <= b.col;
}

// --- Text Objects ---
// Text objects define a region directly (no motion traversal).
// Supported: iw / aw (word) and bracket blocks — inner (i) / a (a):
//   parens: i(  a(  i)  ab ; braces: i{  a{  i}  iB  aB ; brackets: i[  a[  i]
// All bracket objects are single-line, matching iw/aw (see VIM_DIFFERENCES.md).
function computeTextObjectRange(prefix, objChar) {
    if (prefix === 'i' && objChar === 'w') return innerWordRange();
    if (prefix === 'a' && objChar === 'w') return aWordRange();
    if (prefix === 'i' && objChar === 'W') return innerWORDRange();
    if (prefix === 'a' && objChar === 'W') return aWORDRange();
    if (objChar === '"' || objChar === "'" || objChar === '`') return quoteRange(prefix, objChar);
    const pair = bracketChars(objChar);
    if (pair) return bracketRange(prefix, pair.open, pair.close);
    return null;
}

// Classify char: 'word' (alnum + _), 'punct' (non-space non-word), 'space'
function charClass(ch) {
    if (ch === undefined || ch === '') return 'space';
    if (ch === ' ' || ch === '\t') return 'space';
    if (isWordChar(ch)) return 'word';
    return 'punct';
}

function innerWordRange() {
    const { row, col } = state.cursor;
    const line = state.buffer[row] || '';
    const cls = charClass(line[col]);
    if (cls === 'space') {
        // Cursor on whitespace: select the contiguous run of spaces
        let startCol = col;
        while (startCol > 0 && charClass(line[startCol - 1]) === 'space') startCol--;
        let endCol = col;
        while (endCol < line.length - 1 && charClass(line[endCol + 1]) === 'space') endCol++;
        return { linewise: false, startRow: row, startCol, endRow: row, endCol };
    }
    // Cursor on word or punct: extend to both directions within same class
    let startCol = col;
    while (startCol > 0 && charClass(line[startCol - 1]) === cls) startCol--;
    let endCol = col;
    while (endCol < line.length - 1 && charClass(line[endCol + 1]) === cls) endCol++;
    return { linewise: false, startRow: row, startCol, endRow: row, endCol };
}

function aWordRange() {
    // "a word" = inner word + surrounding whitespace (or trailing if no leading)
    const inner = innerWordRange();
    if (!inner) return null;
    const line = state.buffer[inner.startRow] || '';
    // Try to extend to whitespace after, then before
    let endCol = inner.endCol;
    while (endCol < line.length - 1 && charClass(line[endCol + 1]) === 'space') endCol++;
    if (endCol > inner.endCol) {
        return { ...inner, endCol };
    }
    // No trailing space — extend before
    let startCol = inner.startCol;
    while (startCol > 0 && charClass(line[startCol - 1]) === 'space') startCol--;
    return { ...inner, startCol };
}

// WORD text objects (iW / aW): delimited by whitespace only — punctuation is part of
// the WORD (unlike iw/aw which break on punctuation). Mirrors innerWordRange/aWordRange
// but uses "non-whitespace" as the unit. See VIM_DIFFERENCES.md §3.
function innerWORDRange() {
    const { row, col } = state.cursor;
    const line = state.buffer[row] || '';
    const onSpace = charClass(line[col]) === 'space';
    let startCol = col, endCol = col;
    if (onSpace) {
        while (startCol > 0 && charClass(line[startCol - 1]) === 'space') startCol--;
        while (endCol < line.length - 1 && charClass(line[endCol + 1]) === 'space') endCol++;
    } else {
        while (startCol > 0 && charClass(line[startCol - 1]) !== 'space') startCol--;
        while (endCol < line.length - 1 && charClass(line[endCol + 1]) !== 'space') endCol++;
    }
    return { linewise: false, startRow: row, startCol, endRow: row, endCol };
}

function aWORDRange() {
    // "a WORD" = inner WORD + surrounding whitespace (trailing preferred, else leading)
    const inner = innerWORDRange();
    if (!inner) return null;
    const line = state.buffer[inner.startRow] || '';
    let endCol = inner.endCol;
    while (endCol < line.length - 1 && charClass(line[endCol + 1]) === 'space') endCol++;
    if (endCol > inner.endCol) return { ...inner, endCol };
    let startCol = inner.startCol;
    while (startCol > 0 && charClass(line[startCol - 1]) === 'space') startCol--;
    return { ...inner, startCol };
}


// Map a text-object char to its bracket pair. Vim accepts several spellings for
// the same object: ( ) b are parens, { } B are braces, [ ] are square brackets.
function bracketChars(objChar) {
    if (objChar === '(' || objChar === ')' || objChar === 'b') return { open: '(', close: ')' };
    if (objChar === '{' || objChar === '}' || objChar === 'B') return { open: '{', close: '}' };
    if (objChar === '[' || objChar === ']') return { open: '[', close: ']' };
    if (objChar === '<' || objChar === '>') return { open: '<', close: '>' };
    return null;
}

// Index of the innermost unmatched opening bracket at or left of pos, or -1.
// Tracked `skip` lets a nested/earlier close consume its opener so we only land
// on the bracket that actually encloses `pos`.
function findOpenBracket(line, pos, openCh, closeCh) {
    let skip = 0;
    for (let i = pos; i >= 0; i--) {
        if (line[i] === closeCh) skip++;
        else if (line[i] === openCh) {
            if (skip === 0) return i;
            skip--;
        }
    }
    return -1;
}

// Index of the closing bracket matching the opener at openIdx (depth-balanced), or -1.
function findMatchedClose(line, openIdx, openCh, closeCh) {
    let depth = 0;
    for (let i = openIdx; i < line.length; i++) {
        if (line[i] === openCh) depth++;
        else if (line[i] === closeCh) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

// Index of the opener matching the closer at closeIdx (depth-balanced), or -1.
// Used when the cursor sits on a closing delimiter, where a plain left scan would
// treat that closer as needing its own opener and scan right past its pair.
function findMatchedOpen(line, closeIdx, openCh, closeCh) {
    let depth = 0;
    for (let i = closeIdx; i >= 0; i--) {
        if (line[i] === closeCh) depth++;
        else if (line[i] === openCh) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

// First complete bracket pair whose opener is at or after `from`, or null.
function findForwardPair(line, from, openCh, closeCh) {
    for (let i = from; i < line.length; i++) {
        if (line[i] === openCh) {
            const close = findMatchedClose(line, i, openCh, closeCh);
            if (close >= 0) return { open: i, close };
        }
    }
    return null;
}

// Charwise range for an inner (i) / a (a) bracket block on the cursor's line.
// Returns null when no matching pair exists on the line (operator then aborts).
function bracketRange(prefix, openCh, closeCh) {
    const { row, col } = state.cursor;
    const line = state.buffer[row] || '';
    // Enclosing pair. When the cursor is on a closing delimiter, match that closer
    // to its opener directly; otherwise find the innermost opener at/left of the
    // cursor whose matching close is at/right of the cursor (this also matches a
    // cursor sitting on the opening delimiter or strictly inside the pair).
    let open;
    let close;
    if (line[col] === closeCh) {
        close = col;
        open = findMatchedOpen(line, col, openCh, closeCh);
    } else {
        open = findOpenBracket(line, col, openCh, closeCh);
        close = open >= 0 ? findMatchedClose(line, open, openCh, closeCh) : -1;
    }
    if (open < 0 || close < col) {
        // Not inside a pair: use the next complete pair at/after the cursor, then
        // (like Vim) wrap to the earliest pair earlier on the line.
        const next = findForwardPair(line, col, openCh, closeCh) || findForwardPair(line, 0, openCh, closeCh);
        if (!next) return null;
        open = next.open;
        close = next.close;
    }
    if (prefix === 'i') {
        // Inner text between the delimiters (adjacent `()` yields an empty, no-op range).
        return { linewise: false, startRow: row, startCol: open + 1, endRow: row, endCol: close - 1 };
    }
    // 'a': the delimiters plus adjacent whitespace — prefer trailing, else leading.
    let aEnd = close;
    while (aEnd < line.length - 1 && charClass(line[aEnd + 1]) === 'space') aEnd++;
    if (aEnd > close) return { linewise: false, startRow: row, startCol: open, endRow: row, endCol: aEnd };
    let aStart = open;
    while (aStart > 0 && charClass(line[aStart - 1]) === 'space') aStart--;
    return { linewise: false, startRow: row, startCol: aStart, endRow: row, endCol: close };
}

// Charwise range for an inner (i) / a (a) quoted-string block on the cursor's line.
// Delimiters are symmetric (same char opens and closes): " ' and `. Quotes are paired
// consecutively along the line; the enclosing pair (o <= col <= c) wins, else — like
// bracketRange — the next pair at/after the cursor, then the earliest pair on the line.
// Returns null when no complete pair exists (operator aborts, as Vim's E20 does).
// Single-line only (no cross-line quote search), consistent with the rest of the object set.
function quoteRange(prefix, q) {
    const { row, col } = state.cursor;
    const line = state.buffer[row] || '';
    const idxs = [];
    for (let i = 0; i < line.length; i++) if (line[i] === q) idxs.push(i);
    const pairs = [];
    for (let k = 0; k + 1 < idxs.length; k += 2) pairs.push([idxs[k], idxs[k + 1]]);
    let pair = null;
    for (const [o, c] of pairs) { if (col >= o && col <= c) { pair = [o, c]; break; } }
    if (!pair) {
        for (const [o, c] of pairs) { if (o > col) { pair = [o, c]; break; } }   // forward
    }
    if (!pair && pairs.length) pair = pairs[0];                                   // wrap to first
    if (!pair) return null;
    const [o, c] = pair;
    if (prefix === 'i') {
        // Inner text between the quotes (adjacent `""` yields an empty, no-op range).
        return { linewise: false, startRow: row, startCol: o + 1, endRow: row, endCol: c - 1 };
    }
    // 'a': the quotes plus adjacent whitespace — prefer trailing, else leading.
    let aEnd = c;
    while (aEnd < line.length - 1 && charClass(line[aEnd + 1]) === 'space') aEnd++;
    if (aEnd > c) return { linewise: false, startRow: row, startCol: o, endRow: row, endCol: aEnd };
    let aStart = o;
    while (aStart > 0 && charClass(line[aStart - 1]) === 'space') aStart--;
    return { linewise: false, startRow: row, startCol: aStart, endRow: row, endCol: c };
}

// --- Match Bracket (`%`) ---
// Single-line bracket matching, consistent with the single-line text-object scope
// (see VIM_DIFFERENCES.md §2.1). `%` jumps between matching (), {}, []. When the
// cursor sits on a bracket, it goes to that bracket's mate; when it sits elsewhere,
// it scans forward on the line for the first bracket that has a match and jumps to
// that match's partner (like Vim's default forward search).
const OPEN_BRACKETS = { '(': ')', '{': '}', '[': ']' };
const CLOSE_BRACKETS = { ')': '(', '}': '{', ']': '[' };

function isBracketChar(ch) {
    return !!OPEN_BRACKETS[ch] || !!CLOSE_BRACKETS[ch];
}

// Index of the mate of the bracket at column i on `line`, or -1 if unbalanced.
function bracketMate(line, i) {
    const ch = line[i];
    if (OPEN_BRACKETS[ch]) return findMatchedClose(line, i, ch, OPEN_BRACKETS[ch]);
    if (CLOSE_BRACKETS[ch]) return findMatchedOpen(line, i, CLOSE_BRACKETS[ch], ch);
    return -1;
}

// Destination of `%` from the cursor: { row, col } of the matching bracket, or null
// when no match exists on the line.
function moveToMatchBracket(cur) {
    const row = cur.row;
    const line = state.buffer[row] || '';
    if (isBracketChar(line[cur.col])) {
        const m = bracketMate(line, cur.col);
        return m >= 0 ? { row, col: m } : null;
    }
    // Not on a bracket: scan forward for the first bracket that has a match.
    for (let i = cur.col + 1; i < line.length; i++) {
        if (isBracketChar(line[i])) {
            const m = bracketMate(line, i);
            if (m >= 0) return { row, col: m };
        }
    }
    return null;
}

// --- Find In Line (`f` / `F` / `t` / `T`) ---
// Single-line search motions (see VIM_DIFFERENCES.md). `motion` is 'f' (forward,
// land on the char), 'F' (backward, land on), 't' (forward, land just before),
// 'T' (backward, land just after). `count` selects the Nth occurrence. Returns the
// landing { row, col } or null when the Nth occurrence is not found.
// Mirror a find motion to its opposite direction (for the `,` command).
function mirrorFind(m) {
    return m === 'f' ? 'F' : m === 'F' ? 'f' : m === 't' ? 'T' : m === 'T' ? 't' : m;
}

function findInLine(cur, ch, motion, count) {
    const line = state.buffer[cur.row] || '';
    const forward = (motion === 'f' || motion === 't');
    const inclusive = (motion === 'f' || motion === 'F');
    const n = Math.max(1, count || 1);
    const step = forward ? 1 : -1;
    let hits = 0;
    let i = cur.col;
    while (i + step >= 0 && i + step < line.length) {
        i += step;
        if (line[i] === ch) {
            hits++;
            if (hits === n) {
                // Exclusive (t/T): land one step back toward the cursor.
                const col = inclusive ? i : i - step;
                return { row: cur.row, col };
            }
        }
    }
    return null;
}

// Inclusive single-line operator span for a find motion. Because the exclusive
// (t/T) landing is already one step off the found char, the delete span is simply
// forward → [start.col .. dest.col] or backward → [dest.col .. start.col-1].
function findOpRange(motion, start, dest) {
    if (!dest || start.row !== dest.row) return null;
    if (motion === 'f' || motion === 't') {
        if (dest.col < start.col) return null;
        return { linewise: false, startRow: start.row, startCol: start.col,
                 endRow: start.row, endCol: dest.col };
    }
    // backward (F / T)
    const endCol = start.col - 1;
    if (dest.col > endCol) return null;
    return { linewise: false, startRow: start.row, startCol: dest.col,
             endRow: start.row, endCol };
}

// Execute a find motion: plain jump, or apply the pending operator over its range.
function doFind(motion, count, ch) {
    const oldPos = { ...state.cursor };
    const dest = findInLine(state.cursor, ch, motion, count);
    if (!dest) {
        state.statusMsg = 'pattern not found: ' + ch;
        if (state.mode === 'operator-pending') setMode('normal');
        render();
        return;
    }
    if (state.mode === 'operator-pending') {
        if (state.pendingOperator === '>' || state.pendingOperator === '<' || state.pendingOperator === '=') {
            state.cursor = dest; clampCursor();
            applyIndent(state.pendingOperator, oldPos.row, oldPos.row); // find is single-line
            setMode('normal'); clampCursor(); render(); return;
        }
        const range = findOpRange(motion, oldPos, dest);
        state.cursor = dest;
        clampCursor();
        if (state.pendingOperator === 'd') {
            if (range) {
                applyDelete(range);
                state.lastChange = { kind: 'op-find', op: 'd', motion, char: ch, count };
            }
            setMode('normal');
        } else if (state.pendingOperator === 'c') {
            if (range) {
                applyChange(range);
                state.lastChange = { kind: 'op-find', op: 'c', motion, char: ch, count, typed: '' };
            } else {
                setMode('normal');
            }
        } else if (state.pendingOperator === 'y') {
            if (range) applyYank(range);
            state.cursor = oldPos;
            setMode('normal');
        }
        clampCursor();
        state.statusMsg = '';
        render();
    } else {
        state.cursor = dest;
        clampCursor();
        state.statusMsg = '';
        render();
    }
}

// --- Motion Destination (pure: just computes where a motion lands) ---
function motionDest(movement) {
    switch (movement) {
        case 'h': return { row: state.cursor.row, col: state.cursor.col - 1 };
        case 'l': return { row: state.cursor.row, col: state.cursor.col + 1 };
        case 'j': return { row: state.cursor.row + 1, col: state.cursor.col };
        case 'k': return { row: state.cursor.row - 1, col: state.cursor.col };
        case 'w': return moveToNextWord(state.cursor);
        case 'b': return moveToPrevWord(state.cursor);
        case 'W': return moveToNextBigWord(state.cursor);
        case 'B': return moveToPrevBigWord(state.cursor);
        case 'e': return moveToNextWordEnd(state.cursor);
        case 'E': return moveToNextBigWordEnd(state.cursor);
        case 'ge': return moveToPrevWordEnd(state.cursor);
        case 'gE': return moveToPrevBigWordEnd(state.cursor);
        case '0': return { row: state.cursor.row, col: 0 };
        case '$': return { row: state.cursor.row, col: endOfLine(state.cursor.row) };
        case 'gg': return { row: 0, col: firstNonBlank(0) };
        case 'G': return { row: lastNonEmptyRow(), col: firstNonBlank(lastNonEmptyRow()) };
        case '%': return moveToMatchBracket(state.cursor);
        default: return null;
    }
}

// --- Movement Execution (simple mode: no operator, just move) ---
function executeMovement(movement, destOverride) {
    const newPos = destOverride || motionDest(movement);
    if (!newPos) return;

    if (state.mode === 'operator-pending') {
        const oldPos = { ...state.cursor };
        state.cursor = newPos;
        clampCursor();
        // Indent operators shift the whole lines a motion spans (always linewise).
        if (state.pendingOperator === '>' || state.pendingOperator === '<' || state.pendingOperator === '=') {
            applyIndent(state.pendingOperator, Math.min(oldPos.row, newPos.row), Math.max(oldPos.row, newPos.row));
            setMode('normal'); clampCursor(); render(); return;
        }
        // Compute range and apply operator
        const range = computeRange(movement, oldPos, newPos, state.pendingOperator);
        if (state.pendingOperator === 'd') {
            if (range) {
                applyDelete(range);
                state.lastChange = { kind: 'op-motion', op: 'd', motion: movement, count: 1 };
            }
            setMode('normal');
        } else if (state.pendingOperator === 'c') {
            if (range) {
                applyChange(range);
                state.lastChange = { kind: 'op-motion', op: 'c', motion: movement, count: 1, typed: '' };
            } else {
                setMode('normal');
            }
        } else if (state.pendingOperator === 'y') {
            if (range) applyYank(range);
            state.cursor = oldPos; // yank leaves cursor at original position
            setMode('normal');
        }
        clampCursor();
        render();
    } else {
        state.cursor = newPos;
        clampCursor();
        render();
    }
}

// --- Range → Text (for register storage) ---
// For linewise: returns array of strings (the lines as-is, no trailing newline).
// For charwise: returns a single string (may include newlines for multi-line spans).
function getRangeText(range) {
    if (range.linewise) {
        const lines = [];
        for (let r = range.startRow; r <= range.endRow; r++) {
            lines.push(state.buffer[r] || '');
        }
        return lines;
    }
    const { startRow, startCol, endRow, endCol } = range;
    if (startRow === endRow) {
        return (state.buffer[startRow] || '').slice(startCol, endCol + 1);
    }
    const parts = [];
    parts.push((state.buffer[startRow] || '').slice(startCol));
    for (let r = startRow + 1; r < endRow; r++) parts.push(state.buffer[r] || '');
    parts.push((state.buffer[endRow] || '').slice(0, endCol + 1));
    return parts.join('\n');
}

function setRegister(text, linewise) {
    state.register = { text, linewise };
}

// --- Undo / Redo ---
// Snapshot-based. pushUndo() is called before any mutation; new mutations clear redo.
function pushUndo() {
    state.undoStack.push({
        buffer: [...state.buffer],
        cursor: { ...state.cursor },
    });
    if (state.undoStack.length > 200) state.undoStack.shift();
    state.redoStack = [];
}

function undo() {
    if (state.undoStack.length === 0) {
        state.statusMsg = 'nothing to undo';
        return;
    }
    state.redoStack.push({
        buffer: [...state.buffer],
        cursor: { ...state.cursor },
    });
    const prev = state.undoStack.pop();
    state.buffer = prev.buffer;
    state.cursor = prev.cursor;
    state.statusMsg = 'undo';
}

function redo() {
    if (state.redoStack.length === 0) {
        state.statusMsg = 'nothing to redo';
        return;
    }
    state.undoStack.push({
        buffer: [...state.buffer],
        cursor: { ...state.cursor },
    });
    const next = state.redoStack.pop();
    state.buffer = next.buffer;
    state.cursor = next.cursor;
    state.statusMsg = 'redo';
}

// Lazy push for insert mode: ensures an entire insert session is one undo unit.
function ensureInsertPushed() {
    if (!state.insertTouched) {
        pushUndo();
        state.insertTouched = true;
        // Promote pending insert record to lastChange so `.` can replay it
        if (state.pendingInsertRecord) {
            state.lastChange = state.pendingInsertRecord;
            state.pendingInsertRecord = null;
        }
    }
}


// --- Repeat Last Change (`.`) ---
// Replays the previously recorded mutation at the current cursor. One repeat = one undo unit.
function repeatLastChange(repeatCount) {
    if (!state.lastChange) {
        state.statusMsg = 'nothing to repeat';
        render();
        return;
    }
    for (let r = 0; r < repeatCount; r++) {
        doRepeatOnce(state.lastChange);
    }
    clampCursor();
    render();
}

function doRepeatOnce(rec) {
    const c = state.cursor;
    const t = rec.typed || '';

    switch (rec.kind) {
        case 'op-find': {
            // Re-run the find motion at the current cursor, then apply the operator.
            const dest = findInLine(c, rec.char, rec.motion, rec.count || 1);
            if (!dest) return;
            const range = findOpRange(rec.motion, c, dest);
            if (!range) return;
            state.cursor = dest;
            clampCursor();
            if (rec.op === 'd') {
                applyDelete(range);
            } else if (rec.op === 'c') {
                applyChange(range);
                insertRecordedText(rec.typed || '');
            }
            break;
        }
        case 'op-motion': {
            // Walk through motion `count` times, compute range, apply operator
            const oldPos = { ...c };
            const reps = rec.count || 1;
            for (let i = 0; i < reps; i++) {
                const dest = motionDest(rec.motion);
                if (!dest) break;
                state.cursor = dest;
                clampCursor();
            }
            const range = computeRange(rec.motion, oldPos, state.cursor, rec.op);
            if (!range) { state.cursor = oldPos; return; }
            if (rec.op === 'd') {
                applyDelete(range); // pushes undo + fills register
            } else if (rec.op === 'c') {
                applyChange(range); // pushes undo, enters insert mode
                insertRecordedText(t);
            }
            break;
        }
        case 'op-text-object': {
            const range = computeTextObjectRange(rec.prefix, rec.obj);
            if (!range) return;
            if (rec.op === 'd') {
                applyDelete(range);
            } else if (rec.op === 'c') {
                applyChange(range);
                insertRecordedText(t);
            }
            break;
        }
        case 'op-linewise': {
            const startRow = state.cursor.row;
            const endRow = Math.min(ROWS - 1, startRow + (rec.count || 1) - 1);
            const range = { linewise: true, startRow, endRow };
            if (rec.op === 'd') {
                applyDelete(range);
            } else if (rec.op === 'c') {
                applyChange(range);
                insertRecordedText(t);
            }
            break;
        }
        case 'x': {
            const startLine = state.buffer[c.row] || '';
            if (startLine.length > 0 && c.col < startLine.length) {
                pushUndo();
                const reps = rec.count || 1;
                for (let n = 0; n < reps; n++) {
                    const line = state.buffer[c.row];
                    if (line.length === 0 || c.col >= line.length) break;
                    setRegister(line[c.col], false);
                    state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
                }
            }
            break;
        }
        case 'replace': {
            // Replay `r{char}`: overwrite rec.count chars starting at the cursor.
            const line = state.buffer[c.row] || '';
            if (c.col >= line.length) return;
            pushUndo();
            const arr = line.split('');
            let changed = 0;
            for (let n = 0; n < (rec.count || 1) && c.col + n < arr.length; n++) { arr[c.col + n] = rec.char; changed++; }
            state.buffer[c.row] = arr.join('');
            c.col = c.col + changed - 1;
            break;
        }
        case 'op-chars': {
            // Replay `s`: change rec.count chars under the cursor + re-type.
            const line = state.buffer[c.row] || '';
            if (line.length === 0 || c.col >= line.length) return;
            const endCol = Math.min(line.length - 1, c.col + (rec.count || 1) - 1);
            const range = { startRow: c.row, startCol: c.col, endRow: c.row, endCol };
            applyChange(range);
            insertRecordedText(t);
            break;
        }
        case 'op-eol': {
            // Replay `D`/`C`: delete/change to end of (count-1 further) lines.
            applyToEol(rec.op, rec.count); // pushes undo; `c` enters insert
            if (rec.op === 'c') insertRecordedText(t);
            break;
        }
        case 'indent': {
            // Replay `>>`/`<<`/`==`: shift [count] lines from the cursor again.
            const r1 = c.row;
            applyIndent(rec.op, r1, r1 + (rec.count || 1) - 1);
            break;
        }
        case 'paste': {
            applyPaste(1, rec.before); // applyPaste pushes its own undo
            break;
        }
        case 'insert': {
            pushUndo();
            // `i`-style: direction 'before' = insert at cursor, 'after' = insert one past cursor.
            // 'I' = first non-blank of line, 'A' = end of line.
            if (rec.direction === 'after') {
                const line = state.buffer[c.row] || '';
                c.col = Math.min(c.col + 1, line.length);
            } else if (rec.direction === 'I') {
                c.col = firstNonBlank(c.row);
            } else if (rec.direction === 'A') {
                c.col = (state.buffer[c.row] || '').length;
            }
            insertRecordedText(t, /* fromInsert = */ true);
            break;
        }
        case 'open': {
            // Refuse a "below" open at the bottom row: no room to grow the fixed grid.
            if (rec.direction === 'below' && c.row >= ROWS - 1) break;
            pushUndo();
            // Open a new line below or above and put typed text in it
            if (rec.direction === 'below') {
                for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
                state.buffer[c.row + 1] = '';
                c.row++;
            } else {
                for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
                state.buffer[c.row] = '';
            }
            c.col = 0;
            if (t.length > 0) {
                insertRecordedText(t, /* fromInsert = */ true);
            } else {
                setMode('normal');
            }
            break;
        }
    }
}

// Insert recorded typed text (with embedded \n as line breaks) at current cursor.
// fromInsert = true: place cursor past the typed text (used for `i`/`a`/`o`/`O` replays).
// fromInsert = false: used for `c` operator replays — exits insert mode, lands on last typed char.
function insertRecordedText(t, fromInsert = false) {
    if (t.length === 0) {
        if (!fromInsert) setMode('normal');
        return;
    }
    const c = state.cursor;
    for (const ch of t) {
        if (ch === '\n') {
            // Refuse to split past the last row (keeps exactly ROWS rows on-screen).
            if (c.row >= ROWS - 1) continue;
            const line = state.buffer[c.row];
            const after = line.slice(c.col);
            state.buffer[c.row] = line.slice(0, c.col);
            for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
            state.buffer[c.row + 1] = after;
            c.row++;
            c.col = 0;
        } else if (ch === '\b') {
            // Recorded in-line backspace: delete the char just left of the caret.
            if (c.col > 0) {
                const line = state.buffer[c.row];
                state.buffer[c.row] = line.slice(0, c.col - 1) + line.slice(c.col);
                c.col--;
            }
        } else if (ch === '\x7f') {
            // Recorded in-line forward delete: delete the char at/after the caret
            // without moving the caret.
            const line = state.buffer[c.row];
            if (c.col < line.length) {
                state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
            }
        } else {
            const line = state.buffer[c.row];
            if (line.length < COLS) {
                state.buffer[c.row] = line.slice(0, c.col) + ch + line.slice(c.col);
                c.col++;
            }
        }
    }
    if (fromInsert) {
        // For `i`/`a`/`o` replays: cursor sits at the position after the inserted text
        // (vim actually returns to normal mode after `.`-replay of an insert; same here)
    } else {
        // For `c` operator replay: vim places cursor on the last inserted char
        if (c.col > 0) c.col--;
    }
    setMode('normal');
}

// --- Yank Operator --- (no buffer mutation, just fills register)
function applyYank(range) {
    const text = getRangeText(range);
    setRegister(text, !!range.linewise);
    if (range.linewise) {
        const n = range.endRow - range.startRow + 1;
        state.statusMsg = n + ' line' + (n > 1 ? 's' : '') + ' yanked';
    } else {
        state.statusMsg = 'yanked';
    }
}

// --- Paste Operator ---
// Inserts register content. `before=false` → after cursor/line; `before=true` → before.
function applyPaste(count, before) {
    const { text, linewise } = state.register;
    if (text === null || text === undefined) {
        state.statusMsg = 'register is empty';
        return;
    }
    pushUndo();
    for (let i = 0; i < count; i++) {
        if (linewise) pasteLinewise(text, before);
        else pasteCharwise(text, before);
    }
    clampCursor();
    state.statusMsg = 'pasted';
}

function pasteLinewise(lines, before) {
    // Insert yanked lines below or above the cursor's row
    const insertAt = before ? state.cursor.row : state.cursor.row + 1;
    state.buffer.splice(insertAt, 0, ...lines);
    while (state.buffer.length > ROWS) state.buffer.pop();
    const targetRow = Math.min(insertAt, ROWS - 1);
    state.cursor = { row: targetRow, col: firstNonBlank(state.buffer[targetRow] || '') };
}

function pasteCharwise(text, before) {
    // Insert text at (or just after) cursor. Text may contain \n.
    const c = state.cursor;
    const line = state.buffer[c.row] || '';
    // Insertion point: after cursor char normally, at cursor for "before"
    const at = before ? c.col : c.col + 1;

    if (!text.includes('\n')) {
        state.buffer[c.row] = clipCols(line.slice(0, at) + text + line.slice(at));
        state.cursor = { row: c.row, col: Math.max(0, at + text.length - 1) };
        return;
    }

    // Multi-line insertion: split into pieces
    const pieces = text.split('\n');
    const tail = line.slice(at);
    const head = line.slice(0, at);
    // Current line becomes head + first piece (clipped to the grid width)
    state.buffer[c.row] = clipCols(head + pieces[0]);
    // The last piece merges with the tail
    const newLines = pieces.slice(1).map(clipCols);
    newLines[newLines.length - 1] = clipCols(newLines[newLines.length - 1] + tail);
    state.buffer.splice(c.row + 1, 0, ...newLines);
    while (state.buffer.length > ROWS) state.buffer.pop();
    // Cursor lands on last char of pasted text (before tail)
    const lastPasted = pieces[pieces.length - 1];
    state.cursor = {
        row: Math.min(c.row + newLines.length, ROWS - 1),
        col: Math.max(0, lastPasted.length - 1),
    };
}

// --- Delete Operator ---
function applyDelete(range) {
    pushUndo();
    setRegister(getRangeText(range), !!range.linewise);
    if (range.linewise) {
        deleteLines(range.startRow, range.endRow);
    } else {
        deleteChars(range);
    }
}

function deleteLines(startRow, endRow) {
    const numLines = endRow - startRow + 1;
    // Remove lines and shift up
    state.buffer.splice(startRow, numLines);
    // Pad back to ROWS
    for (let i = 0; i < numLines; i++) state.buffer.push('');
    state.cursor = { row: Math.min(startRow, ROWS - 1), col: 0 };
    state.statusMsg = numLines + ' line' + (numLines > 1 ? 's' : '') + ' deleted';
}

function deleteChars(range) {
    const { startRow, startCol, endRow, endCol } = range;

    if (startRow === endRow) {
        // Same line: just remove the substring
        const line = state.buffer[startRow];
        state.buffer[startRow] = line.slice(0, startCol) + line.slice(endCol + 1);
        state.cursor = { row: startRow, col: startCol };
    } else {
        // Multi-line: keep text before start on first line,
        // append text after end from last line
        const firstLine = state.buffer[startRow].slice(0, startCol);
        const lastLine = state.buffer[endRow].slice(endCol + 1);
        const merged = clipCols(firstLine + lastLine);

        // Remove affected lines and insert merged
        const numLines = endRow - startRow + 1;
        state.buffer.splice(startRow, numLines, merged);

        // Pad back to ROWS
        while (state.buffer.length < ROWS) state.buffer.push('');
        state.cursor = { row: startRow, col: startCol };
    }

    state.statusMsg = 'deleted';
}

// --- Change Operator ---
function applyChange(range) {
    pushUndo();
    setRegister(getRangeText(range), !!range.linewise);
    if (range.linewise) {
        changeLines(range.startRow, range.endRow);
    } else {
        changeChars(range);
    }
}

function changeLines(startRow, endRow) {
    // Remove affected lines, insert one blank line, enter insert mode
    const numLines = endRow - startRow + 1;
    state.buffer.splice(startRow, numLines, '');
    while (state.buffer.length < ROWS) state.buffer.push('');
    state.cursor = { row: Math.min(startRow, ROWS - 1), col: 0 };
    setMode('insert');
    state.statusMsg = 'change line' + (numLines > 1 ? 's' : '') + '...';
}

function changeChars(range) {
    const { startRow, startCol, endRow, endCol } = range;

    if (startRow === endRow) {
        const line = state.buffer[startRow];
        state.buffer[startRow] = line.slice(0, startCol) + line.slice(endCol + 1);
        state.cursor = { row: startRow, col: startCol };
    } else {
        const firstLine = state.buffer[startRow].slice(0, startCol);
        const lastLine = state.buffer[endRow].slice(endCol + 1);
        const merged = clipCols(firstLine + lastLine);
        const numLines = endRow - startRow + 1;
        state.buffer.splice(startRow, numLines, merged);
        while (state.buffer.length < ROWS) state.buffer.push('');
        state.cursor = { row: startRow, col: startCol };
    }

    setMode('insert');
    state.statusMsg = 'change...';
}

// --- `D` / `C`: delete/change from the cursor to end of line ====================
// Vim's D == d$ and C == c$. With a count N the motion reaches the end of the
// Nth line (the current line plus N-1 following lines). Because the target is
// always end-of-line there is no trailing text to keep on the last line, so:
//   * the text before the cursor on the first line (the "head") is preserved;
//   * the lines the span covers collapse to that single head line.
// For `d` an empty head means the covered lines vanish entirely (like `dd`);
// for `c` we always leave one line (the head) to type into. A shared undo unit;
// registered in lastChange so `.` replays it. These match real Vim (D==d$, etc.);
// see the operators baseline in VIM_DIFFERENCES.md §1.
function applyToEol(op, count) {
    const c = state.cursor;
    const startRow = c.row, startCol = c.col;
    const targetRow = Math.min(startRow + (count || 1) - 1, ROWS - 1);
    pushUndo();
    // Register: the affected text, charwise (lines joined by newlines).
    const parts = [];
    for (let r = startRow; r <= targetRow; r++) {
        const line = state.buffer[r] || '';
        parts.push(line.slice(r === startRow ? startCol : 0));
    }
    setRegister(parts.join('\n'), false);
    const head = (state.buffer[startRow] || '').slice(0, startCol);
    const numLines = targetRow - startRow + 1;
    if (op === 'd') {
        if (numLines === 1) {
            state.buffer[startRow] = head;
        } else if (head === '') {
            state.buffer.splice(startRow, numLines);       // whole lines removed
        } else {
            state.buffer.splice(startRow, numLines, head);  // keep the head line
        }
        while (state.buffer.length < ROWS) state.buffer.push('');
        state.cursor = { row: Math.min(startRow, ROWS - 1),
                         col: Math.min(startCol, (state.buffer[Math.min(startRow, ROWS - 1)] || '').length) };
        state.statusMsg = 'deleted';
        state.lastChange = { kind: 'op-eol', op: 'd', count: count || 1 };
    } else { // change
        if (numLines === 1) {
            state.buffer[startRow] = head;
            state.cursor = { row: startRow, col: startCol };
        } else {
            state.buffer.splice(startRow, numLines, head);  // always keep one line
            while (state.buffer.length < ROWS) state.buffer.push('');
            state.cursor = { row: startRow, col: head.length };
        }
        setMode('insert');
        state.statusMsg = 'change...';
        state.lastChange = { kind: 'op-eol', op: 'c', count: count || 1, typed: '' };
    }
    clampCursor();
}

// --- `Y` / `S`: linewise yank / change [count] lines (Vim: Y == yy, S == cc) ====
function applyLinewise(op, count) {
    const startRow = state.cursor.row;
    const endRow = Math.min(ROWS - 1, startRow + (count || 1) - 1);
    const range = { linewise: true, startRow, endRow };
    if (op === 'y') {
        applyYank(range);                 // cursor stays put
        return;
    }
    applyChange(range);                   // enters insert
    state.lastChange = { kind: 'op-linewise', op: 'c', count: count || 1, typed: '' };
}

// --- Indent operators: `>` (right), `<` (left), `=` (auto) ======================
// Policy (matches the oracle's pinned shiftwidth=2/expandtab): shift by 2 spaces,
// always spaces, operating on whole lines. `=` re-indents with a brace-depth model
// (`{`/`(`/`[` open, `}`/`)`/`]` close; a line whose first non-blank is a closer
// level out). See VIM_DIFFERENCES.md §1 operators and §2.12 (policy + divergences).
const SW = 2;
function indentWidth(line) { let i = 0; while (i < line.length && line[i] === ' ') i++; return i; }
function autoIndentRange(r1, r2) {
    // Depth from all lines above r1 (those lines are not re-indented here).
    const opener = ch => ch === '{' || ch === '(' || ch === '[';
    const closer = ch => ch === '}' || ch === ')' || ch === ']';
    let depth = 0;
    const delta = s => { let d = 0; for (const ch of s) { if (opener(ch)) d++; else if (closer(ch)) d--; } return d; };
    for (let r = 0; r < r1; r++) depth += delta(state.buffer[r] || '');
    for (let r = r1; r <= r2; r++) {
        const content = (state.buffer[r] || '').trim();
        if (content === '') { state.buffer[r] = ''; continue; } // leave blank lines empty
        const startsCloser = closer(content[0]);
        const lvl = startsCloser ? Math.max(0, depth - 1) : depth;
        state.buffer[r] = ' '.repeat(lvl * SW) + content;
        depth += delta(content);
        if (depth < 0) depth = 0;
    }
}
function applyIndent(op, r1, r2) {
    r1 = Math.max(0, Math.min(r1, ROWS - 1));
    r2 = Math.max(r1, Math.min(r2, ROWS - 1));
    pushUndo();
    for (let r = r1; r <= r2; r++) {
        const line = state.buffer[r] || '';
        if (op === '>') { if (line.trim() !== '') state.buffer[r] = ' '.repeat(SW) + line; }
        else if (op === '<') { const cut = Math.min(indentWidth(line), SW); state.buffer[r] = line.slice(cut); }
    }
    if (op === '=') autoIndentRange(r1, r2);
    state.cursor = { row: r1, col: state.buffer[r1] ? indentWidth(state.buffer[r1]) : 0 };
    if (op === '>') state.cursor.col = Math.min(state.cursor.col + SW, (state.buffer[r1] || '').length);
    state.statusMsg = op === '=' ? 'indented' : ((r2 - r1 + 1) + ' line' + (r2 > r1 ? 's' : '') + (op === '>' ? ' indented' : ' unindented'));
    state.lastChange = { kind: 'indent', op, count: r2 - r1 + 1 };
}


// --- Insert Mode ---
function handleInsertKey(e) {
    const key = e.key;

    if (key === 'Escape') {
        // Vim: leaving insert mode after typing places the cursor back on the
        // last typed character (insert mode sits one past the caret). Only move
        // if the session actually mutated the buffer (an untyped i/a stays put).
        if (state.insertTouched && state.cursor.col > 0) state.cursor.col--;
        setMode('normal');
        clampCursor();
        render();
        return;
    }

    // Arrow keys move the caret within insert mode (no buffer change, no undo push).
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        const c = state.cursor;
        const line = state.buffer[c.row] || '';
        if (key === 'ArrowLeft') {
            if (c.col > 0) c.col--;
            else if (c.row > 0) { c.row--; c.col = (state.buffer[c.row] || '').length; }
        } else if (key === 'ArrowRight') {
            if (c.col < line.length) c.col++;
            else if (c.row < ROWS - 1) { c.row++; c.col = 0; }
        } else if (key === 'ArrowUp') {
            if (c.row > 0) { c.row--; c.col = Math.min(c.col, (state.buffer[c.row] || '').length); }
        } else if (c.row < ROWS - 1) { // ArrowDown
            c.row++;
            c.col = Math.min(c.col, (state.buffer[c.row] || '').length);
        }
        render();
        return;
    }

    // First mutation in this insert session pushes one snapshot for the entire session
    ensureInsertPushed();

    if (key === 'Backspace') {
        const c = state.cursor;
        if (c.col > 0) {
            const line = state.buffer[c.row];
            state.buffer[c.row] = line.slice(0, c.col - 1) + line.slice(c.col);
            c.col--;
            // Record the backspace so `.` reproduces the net typed text.
            if (state.lastChange && 'typed' in state.lastChange) state.lastChange.typed += '\b';
        } else if (c.row > 0) {
            // Join with previous line. Not recorded in `typed`: reproducing a
            // cross-line join inside a `.` replay is out of scope (rare edge).
            const prev = state.buffer[c.row - 1];
            state.buffer[c.row - 1] = clipCols(prev + state.buffer[c.row]);
            state.buffer.splice(c.row, 1);
            state.buffer.push('');
            c.row--;
            c.col = Math.min(prev.length, COLS);
        }
        render();
        return;
    }

    if (key === 'Delete') {
        const c = state.cursor;
        const line = state.buffer[c.row] || '';
        if (c.col < line.length) {
            // Forward delete: remove the char at the caret; caret stays put.
            state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
            // Record so `.` reproduces the net typed text.
            if (state.lastChange && 'typed' in state.lastChange) state.lastChange.typed += '\x7f';
        } else if (c.row < ROWS - 1 && (state.buffer[c.row + 1] || '').length > 0) {
            // At end-of-line: delete the newline by joining the next line up (matches
            // Vim's <Del>). Not recorded in `typed`: reproducing a cross-line join
            // inside a `.` replay is out of scope (same limitation as Backspace).
            state.buffer[c.row] = clipCols(line + state.buffer[c.row + 1]);
            state.buffer.splice(c.row + 1, 1);
            state.buffer.push('');
        }
        render();
        return;
    }

    if (key === 'Enter') {
        const c = state.cursor;
        // Fixed-height grid: there is no row below the last one, so Enter at the
        // bottom row is refused (no-op) to keep exactly ROWS rows on-screen.
        if (c.row >= ROWS - 1) { render(); return; }
        const line = state.buffer[c.row];
        const after = line.slice(c.col);
        state.buffer[c.row] = line.slice(0, c.col);
        for (let r = ROWS - 1; r > c.row; r--) {
            state.buffer[r] = state.buffer[r - 1];
        }
        state.buffer[c.row + 1] = after;
        c.row++;
        c.col = 0;
        if (state.lastChange && 'typed' in state.lastChange) state.lastChange.typed += '\n';
        render();
        return;
    }

    if (key.length === 1) {
        const c = state.cursor;
        const line = state.buffer[c.row];
        if (line.length < COLS) {
            state.buffer[c.row] = line.slice(0, c.col) + key + line.slice(c.col);
            c.col++;
            if (state.lastChange && 'typed' in state.lastChange) state.lastChange.typed += key;
            render();
        }
    }
}


// --- Replace (`r`) helper ---
// Replace up to `count` chars starting at the cursor with `ch` (in-line only,
// stops at end of line). Stays in normal mode; cursor ends on the last replaced
// char (Vim behavior). One undo unit. Registered in lastChange for `.` replay.
function doReplace(count, ch) {
    const c = state.cursor;
    const line = state.buffer[c.row] || '';
    if (c.col >= line.length) { state.statusMsg = ''; render(); return; }
    pushUndo();
    const arr = line.split('');
    let changed = 0;
    for (let n = 0; n < count && c.col + n < arr.length; n++) { arr[c.col + n] = ch; changed++; }
    state.buffer[c.row] = arr.join('');
    c.col = c.col + changed - 1; // land on the last replaced char
    clampCursor();
    state.lastChange = { kind: 'replace', char: ch, count: changed };
    state.statusMsg = '';
    render();
}

// --- Normal Mode ---
function handleNormalKey(e) {
    // If waiting for the find char of f/F/t/T, the next key is the search char
    // (taken raw, so it is not aliased). Escape or a non-character cancels.
    if (state.pendingFind) {
        const pf = state.pendingFind;
        state.pendingFind = null;
        if (e.key === 'Escape' || e.key.length !== 1) {
            if (state.mode === 'operator-pending') setMode('normal');
            state.statusMsg = '';
            render();
            return;
        }
        // Record the last find so `;` / `,` can repeat it (even for operator forms).
        state.lastFind = { motion: pf.motion, char: e.key };
        doFind(pf.motion, pf.count, e.key);
        return;
    }

    // If waiting for the replacement char of `r`, the next key is the replacement
    // (taken raw). Escape or a non-character cancels.
    if (state.pendingReplace !== null) {
        const count = state.pendingReplace;
        state.pendingReplace = null;
        if (e.key === 'Escape' || e.key.length !== 1) {
            state.statusMsg = '';
            render();
            return;
        }
        doReplace(count, e.key);
        return;
    }

    let key = e.key;

    // Aliases: arrow keys act as hjkl; Backspace acts as h in normal mode
    if (key === 'ArrowLeft') key = 'h';
    else if (key === 'ArrowRight') key = 'l';
    else if (key === 'ArrowUp') key = 'k';
    else if (key === 'ArrowDown') key = 'j';
    else if (key === 'Backspace') key = 'h';
    else if (key === 'Delete') key = 'x'; // Del deletes the char under the cursor (as in Vim)

    // Escape cancels operator-pending and any pending count prefix
    if (key === 'Escape') {
        state.inputBuffer = '';
        state.pendingG = false;
        if (state.mode === 'operator-pending') {
            setMode('normal');
            state.statusMsg = '';
            render();
        }
        return;
    }

    // Text-object prefix (i / a) while operator-pending → wait for object char
    if (state.mode === 'operator-pending' && (key === 'i' || key === 'a')) {
        state.mode = 'pending-text-object';
        state.pendingTextObject = key;
        state.statusMsg = state.pendingOperator + ' ' + key + ' ...';
        updateModeDisplay();
        return;
    }

    // Insert mode entry
    if (key === 'i') {
        state.insertTouched = false;
        state.pendingInsertRecord = { kind: 'insert', direction: 'before', typed: '' };
        setMode('insert'); state.statusMsg = ''; render(); return;
    }
    if (key === 'a') {
        state.insertTouched = false;
        state.pendingInsertRecord = { kind: 'insert', direction: 'after', typed: '' };
        const line = state.buffer[state.cursor.row] || '';
        state.cursor.col = Math.min(state.cursor.col + 1, line.length);
        setMode('insert'); state.statusMsg = ''; render(); return;
    }
    if (key === 'o') {
        // Fixed-height grid: opening a line below the last row has nowhere to go,
        // so `o` at the bottom row is refused (no-op). See VIM_DIFFERENCES.md.
        if (state.cursor.row >= ROWS - 1) { render(); return; }
        state.insertTouched = false;
        ensureInsertPushed(); // o mutates buffer immediately (one undo with subsequent typing)
        const c = state.cursor;
        for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
        state.buffer[c.row + 1] = '';
        c.row++; c.col = 0;
        state.lastChange = { kind: 'open', direction: 'below', typed: '' };
        setMode('insert'); state.statusMsg = ''; render(); return;
    }
    if (key === 'O') {
        state.insertTouched = false;
        ensureInsertPushed(); // O mutates buffer immediately
        const c = state.cursor;
        for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
        state.buffer[c.row] = '';
        c.col = 0;
        state.lastChange = { kind: 'open', direction: 'above', typed: '' };
        setMode('insert'); state.statusMsg = ''; render(); return;
    }
    // I — insert at first non-blank of line
    if (key === 'I') {
        state.insertTouched = false;
        state.pendingInsertRecord = { kind: 'insert', direction: 'I', typed: '' };
        state.cursor.col = firstNonBlank(state.cursor.row);
        setMode('insert'); state.statusMsg = ''; render(); return;
    }
    // A — append at end of line
    if (key === 'A') {
        state.insertTouched = false;
        state.pendingInsertRecord = { kind: 'insert', direction: 'A', typed: '' };
        const line = state.buffer[state.cursor.row] || '';
        state.cursor.col = line.length;
        setMode('insert'); state.statusMsg = ''; render(); return;
    }

    // Operator-pending entry (or double-tap like dd/cc/yy)
    // Indent operators > (right), < (left), = (auto). Doubled (>>/<=/==) shifts the
    // current [count] lines; otherwise they wait for a motion and shift the lines it
    // spans. Always linewise. See VIM_DIFFERENCES.md §1.
    if (key === '>' || key === '<' || key === '=') {
        if (state.mode === 'operator-pending' && state.pendingOperator === key) {
            const opCount = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
            state.inputBuffer = '';
            const r1 = state.cursor.row;
            applyIndent(key, r1, r1 + opCount - 1);
            setMode('normal'); clampCursor(); render(); return;
        }
        if (state.mode === 'operator-pending') setMode('normal'); // e.g. > then < : restart
        if (state.inputBuffer && !/^[0-9]+$/.test(state.inputBuffer)) state.inputBuffer = '';
        state.mode = 'operator-pending';
        state.pendingOperator = key;
        state.statusMsg = key + ' ...';
        updateModeDisplay();
        return;
    }

    if (key === 'd' || key === 'c' || key === 'y') {
        // Double-tap: dd deletes line, cc changes line, yy yanks line. Honors count prefix.
        if (state.mode === 'operator-pending' && state.pendingOperator === key) {
            const opCount = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
            state.inputBuffer = ''; // consume the count so it does not leak to the next command
            const endRow = Math.min(ROWS - 1, state.cursor.row + opCount - 1);
            const range = { linewise: true, startRow: state.cursor.row, endRow };
            if (key === 'd') {
                applyDelete(range);
                state.lastChange = { kind: 'op-linewise', op: 'd', count: opCount };
                setMode('normal');
            } else if (key === 'c') {
                applyChange(range);
                state.lastChange = { kind: 'op-linewise', op: 'c', count: opCount, typed: '' };
                // changeLines already enters insert mode
            } else if (key === 'y') {
                applyYank(range);
                setMode('normal'); // cursor stays put
            }
            clampCursor();
            render();
            return;
        }
        // Preserve a leading numeric count (so `2dw` == `d2w`); clear only a
        // stale non-numeric buffer (e.g. a leftover 'g' prefix).
        if (state.inputBuffer && !/^[0-9]+$/.test(state.inputBuffer)) state.inputBuffer = '';
        state.mode = 'operator-pending';
        state.pendingOperator = key;
        state.statusMsg = key + ' ...';
        updateModeDisplay();
        return;
    }

    // x — delete char(s) under cursor (honors count: 3x deletes three chars)
    if (key === 'x') {
        const c = state.cursor;
        let count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = ''; // always consume the prefix, even if nothing is deleted
        if (!count || count < 1) count = 1;
        const startLine = state.buffer[c.row] || '';
        if (startLine.length > 0 && c.col < startLine.length) {
            pushUndo();
            let lastDeleted = null;
            // In-line only (does not wrap to the next line); stops at end of line.
            for (let n = 0; n < count; n++) {
                const line = state.buffer[c.row];
                if (line.length === 0 || c.col >= line.length) break;
                lastDeleted = line[c.col];
                state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
            }
            // x is equivalent to dl: fills the register (last deleted char) so p can paste it.
            if (lastDeleted !== null) {
                setRegister(lastDeleted, false);
                state.lastChange = { kind: 'x', count };
            }
            clampCursor();
        }
        render(); return;
    }

    // s — substitute [count] chars under cursor and enter insert mode (Vim: s == cl)
    if (key === 's') {
        if (state.mode === 'operator-pending') setMode('normal'); // s is a command, not a motion
        if (state.mode !== 'normal') return;
        let count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        state.pendingG = false;
        if (!count || count < 1) count = 1;
        const c = state.cursor;
        const line = state.buffer[c.row] || '';
        if (line.length === 0 || c.col >= line.length) {
            // Nothing under the cursor to substitute (at/beyond EOL): behave like `i`
            // — enter insert without deleting. Divergence from Vim's EOL error is noted.
            state.insertTouched = false;
            state.pendingInsertRecord = { kind: 'insert', direction: 'before', typed: '' };
            setMode('insert'); state.statusMsg = ''; render(); return;
        }
        const endCol = Math.min(line.length - 1, c.col + count - 1);
        const range = { startRow: c.row, startCol: c.col, endRow: c.row, endCol };
        applyChange(range); // pushes undo, deletes the chars, enters insert at startCol
        state.insertTouched = true; // delete+typed text share one undo unit (like o/O)
        state.lastChange = { kind: 'op-chars', op: 'c', count, typed: '' };
        render(); return;
    }

    // Uppercase operator shortcuts: D == d$, C == c$, Y == yy, S == cc.
    // (All honor a leading count: 2D/2C reach end-of-2nd-line; 2Y/2S = two lines.)
    if (key === 'D' || key === 'C' || key === 'Y' || key === 'S') {
        if (state.mode === 'operator-pending') setMode('normal'); // cancel a pending op
        if (state.mode !== 'normal') return;
        let count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        state.pendingG = false;
        if (!count || count < 1) count = 1;
        if (key === 'D') applyToEol('d', count);
        else if (key === 'C') applyToEol('c', count);
        else if (key === 'Y') applyLinewise('y', count);
        else applyLinewise('c', count); // S == cc
        clampCursor();
        render(); return;
    }

    // r — replace [count] chars under cursor with a single typed char (stays normal mode)
    if (key === 'r') {
        if (state.mode === 'operator-pending') setMode('normal');
        if (state.mode !== 'normal') return;
        let count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        state.pendingG = false;
        if (!count || count < 1) count = 1;
        state.pendingReplace = count;
        state.statusMsg = (count > 1 ? count : '') + 'r …';
        render(); return;
    }

    // u — undo (honors count: 3u undoes three times)
    if (key === 'u') {
        const count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        if (state.mode !== 'normal') setMode('normal'); // cancel any pending operator first
        for (let i = 0; i < count; i++) undo();
        clampCursor();
        render(); return;
    }

    // p / P — paste after/before cursor (or below/above current line for linewise)
    if (key === 'p' || key === 'P') {
        const pasteCount = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        applyPaste(pasteCount, key === 'P');
        if (state.register.text !== null) {
            state.lastChange = { kind: 'paste', before: key === 'P' };
        }
        render(); return;
    }

    // . — repeat last change (honors count: 3. repeats three times)
    if (key === '.') {
        const count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';
        if (state.mode !== 'normal') setMode('normal'); // cancel any pending operator first
        repeatLastChange(count);
        return;
    }

    // : — enter command-line mode (e.g. `:wq` to finish a challenge). Cancels a
    // pending operator if one is active.
    if (key === ':') {
        if (state.mode === 'operator-pending') setMode('normal');
        if (state.mode !== 'normal') return;
        state.commandMode = true;
        state.commandInput = '';
        state.statusMsg = ':';
        render();
        return;
    }

    // Numeric prefix (counts start 1-9; 0 is the "beginning of line" motion)
    if (/[1-9]/.test(key)) {
        state.inputBuffer += key;
        state.statusMsg = state.inputBuffer;
        return;
    }

    // gg / G — honor a count: 5gg / 5G jump to that absolute (1-based) line.
    if (key === 'g') {
        if (state.pendingG) {
            state.pendingG = false;
            const count = state.inputBuffer ? parseInt(state.inputBuffer, 10) : 0;
            state.inputBuffer = '';
            if (count > 0) {
                const row = Math.min(count - 1, ROWS - 1);
                executeMovement('gg', { row, col: firstNonBlank(row) });
            } else {
                executeMovement('gg');
            }
            state.statusMsg = '';
        } else {
            state.pendingG = true;
            state.statusMsg = state.inputBuffer + 'g';
        }
        return;
    }
    // ge / gE: pending 'g' followed by e/E → backward to end of previous word/WORD.
    if (state.pendingG && (key === 'e' || key === 'E')) {
        const motion = (key === 'e') ? 'ge' : 'gE';
        const count = state.inputBuffer ? parseInt(state.inputBuffer, 10) : 1;
        state.pendingG = false;
        state.inputBuffer = '';
        if (state.mode === 'operator-pending') {
            executeMovement(motion); // operator applies over a single motion span
        } else {
            for (let i = 0; i < count; i++) executeMovement(motion);
            state.statusMsg = '';
        }
        return;
    }
    if (key === 'G') {
        const count = state.inputBuffer ? parseInt(state.inputBuffer, 10) : 0;
        state.pendingG = false;
        state.inputBuffer = '';
        if (count > 0) {
            const row = Math.min(count - 1, ROWS - 1);
            executeMovement('G', { row, col: firstNonBlank(row) });
        } else {
            executeMovement('G');
        }
        return;
    }

    // f / F / t / T — find-in-line. Enter a mini state waiting for the search char.
    // Honors a count prefix (2fx = 2nd occurrence); works in normal and operator-pending.
    if (key === 'f' || key === 'F' || key === 't' || key === 'T') {
        const count = state.inputBuffer ? parseInt(state.inputBuffer, 10) : 1;
        state.inputBuffer = '';
        state.pendingG = false;
        state.pendingFind = { motion: key, count };
        const op = state.mode === 'operator-pending' ? state.pendingOperator : '';
        state.statusMsg = op + (count > 1 ? count : '') + key + ' ...';
        return;
    }

    // ; / , — repeat the last find forward (;) or in the opposite direction (,).
    // Honors a count (2; skips two). Usable as a motion too (d;, c;, y;).
    if (key === ';' || key === ',') {
        const count = state.inputBuffer ? parseInt(state.inputBuffer, 10) : 1;
        state.inputBuffer = '';
        state.pendingG = false;
        if (!state.lastFind) {
            state.statusMsg = 'no previous find';
            render();
            return;
        }
        const motion = key === ';' ? state.lastFind.motion : mirrorFind(state.lastFind.motion);
        doFind(motion, count, state.lastFind.char);
        return;
    }

    // % — jump to matching bracket (single-line). Ignored count (a count before %
    // does not repeat the jump, unlike other motions). Inclusive for operators.
    if (key === '%') {
        state.inputBuffer = '';
        state.pendingG = false;
        const oldPos = { ...state.cursor };
        const dest = moveToMatchBracket(state.cursor);
        if (!dest) {
            state.statusMsg = 'no matching bracket';
            if (state.mode === 'operator-pending') setMode('normal');
            render();
            return;
        }
        if (state.mode === 'operator-pending') {
            if (state.pendingOperator === '>' || state.pendingOperator === '<' || state.pendingOperator === '=') {
                state.cursor = dest; clampCursor();
                applyIndent(state.pendingOperator, Math.min(oldPos.row, dest.row), Math.max(oldPos.row, dest.row));
                setMode('normal'); clampCursor(); render(); return;
            }
            const range = computeRange('%', oldPos, dest);
            state.cursor = dest;
            clampCursor();
            if (state.pendingOperator === 'd') {
                if (range) {
                    applyDelete(range);
                    state.lastChange = { kind: 'op-motion', op: 'd', motion: '%', count: 1 };
                }
                setMode('normal');
            } else if (state.pendingOperator === 'c') {
                if (range) {
                    applyChange(range);
                    state.lastChange = { kind: 'op-motion', op: 'c', motion: '%', count: 1, typed: '' };
                } else {
                    setMode('normal');
                }
            } else if (state.pendingOperator === 'y') {
                if (range) applyYank(range);
                state.cursor = oldPos;
                setMode('normal');
            }
            clampCursor();
            state.statusMsg = '';
            render();
        } else {
            state.cursor = dest;
            clampCursor();
            state.statusMsg = '';
            render();
        }
        return;
    }

    // Movement keys
    if ('hjklwbWBeE$0'.includes(key)) {
        const count = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
        state.inputBuffer = '';

        if (state.mode === 'operator-pending') {
            // Move through all reps first, then apply operator once
            const oldPos = { ...state.cursor };
            for (let i = 0; i < count; i++) {
                const dest = motionDest(key);
                if (!dest) break;
                state.cursor = dest;
                clampCursor();
            }
            // Indent operators shift the lines spanned (always linewise).
            if (state.pendingOperator === '>' || state.pendingOperator === '<' || state.pendingOperator === '=') {
                applyIndent(state.pendingOperator, Math.min(oldPos.row, state.cursor.row), Math.max(oldPos.row, state.cursor.row));
                setMode('normal'); clampCursor(); render(); return;
            }
            const range = computeRange(key, oldPos, state.cursor, state.pendingOperator);
            if (state.pendingOperator === 'd') {
                if (range) {
                    applyDelete(range);
                    state.lastChange = { kind: 'op-motion', op: 'd', motion: key, count };
                }
                setMode('normal');
            } else if (state.pendingOperator === 'c') {
                if (range) {
                    applyChange(range);
                    state.lastChange = { kind: 'op-motion', op: 'c', motion: key, count, typed: '' };
                } else {
                    setMode('normal');
                }
            } else if (state.pendingOperator === 'y') {
                if (range) applyYank(range);
                state.cursor = oldPos;
                setMode('normal');
            }
            clampCursor();
            render();
        } else {
            for (let i = 0; i < count; i++) executeMovement(key);
            state.statusMsg = '';
        }
        return;
    }

    state.inputBuffer = '';
    state.statusMsg = '';
    state.pendingG = false; // an unrecognized command cancels a pending 'g' sequence
}


// --- Command-line Mode (`:`) ---
// Types a command after `:`. Enter runs it; Escape (or Backspace past the colon)
// cancels. Recognized commands are game-flavored: `:wq` / `:x` advance to the next
// challenge once the current one is solved (`!` forces the skip).
function handleCommandKey(e) {
    const key = e.key;
    if (key === 'Escape') {
        state.commandMode = false;
        state.commandInput = '';
        state.statusMsg = '';
        render();
        return;
    }
    if (key === 'Enter') {
        runCommand(state.commandInput.trim());
        return;
    }
    if (key === 'Backspace') {
        state.commandInput = state.commandInput.slice(0, -1);
        if (state.commandInput.length === 0) {
            // Backspacing past the colon exits command-line mode, like Vim.
            state.commandMode = false;
            state.statusMsg = '';
        } else {
            state.statusMsg = ':' + state.commandInput;
        }
        render();
        return;
    }
    if (key.length === 1) {
        state.commandInput += key;
        state.statusMsg = ':' + state.commandInput;
        render();
    }
}

// Advance to the next challenge (wrapping around) and re-focus the editor.
// Briefly shows a "✓ Solved!" banner, then reveals the new challenge's hint
// (the same hint you'd get choosing it from the dropdown). The swap back to the
// hint only happens if the player hasn't already started acting (which would
// have replaced statusMsg with a command echo / operator-pending prompt).
let solvedTimer = null;
function advanceChallenge() {
    const next = (state.currentChallenge + 1) % CHALLENGES.length;
    loadChallenge(next); // sets statusMsg to the new hint, re-renders, refocuses
    const hint = CHALLENGES[next].hint;
    state.statusMsg = '✓ Solved! ' + CHALLENGES[next].name;
    render();
    if (solvedTimer) clearTimeout(solvedTimer);
    solvedTimer = setTimeout(() => {
        solvedTimer = null;
        // Only reveal the hint if nothing else has taken over the status line.
        if (state.statusMsg.indexOf('✓ Solved!') === 0) {
            state.statusMsg = hint;
            render();
        }
    }, 1500);
}

// Interpret a typed `:` command (without the leading colon).
function runCommand(cmd) {
    state.commandMode = false;
    state.commandInput = '';
    if (cmd === '') {
        state.statusMsg = '';
        render();
        return;
    }
    const force = cmd.endsWith('!');
    const base = force ? cmd.slice(0, -1) : cmd;
    const isQuit = base === 'wq' || base === 'x' || base === 'wqa';

    if (isQuit) {
        if (buffersMatch()) {
            advanceChallenge();
        } else if (force) {
            advanceChallenge(); // `!` skips even when unsolved
        } else {
            const diff = computeDiff();
            const remaining = diff.totalCells - diff.matchCount;
            state.statusMsg = 'not solved — ' + remaining +
                ' char' + (remaining !== 1 ? 's' : '') + ' to fix (use :wq! to skip)';
            render();
        }
        return;
    }
    if (base === 'q') { state.statusMsg = 'use :wq to finish a challenge'; render(); return; }
    if (base === 'w') { state.statusMsg = 'buffer is virtual — nothing to write'; render(); return; }
    // :bn / :bp — go to the next / previous exercise (wraps; like the picker,
    // no completion required). loadChallenge resets state, shows the hint, refocuses.
    if (base === 'bn' || base === 'bp') {
        const n = CHALLENGES.length;
        const next = base === 'bn'
            ? (state.currentChallenge + 1) % n
            : (state.currentChallenge - 1 + n) % n;
        loadChallenge(next);
        return;
    }
    state.statusMsg = 'not an editor: :' + cmd;
    render();
}

// --- Pending Text Object Mode ---
// Reached after `d`/`c`/`y` then `i` or `a`. Waiting for object char (e.g. `w`).
function handleTextObjectKey(e) {
    const key = e.key;
    const op = state.pendingOperator;
    const prefix = state.pendingTextObject;

    // Cancel
    if (key === 'Escape') {
        setMode('normal');
        state.statusMsg = '';
        render();
        return;
    }

    // Any other char is treated as the object selector
    const range = computeTextObjectRange(prefix, key);
    if (!range) {
        state.statusMsg = 'unknown text object: ' + prefix + key;
        setMode('normal');
        render();
        return;
    }

    // Apply operator over the range
    if (op === '>' || op === '<' || op === '=') {
        applyIndent(op, Math.min(range.startRow, range.endRow), Math.max(range.startRow, range.endRow));
        setMode('normal');
        clampCursor();
        render();
        return;
    }
    if (op === 'd') {
        applyDelete(range);
        state.lastChange = { kind: 'op-text-object', op: 'd', prefix, obj: key };
        setMode('normal');
    } else if (op === 'c') {
        applyChange(range);
        state.lastChange = { kind: 'op-text-object', op: 'c', prefix, obj: key, typed: '' };
        // applyChange already enters insert mode
    } else if (op === 'y') {
        applyYank(range);
        setMode('normal');
    }
    clampCursor();
    render();
}


// --- Render ---
function render() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'terminal-row';
        const line = state.buffer[r] || '';

        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'terminal-cell';
            cell.textContent = c < line.length ? line[c] : '';

            if (r === state.cursor.row && c === state.cursor.col) {
                cell.classList.add('cursor');
                if (state.mode === 'insert') {
                    cell.classList.add('insert-mode');
                }
            }
            rowEl.appendChild(cell);
        }
        terminal.appendChild(rowEl);
    }

    document.getElementById('cursor-pos').textContent =
        'Ln ' + (state.cursor.row + 1) + ', Col ' + (state.cursor.col + 1);
    document.getElementById('status-msg').textContent = state.statusMsg;

    renderReference();
}

// --- Reference Panel Render ---
function renderReference() {
    const refTerminal = document.getElementById('reference-terminal');
    if (!refTerminal) return;
    refTerminal.innerHTML = '';

    const diff = computeDiff();
    const accuracy = diff.totalCells > 0
        ? Math.round((diff.matchCount / diff.totalCells) * 100)
        : 100;

    for (let r = 0; r < ROWS; r++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'terminal-row';
        const line = state.targetBuffer[r] || '';

        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'terminal-cell reference-cell';
            cell.textContent = c < line.length ? line[c] : '';

            const d = diff.grid[r][c];
            if (d === 'match') cell.classList.add('match');
            else if (d === 'diff') cell.classList.add('diff');

            rowEl.appendChild(cell);
        }
        refTerminal.appendChild(rowEl);
    }

    // Update accuracy badge
    const badge = document.getElementById('accuracy-badge');
    if (badge) {
        badge.textContent = accuracy + '%';
        badge.className = 'accuracy-badge' + (accuracy === 100 ? ' complete' : '');
    }

    // Update challenge picker (reflect current challenge in the dropdown)
    const sel = document.getElementById('challenge-select');
    if (sel && sel.value !== String(state.currentChallenge)) {
        sel.value = String(state.currentChallenge);
    }

    // Win detection
    const refStatus = document.getElementById('reference-status');
    if (refStatus) {
        if (accuracy === 100) {
            refStatus.textContent = '✓ Challenge Complete!';
            refStatus.className = 'ref-win';
        } else {
            const diffCount = diff.totalCells - diff.matchCount;
            refStatus.textContent = diffCount + ' char' + (diffCount !== 1 ? 's' : '') + ' to fix';
            refStatus.className = '';
        }
    }
}

// --- Key Dispatcher ---
function handleKeyDown(e) {
    // Let the challenge dropdown (or any form control) keep native key handling.
    if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
    // Ctrl+R = redo (only Ctrl binding we intercept; everything else passes through to browser)
    if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (state.mode === 'normal' || state.mode === 'operator-pending' || state.mode === 'pending-text-object') {
            // Cancel any pending operator so redo doesn't get confused
            if (state.mode !== 'normal') setMode('normal');
            redo();
            clampCursor();
            render();
        }
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Ignore bare modifier / lock keys. A lone keydown (e.g. pressing Shift to
    // type a capital, "gE") must NOT fall through to the command handlers, or it
    // clears a pending count/`g` prefix mid-command. (Key combo presses still
    // arrive as the real character, e.g. Shift+e -> e.key === 'E', which we want.)
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' ||
        e.key === 'Meta' || e.key === 'CapsLock' || e.key === 'Dead') {
        return;
    }
    e.preventDefault();
    if (state.commandMode) {
        handleCommandKey(e);
    } else if (state.mode === 'insert') {
        handleInsertKey(e);
    } else if (state.mode === 'pending-text-object') {
        handleTextObjectKey(e);
    } else {
        handleNormalKey(e);
    }
}

// --- Init ---
// Load a challenge by index and return keyboard focus to the editor.
function loadChallenge(index) {
    initChallenge(index);
    setMode('normal');
    render();
    const terminal = document.getElementById('terminal');
    if (terminal) terminal.focus();
}

// Populate the challenge dropdown and wire it up (browser only).
function buildChallengePicker() {
    const sel = document.getElementById('challenge-select');
    if (!sel) return;
    sel.innerHTML = '';
    CHALLENGES.forEach((ch, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = (i + 1) + '. ' + ch.name;
        sel.appendChild(opt);
    });
    sel.value = String(state.currentChallenge);
    sel.addEventListener('change', () => loadChallenge(parseInt(sel.value, 10)));
}

function init() {
    initChallenge(0);
    setMode('normal');
    buildChallengePicker();
    render();
    const terminal = document.getElementById('terminal');
    terminal.tabIndex = 0;
    terminal.focus();
    document.addEventListener('keydown', handleKeyDown);
}

// Only auto-init in the browser. In Node (test runner) skip DOM setup.
if (typeof window !== 'undefined') {
    init();
}

// Export internal pieces for unit tests. In the browser this block is a no-op.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        ROWS,
        COLS,
        clampCursor,
        isWordChar,
        isWhitespaceCh,
        posToIndex,
        flattenBuffer,
        firstNonBlank,
        moveToNextWord,
        moveToPrevWord,
        moveToNextBigWord,
        moveToPrevBigWord,
        moveToNextWordEnd,
        moveToNextBigWordEnd,
        moveToPrevWordEnd,
        moveToPrevBigWordEnd,
        MOTION_INFO,
        computeRange,
        prevPos,
        nextPos,
        executeMovement,
        applyYank,
        applyPaste,
        applyDelete,
        applyChange,
        getRangeText,
        pushUndo,
        undo,
        redo,
        setMode,
        repeatLastChange,
        handleNormalKey,
        handleInsertKey,
        handleTextObjectKey,
        handleKeyDown,
        CHALLENGES,
        initChallenge,
        computeDiff,
        buffersMatch,
        moveToMatchBracket,
        findInLine,
        findOpRange,
    };
}

