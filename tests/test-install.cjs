const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temporary = require('./temporary.cjs');
const {spawnSync} = require('node:child_process');
const source = path.resolve(__dirname, '..');
const installer = path.join(source, 'scripts/install.py');

test('launcher is executable in the source checkout, matching installed Git permissions', () => {
    assert.ok(fs.statSync(path.join(source, 'bin/omarchy-motion-cues')).mode & 0o111,
        'native installation must not change the tracked launcher mode');
});

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

test('flat-layout upgrades back up obsolete files and preserve settings and unrelated files', () => {
    const f = fixture('{}');
    const plugin = path.join(f.config, 'plugins/max.motion-cues');
    fs.mkdirSync(plugin, {recursive:true});
    fs.writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({
        id:'max.motion-cues', version:'1.7.2', entryPoints:{service:'Service.qml'}
    }));
    const legacy = ['Service.qml', 'MotionModel.js', 'Settings.js', 'Phyphox.js',
        'GyrOSC.qml', 'gyrosc_receiver.py', 'BubbleFlow.js', 'Bubble.qml', 'BubbleField.qml',
        'Endpoint.jq', 'setup_window.py', 'SETUP.txt', 'menu.jsonc', 'omarchy-motion-cues'];
    for (const name of legacy) fs.writeFileSync(path.join(plugin, name), 'old ' + name);
    fs.writeFileSync(path.join(plugin, 'my-notes.txt'), 'keep my notes');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const backups = path.join(f.home, '.local/state/motion-cues/backups');
    const backup = path.join(backups, fs.readdirSync(backups)[0], 'plugin');
    for (const name of legacy) {
        assert.equal(fs.existsSync(path.join(plugin, name)), false, name);
        assert.equal(fs.readFileSync(path.join(backup, name), 'utf8'), 'old ' + name);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(plugin, 'manifest.json')));
    assert.equal(manifest.entryPoints.service, 'src/Service.qml');
    assert.ok(fs.existsSync(path.join(plugin, manifest.entryPoints.service)));
    assert.ok(fs.existsSync(path.join(plugin, 'scripts/install.py')));
    assert.equal(fs.readFileSync(path.join(plugin, 'my-notes.txt'), 'utf8'), 'keep my notes');
    assert.equal(fs.readFileSync(f.settings, 'utf8'), f.original);
    const cli = spawnSync(path.join(f.home, '.local/bin/omarchy-motion-cues'),
        ['endpoint', '192.168.1.123:8080'], {encoding:'utf8',
            env:{...process.env, HOME:f.home, XDG_CONFIG_HOME:path.join(f.home, '.config')}});
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stdout.trim(), 'http://192.168.1.123:8080');
    assert.equal(JSON.parse(fs.readFileSync(f.settings)).custom, 'keep');
});

test('nested deployment paths cannot escape through directory symlinks', () => {
    for (const name of ['src', 'bin', 'config', 'docs', 'scripts']) {
        const f = fixture('{}');
        const plugin = path.join(f.config, 'plugins/max.motion-cues');
        const outside = path.join(f.home, 'outside');
        fs.mkdirSync(plugin, {recursive:true});
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(plugin, 'manifest.json'), '{"id":"max.motion-cues"}');
        fs.symlinkSync(outside, path.join(plugin, name));
        const result = f.run();
        assert.notEqual(result.status, 0, name);
        assert.match(result.stderr, /symlink/);
        assert.deepEqual(fs.readdirSync(outside), []);
        assert.equal(fs.readFileSync(f.menu, 'utf8'), '{}');
        assert.equal(fs.readFileSync(f.settings, 'utf8'), f.original);
    }
});

test('release checkout can install itself without dirtying tracked files', () => {
    const f = fixture('{}');
    const plugin = path.join(f.config, 'plugins/max.motion-cues');
    fs.mkdirSync(plugin, {recursive:true});
    const release = spawnSync('python3', [path.join(source, 'scripts/release.py'),
        '--output-dir', f.home], {encoding:'utf8'});
    assert.equal(release.status, 0, release.stderr);
    const extract = spawnSync('tar', ['-xzf', release.stdout.trim(), '-C', plugin, '--strip-components=1'], {encoding:'utf8'});
    assert.equal(extract.status, 0, extract.stderr);
    const git = (...args) => {
        const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', plugin, ...args], {encoding:'utf8'});
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
    };
    git('init', '--quiet');
    git('add', '.');
    git('-c', 'user.name=Motion Cues Tests', '-c', 'user.email=tests@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Test release snapshot');
    for (let attempt = 0; attempt < 2; attempt++) {
        const install = spawnSync('python3', [path.join(plugin, 'scripts/install.py'), '--no-reload'], {
            encoding:'utf8', env:{...process.env, HOME:f.home,
                XDG_CONFIG_HOME:path.join(f.home, '.config'), XDG_STATE_HOME:path.join(f.home, '.local/state')}
        });
        assert.equal(install.status, 0, install.stderr);
        assert.equal(git('status', '--porcelain'), '');
        assert.equal(fs.readFileSync(f.settings, 'utf8'), f.original);
    }
});

test('a file in place of a source directory is rejected before updating the installation', () => {
    const f = fixture('{}');
    const plugin = path.join(f.config, 'plugins/max.motion-cues');
    fs.mkdirSync(plugin, {recursive:true});
    const original = '{"id":"max.motion-cues","version":"1.7.2"}';
    fs.writeFileSync(path.join(plugin, 'manifest.json'), original);
    fs.writeFileSync(path.join(plugin, 'src'), 'keep this file');
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected a release directory/);
    assert.equal(fs.readFileSync(path.join(plugin, 'manifest.json'), 'utf8'), original);
    assert.equal(fs.readFileSync(path.join(plugin, 'src'), 'utf8'), 'keep this file');
    assert.equal(fs.readFileSync(f.menu, 'utf8'), '{}');
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
