const Promise = require('promise')
const ProgressBar = require('./progress-bar')
const callDisplayOverRpc = require('./display-util').callDisplayOverRpc

/**
 * I know how to display stuff. Updater tells me what's going on, and I make sure it is displayed correctly.
 * 
 * If displayRpcPort is given, then I'll use RPC to talk to a separate service that handles display stuff,
 * using this protocol: https://github.com/sveasmart/display
 *
 * If displayRpcPort is not given (or falsy), then I'll just log to the local console.
 */
class Display {
  constructor(deviceId, displayRpcPort, mainDisplayTab, networkInfoDisplayTab, logCalls = true) {
    this.deviceId = deviceId
    console.assert(deviceId, "missing deviceId param")

    this.displayRpcPort = displayRpcPort
    if (this.displayRpcPort) {
      console.log("I will talk to a display via RPC on port " + this.displayRpcPort)

      this.mainDisplayTab = mainDisplayTab
      console.assert(mainDisplayTab, "missing mainDisplayTab param")

      this.networkInfoDisplayTab = networkInfoDisplayTab
      console.assert(networkInfoDisplayTab, "missing networkInfoDisplayTab param")

      this.logCalls = logCalls

      this.mainTabColumn = 0

    } else {
      console.log("No displayRpcPort set, so I will use console.log")
    }

  }

  showNetworkOk() {
    if (!this.displayRpcPort) {
      console.log("Network OK")
      return
    }

    this._writeLineOnMainTab(7, "Network OK")

    this._call("setTexts", [["Network OK"], this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showNetworkError(err) {
    if (!this.displayRpcPort) {
      console.log("NETWORK ERROR", err)
      return
    }

    this._writeLineOnMainTab(7, "NETWORK ERROR!")

    this._call("setTexts", [["NETWORK ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }

  showUpdateError(err) {
    if (!this.displayRpcPort) {
      console.log("UPDATE ERROR", err)
      return
    }

    this._writeLineOnMainTab(7, "UPDATE ERROR!")

    this._call("setTexts", [["UPDATE ERROR"], this.networkInfoDisplayTab ])
    this._call("writeText", [err.message, 0, 1, true, this.networkInfoDisplayTab ])

    this.showDeviceId()
  }
  
  showUpdatingProgressBar() {
    if (!this.displayRpcPort) {
      console.log("Updating...")
      return
    }


    this._writeLineOnMainTab(7, "Updating...")
  }

  hideUpdatingProgressBar() {
    if (!this.displayRpcPort) {
      console.log("Update done!")
      return
    }
    this._writeLineOnMainTab(7, "Update done!")
  }

  showDeviceId() {
    if (!this.displayRpcPort) {
      console.log("ID: " + this.deviceId.toUpperCase())
      return
    }

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