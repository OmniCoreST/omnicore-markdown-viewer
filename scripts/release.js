#!/usr/bin/env node

/**
 * Release Script for Omnicore Markdown Viewer
 *
 * This script automates the release process:
 * 1. Prompts for version
 * 2. Builds for Windows and Linux
 * 3. Creates a GitHub release
 * 4. Uploads all artifacts for auto-update
 *
 * Prerequisites:
 * - GitHub CLI (gh) installed and authenticated
 * - Node.js and npm
 *
 * Usage:
 *   npm run release              # Interactive - asks for version
 *   npm run release -- 1.7.0     # Use specified version
 *   npm run release -- --skip-build  # Skip build, just create release
 *   npm run release -- --dry-run     # Simulate release without executing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${'='.repeat(50)}]`, colors.cyan);
  log(`[Step ${step}] ${message}`, colors.bright + colors.cyan);
  log(`[${'='.repeat(50)}]`, colors.cyan);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logDryRun(message) {
  log(`[DRY-RUN] ${message}`, colors.yellow);
}

// Global dry-run flag
let dryRun = false;

function exec(command, options = {}) {
  if (dryRun && !options.allowInDryRun) {
    logDryRun(`Would run: ${command}`);
    return options.dryRunReturn || '';
  }
  logInfo(`Running: ${command}`);
  try {
    const result = execSync(command, {
      cwd: ROOT_DIR,
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    return result;
  } catch (error) {
    if (!options.ignoreError) {
      logError(`Command failed: ${command}`);
      throw error;
    }
    return null;
  }
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function writePackageJson(pkg) {
  if (dryRun) {
    logDryRun(`Would update package.json with version ${pkg.version}`);
    return;
  }
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function askForVersion(currentVersion) {
  log('\n📦 Version Selection\n', colors.bright + colors.yellow);
  log(`Current version: ${currentVersion}`, colors.cyan);

  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const suggestions = {
    1: `${major}.${minor}.${patch + 1}`,  // patch
    2: `${major}.${minor + 1}.0`,          // minor
    3: `${major + 1}.0.0`                  // major
  };

  log('\nVersion options:', colors.yellow);
  log(`  1) ${suggestions[1]} (patch)`, colors.reset);
  log(`  2) ${suggestions[2]} (minor)`, colors.reset);
  log(`  3) ${suggestions[3]} (major)`, colors.reset);
  log(`  4) Keep current (${currentVersion})`, colors.reset);
  log(`  5) Enter custom version`, colors.reset);

  const choice = await prompt('\nSelect option (1-5): ');

  switch (choice) {
    case '1':
      return suggestions[1];
    case '2':
      return suggestions[2];
    case '3':
      return suggestions[3];
    case '4':
      return currentVersion;
    case '5':
      const custom = await prompt('Enter version (e.g., 1.7.0): ');
      if (!/^\d+\.\d+\.\d+$/.test(custom)) {
        logError('Invalid version format. Use semver (e.g., 1.7.0)');
        process.exit(1);
      }
      return custom;
    default:
      logError('Invalid option');
      process.exit(1);
  }
}

async function confirmRelease(version) {
  if (dryRun) {
    log(`\n⚠️  DRY-RUN: Would release version ${version}`, colors.yellow);
    return;
  }
  log(`\n⚠️  You are about to release version ${version}`, colors.yellow);
  const confirm = await prompt('Continue? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    log('Release cancelled.', colors.yellow);
    process.exit(0);
  }
}

function updateVersion(version) {
  const pkg = readPackageJson();
  if (pkg.version !== version) {
    pkg.version = version;
    writePackageJson(pkg);
    logSuccess(`Version updated to ${version}`);
    return true;
  }
  return false;
}

function checkPrerequisites() {
  logStep(1, 'Checking prerequisites');

  // Check GitHub CLI
  try {
    exec('gh --version', { silent: true, allowInDryRun: true });
    logSuccess('GitHub CLI (gh) is installed');
  } catch {
    logError('GitHub CLI (gh) is not installed');
    logInfo('Install it from: https://cli.github.com/');
    process.exit(1);
  }

  // Check gh auth status
  try {
    exec('gh auth status', { silent: true, allowInDryRun: true });
    logSuccess('GitHub CLI is authenticated');
  } catch {
    logError('GitHub CLI is not authenticated');
    logInfo('Run: gh auth login');
    process.exit(1);
  }

  // Check if we're in a git repo
  try {
    exec('git rev-parse --git-dir', { silent: true, allowInDryRun: true });
    logSuccess('Git repository detected');
  } catch {
    logError('Not a git repository');
    process.exit(1);
  }
}

function isWSL() {
  try {
    const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return release.includes('microsoft') || release.includes('wsl');
  } catch {
    return false;
  }
}

function buildWindows() {
  logStep(2, 'Building for Windows');

  if (dryRun) {
    if (isWSL()) {
      logDryRun('Would run Windows build via PowerShell (WSL detected)');
    } else if (process.platform === 'win32') {
      logDryRun('Would run Windows build (native Windows)');
    } else {
      logDryRun('Would attempt Windows build (requires Wine)');
    }
    return;
  }

  try {
    if (isWSL()) {
      // Running in WSL - use PowerShell for Windows build
      logInfo('Detected WSL environment, using PowerShell');
      exec('powershell.exe -Command "npm run build-installer"', { timeout: 600000 });
    } else if (process.platform === 'win32') {
      // Native Windows
      exec('npm run build-installer', { timeout: 600000 });
    } else {
      // Native Linux/macOS - need Wine for Windows builds
      logInfo('Attempting Windows build (requires Wine on Linux)');
      exec('npm run build-installer', { timeout: 600000 });
    }
    logSuccess('Windows build completed');
  } catch (error) {
    if (process.platform !== 'win32' && !isWSL()) {
      logInfo('Windows build skipped (not on Windows/WSL)');
    } else {
      logError('Windows build failed');
      throw error;
    }
  }
}

function buildLinux() {
  logStep(3, 'Building for Linux');

  if (dryRun) {
    if (isWSL() || process.platform === 'linux') {
      logDryRun('Would run Linux build');
    } else if (process.platform === 'win32') {
      logDryRun('Would skip Linux build (native Windows without WSL)');
    } else {
      logDryRun('Would run Linux build');
    }
    return;
  }

  try {
    if (isWSL() || process.platform === 'linux') {
      exec('npm run build-linux', { timeout: 600000 });
      logSuccess('Linux build completed');
    } else if (process.platform === 'win32') {
      // Native Windows can't build Linux without WSL
      logInfo('Linux build skipped (run from WSL or Linux for Linux builds)');
    } else {
      exec('npm run build-linux', { timeout: 600000 });
      logSuccess('Linux build completed');
    }
  } catch (error) {
    logInfo('Linux build failed or skipped');
  }
}

function getArtifacts(version) {
  logStep(4, 'Collecting build artifacts');

  if (dryRun) {
    // Show expected artifacts in dry-run mode
    const expectedArtifacts = [
      `Omnicore-Markdown-Viewer-Setup-${version}.exe`,
      `Omnicore Markdown Viewer Setup ${version}.exe`,
      `Omnicore.Markdown.Viewer-${version}.AppImage`,
      `omnicore-markdown-viewer_${version}_amd64.deb`,
      'latest.yml',
      'latest-linux.yml',
      `Omnicore-Markdown-Viewer-Setup-${version}.exe.blockmap`
    ];
    logDryRun('Expected artifacts:');
    expectedArtifacts.forEach(a => logDryRun(`  - ${a}`));
    return expectedArtifacts.map(a => path.join(DIST_DIR, a));
  }

  const artifacts = [];

  if (!fs.existsSync(DIST_DIR)) {
    logError('dist/ directory not found. Run build first.');
    process.exit(1);
  }

  const files = fs.readdirSync(DIST_DIR);

  // Find relevant files
  const patterns = [
    /Setup.*\.exe$/i,
    /\.AppImage$/i,
    /\.deb$/i,
    /^latest.*\.yml$/i,
    /\.blockmap$/i
  ];

  for (const file of files) {
    for (const pattern of patterns) {
      if (pattern.test(file)) {
        const filePath = path.join(DIST_DIR, file);
        if (fs.statSync(filePath).isFile()) {
          artifacts.push(filePath);
          logSuccess(`Found: ${file}`);
        }
        break;
      }
    }
  }

  if (artifacts.length === 0) {
    logError('No artifacts found in dist/ directory');
    process.exit(1);
  }

  logInfo(`Total artifacts: ${artifacts.length}`);
  return artifacts;
}

function renameWindowsInstaller(version) {
  // Rename installer to use dashes (required for auto-update)
  const spaceName = path.join(DIST_DIR, `Omnicore Markdown Viewer Setup ${version}.exe`);
  const dashName = path.join(DIST_DIR, `Omnicore-Markdown-Viewer-Setup-${version}.exe`);

  if (dryRun) {
    logDryRun(`Would copy installer with dashes: Omnicore-Markdown-Viewer-Setup-${version}.exe`);
    return;
  }

  if (fs.existsSync(spaceName) && !fs.existsSync(dashName)) {
    fs.copyFileSync(spaceName, dashName);
    logSuccess(`Created: Omnicore-Markdown-Viewer-Setup-${version}.exe`);
  }
}

function createGitHubRelease(version, artifacts) {
  logStep(5, 'Creating GitHub release');

  const tag = `v${version}`;
  const title = `v${version}`;

  // Create release notes
  const releaseNotes = `## Omnicore Markdown Viewer v${version}

### Downloads
- **Windows**: Download \`Omnicore-Markdown-Viewer-Setup-${version}.exe\`
- **Linux AppImage**: Download \`Omnicore.Markdown.Viewer-${version}.AppImage\`
- **Linux DEB**: Download \`omnicore-markdown-viewer_${version}_amd64.deb\`

### Auto-Update
Existing installations will automatically detect this update.

### Installation
1. Download the appropriate file for your OS
2. Run the installer (Windows) or make executable and run (Linux AppImage)
`;

  if (dryRun) {
    logDryRun(`Would check if release ${tag} exists`);
    logDryRun(`Would create release with tag: ${tag}`);
    logDryRun(`Would upload ${artifacts.length} artifacts`);
    logDryRun('Release notes would be:');
    releaseNotes.split('\n').forEach(line => logDryRun(`  ${line}`));
    return `https://github.com/OmniCoreST/omnicore-markdown-viewer/releases/tag/${tag}`;
  }

  // Check if release already exists
  try {
    exec(`gh release view ${tag}`, { silent: true });
    logInfo(`Release ${tag} already exists, deleting...`);
    exec(`gh release delete ${tag} --yes`, { ignoreError: true });
    exec(`git tag -d ${tag}`, { ignoreError: true, silent: true });
    exec(`git push origin :refs/tags/${tag}`, { ignoreError: true, silent: true });
  } catch {
    // Release doesn't exist, that's fine
  }

  // Write release notes to temp file
  const notesPath = path.join(ROOT_DIR, '.release-notes.md');
  fs.writeFileSync(notesPath, releaseNotes);

  // Create the release
  const artifactArgs = artifacts.map(a => `"${a}"`).join(' ');
  exec(`gh release create ${tag} --title "${title}" --notes-file "${notesPath}" ${artifactArgs}`);

  // Clean up
  fs.unlinkSync(notesPath);

  logSuccess(`GitHub release ${tag} created successfully!`);

  // Get release URL
  const releaseUrl = exec(`gh release view ${tag} --json url --jq .url`, { silent: true }).trim();
  logInfo(`Release URL: ${releaseUrl}`);

  return releaseUrl;
}

function commitVersionBump(version) {
  logInfo('Committing version bump...');
  exec(`git add package.json`);
  exec(`git commit -m "Bump version to ${version}"`, { ignoreError: true });
  exec(`git push`, { ignoreError: true });
  logSuccess('Version bump committed and pushed');
}

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  dryRun = args.includes('--dry-run');
  const versionArg = args.find(a => /^\d+\.\d+\.\d+$/.test(a));

  log('\n🚀 Omnicore Markdown Viewer Release Script\n', colors.bright + colors.cyan);

  if (dryRun) {
    log('⚠️  DRY-RUN MODE - No changes will be made\n', colors.yellow);
  }

  // Check prerequisites
  checkPrerequisites();

  // Get current version
  const currentVersion = readPackageJson().version;

  // Determine version
  let version;
  if (versionArg) {
    version = versionArg;
    logInfo(`Using specified version: ${version}`);
  } else {
    version = await askForVersion(currentVersion);
  }

  // Confirm
  await confirmRelease(version);

  // Update version in package.json if needed
  const versionChanged = updateVersion(version);
  if (versionChanged) {
    commitVersionBump(version);
  }

  // Build
  if (!skipBuild) {
    buildWindows();
    buildLinux();

    // Rename Windows installer for auto-update compatibility
    renameWindowsInstaller(version);
  } else {
    logInfo('Skipping build (--skip-build flag)');
  }

  // Collect artifacts
  const artifacts = getArtifacts(version);

  // Create GitHub release
  const releaseUrl = createGitHubRelease(version, artifacts);

  // Done!
  log('\n' + '='.repeat(60), dryRun ? colors.yellow : colors.green);
  if (dryRun) {
    log('🔍 DRY-RUN COMPLETED - No changes were made', colors.bright + colors.yellow);
  } else {
    log('🎉 Release completed successfully!', colors.bright + colors.green);
  }
  log('='.repeat(60), dryRun ? colors.yellow : colors.green);
  log(`\nVersion: ${version}`, colors.cyan);
  log(`Release: ${releaseUrl}`, colors.cyan);
  log(`Artifacts: ${artifacts.length} files ${dryRun ? 'would be' : ''} uploaded\n`, colors.cyan);

  if (dryRun) {
    log('Run without --dry-run to execute the release.\n', colors.yellow);
  }
}

main().catch(error => {
  logError(`Release failed: ${error.message}`);
  process.exit(1);
});
