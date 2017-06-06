const Promise = require('promise')
const ProgressBar = require('./progress-bar')
const callDisplayOverRpc = require('./display-util').callDisplayOverRpc

class Display {
  constructor(deviceId, displayRpcPort, mainDisplayTab, logCalls = true) {
    this.deviceId = deviceId
    console.assert(deviceId, "missing deviceId param")

    this.displayRpcPort = displayRpcPort
    console.assert(displayRpcPort, "missing displayRpcPort param")

    this.mainDisplayTab = mainDisplayTab
    console.assert(mainDisplayTab, "missing mainDisplayTab param")

    this.logCalls = logCalls

    this.mainTabColumn = 8

    const progressBarRow = 1
    this.progressBar = new ProgressBar(this.displayRpcPort, progressBarRow, this.mainTabColumn, 0, "", this.logCalls)
  }

  showNetworkOk() {
    this._writeLineOnMainTab(0, "Network")
    this._writeLineOnMainTab(1, "OK")
    this.showDeviceId()
  }

  showNetworkError(err) {
    this._writeLineOnMainTab(0, "Network")
    this._writeLineOnMainTab(1, "ERROR")
    this.showDeviceId()
  }

  showUpdateError(err) {
    this._writeLineOnMainTab(0, "Update")
    this._writeLineOnMainTab(1, "ERROR")
    this.showDeviceId()
  }
  
  showUpdatingProgressBar() {
    console.log("showUpdatingProgressBar")
    this._writeLineOnMainTab(0, "Update")
    this.progressBar.start()
  }

  hideUpdatingProgressBar() {
    console.log("hideUpdatingProgressBar")
    this._writeLineOnMainTab(0, "Update")
    this._writeLineOnMainTab(1, "OK")
    this.progressBar.stop()
  }


  showDeviceId() {
    const deviceIdUpperCase = this.deviceId.toUpperCase()
    const firstHalf = deviceIdUpperCase.substr(0, 5)
    const secondHalf = deviceIdUpperCase.substr(5)

    this._writeLineOnMainTab(5, 'Device:')
    this._writeLineOnMainTab(6, firstHalf)
    this._writeLineOnMainTab(7, secondHalf)
  }
  
  _writeLineOnMainTab(row, text) {
    const col = this.mainTabColumn
    const rowLength = 16 - col
    //Add blank spaces to the rest of the row to override anything else there
    while (text.length < rowLength) {
      text = text + " "
    }
    this._call("writeText", [text, row, col, false, this.mainDisplayTab])
  }

  _call(method, args) {
    callDisplayOverRpc(this.displayRpcPort, method, args, this.logCalls)
  }
  
  
}

module.exports = Display