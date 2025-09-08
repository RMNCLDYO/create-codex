import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { ProjectContext, TemplateVariables } from './types.js';
import { detectPackageManager, detectRuntime, detectFramework, exists } from './utils.js';
import { executeQuiet } from './exec.js';
import { withRetry } from './atomic.js';
import { logger } from './logger.js';
import { mapWithLimit } from './concurrency.js';

async function detectPurpose(projectPath: string): Promise<string | undefined> {
  const checks = [
    {
      path: 'package.json',
      parser: (content: string) => {
        try {
          const pkg = JSON.parse(content);
          return pkg.description;
        } catch {
          return undefined;
        }
      }
    },
    {
      path: 'Cargo.toml',
      parser: (content: string) => {
        const match = content.match(/description\s*=\s*"([^"]+)"/);
        return match?.[1];
      }
    },
    {
      path: 'pyproject.toml',
      parser: (content: string) => {
        const match = content.match(/description\s*=\s*"([^"]+)"/);
        return match?.[1];
      }
    },
    {
      path: 'README.md',
      parser: (content: string) => {
        const lines = content.split('\n');
        const descLine = lines.find(line => 
          !line.startsWith('#') && line.trim().length > 10
        );
        return descLine?.trim().slice(0, 200);
      }
    }
  ];

  for (const check of checks) {
    const filePath = join(projectPath, check.path);
    if (await exists(filePath)) {
      try {
        const content = await withRetry(
          async () => await readFile(filePath, 'utf-8'),
          `reading ${check.path}`,
          2
        );
        
        const purpose = check.parser(content);
        if (purpose && typeof purpose === 'string' && purpose.trim()) {
          return purpose.trim();
        }
      } catch (error) {
        logger.debug(`Failed to read ${check.path}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  return undefined;
}

async function getGitInfo(projectPath: string): Promise<{
  remoteUrl?: string | undefined;
  userName?: string | undefined;
  userEmail?: string | undefined;
  branch?: string | undefined;
}> {
  const gitCommands = [
    'git config --get remote.origin.url',
    'git config user.name',
    'git config user.email',
    'git rev-parse --abbrev-ref HEAD'
  ];
  
  const results = await mapWithLimit(gitCommands, 2, cmd =>
    executeQuiet(cmd, { cwd: projectPath, timeout: 5000 })
  );
  
  const [remoteUrl, userName, userEmail, branch] = results;
  
  return {
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(userName ? { userName } : {}),
    ...(userEmail ? { userEmail } : {}),
    ...(branch ? { branch } : {})
  };
}

export async function detectProjectContext(projectPath: string): Promise<ProjectContext> {
  logger.info('Detecting project context', { path: projectPath });
  
  const [
    hasGit,
    packageManager,
    runtime,
    hasCodexDir,
    framework
  ] = await Promise.all([
    exists(join(projectPath, '.git')),
    detectPackageManager(projectPath),
    detectRuntime(projectPath),
    exists(join(projectPath, '.codex')),
    detectFramework(projectPath)
  ]);

  const projectName = basename(projectPath);
  const gitInfo = hasGit ? await getGitInfo(projectPath) : {};
  
  const context: ProjectContext = {
    hasGit,
    packageManager,
    runtime,
    hasCodexDir,
    projectName,
    framework,
    ...(gitInfo.remoteUrl ? { gitRemoteUrl: gitInfo.remoteUrl } : {})
  };
  
  logger.debug('Project context detected', { 
    projectName: context.projectName,
    runtime: context.runtime,
    framework: context.framework
  });
  return context;
}

function formatVersionControl(
  hasGit: boolean,
  gitRemoteUrl?: string,
  projectPath?: string
): string {
  if (!hasGit) return 'No version control detected';
  
  if (gitRemoteUrl) {
    try {
      const url = new URL(gitRemoteUrl.replace(/^git@/, 'https://').replace(/:/g, '/'));
      if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
        return `https://github.com${url.pathname}`.replace(/\.git$/, '');
      }
      if (url.hostname === 'gitlab.com' || url.hostname === 'www.gitlab.com') {
        return `https://gitlab.com${url.pathname}`.replace(/\.git$/, '');
      }
      if (url.hostname === 'bitbucket.org' || url.hostname === 'www.bitbucket.org') {
        return `https://bitbucket.org${url.pathname}`.replace(/\.git$/, '');
      }
      return gitRemoteUrl;
    } catch (error) {
      return gitRemoteUrl;
    }
  }
  
  return projectPath ? `Local Git repository: ${projectPath}` : 'Local Git repository';
}

function formatRuntime(runtime: string): string {
  const runtimeNames: Record<string, string> = {
    'c/c++': 'C/C++',
    'rust': 'Rust',
    'go': 'Go',
    'python': 'Python',
    'java': 'Java',
    'typescript': 'TypeScript',
    'node': 'Node.js',
    'bun': 'Bun',
    'unknown': 'Unknown'
  };
  
  return runtimeNames[runtime] || runtime.charAt(0).toUpperCase() + runtime.slice(1);
}

