// Test-only aggregate: production modules keep explicit, narrow responsibilities.
module.exports = Object.assign({}, require('../src/Settings.js'), require('../src/Phyphox.js'),
    require('../src/MotionModel.js'), require('../src/BubbleFlow.js'));
