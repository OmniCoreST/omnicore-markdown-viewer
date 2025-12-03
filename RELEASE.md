# Release Guide

This document explains how to create releases for Omnicore Markdown Viewer.

## Prerequisites

Before running the release script, ensure you have:

1. **GitHub CLI (gh)** installed and authenticated
   ```bash
   # Install (Ubuntu/Debian)
   sudo apt install gh

   # Install (Windows)
   winget install GitHub.cli

   # Authenticate
   gh auth login
   ```

2. **Node.js and npm** installed

3. **Git repository** properly configured with remote

## Usage

### Interactive Release (Recommended)

```bash
npm run release
```

This will:
1. Check prerequisites
2. Show current version and prompt for new version (patch/minor/major/custom)
3. Ask for confirmation
4. Build for Windows and Linux
5. Create GitHub release with all artifacts

### Specify Version Directly

```bash
npm run release -- 1.7.0
```

### Dry Run (Preview without executing)

```bash
npm run release -- --dry-run
npm run release -- --dry-run 1.7.0
```

Shows what would happen without making any changes. Useful for verifying the release process.

### Skip Build (Use existing artifacts)

```bash
npm run release -- --skip-build
npm run release -- --skip-build 1.7.0
```

Skips the build step and uses existing files in `dist/` folder. Useful when you've already built the artifacts.

### Combine Options

```bash
npm run release -- --dry-run --skip-build 1.7.0
```

## What the Script Does

1. **Checks prerequisites** - Verifies gh CLI, authentication, and git repo
2. **Version selection** - Interactive menu or use provided version
3. **Updates package.json** - Bumps version if changed
4. **Commits version bump** - Creates git commit and pushes
5. **Builds Windows** - Creates NSIS installer (.exe)
6. **Builds Linux** - Creates AppImage and .deb packages
7. **Renames installer** - Creates dash-named installer for auto-update compatibility
8. **Collects artifacts** - Gathers all release files from dist/
9. **Creates GitHub release** - Uploads all artifacts with release notes

## Build Artifacts

The following files are included in each release:

| File | Platform | Description |
|------|----------|-------------|
| `Omnicore-Markdown-Viewer-Setup-X.X.X.exe` | Windows | NSIS installer |
| `Omnicore.Markdown.Viewer-X.X.X.AppImage` | Linux | Portable AppImage |
| `omnicore-markdown-viewer_X.X.X_amd64.deb` | Linux | Debian package |
| `latest.yml` | Windows | Auto-update manifest |
| `latest-linux.yml` | Linux | Auto-update manifest |
| `*.blockmap` | Windows | Delta update support |

## Platform Notes

### Running from WSL (Recommended)
- Windows build uses PowerShell automatically
- Linux build runs natively
- Both platforms built in single run

### Running from Native Windows
- Windows build runs natively
- Linux build skipped (use WSL for Linux builds)

### Running from Native Linux
- Linux build runs natively
- Windows build requires Wine (may not work)

## Troubleshooting

### "GitHub CLI is not installed"
Install gh from https://cli.github.com/

### "GitHub CLI is not authenticated"
Run `gh auth login` and follow the prompts

### "No artifacts found in dist/"
Run without `--skip-build` or build manually first:
```bash
npm run build-installer  # Windows
npm run build-linux      # Linux
```

### Build fails on WSL
Ensure you have the required dependencies:
```bash
sudo apt update
sudo apt install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libsecret-1-0
```
