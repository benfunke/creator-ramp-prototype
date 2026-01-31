# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! (unalias rg 2>/dev/null; command -v rg) >/dev/null 2>&1; then
  alias rg=''\''C:\Users\ben_f\AppData\Roaming\Claude\claude-code\2.1.15\claude.exe'\'' --ripgrep'
fi
export PATH=$PATH
