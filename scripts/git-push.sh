#!/bin/bash
cd /vercel/share/v0-project
git add -A
git commit -m "fix: timer now works correctly when tab is inactive

- Changed timer logic from increment-based to timestamp-based calculation
- Added startTimestamp and accumulatedSeconds state for accurate time tracking
- Added visibilitychange event listener to recalculate time when tab becomes visible
- Timer now reflects real elapsed time regardless of tab focus state

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"
git push origin dashboard-counter-fix
