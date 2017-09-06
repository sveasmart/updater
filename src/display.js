const Promise = require('promise')
const ProgressBar = require('./progress-bar')
const callDisplayOverRpc = require('./display-util').callDisplayOverRpc

class Display {
  constructor(deviceId, displayRpcPort, mainDisplayTab, networkInfoDisplayTab, logCalls = true) {
    this.deviceId = deviceId
    console.assert(deviceId, "missing deviceId param")

    this.displayRpcPort = displayRpcPort
    console.assert(displayRpcPort, "missing displayRpcPort param")

    this.mainDisplayTab = mainDisplayTab
    console.assert(mainDisplayTab, "missing mainDisplayTab param")

    this.networkInfoDisplayTab = networkInfoDisplayTab
    console.assert(networkInfoDisplayTab, "missing networkInfoDisplayTab param")

    this.logCalls = logCalls

    this.mainTabColumn = 0
  }

  showNetworkOk() {
    this._writeLineOnMainTab(7, "Network OK")

    this._call("setTexts", [["Network OK"], this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showNetworkError(err) {
    this._writeLineOnMainTab(7, "NETWORK ERROR!")

    this._call("setTexts", [["NETWORK ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showUpdateError(err) {
    this._writeLineOnMainTab(7, "UPDATE ERROR!")

    this._call("setTexts", [["UPDATE ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }
  
  showUpdatingProgressBar() {
    this._writeLineOnMainTab(7, "Updating...")
  }

  hideUpdatingProgressBar() {
    this._writeLineOnMainTab(7, "Update done!")
  }

  showDeviceId() {
    const deviceIdUpperCase = this.deviceId.toUpperCase()

    this._writeLineOnMainTab(6, 'ID: ' + deviceIdUpperCase)
  }
  
  _writeLineOnMainTab(row, text) {
    const col = this.mainTabColumn
    const rowLength = 16 - col
    //Add blank spaces to the rest of the row to override anything else there
    while (text.length < rowLength) {
      text = text + " "
    }
    this._call("writeText", [text, col, row, false, this.mainDisplayTab])
  }

  _call(method, args) {
    callDisplayOverRpc(this.displayRpcPort, method, args, this.logCalls)
      .catch((err) => {
        console.log("Failed to call display over RPC (probably temporary): " + err)
      })
  }
  
  
}

module.exports = Display