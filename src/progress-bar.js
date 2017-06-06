/**
 * A helper class that displays an animated progress bar
 * on the display whenever active.
 */
class ProgressBar {
  /**
   * Creates a ProgressBar that uses the given display.
   * The display
   * @param display should match DisplayDriver from adafruit-mcp23008-ssd1306-node-driver.
   * @param row which row (0-7) the progress bar should be shown on. Default 0.
   * @param text optional text at the beginning of the row, for example "Updating". Should be max 13 chars.
   *
   */
  constructor(display, row = 0, col = 0, text = "") {
    console.assert(display, "missing display parameter")
    console.assert(row >= 0 && row <= 7, "row should be a number from 0-7, not " + row)
    console.assert(!text || text.length <= 13, "text is too long, should be max 13 chars: " + text)
    this.text = text
    this.row = row
    this.col = col

    this.display = display
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
      this.display.clearRow(this.row)
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
    this.display.clearRow(this.row)
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

    this.display.writeText(content, this.col, this.row, false)
  }
}

module.exports = ProgressBar