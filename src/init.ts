import { detectProjectContext, getTemplateVariables } from './projects.js';
import { copyCodexDirectory, copyAdditionalFiles } from './files.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { exists } from './utils.js';
import { ErrorCode, type TemplateVariables } from './types.js';
import { logger, LogLevel, configureLogger } from './logger.js';

export interface InitOptions {
  dryRun?: boolean;
}

export interface InitResult {
  success: boolean;
  filesCreated: number;
  message: string;
  createdFiles?: string[];
  projectName?: string;
  dryRun?: boolean;
  errorCode?: ErrorCode;
}

class InitError extends Error {
  constructor(message: string, public code: ErrorCode) {
    super(message);
    this.name = 'InitError';
  }
}

async function validateTargetDirectory(projectPath: string): Promise<void> {
  try {
    const targetStat = await fs.stat(projectPath);
    if (!targetStat.isDirectory()) {
      throw new InitError(
        `INVALID PATH: Not a directory\n` +
        `Action: Ensure path exists and is a directory`,
        ErrorCode.INVALID_TARGET_DIRECTORY
      );
    }
  } catch (error) {
    if (error instanceof InitError) throw error;
    throw new InitError(
      `CANNOT ACCESS: Target directory\n` +
      `Action: Check path exists and you have read permissions`,
      ErrorCode.INVALID_TARGET_DIRECTORY
    );
  }
  
  const testFile = join(projectPath, `.create-codex-test-${Date.now()}`);
  try {
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
  } catch (error) {
    throw new InitError(
      `NO WRITE PERMISSION\n` +
      `Action: Check directory permissions`,
      ErrorCode.NO_WRITE_PERMISSION
    );
  }
}

async function validateSkelFiles(): Promise<void> {
  const skelDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skel');
  
  if (!await exists(skelDir)) {
    throw new InitError(
      `PACKAGE CORRUPTED: Skeleton files missing\n` +
      `Expected: ${skelDir}\n` +
      `Action: Reinstall with 'npm install -g create-codex'`,
      ErrorCode.SKELETON_FILES_MISSING
    );
  }
  
  const requiredFiles = [
    'AGENTS.md'
  ];
  
  const missingFiles: string[] = [];
  await Promise.all(
    requiredFiles.map(async file => {
      const filePath = join(skelDir, file);
      if (!await exists(filePath)) {
        missingFiles.push(file);
      }
    })
  );
  
  if (missingFiles.length > 0) {
    throw new InitError(
      `PACKAGE CORRUPTED: Required files missing\n` +
      `Missing: ${missingFiles.join(', ')}\n` +
      `Action: Reinstall with 'npm install -g create-codex'`,
      ErrorCode.SKELETON_FILES_MISSING
    );
  }
}

async function checkExistingFiles(projectPath: string): Promise<string[]> {
  const files = ['AGENTS.md'];
  const existing: string[] = [];
  
  await Promise.all(
    files.map(async file => {
      const filePath = join(projectPath, file);
      if (await exists(filePath)) {
        existing.push(file);
      }
    })
  );
  
  return existing;
}

async function countFilesRecursively(dir: string): Promise<number> {
  let count = 0;
  
  async function traverse(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        await traverse(join(currentDir, entry.name));
      }
    }
  }
  
  await traverse(dir);
  return count;
}

async function performDryRun(
  _projectPath: string,
  context: any
): Promise<InitResult> {
  const skelDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skel');
  const codexDir = join(skelDir, '.codex');
  let codexFiles = 0;
  
  if (await exists(codexDir)) {
    codexFiles = await countFilesRecursively(codexDir);
  }
  
  const additionalFiles = 1;
  const totalFiles = codexFiles + additionalFiles;
  
  return {
    success: true,
    filesCreated: totalFiles,
    message: `[DRY RUN] Would create ${totalFiles} files for ${context.projectName} (${context.runtime} + ${context.framework})`,
    dryRun: true
  };
}

async function performFileCopy(
  projectPath: string,
  templateVariables: TemplateVariables
): Promise<{ filesCreated: number; backupDir?: string | undefined }> {
  const codexResult = await copyCodexDirectory(projectPath, templateVariables);
  const additionalResult = await copyAdditionalFiles(
    projectPath,
    templateVariables,
    codexResult.backupDir
  );
  
  return {
    filesCreated: codexResult.filesProcessed + additionalResult.filesProcessed,
    backupDir: codexResult.backupDir
  };
}

async function validateInstallation(projectPath: string): Promise<void> {
  const criticalFiles = ['AGENTS.md'];
  const missing: string[] = [];
  
  await Promise.all(
    criticalFiles.map(async file => {
      const filePath = join(projectPath, file);
      if (!await exists(filePath)) {
        missing.push(file);
      }
    })
  );
  
  if (missing.length > 0) {
    throw new InitError(
      `INSTALLATION FAILED: Critical files not created\n` +
      `Missing: ${missing.join(', ')}\n` +
      `Action: Check disk space and permissions, then retry`,
      ErrorCode.VALIDATION_FAILED
    );
  }
}

export async function init(
  projectPath: string,
  options: InitOptions = {}
): Promise<InitResult> {
  const { dryRun = false } = options;
  
  configureLogger({
    level: LogLevel.INFO,
    silent: true
  });
  
  try {
    await validateSkelFiles();
    await validateTargetDirectory(projectPath);
    
    await checkExistingFiles(projectPath);
    const context = await detectProjectContext(projectPath);
    const templateVariables = await getTemplateVariables(context, projectPath);
    
    if (dryRun) {
      return await performDryRun(projectPath, context);
    }
    
    const { filesCreated, backupDir } = await performFileCopy(projectPath, templateVariables);
    
    if (backupDir) {
      logger.info('Created backup', { dir: backupDir });
    }
    
    await validateInstallation(projectPath);
    
    return {
      success: true,
      filesCreated,
      message: `Successfully initialized ${filesCreated} files for ${context.projectName}`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = error instanceof InitError ? error.code : ErrorCode.UNKNOWN_ERROR;
    
    logger.error('Initialization failed', { error: errorMessage, code: errorCode });
    
    return {
      success: false,
      filesCreated: 0,
      message: errorMessage,
      errorCode
    };
  }
}
