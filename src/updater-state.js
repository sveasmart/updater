const Enum = require('enum')

//The updater has three possible states:

const STATE = new Enum ([
  'checking', //currently connecting to see if an update is needed
  'updating', //currently executing an update script
  'waiting' //currently waiting for next time to check for updates
])

//Each check has four possible outcomes
const RESULT = new Enum([
  'nothingToUpdate',
  'updated',
  'updateFailed',
  'networkFailed'
])

class UpdaterState {
  constructor() {
    this.state = null
    this.result = null
  }  
  
  setState(state) {
    console.assert(STATE.enums.includes(state), "Invalid state: " + state)
    this.state = state
  }

  setResult(result) {
    this.result = result
  }

  getState() {
    return this.state
  }

}

module.exports = {
  UpdaterState: UpdaterState,
  STATE: STATE,
  RESULT: RESULT
}