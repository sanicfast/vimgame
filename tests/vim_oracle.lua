-- Real-Vim oracle driver (Neovim). Usage:
--   nvim --headless -u NONE -n -i NONE -l vim_oracle.lua <job.json>
-- job.json = { startLines = [ ... ], keys = "<Normal-mode key string>" }
-- It loads startLines into a clean buffer, positions the cursor at line 1/col 0,
-- applies `keys` as Normal-mode input via `:normal!` (synchronous, so no typeahead
-- timing races), then writes the resulting buffer lines as a JSON array to stdout.
--
-- Options are neutralized so real Vim behaves like the simulator:
--   * formatoptions=''  -> `o`/`O`/`cc` never auto-continue a comment leader
--   * no autoindent/smartindent/cindent -> the simulator never re-indents
local job = vim.json.decode(io.open(arg[1], 'r'):read('*a'))
local buf = vim.api.nvim_get_current_buf()
vim.api.nvim_buf_set_lines(buf, 0, -1, false, job.startLines)
vim.bo[buf].formatoptions = ''
vim.bo[buf].autoindent = false
vim.bo[buf].smartindent = false
vim.bo[buf].cindent = false
-- Indent policy is pinned to match the simulator's: shift by 2, insert spaces
-- (not tabs). These only affect the indent operators (>, <, =); no other test
-- types Tab or indents, so this is otherwise inert.
vim.bo[buf].shiftwidth = 2
vim.bo[buf].expandtab = true
-- Cursor: 0-based {row, col} in the job; default to line 1 / col 0.
local cur = job.cursor or { row = 0, col = 0 }
vim.api.nvim_win_set_cursor(0, { cur.row + 1, cur.col })
vim.cmd('1normal! ' .. job.keys)
io.write(vim.json.encode(vim.api.nvim_buf_get_lines(buf, 0, -1, false)))
io.flush()
vim.cmd('qa!')