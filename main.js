const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let fileToOpen = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Omnicore Markdown Viewer',
    backgroundColor: '#f5f5f5',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'logo.ico')
  });

  // Maximize window on start
  mainWindow.maximize();

  mainWindow.loadFile('index.html');

  // Load file from command line after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    if (fileToOpen) {
      openFile(fileToOpen);
      fileToOpen = null;
    }
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.key === 'o' && input.type === 'keyDown') {
        event.preventDefault();
        openFileDialog();
      } else if (input.key === 'q' && input.type === 'keyDown') {
        event.preventDefault();
        app.quit();
      }
    }

    if (input.key === 'F11' && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'Escape' && input.type === 'keyDown') {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      }
    }
  });
}

function openFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return;
    }
    // Remove BOM if present
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.substring(1);
    }
    mainWindow.webContents.send('file-opened', {
      content: data,
      path: filePath,
      allPaths: [filePath]
    });
  });
}

function openFileDialog() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePaths = result.filePaths;

      // Read the first file to display
      const firstFilePath = filePaths[0];
      fs.readFile(firstFilePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }
        // Remove BOM if present
        if (data.charCodeAt(0) === 0xFEFF) {
          data = data.substring(1);
        }
        // Send first file content and all selected paths
        mainWindow.webContents.send('file-opened', {
          content: data,
          path: firstFilePath,
          allPaths: filePaths
        });
      });
    }
  }).catch(err => {
    console.error('Error opening file:', err);
  });
}

// Handle file open request from renderer
ipcMain.on('open-file-dialog', () => {
  openFileDialog();
});

// Handle file argument from command line or "Open with"
function handleFileArgument(argv) {
  // In packaged app: argv[1] is the file path
  // In development: argv[2] is the file path (argv[1] is the script)
  const filePath = app.isPackaged ? argv[1] : argv[2];

  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.md', '.markdown', '.mdown', '.mkd', '.mkdn'].includes(ext)) {
      fileToOpen = filePath;
      return true;
    }
  }
  return false;
}

// Check for file argument on first launch
handleFileArgument(process.argv);

// Handle second-instance (when app is already running and user opens another file)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // User opened a file while app is running
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle the file from second instance
      if (handleFileArgument(commandLine)) {
        openFile(fileToOpen);
        fileToOpen = null;
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
