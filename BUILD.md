# Building Omnicore Markdown Viewer

This guide explains how to create a standalone executable (.exe) file.

## Prerequisites

1. **Node.js** installed (https://nodejs.org/)
2. **Git Bash** or **Command Prompt** on Windows

## Step-by-Step Build Instructions

### 1. Install Dependencies

Open terminal in the project folder and run:
```bash
npm install
```

This will install all required packages including electron-builder.

### 2. Build Standalone EXE

To create a **portable .exe** file (no installation required):
```bash
npm run build
```

**Wait time:** 2-5 minutes depending on your computer

### 3. Find Your EXE

After the build completes, look in the `dist/` folder:
```
dist/
└── Omnicore Markdown Viewer 1.0.0.exe
```

This is your **standalone executable**!

## Alternative Build Options

### Windows Installer (for distribution)
```bash
npm run build-installer
```
Creates: `dist/Omnicore Markdown Viewer Setup 1.0.0.exe`

### Build Everything
```bash
npm run build-all
```
Creates both portable exe and installer.

## File Sizes

- **Portable EXE:** ~150-200 MB (includes Electron runtime)
- **Installer:** ~150-200 MB compressed

## Distribution

The portable .exe file can be:
- ✅ Copied to any Windows PC
- ✅ Run without installation
- ✅ Placed on USB drive
- ✅ Shared with colleagues
- ✅ Run from network drive

## Troubleshooting

**Build fails?**
- Delete `node_modules` folder
- Run `npm install` again
- Try `npm run build` again

**Missing icon?**
- Ensure `logo.png` is in the project root folder

**Antivirus blocks exe?**
- This is normal for unsigned executables
- Add exception or sign the executable with a code signing certificate

## Code Signing (Optional)

For production distribution, consider code signing to avoid Windows SmartScreen warnings:
1. Purchase a code signing certificate
2. Configure in `package.json` under `build.win.certificateFile`
3. Add certificate password to environment variables

## Clean Build

To start fresh:
```bash
# Delete build artifacts
rmdir /s /q dist
rmdir /s /q node_modules

# Reinstall and build
npm install
npm run build
```
