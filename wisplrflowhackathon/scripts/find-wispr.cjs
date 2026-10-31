const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Checking for Wispr Flow on Desktop / System ===');

// 1. Check running processes
try {
  const tasklist = execSync('tasklist /FO CSV', { encoding: 'utf-8' });
  const lines = tasklist.split('\n').filter(l => /wispr|flow/i.test(l));
  console.log('Running Wispr / Flow processes:', lines);
} catch (e) {
  console.log('Process check error:', e.message);
}

// 2. Check AppData paths
const checkDirs = [
  path.join(process.env.APPDATA || '', 'Wispr'),
  path.join(process.env.APPDATA || '', 'wispr-flow'),
  path.join(process.env.APPDATA || '', 'Wispr Flow'),
  path.join(process.env.APPDATA || '', 'WisprFlow'),
  path.join(process.env.LOCALAPPDATA || '', 'Wispr'),
  path.join(process.env.LOCALAPPDATA || '', 'wispr-flow'),
  path.join(process.env.LOCALAPPDATA || '', 'Wispr Flow'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Wispr Flow'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'wispr-flow'),
  path.join(process.env.USERPROFILE || '', '.wispr'),
  path.join(process.env.USERPROFILE || '', 'Documents', 'Wispr'),
  path.join(process.env.USERPROFILE || '', 'Documents', 'Wispr Flow')
];

checkDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`[FOUND DIR]: ${dir}`);
    try {
      const files = fs.readdirSync(dir);
      console.log(`  Contents of ${dir}:`, files.slice(0, 15));
    } catch (err) {
      console.log(`  Cannot read ${dir}:`, err.message);
    }
  }
});
