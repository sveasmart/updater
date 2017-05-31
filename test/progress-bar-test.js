const adafruit = require("adafruit-mcp23008-ssd1306-node-driver")

let display
if (adafruit.hasDriver()) {
  display = new adafruit.DisplayDriver()
} else {
  display = new adafruit.FakeDisplayDriver()
}

const ProgressBar = require("../src/progress-bar")

const progressBar = new ProgressBar(display, 3)

console.log("Starting progress bar")
progressBar.start()
setTimeout(() => {
  console.log("Stopping progress bar")
  progressBar.stop()
}, 10000)