# Omnicore Markdown Viewer

<div align="center">
  <img src="logo.png" alt="Omnicore Logo" height="100">
  <p><strong>A sleek, cross-platform markdown viewer with full HTML support and Mermaid diagram rendering</strong></p>
</div>

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/Electron-27.0-blue)

## Features

- **Full HTML Support** - Render HTML tags within markdown
- **Mermaid Diagrams** - Beautiful diagram rendering
- **Syntax Highlighting** - Code blocks with Fira Code font
- **Auto Table of Contents** - Hierarchical index of headers with one-click navigation
- **Search with Highlighting** - Find text with real-time highlighting (Ctrl+F)
- **Zoom Controls** - Keyboard shortcuts and mouse wheel zoom
- **Fullscreen Mode** - Distraction-free viewing
- **Recent Files** - Quick access to last 100 opened files
- **Professional Theme** - Clean interface with Omnicore branding
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **Offline Support** - Works without internet connection

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

Start the application in development mode:
```bash
npm start
```

## Building for Production

### Standalone Portable EXE (No Installation Required)
```bash
npm run build
```
This creates a portable `.exe` file in `dist/` folder that can run without installation.

### Windows Installer (NSIS)
```bash
npm run build-installer
```
This creates a Windows installer in `dist/` folder.

### Build Both
```bash
npm run build-all
```
This creates both portable exe and installer.

**Output location:** `dist/` folder

## Controls

### Keyboard Shortcuts

- **Ctrl+O** (Cmd+O on Mac) - Open markdown file
- **Ctrl+F** (Cmd+F on Mac) - Open search panel
- **Enter** (in search) - Next match
- **Shift+Enter** (in search) - Previous match
- **Escape** (in search) - Close search panel
- **Ctrl++** - Zoom in
- **Ctrl+-** - Zoom out
- **Ctrl+0** - Reset zoom to 100%
- **F11** - Toggle fullscreen
- **Escape** - Exit fullscreen

### Mouse Controls

- **Ctrl+Mouse Wheel** (Cmd+Mouse Wheel on Mac) - Zoom in/out
  - Scroll up to zoom in
  - Scroll down to zoom out

### Search Features

- **Real-time highlighting** - Matches are highlighted as you type
- **Match counter** - Shows current match and total matches (e.g., "3 of 15")
- **Navigation** - Use arrow buttons or Enter/Shift+Enter to navigate
- **Case-insensitive** - Searches ignore case differences
- **Minimum 2 characters** - Search activates after typing at least 2 characters

### Table of Contents

- **Auto-generated** - Automatically extracts all headers (H1-H6) from document
- **Hierarchical display** - Shows header levels with indentation
- **One-click navigation** - Click any header to jump to that section
- **Active highlighting** - Current section is highlighted in the TOC
- **Collapsible panel** - Click the TOC button in toolbar to show/hide

## Supported File Types

- `.md` - Markdown
- `.markdown` - Markdown
- `.mdown` - Markdown
- `.mkd` - Markdown
- `.mkdn` - Markdown

## Opening Files

### Method 1: Within the App
- Press `Ctrl+O` and browse for files
- Use Recent Files panel (left side)

### Method 2: Windows "Open With"
- Right-click any `.md` file in Windows Explorer
- Select "Open with" → "Omnicore Markdown Viewer"
- The file opens directly in the app

### Method 3: Default Program (After Installer)
- The NSIS installer registers the app for `.md` files
- You can set it as the default program for markdown files
- Double-click any `.md` file to open in Omnicore Markdown Viewer

### Method 4: Drag & Drop (Not yet implemented)
- Coming soon: Drag `.md` files onto the app window

## Mermaid Support

The viewer supports all Mermaid diagram types. Simply use mermaid code blocks:

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

## Technology Stack

- **Electron** - Cross-platform desktop framework
- **Marked** - Markdown parser
- **Mermaid** - Diagram rendering
- **DOMPurify** - HTML sanitization
- **Fira Code** - Monospace font

## Screenshots

<!-- Add screenshots here after building the app -->

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for Windows
npm run build-all
```

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Credits

Developed by [Omnicore](https://www.omnicore.com.tr)
