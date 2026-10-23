import { spawn } from 'child_process';

// Only launch when explicitly run via `npm run install` or directly, NOT during `npm install`
if (process.env.npm_command !== 'install') {
  const isWindows = process.platform === 'win32';
  const command = isWindows
    ? 'npx.cmd vite --port=3000 --host=0.0.0.0'
    : 'npx vite --port=3000 --host=0.0.0.0';

  const child = spawn(command, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
