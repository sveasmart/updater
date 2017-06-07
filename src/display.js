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

    this.mainTabColumn = 9

    const progressBarRow = 1
    this.progressBar = new ProgressBar(this.displayRpcPort, progressBarRow, this.mainTabColumn, "", this.logCalls)
  }

  showNetworkOk() {
    this._writeLineOnMainTab(0, "Network")
    this._writeLineOnMainTab(1, "OK")

    this._call("setTexts", [["Network OK"], this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showNetworkError(err) {
    this._writeLineOnMainTab(0, "NETWORK")
    this._writeLineOnMainTab(1, "ERROR!")

    this._call("setTexts", [["NETWORK ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showUpdateError(err) {
    this._writeLineOnMainTab(0, "UPDATE")
    this._writeLineOnMainTab(1, "ERROR!")

    this._call("setTexts", [["UPDATE ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }
  
  showUpdatingProgressBar() {
    this._writeLineOnMainTab(0, "Doing")
    this._writeLineOnMainTab(1, "update")
    this._writeLineOnMainTab(2, ".....")
  }

  hideUpdatingProgressBar() {
    this._writeLineOnMainTab(0, "Update")
    this._writeLineOnMainTab(1, "done")
    this._writeLineOnMainTab(2, "")
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