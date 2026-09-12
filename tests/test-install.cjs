const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temporary = require('./temporary.cjs');
const {spawnSync} = require('node:child_process');
const source = path.resolve(__dirname, '..');
const installer = path.join(source, 'scripts/install.py');

function fixture(menuText) {
    const home = temporary('motion cues install-');
    const config = path.join(home, '.config/omarchy');
    fs.mkdirSync(path.join(config, 'extensions'), {recursive:true});
    const menu = path.join(config, 'extensions/omarchy-menu.jsonc');
    fs.writeFileSync(menu, menuText);
    fs.chmodSync(menu, 0o640);
    const settings = path.join(config, 'motion-cues.json');
    fs.writeFileSync(settings, '{"url":"http://10.0.0.1","custom":"keep"}\n');
    const original = fs.readFileSync(settings, 'utf8');
    return {home, config, menu, settings, original,
        run(...args) { return spawnSync('python3', [installer, '--no-reload', ...args], {
            encoding:'utf8', timeout:10000,
            env:{...process.env, HOME:home, XDG_CONFIG_HOME:path.join(home, '.config'), XDG_STATE_HOME:path.join(home, '.local/state')}
        }); }
    };
}

test('install/update/remove preserve unrelated menu bytes, settings and file permissions', () => {
    const untouched = '"unrelated": {"label": "Keep", "action":"printf \\\"{hello}\\\"", "custom":[1,2,],}';
    for (const wrapper of [false, true]) {
        const content = `\n  // keep this comment\n  ${untouched},\n`;
        const f = fixture(wrapper ? '{"meta":"unchanged","items":{' + content + '}}\n' : '{' + content + '}\n');
        for (let iteration = 0; iteration < 2; iteration++) {
            const result = f.run();
            assert.equal(result.status, 0, result.stderr);
            const text = fs.readFileSync(f.menu, 'utf8');
            assert.ok(text.includes(untouched));
            assert.ok(text.includes('// keep this comment'));
            assert.equal((text.match(/"motion-cues.setup"/g) || []).length, 1);
            assert.equal(fs.statSync(f.menu).mode & 0o777, 0o640);
            assert.equal(fs.readFileSync(f.settings, 'utf8'), f.original);
            assert.ok(!fs.existsSync(path.join(f.config, 'shell.json')), 'install must not enable service');
        }
        const removed = f.run('--uninstall');
        assert.equal(removed.status, 0, removed.stderr);
        const text = fs.readFileSync(f.menu, 'utf8');
        assert.ok(text.includes(untouched));
        assert.ok(!text.includes('"motion-cues.setup"'));
        assert.equal(fs.existsSync(path.join(f.config, 'plugins/max.motion-cues')), false);
        assert.equal(fs.existsSync(path.join(f.home, '.local/bin/omarchy-motion-cues')), false);
        assert.equal(fs.readFileSync(f.settings, 'utf8'), f.original);
        assert.ok(fs.readdirSync(path.join(f.home, '.local/state/motion-cues/backups')).length >= 3);
    }
});

test('empty menus, no trailing comma and comments after the last entry are supported', () => {
    for (const text of ['{}', '{\n// empty\n}', '{"keep":{"label":"x"}}', '{"keep":{} /* end */}',
        '{"keep":{} // end\n}', '{"keep":{}, // end\n}', '{"keep":{} /* end */,}',
        '{"keep":{} // end\n,}', '{"keep":{} /* comma in comment , */}']) {
        const f = fixture(text);
        const result = f.run();
        assert.equal(result.status, 0, text + ': ' + result.stderr);
        assert.equal(f.run('--uninstall').status, 0);
    }
});

test('invalid or ambiguous menus are rejected before any installation writes', () => {
    for (const text of ['broken JSON', '[]', '{"x":{},"x":{}}', '{"items":[]}']) {
        const f = fixture(text);
        assert.notEqual(f.run().status, 0);
        assert.equal(fs.readFileSync(f.menu, 'utf8'), text);
        assert.equal(fs.existsSync(path.join(f.config, 'plugins/max.motion-cues')), false);
    }
});

test('refuse symlink targets, foreign launchers and customized removal rows', () => {
    const f = fixture('{}');
    const bin = path.join(f.home, '.local/bin');
    fs.mkdirSync(bin, {recursive:true});
    fs.writeFileSync(path.join(bin, 'omarchy-motion-cues'), 'unrelated program');
    assert.notEqual(f.run().status, 0);
    assert.equal(fs.readFileSync(path.join(bin, 'omarchy-motion-cues'), 'utf8'), 'unrelated program');
    const g = fixture('{}');
    fs.symlinkSync(g.settings, path.join(g.config, 'plugins-link'));
    fs.renameSync(g.menu, g.menu + '.original');
    fs.symlinkSync(g.menu + '.original', g.menu);
    assert.notEqual(g.run().status, 0);
    assert.equal(fs.readFileSync(g.menu, 'utf8'), '{}');
    const h = fixture('{}');
    assert.equal(h.run().status, 0);
    fs.writeFileSync(h.menu, fs.readFileSync(h.menu, 'utf8').replace('"label": "Setup"', '"label": "My custom guide"'));
    assert.notEqual(h.run('--uninstall').status, 0);
    assert.ok(fs.existsSync(path.join(h.config, 'plugins/max.motion-cues')));
});
