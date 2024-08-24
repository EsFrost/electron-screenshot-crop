const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('GET_SOURCES', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.map(source => ({ id: source.id, name: source.name }));
});

ipcMain.on('save-image', (event, dataURL) => {
    dialog.showSaveDialog({
        title: 'Save screenshot',
        defaultPath: `screenshot-${Date.now()}.png`,
        filters: [{ name: 'Images', extensions: ['png'] }]
    }).then(result => {
        if (!result.canceled) {
            // Remove the data URL prefix
            const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

            fs.writeFile(result.filePath, base64Data, 'base64', (err) => {
                if (err) {
                    console.error('Error saving the image:', err);
                    event.reply('save-image-response', { success: false, error: err.message });
                } else {
                    event.reply('save-image-response', { success: true });
                }
            });
        }
    }).catch(err => {
        console.error(err);
        event.reply('save-image-response', { success: false, error: err.message });
    });
});