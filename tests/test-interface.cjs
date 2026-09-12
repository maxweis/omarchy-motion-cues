const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('runtime interface does not assume a phone operating system', () => {
    for (const name of ['Service.qml','manifest.json','menu.jsonc','omarchy-motion-cues']) {
        const source = fs.readFileSync(path.join(__dirname,'..',name),'utf8');
        assert.doesNotMatch(source, /\b(?:iPhone|iOS|Android)\b/i, name);
    }
    const menu = JSON.parse(fs.readFileSync(path.join(__dirname,'..','menu.jsonc'),'utf8'));
    assert.equal(menu['motion-cues.reconnect'].label,'Reconnect to phone');
    assert.equal(menu['motion-cues.endpoint'].label,'Phone address…');
    const source = fs.readFileSync(path.join(__dirname,'..','Service.qml'),'utf8');
    for (const message of ['Connecting to phone','Live phone motion','Cannot reach phone','Phone connection timed out'])
        assert.ok(source.includes(JSON.stringify(message)), message);
});
