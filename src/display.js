const Promise = require('promise')
const DisplayRpcClient = require('./display-rpc-client')

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

      this.updaterStatus = "Starting up..."
      this.updaterError = null
      this.wasLastDisplayCallSuccessful = false

    } else {
      console.log("No displayRpcPort set, so I will use console.log")
    }

  }

  showNetworkConnecting() {
    this._setStatusAndSendToDisplay("Connecting...")
  }

  showNetworkOk() {
    this._setStatusAndSendToDisplay("Network OK")
  }

  showNetworkError(err) {
    this._setStatusAndSendToDisplay("NETWORK ERROR", err)
  }

  showUpdateError(err) {
    this._setStatusAndSendToDisplay("UPDATE ERROR", err)
  }
  
  showUpdating() {
    this._setStatusAndSendToDisplay("Updating...")
  }

  showUpdateDone() {
    this._setStatusAndSendToDisplay("Update done!")
  }

  showDeviceId() {
    this._sendStatusToDisplay()
  }

  resendStatusToDisplayIfLastAttemptFailed() {
    if (!this.wasLastDisplayCallSuccessful) {
      console.log("Last RPC-call to display failed, so I'm trying again now.")
      this._sendStatusToDisplay()
    }
  }

  _setStatusAndSendToDisplay(status, error) {
    this.updaterStatus = status
    this.updaterError = error
    this._sendStatusToDisplay()
  }
  
  /*
    Sends the current status to the display.
    This is the ONLY public method that uses _call(...).
    The other methods above just update the status, and then call this method.
   */
  _sendStatusToDisplay() {
    if (!this.displayRpcPort) {
      console.log(this.updaterStatus, this.updaterError)
      return
    }

    //Write the current status on row 7 of the main tab
    this._writeLineOnMainTab(7, this.updaterStatus)

    //Also write the current status on the network info tab (+ clear that tab)
    this._call("setTexts", [[this.updaterStatus], this.networkInfoDisplayTab ])

    if (this.updaterError) {
      //Oh, we have an error. Let's write that on the network info tab as well, with word wrap.
      this._call("writeText", [this.updaterError.message, 0, 1, true, this.networkInfoDisplayTab ])
    }

    //We aways write deviceId as well.
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



  /*
    Triggers the RPC call to the display app.
    This is the ONLY method that talks to DisplayRpcClient and does that.
   */
  _call(method, args) {
    const displayRpcClient = new DisplayRpcClient(this.displayRpcPort, this.logCalls)
    displayRpcClient.call(method, args)
      .then(() => {
        this.wasLastDisplayCallSuccessful = true
      })
      .catch((err) => {
        this.wasLastDisplayCallSuccessful = false
      })
  }
}

module.exports = Display