// ============================================================
// VIM SIMULATOR — Core Engine
// Architecture: mode state machine with operator-pending support
// ============================================================

const ROWS = 20;
const COLS = 80;

// --- State ---
const state = {
    buffer: [],
    cursor: { row: 0, col: 0 },
    mode: 'normal',        // 'normal' | 'insert' | 'operator-pending' | 'pending-text-object'
    pendingOperator: null, // 'd' | 'c' | 'y' | null — for future operators
    pendingTextObject: null, // 'i' | 'a' — set while waiting for object char (e.g. 'w')
    register: { text: null, linewise: false }, // unnamed register
    undoStack: [],         // array of { buffer, cursor } snapshots
    redoStack: [],         // array of { buffer, cursor } snapshots
    insertTouched: false,  // tracks whether current insert session has mutated buffer (so it's one undo unit)
    lastChange: null,      // shape varies by kind — see repeatLastChange() for the cases
    pendingInsertRecord: null, // for `i`/`a` sessions: gets promoted to lastChange on first keystroke
    statusMsg: '',
    inputBuffer: '',       // accumulates keys for multi-key commands
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
    let idx = posToIndex(cur.row, cur.col) + 1;
    if (idx >= flat.length) return { row: cur.row, col: cur.col };

    // skip whitespace
    while (idx < flat.length && (flat[idx].ch === ' ' || flat[idx].ch === '\n')) idx++;
    if (idx >= flat.length) return { row: cur.row, col: cur.col };

    // skip word or punct block
    const type = isWordChar(flat[idx].ch) ? 'word' : 'punct';
    idx++;
    while (idx < flat.length) {
        const ch = flat[idx].ch;
        if (ch === ' ' || ch === '\n') break;
        if (type === 'word' && !isWordChar(ch)) break;
        if (type === 'punct' && isWordChar(ch)) break;
        idx++;
    }
    if (idx >= flat.length) return flat[flat.length - 1];
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

// --- Mode Management ---
function setMode(mode) {
    state.mode = mode;
    state.pendingOperator = null;
    state.pendingTextObject = null;
    state.inputBuffer = '';
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
function computeRange(motion, start, end) {
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
        // Forward: from start to (end - 1) if exclusive, end if inclusive
        let endAdj = info.inclusive ? end : prevPos(end);
        if (!endAdj) return null; // would go before start
        return { linewise: false, startRow: start.row, startCol: start.col,
                 endRow: endAdj.row, endCol: endAdj.col };
    } else {
        // Backward: from (end) to (start - 1) if inclusive, to (start) if exclusive
        let startAdj = info.inclusive ? end : nextPos(end);
        let endAdj = info.inclusive ? prevPos(start) : prevPos(start);
        // For backward inclusive: text is [dest, start-1]
        // For backward exclusive: text is [dest+1, start-1]
        if (info.inclusive) {
            startAdj = end;
        } else {
            startAdj = nextPos(end);
        }
        endAdj = prevPos(start);
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

// --- Position comparison (a before or equal to b) ---
function posBeforeOrEqual(a, b) {
    if (a.row < b.row) return true;
    if (a.row > b.row) return false;
    return a.col <= b.col;
}

// --- Text Objects ---
// Text objects define a region directly (no motion traversal).
// Currently supported: iw (inner word). Will expand to i"/i(/i{ etc.
function computeTextObjectRange(prefix, objChar) {
    if (prefix === 'i' && objChar === 'w') return innerWordRange();
    if (prefix === 'a' && objChar === 'w') return aWordRange();
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


// --- Motion Destination (pure: just computes where a motion lands) ---
function motionDest(movement) {
    switch (movement) {
        case 'h': return { row: state.cursor.row, col: state.cursor.col - 1 };
        case 'l': return { row: state.cursor.row, col: state.cursor.col + 1 };
        case 'j': return { row: state.cursor.row + 1, col: state.cursor.col };
        case 'k': return { row: state.cursor.row - 1, col: state.cursor.col };
        case 'w': return moveToNextWord(state.cursor);
        case 'b': return moveToPrevWord(state.cursor);
        case '0': return { row: state.cursor.row, col: 0 };
        case '$': return { row: state.cursor.row, col: endOfLine(state.cursor.row) };
        case 'gg': return { row: 0, col: firstNonBlank(0) };
        case 'G': return { row: lastNonEmptyRow(), col: firstNonBlank(lastNonEmptyRow()) };
        default: return null;
    }
}

// --- Movement Execution (simple mode: no operator, just move) ---
function executeMovement(movement) {
    const newPos = motionDest(movement);
    if (!newPos) return;

    if (state.mode === 'operator-pending') {
        const oldPos = { ...state.cursor };
        state.cursor = newPos;
        clampCursor();
        // Compute range and apply operator
        const range = computeRange(movement, oldPos, newPos);
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
            const range = computeRange(rec.motion, oldPos, state.cursor);
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
            const line = state.buffer[c.row];
            if (line.length > 0) {
                pushUndo();
                setRegister(line[c.col], false);
                state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
            }
            break;
        }
        case 'paste': {
            applyPaste(1, rec.before); // applyPaste pushes its own undo
            break;
        }
        case 'insert': {
            pushUndo();
            // `i`-style: direction 'before' = insert at cursor, 'after' = insert one past cursor
            if (rec.direction === 'after') {
                const line = state.buffer[c.row] || '';
                c.col = Math.min(c.col + 1, line.length);
            }
            insertRecordedText(t, /* fromInsert = */ true);
            break;
        }
        case 'open': {
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
            const line = state.buffer[c.row];
            const after = line.slice(c.col);
            state.buffer[c.row] = line.slice(0, c.col);
            for (let r = ROWS - 1; r > c.row; r--) state.buffer[r] = state.buffer[r - 1];
            state.buffer[c.row + 1] = after;
            c.row++;
            c.col = 0;
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
        state.buffer[c.row] = line.slice(0, at) + text + line.slice(at);
        state.cursor = { row: c.row, col: Math.max(0, at + text.length - 1) };
        return;
    }

    // Multi-line insertion: split into pieces
    const pieces = text.split('\n');
    const tail = line.slice(at);
    const head = line.slice(0, at);
    // Current line becomes head + first piece
    state.buffer[c.row] = head + pieces[0];
    // The last piece merges with the tail
    const newLines = pieces.slice(1).slice();
    newLines[newLines.length - 1] = newLines[newLines.length - 1] + tail;
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
        const merged = firstLine + lastLine;

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
        const merged = firstLine + lastLine;
        const numLines = endRow - startRow + 1;
        state.buffer.splice(startRow, numLines, merged);
        while (state.buffer.length < ROWS) state.buffer.push('');
        state.cursor = { row: startRow, col: startCol };
    }

    setMode('insert');
    state.statusMsg = 'change...';
}


// --- Insert Mode ---
function handleInsertKey(e) {
    const key = e.key;

    if (key === 'Escape') {
        setMode('normal');
        clampCursor();
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
        } else if (c.row > 0) {
            const prev = state.buffer[c.row - 1];
            state.buffer[c.row - 1] = prev + state.buffer[c.row];
            state.buffer.splice(c.row, 1);
            state.buffer.push('');
            c.row--;
            c.col = prev.length;
        }
        render();
        return;
    }

    if (key === 'Enter') {
        const c = state.cursor;
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


// --- Normal Mode ---
function handleNormalKey(e) {
    let key = e.key;

    // Aliases: arrow keys act as hjkl; Backspace acts as h in normal mode
    if (key === 'ArrowLeft') key = 'h';
    else if (key === 'ArrowRight') key = 'l';
    else if (key === 'ArrowUp') key = 'k';
    else if (key === 'ArrowDown') key = 'j';
    else if (key === 'Backspace') key = 'h';

    // Escape cancels operator-pending
    if (key === 'Escape') {
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

    // Operator-pending entry (or double-tap like dd/cc/yy)
    if (key === 'd' || key === 'c' || key === 'y') {
        // Double-tap: dd deletes line, cc changes line, yy yanks line. Honors count prefix.
        if (state.mode === 'operator-pending' && state.pendingOperator === key) {
            const opCount = state.inputBuffer ? parseInt(state.inputBuffer) : 1;
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
        state.inputBuffer = ''; // clear any stale count for single-press operator entry
        state.mode = 'operator-pending';
        state.pendingOperator = key;
        state.statusMsg = key + ' ...';
        updateModeDisplay();
        return;
    }

    // x — delete char under cursor
    if (key === 'x') {
        const c = state.cursor;
        const line = state.buffer[c.row];
        if (line.length > 0) {
            pushUndo();
            // x is equivalent to dl: also fills the register so p can paste it
            setRegister(line[c.col], false);
            state.buffer[c.row] = line.slice(0, c.col) + line.slice(c.col + 1);
            state.lastChange = { kind: 'x' };
            clampCursor();
        }
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

    // Numeric prefix (counts start 1-9; 0 is the "beginning of line" motion)
    if (/[1-9]/.test(key)) {
        state.inputBuffer += key;
        state.statusMsg = state.inputBuffer;
        return;
    }

    // gg / G
    if (key === 'g') {
        if (state.inputBuffer === 'g') {
            state.inputBuffer = '';
            executeMovement('gg');
        } else {
            state.inputBuffer = 'g';
            state.statusMsg = 'g';
        }
        return;
    }
    if (key === 'G') { state.inputBuffer = ''; executeMovement('G'); return; }

    // Movement keys
    if ('hjklwb$0'.includes(key)) {
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
            const range = computeRange(key, oldPos, state.cursor);
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
}

// --- Key Dispatcher ---
function handleKeyDown(e) {
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
    e.preventDefault();
    if (state.mode === 'insert') {
        handleInsertKey(e);
    } else if (state.mode === 'pending-text-object') {
        handleTextObjectKey(e);
    } else {
        handleNormalKey(e);
    }
}

// --- Init ---
function init() {
    initBuffer();
    setMode('normal');
    render();
    const terminal = document.getElementById('terminal');
    terminal.tabIndex = 0;
    terminal.focus();
    document.addEventListener('keydown', handleKeyDown);
}

init();

