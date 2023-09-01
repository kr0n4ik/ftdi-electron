const { app, BrowserWindow } = require('electron')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1500,
        height: 800,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            webSecurity: false,
        }
    })
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
})