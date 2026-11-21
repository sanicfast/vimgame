// Canonical keystroke sequences — a single source of truth shared by:
//   - tests/challenge.test.js       (the simulator reproduces each target)
//   - tests/vim_equivalence.test.js (real Vim produces the same buffer)
// Sequences are per-challenge NAME (robust to CHALLENGES reordering) and use only
// features that are Vim-equivalent (no 80-col clip / 20-row grid / cross-line %).
// Keys are token arrays; tokens are single characters or the words 'Escape',
// 'Enter', 'Backspace', 'Space'.
module.exports = {
    SOLUTIONS: {
        'Open a New Line': ['o', 'b', 'e', 't', 'a', 'Escape'],
        'Close the Calls': ['A', '"', ')', 'Escape', 'j', '.'],
        'Add Semicolons': ['$', 'A', ';', 'Escape', 'j', '.', 'j', '.'],
        'Make It a List': ['I', '-', ' ', 'Escape', 'j', '.', 'j', '.'],
        'Duplicate the Line': ['y', 'y', 'p'],
        'Swap Two Characters': ['l', 'x', 'p', 'j', 'h', 'x', 'p'],
        'Fix the Typo': ['f', ':', 'r', ';', 'j', '.'],
        'Rewrite the Lines': ['c', 'c', '/', '/', ' ', 'd', 'o', 'n', 'e', 'Escape', 'j', '.'],
        'Reword the Comment': ['c', 'c', '#', ' ', 'c', 'a', 'l', 'c', 'u', 'l', 'a', 't', 'e', ' ', 't', 'o', 't', 'a', 'l', 'Escape', 'j', 'c', 'c', '#', ' ', 'a', 's', 's', 'e', 'm', 'b', 'l', 'e', ' ', 'i', 'n', 'p', 'u', 't', 'Escape'],
        'Delete Two Words': ['2', 'd', 'w', 'j', '.'],
        'Remove the Dots': ['f', '.', 'x', ';', 'x', ';', 'x', 'j', '0', 'f', '.', 'x', ';', 'x', ';', 'x'],
        'Swap Two Lines': ['d', 'd', 'p'],
        'Delete the Dead Code': ['j', '2', 'd', 'd', 'j', 'd', 'd'],
        'Set Every Value': ['c', 'i', '(', '4', '2', 'Escape', 'j', '.', 'j', '.', 'j', '.'],
        'Fill the Quotes': ['f', '"', 'l', 'i', 'a', 'l', 'i', 'c', 'e', 'Escape', 'j', '0', 'f', '"', 'l', 'i', 'b', 'o', 'b', 'Escape'],
        'Empty the Containers': ['0', 'f', '[', 'd', 'i', '[', 'j', '0', 'f', '{', 'd', 'i', '{', 'j', '0', 'f', '(', 'd', 'i', '('],
        'Trim the Tail': ['f', '|', 'd', '$', 'j', '0', 'f', '|', 'd', '$', 'j', '0', 'f', '|', 'd', '$'],
    },
};