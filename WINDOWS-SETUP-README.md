# Windows Setup - Quick Start

## What's Been Configured

Your Windows installer setup is now complete! Here's what has been configured:

### ✅ Installer Configuration
- **NSIS Installer** with professional setup wizard
- **Portable Executable** for no-install usage
- **File Associations** for .md, .mmd, .mermaid, .ow files
- **Desktop & Start Menu** shortcuts
- **Custom Icons** for app and file types
- **License Agreement** (MIT License)
- **Uninstaller** with clean removal

### 📁 Files Created

1. **LICENSE.txt** - MIT license for installer agreement
2. **WINDOWS-SETUP.md** - Comprehensive setup guide
3. **INSTALLER-TEST-GUIDE.md** - Testing checklist
4. **build-windows.bat** - Interactive build script
5. **WINDOWS-SETUP-README.md** - This file

### ⚙️ Updated Configuration

**package.json** has been enhanced with:
- Complete NSIS installer settings
- Installation directory selection
- Desktop shortcut creation
- Start menu integration
- Post-install options
- LICENSE.txt inclusion

## Quick Commands

```bash
# Build portable EXE only (no installation required)
npm run build

# Build NSIS installer only (traditional installer)
npm run build-installer

# Build both versions
npm run build-all

# Interactive builder (Windows only)
build-windows.bat
```

## Output Files

After building, you'll find in the `dist/` folder:

- `Omnicore.Markdown.Viewer.2.0.4.exe` - Portable version
- `Omnicore.Markdown.Viewer.Setup.2.0.4.exe` - Installer version

## First-Time Build

If this is your first build:

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Build the installer
npm run build-installer

# 3. Test the installer
# Run: dist\Omnicore.Markdown.Viewer.Setup.2.0.4.exe
```

## Installer Features

When users run the installer, they get:

✅ **Welcome Screen** with license agreement
✅ **Installation Path** selection (default: Program Files)
✅ **Shortcuts** on Desktop and Start Menu
✅ **File Associations** for markdown files
✅ **Auto-launch** option after installation
✅ **Clean Uninstaller** via Windows Settings

## File Associations

After installation, these file types open with your app:

- `.md` → Markdown files
- `.mmd` → Mermaid diagram files
- `.mermaid` → Mermaid diagram files
- `.ow` → OmniWare wireframe files

Users can right-click any of these files and see "Open with Omnicore Markdown Viewer"

## Distribution Options

### For Personal/Internal Use
- Share the portable `.exe` file (no installation needed)

### For Public Distribution
- Share the installer `.exe` file (professional setup)
- Consider code signing for production (removes SmartScreen warnings)

## Next Steps

1. **Build and Test**
   ```bash
   npm run build-installer
   ```

2. **Install and Verify**
   - Run the installer from `dist/` folder
   - Test file associations
   - Verify shortcuts work

3. **Test Uninstallation**
   - Windows Settings → Apps → Uninstall
   - Verify clean removal

4. **Read Full Documentation**
   - See `WINDOWS-SETUP.md` for detailed configuration
   - See `INSTALLER-TEST-GUIDE.md` for testing checklist

## Troubleshooting

### Build Fails
```bash
# Reinstall dependencies
npm install

# Clear cache and rebuild
rmdir /s /q node_modules
npm install
npm run build-installer
```

### Installer Requires Admin
This is normal for per-machine installation. Users should:
- Right-click installer → "Run as administrator"

### SmartScreen Warning
This is expected for unsigned executables. Users can:
- Click "More info" → "Run anyway"
- For production: Get code signing certificate (~$200-400/year)

## Support & Documentation

- **Full Setup Guide**: `WINDOWS-SETUP.md`
- **Testing Guide**: `INSTALLER-TEST-GUIDE.md`
- **Build Script**: `build-windows.bat`
- **GitHub**: https://github.com/OmniCoreST/omnicore-markdown-viewer
- **Email**: info@omnicore.com.tr

## Configuration Files

All installer settings are in `package.json`:

```json
{
  "build": {
    "win": {
      // Windows build settings
      "icon": "logo.ico",
      "fileAssociations": [...],
      "target": ["portable", "nsis"]
    },
    "nsis": {
      // Installer-specific settings
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "runAfterFinish": true
    }
  }
}
```

To customize, edit these values and rebuild.

---

**Your Windows setup is ready to use! 🎉**

Run `npm run build-installer` to create your first installer.
