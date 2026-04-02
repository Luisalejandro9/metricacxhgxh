import { execSync } from 'child_process';

const commitMessage = `fix: timer now works correctly when tab is inactive

- Changed timer logic from increment-based to timestamp-based calculation
- Added startTimestamp and accumulatedSeconds state for accurate time tracking
- Added visibilitychange event listener to recalculate time when tab becomes visible
- Timer now reflects real elapsed time regardless of tab focus state

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>`;

try {
  console.log('Adding changes...');
  execSync('git add -A', { cwd: '/vercel/share/v0-project', stdio: 'inherit' });
  
  console.log('Committing...');
  execSync(`git commit -m "${commitMessage}"`, { cwd: '/vercel/share/v0-project', stdio: 'inherit' });
  
  console.log('Pushing to dashboard-counter-fix...');
  execSync('git push origin dashboard-counter-fix', { cwd: '/vercel/share/v0-project', stdio: 'inherit' });
  
  console.log('Successfully pushed changes to GitHub!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
