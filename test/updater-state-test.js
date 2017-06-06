const chai = require('chai')
const expect = chai.expect
const mocha = require('mocha')

const UpdaterState = require('../src/updater-state').UpdaterState
const STATE = require('../src/updater-state').STATE

describe('UpdaterState', function() {
  it('invalid state', function() {
    const updaterState = new UpdaterState()
    expect(function() {updaterState.setState("x")}).to.throw()
  })

  it('valid state', function() {
    const updaterState = new UpdaterState()
    expect(updaterState.getState()).to.equal(null)
    updaterState.setState(STATE.checking)
    expect(updaterState.getState()).to.equal(STATE.checking)
  })

})