async function getProjectCommands(
  projectPath: string,
  packageManager: string
): Promise<{ install?: string; dev?: string; build?: string; test?: string }> {
  const commands: { install?: string; dev?: string; build?: string; test?: string } = {};
  
  const packageJsonPath = join(projectPath, 'package.json');
  if (await exists(packageJsonPath)) {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      
      if (packageManager !== 'none') {
        const installCmd = packageManager === 'npm' ? 'npm install' : 
                          packageManager === 'yarn' ? 'yarn install' :
                          packageManager === 'pnpm' ? 'pnpm install' :
                          packageManager === 'bun' ? 'bun install' : undefined;
        if (installCmd) commands.install = installCmd;
      }
      
      if (pkg.scripts) {
        if (pkg.scripts.dev) commands.dev = `${packageManager} run dev`;
        else if (pkg.scripts.start) commands.dev = `${packageManager} run start`;
        
        if (pkg.scripts.build) commands.build = `${packageManager} run build`;
        if (pkg.scripts.test) commands.test = `${packageManager} run test`;
      }
    } catch (error) {
      logger.debug('Failed to parse package.json for commands', { error });
    }
  }
  
  if (packageManager === 'pip' || packageManager === 'poetry' || packageManager === 'uv') {
    const pythonInstall = packageManager === 'pip' ? 'pip install -r requirements.txt' :
                         packageManager === 'poetry' ? 'poetry install' :
                         packageManager === 'uv' ? 'uv pip install -r requirements.txt' : undefined;
    if (pythonInstall) commands.install = pythonInstall;
    commands.test = 'pytest';
  }
  
  return commands;
}

async function getProjectImports(
  projectPath: string,
  runtime: string
): Promise<string | undefined> {
  const importMappings: Record<string, Array<{ file: string; text: string }>> = {
    'typescript': [
      { file: 'package.json', text: '@package.json for available scripts' },
      { file: 'tsconfig.json', text: '@tsconfig.json for TypeScript configuration' }
    ],
    'node': [
      { file: 'package.json', text: '@package.json for available scripts' }
    ],
    'bun': [
      { file: 'package.json', text: '@package.json for available scripts' },
      { file: 'bun.lockb', text: '@bun.lockb for locked dependencies' }
    ],
    'python': [
      { file: 'pyproject.toml', text: '@pyproject.toml for project configuration' },
      { file: 'requirements.txt', text: '@requirements.txt for dependencies' },
      { file: 'setup.py', text: '@setup.py for package configuration' },
      { file: 'Pipfile', text: '@Pipfile for dependencies' }
    ],
    'go': [
      { file: 'go.mod', text: '@go.mod for module dependencies' },
      { file: 'go.sum', text: '@go.sum for dependency checksums' }
    ],
    'rust': [
      { file: 'Cargo.toml', text: '@Cargo.toml for project configuration' },
      { file: 'Cargo.lock', text: '@Cargo.lock for locked dependencies' }
    ],
    'java': [
      { file: 'pom.xml', text: '@pom.xml for Maven configuration' },
      { file: 'build.gradle', text: '@build.gradle for Gradle configuration' },
      { file: 'build.gradle.kts', text: '@build.gradle.kts for Gradle Kotlin DSL' }
    ],
    'c/c++': [
      { file: 'CMakeLists.txt', text: '@CMakeLists.txt for CMake configuration' },
      { file: 'Makefile', text: '@Makefile for build configuration' },
      { file: 'meson.build', text: '@meson.build for Meson configuration' }
    ]
  };

  const configs = importMappings[runtime];
  if (!configs) return undefined;

  const foundImports: string[] = [];
  for (const config of configs) {
    const filePath = join(projectPath, config.file);
    if (await exists(filePath)) {
      foundImports.push(config.text);
    }
  }

  if (foundImports.length === 0) return undefined;
  if (foundImports.length === 1) return foundImports[0];
  
  const lastImport = foundImports.pop()!;
  return foundImports.join(', ') + ' and ' + lastImport;
}

export async function getTemplateVariables(
  context: ProjectContext,
  projectPath: string
): Promise<TemplateVariables> {
  logger.info('Building template variables');
  
  const gitInfo = context.hasGit ? await getGitInfo(projectPath) : {};
  const purpose = await detectPurpose(projectPath);
  const projectImports = await getProjectImports(projectPath, context.runtime);
  const commands = await getProjectCommands(projectPath, context.packageManager);
  
  const variables: TemplateVariables = {
    PROJECT_NAME: context.projectName,
    PACKAGE_MANAGER: context.packageManager.toUpperCase(),
    RUNTIME: formatRuntime(context.runtime),
    TIMESTAMP: new Date().toISOString(),
    PROJECT_PATH: projectPath,
    VERSION_CONTROL: formatVersionControl(context.hasGit, context.gitRemoteUrl, projectPath),
    FRAMEWORK: context.framework,
    HAS_FRAMEWORK: context.framework !== 'None',
    HAS_PACKAGE_MANAGER: context.packageManager !== 'none',
    HAS_GIT: context.hasGit,
    ...(context.gitRemoteUrl ? { GIT_REMOTE_URL: context.gitRemoteUrl } : {}),
    ...(gitInfo.userName ? { USER_NAME: gitInfo.userName } : {}),
    ...(gitInfo.userEmail ? { USER_EMAIL: gitInfo.userEmail } : {}),
    ...(purpose ? { PURPOSE: purpose } : {}),
    ...(projectImports ? { PROJECT_IMPORTS: projectImports } : {}),
    ...(commands.install ? { INSTALL_COMMAND: commands.install } : {}),
    ...(commands.dev ? { DEV_COMMAND: commands.dev } : {}),
    ...(commands.build ? { BUILD_COMMAND: commands.build } : {}),
    ...(commands.test ? { TEST_COMMAND: commands.test } : {})
  };
  
  logger.debug('Template variables ready', {
    project: variables.PROJECT_NAME,
    runtime: variables.RUNTIME,
    framework: variables.FRAMEWORK
  });
  
  return variables;
}
