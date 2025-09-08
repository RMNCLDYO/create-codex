#!/usr/bin/env node

import { init } from './init.js';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
function validateArgs(args: string[]): { dryRun: boolean; directory: string | undefined } {
  const processedArgs = args[0] === 'init' ? args.slice(1) : args;
  let dryRun = false;
  let directory: string | undefined;
  
  for (const arg of processedArgs) {
    if (arg?.startsWith('-')) {
      if (!['--help', '-h', '--version', '-v', '--dry-run'].includes(arg)) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      if (arg === '--dry-run') dryRun = true;
    } else if (arg && !directory) {
      directory = arg;
    }
  }
  
  return { dryRun, directory };
}

function showVersion(): void {
  const packagePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const packageContent = readFileSync(packagePath, 'utf-8');
  const packageJson = JSON.parse(packageContent) as { version: string; [key: string]: unknown };
  console.log(packageJson.version);
}


async function runInit(options: { dryRun?: boolean; directory?: string | undefined } = {}): Promise<number> {
  const targetDir = options.directory ? resolve(options.directory) : process.cwd();
  
  console.log('create-codex sets up your AGENTS.md file following the open standard');
  console.log('format. Press ^C anytime to quit.');
  
  if (options.directory) {
    const fs = await import('node:fs/promises');
    try {
      await fs.mkdir(targetDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory: ${targetDir}`);
      return 1;
    }
  }
  
  const result = await init(targetDir, options);
  
  if (!result.success) {
    console.error(result.message);
    return 1;
  }
  
  if (!options.dryRun) {
    console.log('\nDone! AGENTS.md saved in current directory.');
    const createdFiles = [
      ' + AGENTS.md'
    ];
    
    console.log(createdFiles.join('\n'));
    console.log('\nTo get started:');
    console.log('  Open your project in your favorite AI coding agent!');
  } else {
    console.log(result.message);
  }
  return 0;
}

function showHelp(): void {
  console.log(`create-codex - Enhanced AGENTS.md setup`);
  console.log(``);
  console.log(`USAGE:`);
  console.log(`  create-codex [directory] [OPTIONS]`);
  console.log(`  cld [directory] [OPTIONS]`);
  console.log(``);
  console.log(`DESCRIPTION:`);
  console.log(`  Sets up AGENTS.md file following the open standard format.`);
  console.log(``);
  console.log(`ARGUMENTS:`);
  console.log(`  directory      Target directory (defaults to current directory)`);
  console.log(``);
  console.log(`OPTIONS:`);
  console.log(`  --help, -h     Show this help message`);
  console.log(`  --version, -v  Show version number`);
  console.log(`  --dry-run      Show what would be done without making changes`);
  console.log(``);
  console.log(`EXAMPLES:`);
  console.log(`  create-codex              # Setup in current directory`);
  console.log(`  create-codex my-project   # Setup in ./my-project directory`);
  console.log(`  create-codex --dry-run    # Preview changes without applying`);
}

function checkNodeVersion(): void {
  const currentVersion = process.version;
  const versionParts = currentVersion.slice(1).split('.');
  const majorVersion = parseInt(versionParts[0] || '0', 10);
  
  if (majorVersion < 20) {
    console.error(`Error: Node.js version ${currentVersion} is not supported.`);
    console.error(`Please upgrade to Node.js 20 or higher.`);
    console.error(`Visit https://nodejs.org to download the latest version.`);
    process.exit(1);
  }
}

function setupSignalHandlers(): void {
  let isShuttingDown = false;
  
  const handleShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    process.exit(1);
  };
  
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGHUP', () => handleShutdown('SIGHUP'));
  process.on('SIGQUIT', () => handleShutdown('SIGQUIT'));
}

async function main(): Promise<void> {
  checkNodeVersion();
  setupSignalHandlers();
  
  const rawArgs = process.argv.slice(2);
  
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    showVersion();
    process.exit(0);
  }
  
  const { dryRun, directory } = validateArgs(rawArgs);
  const exitCode = await runInit({ dryRun, directory });
  process.exit(exitCode);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
});
