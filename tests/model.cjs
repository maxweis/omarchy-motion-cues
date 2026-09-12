// Test-only aggregate: production modules keep explicit, narrow responsibilities.
module.exports = Object.assign({}, require('../Settings.js'), require('../Phyphox.js'),
    require('../MotionModel.js'), require('../BubbleFlow.js'));
