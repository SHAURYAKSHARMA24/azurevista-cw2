const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || '8080';
const serveMain = path.join(__dirname, 'node_modules', 'serve', 'build', 'main.js');

const child = spawn(process.execPath, [serveMain, '-s', 'dist', '-l', port], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});
