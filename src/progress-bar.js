const callDisplayOverRpc = require('./display-util').callDisplayOverRpc

/**
 * A helper class that displays an animated progress bar
 * on the display whenever active.
 */
class ProgressBar {
  /**
   * Creates a ProgressBar that uses the given display.
   * The display
   * @param displayRpcPort the port that the display is running on
   * @param row which row (0-7) the progress bar should be shown on. Default 0.
   * @param text optional text at the beginning of the row, for example "Updating". Should be max 13 chars.
   *
   */
  constructor(displayRpcPort, row = 0, col = 0, text = "", logCalls = true) {
    console.assert(displayRpcPort, "missing displayRpcPort parameter")
    console.assert(row >= 0 && row <= 7, "row should be a number from 0-7, not " + row)
    console.assert(!text || text.length <= 13, "text is too long, should be max 13 chars: " + text)

    this.displayRpcPort = displayRpcPort
    this.row = row
    this.col = col
    this.text = text
    this.logCalls = logCalls

    this.barCount = 0
    //The display will look something like this,
    //so we calculate maxBarCount based on a row width of 16
    //text [========]
    this.maxBarCount = 16 - (text.length + 2) //+3 takes into account the space and two brackets
    this.maxBarCount = this.maxBarCount - col  //if the progress bar is indented we can't fit as many bars
    this.msPerAnimationStep = 1000
    this.timeout = null
  }

  setActive(active) {
    if (active) {
      this.start()
    } else {
      this.stop()
    }
  }

  start() {
    console.log("Start. Timeout = " + this.timeout)
    if (!this.isActive()) {
      this.barCount = 0
      this._drawProgressBarOnDisplay()
      this.timeout = setInterval(() => {
        this._updateBarCount()
        this._drawProgressBarOnDisplay()
      }, this.msPerAnimationStep)
    }

  }

  stop() {
    if (this.isActive()) {
      callDisplayOverRpc(this.displayRpcPort, "clearRow", [this.row], this.logCalls)
      clearInterval(this.timeout)
      this.timeout = null
    }
  }

  isActive() {
    return this.timeout != null
  }

  _updateBarCount() {
    console.log("Update bar count")

    this.barCount = this.barCount + 1
    if (this.barCount > this.maxBarCount) {
      this.barCount = 0
    }
  }

  _drawProgressBarOnDisplay() {
    callDisplayOverRpc(this.displayRpcPort, "clearRow", [this.row], this.logCalls)
    let content = this.text + "["

    //The display will look like this with full bars (16 chars wide):
    //Updating[=====]
    for (let bar = 1; bar <= this.maxBarCount; ++bar) {
      if (bar <= this.barCount) {
        content = content + "="
      } else {
        content = content + " "
      }
    }
    content = content + "]"

    callDisplayOverRpc(this.displayRpcPort, "writeText", [content, this.col, this.row, false], this.logCalls)
  }
}

module.exports = ProgressBar