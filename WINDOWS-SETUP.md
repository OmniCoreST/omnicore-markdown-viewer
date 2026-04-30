# Windows Setup Guide

This guide explains how to build and distribute the Omnicore Markdown Viewer for Windows.

## Prerequisites

1. **Node.js** (v16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Install Dependencies**
   ```bash
   npm install
   ```

## Build Options

The application supports two Windows build formats:

### 1. Portable Executable (.exe)
A standalone executable that doesn't require installation. Users can run it directly from any location.

```bash
npm run build
```

**Output**: `dist/Omnicore.Markdown.Viewer.2.0.4.exe`

**Features**:
- No installation required
- Can run from USB drives or network locations
- No admin rights needed
- Portable settings (stored in app directory)

### 2. NSIS Installer (.exe)
A traditional Windows installer that installs the application to Program Files.

```bash
npm run build-installer
```

**Output**: `dist/Omnicore.Markdown.Viewer.Setup.2.0.4.exe`

**Features**:
- Professional installer with wizard
- Installs to Program Files
- Creates Start Menu shortcuts
- Creates Desktop shortcut (optional during install)
- Registers file associations for .md, .mmd, .mermaid, .ow files
- Add/Remove Programs entry
- Clean uninstaller
- Option to run application after installation

### 3. Build Both
Create both portable and installer versions in one command:

```bash
npm run build-all
```

## Installer Features

The NSIS installer includes:

### Installation Options
- **Installation Directory**: Users can choose where to install (default: C:\Program Files\Omnicore Markdown Viewer)
- **Desktop Shortcut**: Option to create desktop shortcut
- **Start Menu**: Creates Start Menu folder with shortcuts
- **File Associations**: Automatically associates .md, .mmd, .mermaid, and .ow files
- **Run After Install**: Option to launch application immediately after installation

### User Experience
- Welcome screen with license agreement (MIT License)
- Progress bar during installation
- Custom installer icons (Omnicore logo)
- Per-machine installation (requires admin rights)
- Clean uninstallation process

### File Associations
When installed, the following file types will open with Omnicore Markdown Viewer:
- `.md` - Markdown documents
- `.mmd` - Mermaid diagrams
- `.mermaid` - Mermaid diagrams
- `.ow` - OmniWare wireframe files

Users can right-click these files and choose "Open with Omnicore Markdown Viewer".

## Distribution

### For End Users

**Portable Version**:
1. Download `Omnicore.Markdown.Viewer.2.0.4.exe`
2. Run the executable directly
3. No installation needed

**Installer Version**:
1. Download `Omnicore.Markdown.Viewer.Setup.2.0.4.exe`
2. Double-click to start installation wizard
3. Follow the installation steps
4. Application will be available in Start Menu and Desktop (if selected)

### For Developers

**Testing Installer Locally**:
1. Build the installer: `npm run build-installer`
2. Navigate to `dist/` folder
3. Run `Omnicore.Markdown.Viewer.Setup.2.0.4.exe`
4. Complete installation
5. Test file associations by opening .md files
6. Test uninstallation from Add/Remove Programs

**Build Configuration**:
All build settings are in `package.json` under the `build` section:
- `build.win` - Windows-specific settings
- `build.nsis` - NSIS installer settings
- `build.fileAssociations` - File type associations

## Customization

### Changing Installer Options

Edit `package.json` > `build` > `nsis`:

```json
"nsis": {
  "oneClick": false,                    // false = custom install, true = one-click
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,        // Create desktop shortcut
  "createStartMenuShortcut": true,      // Create start menu entry
  "runAfterFinish": true,               // Run app after install
  "perMachine": true,                   // Install for all users (requires admin)
  "deleteAppDataOnUninstall": false     // Keep user data on uninstall
}
```

### Changing Icons

Replace these files with your custom icons:
- `logo.ico` - Application icon (256x256, .ico format)
- `file-icon.ico` - File association icon (256x256, .ico format)

Then rebuild: `npm run build-installer`

### Changing Application Details

Edit `package.json`:
- `name` - Internal package name
- `productName` - Display name in installer
- `version` - Version number (appears in installer)
- `description` - Application description
- `author` - Company/developer name
- `homepage` - Website URL

## Troubleshooting

### Build Fails

**Problem**: `electron-builder` command not found
**Solution**:
```bash
npm install --save-dev electron-builder
```

**Problem**: Icon file not found
**Solution**: Ensure `logo.ico` and `file-icon.ico` exist in the root directory

**Problem**: "NSIS Error: Can't load icon"
**Solution**: Icons must be .ico format. Use a tool like ImageMagick or online converters to convert PNG to ICO

### Installer Issues

**Problem**: File associations not working
**Solution**:
- Uninstall the application completely
- Rebuild the installer
- Install again (requires admin rights)

**Problem**: Installer requires admin rights
**Solution**: This is expected for per-machine installation. Users can right-click > "Run as administrator"

**Problem**: Antivirus blocks installer
**Solution**:
- This is common with unsigned executables
- Consider code signing certificate for production releases
- Users can add exception in their antivirus

## Code Signing (Optional)

For production releases, consider signing your installer to avoid Windows SmartScreen warnings.

1. **Obtain a code signing certificate** from a trusted CA (e.g., DigiCert, Sectigo)
2. **Configure electron-builder** in package.json:

```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "your-password",
  "signingHashAlgorithms": ["sha256"]
}
```

3. **Build signed installer**:
```bash
npm run build-installer
```

**Note**: Code signing certificates cost ~$200-400/year but provide better trust for end users.

## Advanced Configuration

### Silent Installation

Users can install silently (for enterprise deployment):
```bash
Omnicore.Markdown.Viewer.Setup.2.0.4.exe /S
```

### Custom Install Directory (Silent)
```bash
Omnicore.Markdown.Viewer.Setup.2.0.4.exe /S /D=C:\CustomPath
```

### Uninstall Silently
```bash
"C:\Program Files\Omnicore Markdown Viewer\Uninstall Omnicore Markdown Viewer.exe" /S
```

## Release Checklist

Before distributing:

- [ ] Update version in `package.json`
- [ ] Test portable version on clean Windows machine
- [ ] Test installer on clean Windows machine
- [ ] Verify file associations work
- [ ] Test uninstaller completely removes app
- [ ] Check that Start Menu shortcuts work
- [ ] Verify Desktop shortcut works
- [ ] Test "Run as administrator" if needed
- [ ] Scan with antivirus to ensure clean build
- [ ] Test on Windows 10 and Windows 11
- [ ] Document any known issues
- [ ] Update changelog/release notes

## Support

For issues or questions:
- GitHub: https://github.com/OmniCoreST/omnicore-markdown-viewer
- Email: info@omnicore.com.tr
- Website: https://www.omnicore.com.tr
