#!/bin/bash
# Starts the Mecanova Admin dev server fully detached from the parent process.
# Invoked by "Mecanova Admin.app" on the Desktop.

export PATH="/Users/felixbaitz/.nvm/versions/node/v20.20.1/bin:$PATH"
cd "/Users/felixbaitz/Documents/Mecanova_Projects/mecanova-partner-portal" || exit 1

# Already running on port 3001?
if lsof -i :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
  exit 0
fi

# Double-fork via subshell so npm is reparented to launchd
# and survives when the calling .app exits.
(
  nohup npm run dev --workspace=admin </dev/null >/tmp/mecanova-admin.log 2>&1 &
  disown
) &

exit 0
