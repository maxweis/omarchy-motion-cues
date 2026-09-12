const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {after} = require('node:test');

module.exports = function temporary(prefix) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    after(() => fs.rmSync(directory, {recursive:true, force:true}));
    return directory;
};
