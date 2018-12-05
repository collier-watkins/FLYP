const electron = require('electron');
//const electron = window.require('electron');
//const fs = electron.remote.require('fs');
//const ipcRenderer = electron.ipcRenderer;

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    alwaysOnTop: true,
    width: 800, 
    height: 600
  });

  // and load the index.html of the app.
  const startUrl = process.env.ELECTRON_START_URL || url.format({
          pathname: path.join(__dirname, '/../build/index.html'),
          protocol: 'file:',
          slashes: true
      });
  mainWindow.loadURL(startUrl);
  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
  mainWindow.setFullScreen( true );

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {

  // We can call shutdown here if we want, wall to other terminals for testing
  //require('child_process').exec('wall YEET', function(msg){ console.log(msg) });

  if (process.platform !== 'darwin') {
      app.quit()
  }
});

app.on('before-quit', function () {

  require('child_process').exec('shutdown -h now');

});

app.on('activate', function () {

  if (mainWindow === null) {
      createWindow()
  }

});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
