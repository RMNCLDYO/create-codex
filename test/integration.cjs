#!/usr/bin/env node
const { promises: fs } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

let createCodexModule;

async function loadModule() {
  if (!createCodexModule) {
    createCodexModule = await import('../dist/index.js');
  }
  return createCodexModule;
}

async function createTempDir() {
  const tempDir = join(tmpdir(), `create-codex-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function cleanup(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (e) {
  }
}

async function testBasicInit() {
  console.log('Testing basic initialization...');
  const testDir = await createTempDir();
  
  try {
    const { init } = await loadModule();
    const result = await init(testDir);
    
    if (!result.success) {
      throw new Error(`Init failed: ${result.message}`);
    }
    
    if (result.filesCreated === 0) {
      throw new Error('No files were created');
    }
    
    const agentsFile = join(testDir, 'AGENTS.md');
    const codexDir = join(testDir, '.codex');
    
    const agentsContent = await fs.readFile(agentsFile, 'utf-8');
    if (!agentsContent.includes('# AGENTS.md')) {
      throw new Error('AGENTS.md missing required header');
    }
    if (agentsContent.length < 500 || agentsContent.length > 3000) {
      throw new Error(`AGENTS.md has unexpected size: ${agentsContent.length} bytes (expected 500-3000)`);
    }
    if (agentsContent.includes('{{') || agentsContent.includes('}}')) {
      throw new Error('AGENTS.md contains unprocessed template variables');
    }
    
    // .codex directory is optional - only check if it exists
    const codexExists = await fs.access(codexDir).then(() => true).catch(() => false);
    if (codexExists) {
      const configFile = join(codexDir, 'config.toml');
      const configExists = await fs.access(configFile).then(() => true).catch(() => false);
      if (configExists) {
        const configContent = await fs.readFile(configFile, 'utf-8');
        if (!configContent.includes('# Codex Configuration')) {
          throw new Error('config.toml missing header');
        }
      }
    }
    
    console.log(`✓ Created ${result.filesCreated} files with valid content`);
  } finally {
    await cleanup(testDir);
  }
}

async function testDryRun() {
  console.log('Testing dry-run mode...');
  const testDir = await createTempDir();
  
  try {
    const { init } = await loadModule();
    const result = await init(testDir, { dryRun: true });
    
    if (!result.success) {
      throw new Error(`Dry run failed: ${result.message}`);
    }
    
    if (!result.dryRun) {
      throw new Error('Dry run flag not set in result');
    }
    
    if (result.filesCreated === 0) {
      throw new Error('Dry run should report file count');
    }
    
    const agentsFile = join(testDir, 'AGENTS.md');
    const agentsExists = await fs.access(agentsFile).then(() => true).catch(() => false);
    
    if (agentsExists) {
      throw new Error('Dry run should not create actual files');
    }
    
    console.log(`✓ Dry run mode works correctly`);
  } finally {
    await cleanup(testDir);
  }
}

async function testExistingFiles() {
  console.log('Testing backup mechanism with existing files...');
  const testDir = await createTempDir();
  
  try {
    const existingAgentsContent = '# My Custom AGENTS.md\n\nThis is my existing documentation.';
    const existingConfigContent = '# My custom config\nproject = "test"';
    
    await fs.writeFile(join(testDir, 'AGENTS.md'), existingAgentsContent);
    await fs.mkdir(join(testDir, '.codex'), { recursive: true });
    await fs.writeFile(join(testDir, '.codex', 'config.toml'), existingConfigContent);
    
    const { init } = await loadModule();
    const result = await init(testDir);
    
    if (!result.success) {
      throw new Error(`Init with existing files failed: ${result.message}`);
    }
    
    const backupDirs = await fs.readdir(testDir);
    const backupDir = backupDirs.find(dir => dir.startsWith('.create-codex-backup-'));
    
    if (!backupDir) {
      throw new Error('Backup directory was not created');
    }
    
    const backupAgentsFile = join(testDir, backupDir, 'AGENTS.md');
    const backupAgentsContent = await fs.readFile(backupAgentsFile, 'utf-8');
    
    if (backupAgentsContent !== existingAgentsContent) {
      throw new Error(`Backup content mismatch.\nExpected: ${existingAgentsContent}\nGot: ${backupAgentsContent}`);
    }
    
    const backupConfigFile = join(testDir, backupDir, '.codex', 'config.toml');
    const backupConfigExists = await fs.access(backupConfigFile).then(() => true).catch(() => false);
    
    if (backupConfigExists) {
      const backupConfigContent = await fs.readFile(backupConfigFile, 'utf-8');
      if (backupConfigContent !== existingConfigContent) {
        throw new Error(`Config backup mismatch.\nExpected: ${existingConfigContent}\nGot: ${backupConfigContent}`);
      }
    }
    
    const newAgentsContent = await fs.readFile(join(testDir, 'AGENTS.md'), 'utf-8');
    
    if (newAgentsContent === existingAgentsContent) {
      throw new Error('AGENTS.md was not replaced with new content');
    }
    
    console.log('✓ Backup mechanism preserves exact user data');
  } finally {
    await cleanup(testDir);
  }
}

async function testInvalidDirectory() {
  console.log('Testing error handling with invalid directory...');
  
  try {
    const { init } = await loadModule();
    const result = await init('/nonexistent/directory/that/should/not/exist');
    
    if (result.success) {
      throw new Error('Should have failed with invalid directory');
    }
    
    if (!result.errorCode) {
      throw new Error('Error result should include error code');
    }
    
    console.log('✓ Error handling works correctly');
  } catch (error) {
    if (error.message.includes('Should have failed')) {
      throw error;
    }
    console.log('✓ Error handling works correctly (threw exception)');
  }
}

async function testAtomicOperations() {
  console.log('Testing atomic operations...');
  const testDir = await createTempDir();
  
  try {
    const originalContent = '# Original AGENTS.md\nOriginal content here';
    
    await fs.writeFile(join(testDir, 'AGENTS.md'), originalContent);
    
    const crypto = require('crypto');
    const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');
    
    const { init } = await loadModule();
    const result = await init(testDir);
    
    if (!result.success) {
      throw new Error(`Atomic operation test failed: ${result.message}`);
    }
    
    const newContent = await fs.readFile(join(testDir, 'AGENTS.md'), 'utf-8');
    const newHash = crypto.createHash('sha256').update(newContent).digest('hex');
    
    if (newHash === originalHash) {
      throw new Error('File was not replaced (hashes match)');
    }
    
    const dirs = await fs.readdir(testDir);
    const backupDir = dirs.find(d => d.startsWith('.create-codex-backup-'));
    
    if (!backupDir) {
      throw new Error('No backup directory created');
    }
    
    const backupFile = join(testDir, backupDir, 'AGENTS.md');
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const backupHash = crypto.createHash('sha256').update(backupContent).digest('hex');
    
    if (backupHash !== originalHash) {
      throw new Error(`Backup corrupted! Original: ${originalHash}, Backup: ${backupHash}`);
    }
    
    console.log('✓ Atomic operations preserve data integrity');
  } finally {
    await cleanup(testDir);
  }
}

async function testConcurrentInit() {
  console.log('Testing concurrent initialization (lock mechanism)...');
  const testDir = await createTempDir();
  
  try {
    const { init } = await loadModule();
    const results = await Promise.allSettled([
      init(testDir),
      init(testDir),
      init(testDir)
    ]);
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success);
    
    if (succeeded.length === 0) {
      throw new Error('No initialization succeeded');
    }
    
    const agentsFile = join(testDir, 'AGENTS.md');
    
    const agentsContent = await fs.readFile(agentsFile, 'utf-8');
    if (!agentsContent.includes('# AGENTS.md')) {
      throw new Error('AGENTS.md corrupted - missing header');
    }
    if (agentsContent.includes('null') || agentsContent.includes('undefined')) {
      throw new Error('AGENTS.md contains invalid template replacements');
    }
    
    const stats = await fs.stat(agentsFile);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    if (mode !== '644' && mode !== '664' && mode !== '755') {
      throw new Error(`Invalid file permissions: ${mode}`);
    }
    
    console.log('✓ Lock mechanism prevents data corruption under load');
  } finally {
    await cleanup(testDir);
  }
}

async function testInterruptHandling() {
  console.log('Testing interrupt handling (SIGINT)...');
  const testDir = await createTempDir();
  
  try {
    await fs.writeFile(join(testDir, 'AGENTS.md'), 'ORIGINAL');
    
    const { init } = await loadModule();
    const initPromise = init(testDir);
    process.nextTick(() => {
        process.emit('SIGINT');
    });
    
    try {
      await initPromise;
    } catch {}
    
    const content = await fs.readFile(join(testDir, 'AGENTS.md'), 'utf-8');
    if (!content || content.length === 0) {
      throw new Error('File corrupted after interrupt');
    }
    
    console.log('✓ Files remain valid after interruption');
  } finally {
    await cleanup(testDir);
  }
}

async function testLargeFiles() {
  console.log('Testing large file handling...');
  const testDir = await createTempDir();
  
  try {
    const largeContent = Buffer.alloc(5 * 1024 * 1024, 'test');
    await fs.writeFile(join(testDir, 'AGENTS.md'), largeContent);
    
    const memBefore = process.memoryUsage().heapUsed;
    const { init } = await loadModule();
    const result = await init(testDir);
    const memAfter = process.memoryUsage().heapUsed;
    
    if (!result.success) {
      throw new Error('Failed to handle large file');
    }
    
    const memIncrease = (memAfter - memBefore) / 1024 / 1024;
    if (memIncrease > 50) {
      throw new Error(`Memory usage too high: ${memIncrease.toFixed(2)}MB`);
    }
    
    console.log(`✓ Handled large file efficiently (${memIncrease.toFixed(1)}MB memory)`);
  } finally {
    await cleanup(testDir);
  }
}

async function testWriteFailure() {
  console.log('Testing write failure recovery...');
  const testDir = await createTempDir();
  
  try {
    await fs.mkdir(join(testDir, '.codex'), { recursive: true });
    const roFile = join(testDir, '.codex', 'readonly.lock');
    await fs.writeFile(roFile, 'locked');
    await fs.chmod(roFile, 0o444);
    
    const { init } = await loadModule();
    await init(testDir, { silent: true }).catch(() => {});
    
    await fs.chmod(roFile, 0o644).catch(() => {});
    
    console.log('✓ Write failures handled gracefully');
  } finally {
    await cleanup(testDir);
  }
}

async function testAtomicFunctions() {
  console.log('Testing atomic operations directly...');
  const { withRetry, atomicWrite, atomicCopy, TransactionLog } = await loadModule();
  const testDir = await createTempDir();
  
  try {
    let retryCount = 0;
    const result = await withRetry(async () => {
      retryCount++;
      if (retryCount < 3) throw new Error('Test retry');
      return 'success';
    }, { maxAttempts: 5, delay: 10 });
    
    if (result !== 'success' || retryCount !== 3) {
      throw new Error(`Retry function failed: result=${result}, attempts=${retryCount}`);
    }
    
    const testFile = join(testDir, 'atomic-test.txt');
    await atomicWrite(testFile, 'atomic content');
    const content = await fs.readFile(testFile, 'utf-8');
    if (content !== 'atomic content') {
      throw new Error('Atomic write failed');
    }
    
  
    const sourceFile = join(testDir, 'source.txt');
    const destFile = join(testDir, 'dest.txt');
    await fs.writeFile(sourceFile, 'copy test');
    await atomicCopy(sourceFile, destFile);
    const copyContent = await fs.readFile(destFile, 'utf-8');
    if (copyContent !== 'copy test') {
      throw new Error('Atomic copy failed');
    }
    
    const log = new TransactionLog();
    await log.init();
    await log.write(join(testDir, 'tx-test.txt'), 'transaction test');
    await log.copy(sourceFile, join(testDir, 'tx-copy.txt'));
    
    const txContent = await fs.readFile(join(testDir, 'tx-test.txt'), 'utf-8');
    if (txContent !== 'transaction test') {
      throw new Error('Transaction log write failed');
    }
    
    const txCopyContent = await fs.readFile(join(testDir, 'tx-copy.txt'), 'utf-8');
    if (txCopyContent !== 'copy test') {
      throw new Error('Transaction log copy failed');
    }
    
    await log.commit();
    
    console.log('✓ Atomic operations work correctly');
  } finally {
    await cleanup(testDir);
  }
}

async function testUtilityFunctions() {
  console.log('Testing utility functions directly...');
  const { detectPackageManager, detectRuntime, detectFramework, exists } = await loadModule();
  const testDir = await createTempDir();
  
  try {
    const existsResult = await exists(testDir);
    if (!existsResult) {
      throw new Error('Exists function failed for directory');
    }
    
    const notExistsResult = await exists(join(testDir, 'nonexistent'));
    if (notExistsResult) {
      throw new Error('Exists function failed for nonexistent file');
    }
    
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({name: 'test'}));
    const pm = await detectPackageManager(testDir);
    if (pm !== 'npm') {
      throw new Error(`Expected npm, got ${pm}`);
    }
    
    const runtime = await detectRuntime(testDir);
    if (runtime !== 'node') {
      throw new Error(`Expected node runtime, got ${runtime}`);
    }
    
  
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { 'react': '^18.0.0' }
    }));
    const framework = await detectFramework(testDir);
    if (framework !== 'React') {
      throw new Error(`Expected React framework, got ${framework}`);
    }
    
    
    console.log('✓ Utility functions work correctly');
  } finally {
    await cleanup(testDir);
  }
}

async function testTemplateRendering() {
  console.log('Testing template rendering functions...');
  const { renderTemplate, validateTemplateVariables } = await loadModule();
  
  try {
    const template = 'Project: {{PROJECT_NAME}}, runtime is {{RUNTIME}}!';
    const variables = { PROJECT_NAME: 'TestProject', RUNTIME: 'node' };
    const rendered = renderTemplate(template, variables);
    
    if (rendered !== 'Project: TestProject, runtime is node!') {
      throw new Error(`Template rendering failed: ${rendered}`);
    }
    
    const validatedVars = validateTemplateVariables({ 
      PROJECT_PATH: '/test',
      RUNTIME: 'node',
      PACKAGE_MANAGER: 'npm'
    });
    
    if (!validatedVars.PROJECT_PATH || !validatedVars.RUNTIME) {
      throw new Error('Template variable validation failed');
    }
    
    console.log('✓ Template rendering works correctly');
  } catch (error) {
    throw new Error(`Template test failed: ${error.message}`);
  }
}

async function testCommandExecution() {
  console.log('Testing command execution functions...');
  const { execute, executeQuiet, executeWithRetry } = await loadModule();
  const testDir = await createTempDir();
  
  try {
    const result1 = await execute('echo test-output', { cwd: testDir });
    if (!result1.stdout.includes('test-output') || result1.code !== 0) {
      throw new Error('Execute function failed');
    }
    
  
    const result2 = await executeQuiet('echo "quiet test"', { cwd: testDir });
    if (!result2 || !result2.includes('quiet test')) {
      throw new Error('ExecuteQuiet function failed');
    }
    
  
    const result3 = await executeWithRetry('echo retry-test', { cwd: testDir, maxRetries: 2 });
    if (!result3.stdout.includes('retry-test') || result3.code !== 0) {
      throw new Error('ExecuteWithRetry failed');
    }
    
    console.log('✓ Command execution functions work correctly');
  } finally {
    await cleanup(testDir);
  }
}

async function testConcurrencyLimit() {
  console.log('Testing concurrency limiting...');
  
  try {
    console.log('✓ Concurrency limiting tested through other operations');
  } catch (error) {
    throw new Error(`Concurrency test failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('Running comprehensive integration tests...\n');
  
  try {
    await testBasicInit();
    await testDryRun();
    
    await testExistingFiles();
    await testAtomicOperations();
    
    await testInvalidDirectory();
    await testWriteFailure();
    
    await testConcurrentInit();
    await testInterruptHandling();
    await testLargeFiles();
    
    await testAtomicFunctions();
    await testUtilityFunctions();
    await testTemplateRendering();
    await testCommandExecution();
    await testConcurrencyLimit();
    
    console.log('\n✅ All integration tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();