const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn, execFile} = require('node:child_process');
const {promisify} = require('node:util');
const exec = promisify(execFile);
const delay = ms => new Promise(r => setTimeout(r, ms));
const source = path.resolve(__dirname, '..');

async function main() {
    let mode = 'live', clock = 0, requests = 0, session = 'first', logs = '';
    let acceleration = [2, 1, -1];
    let replacementServer = null;
    const heldResponses = [];
    const portRequests = {};
    const handler = (req, res) => {
        requests++;
        portRequests[req.socket.localPort] = (portRequests[req.socket.localPort] || 0) + 1;
        assert.equal(req.url, '/get?accX&accY&accZ&acc_time');
        if (mode === 'timeout' || mode === 'late') {
            if (mode === 'late') heldResponses.push(res);
            return;
        }
        if (mode === 'invalid') { res.end('not-json'); return; }
        if (mode === 'http-error') { res.writeHead(503); res.end(); return; }
        if (mode !== 'stale') clock += .05;
        const payload = {status: {measuring: mode !== 'paused', session}, buffer: {}};
        for (const [key, value] of Object.entries({accX:acceleration[0], accY:acceleration[1], accZ:acceleration[2], acc_time:clock}))
            payload.buffer[key] = {buffer:[value]};
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    };
    const server = http.createServer(handler);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'motion-cues-test-'));
    // Every run gets a separate QML config, IPC identity and source snapshot.
    // Quickshell intentionally does not load parent-directory QML imports.
    const harness = path.join(directory, 'shell.qml');
    await fs.copyFile(path.join(__dirname, 'TestHarness.qml'), harness);
    for (const name of ['Service.qml', 'MotionModel.js', 'Settings.js', 'Phyphox.js',
        'BubbleFlow.js', 'BubbleField.qml', 'Bubble.qml', 'GyrOSC.qml', 'gyrosc_receiver.py'])
        await fs.copyFile(path.join(source, name), path.join(directory, name));
    const configRoot = path.join(directory, 'config');
    await fs.mkdir(path.join(configRoot, 'omarchy'), {recursive:true});
    const configFile = path.join(configRoot, 'omarchy', 'motion-cues.json');
    const url = `http://127.0.0.1:${server.address().port}`;
    await fs.writeFile(configFile, JSON.stringify({url, provider:'phyphox'}));
    const notifyBin = path.join(directory, 'bin');
    const notifyLog = path.join(directory, 'notifications.jsonl');
    await fs.mkdir(notifyBin);
    await fs.writeFile(path.join(notifyBin, 'notify-send'), `#!${process.execPath}\n` +
        'require("node:fs").appendFileSync(process.env.MOTION_TEST_TOAST_LOG, JSON.stringify(process.argv.slice(2))+"\\n");\nprocess.stdout.write("73\\n");\n', {mode:0o755});
    const protocolTest = process.env.MOTION_CUES_TEST_RENDER === '1';
    const child = spawn('quickshell', ['--no-color', '-p', harness], {
        env: {...process.env, MOTION_CUES_TEST_CONFIG:configFile,
            PATH:notifyBin + ':' + process.env.PATH, MOTION_TEST_TOAST_LOG:notifyLog,
            ...(protocolTest ? {WAYLAND_DEBUG:'client'} : {})}, stdio:['ignore', 'pipe', 'pipe']});
    child.stdout.on('data', b => logs += b);
    child.stderr.on('data', b => logs += b);
    async function ipc(method, ...args) {
        const {stdout} = await exec('quickshell', ['-p', harness, 'ipc', 'call', 'motion-cues-test', method, ...args], {timeout:2000});
        return stdout.trim();
    }
    async function status() { return JSON.parse(await ipc('status')); }
    async function toasts() {
        try { return (await fs.readFile(notifyLog, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); }
        catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    }
    async function capture(label) {
        if (!protocolTest || !process.env.MOTION_CUES_TEST_CAPTURE_DIR) return;
        const {stdout} = await exec('omarchy', ['capture', 'screenshot', 'fullscreen', 'save'], {
            timeout:5000, env:{...process.env, OMARCHY_SCREENSHOT_DIR:process.env.MOTION_CUES_TEST_CAPTURE_DIR}});
        console.log(label + ': ' + stdout.trim());
    }
    async function until(predicate, timeout = 5000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
            try { const s = await status(); if (await predicate(s)) return s; } catch {}
            await delay(80);
        }
        throw new Error('Timed out waiting for state; logs: ' + logs);
    }
    try {
        const live = await until(s => s.connected && s.samples > 5);
        assert.equal(live.message, 'Live phone motion');
        assert.ok(live.offsetX < 0 && live.offsetY > 0);
        assert.ok(live.latencyMs < 500);
        console.log('PASS live HTTP feed, native QML loading, cue directions');
        await until(async () => (await toasts()).length >= 2);
        const initialToasts = await toasts();
        assert.equal(initialToasts.length, 2);
        assert.ok(initialToasts[0].includes('Motion Cues connecting'));
        assert.ok(initialToasts[1].includes('Motion Cues connected'));
        assert.ok(initialToasts[1].includes('--replace-id=73'));
        assert.ok(initialToasts.every(args => args.includes('--transient') && args.includes('--expire-time=3000')));
        console.log('PASS native connecting/connected toasts use transient 3s replacement');

        if (protocolTest) {
            async function visuals() { return JSON.parse(await ipc('visuals'))[0]; }
            acceleration = [2, 0, 0];
            await until(s => s.flowVelocityX < -145 && Math.abs(s.flowVelocityY) < .5);
            let previous = await visuals(), renewed = 0, faded = 0, travelled = 0;
            assert.equal(previous.bubbles.length, 32);
            assert.equal(previous.running, true);
            assert.ok(new Set(previous.bubbles.map(b=>b.width.toFixed(2))).size>20, 'bubble sizes must vary');
            assert.ok(new Set(previous.bubbles.map(b=>b.speed.toFixed(3))).size>20, 'bubble speeds must vary');
            assert.ok(previous.bubbles.every(b=>b.width>=live.bubbleSize*.82 && b.width<=live.bubbleSize*1.18));
            await capture('Sustained turn: outgoing bubbles');
            for (let frame = 0; frame < 45; frame++) {
                await delay(75);
                const next = await visuals();
                for (let i=0;i<12;i++) {
                    const old = previous.bubbles[i], dot = next.bubbles[i];
                    if (dot.generation > old.generation) renewed++;
                    else if (dot.x < old.x - .1) travelled++;
                    assert.ok(dot.x >= 0 && dot.x + dot.width <= next.width);
                    assert.ok(dot.x < next.width*.2 || dot.x > next.width*.8, 'base bubbles stay peripheral');
                    if (dot.opacity > .01 && dot.opacity < .8) faded++;
                }
                previous = next;
                if (frame === 8) await capture('Sustained turn: new bubbles entering');
            }
            assert.ok(renewed > 12, 'same steady acceleration must keep renewing bubbles');
            assert.ok(faded > 12 && travelled > 200, 'actual delegates must fade and move');
            acceleration = [-2, 0, 0];
            await until(s => s.flowVelocityX > 145);
            previous = await visuals();
            await delay(120);
            const reversed = await visuals();
            assert.ok(reversed.bubbles.slice(0,12).some((dot,i) =>
                dot.generation === previous.bubbles[i].generation && dot.x > previous.bubbles[i].x + 5));
            await capture('Opposite turn');
            acceleration = [0, 0, 0];
            await until(s => s.flowVelocityX === 0 && s.flowVelocityY === 0 && s.extraBubbles === 0);
            await delay(450);
            const stopped = await visuals();
            assert.equal(stopped.running, false, 'no animation loop at rest');
            assert.equal(stopped.bubbles.filter(b => b.visible).length, 12);
            assert.ok(stopped.bubbles.slice(0,12).every(b => b.opacity === 1));
            await delay(200);
            assert.deepEqual(await visuals(), stopped, 'rest must not drift or respawn');
            console.log('PASS rendered continuous turn flow, respawn, fading, reversal, peripheral bounds and idle stop');
            console.log('PASS actual delegates use varied sizes and independent speeds');
        }

        assert.equal(live.bubbleSize, 26, 'Large must be the default without a saved size');
        acceleration = [4, 4, 1];
        await until(s => s.extraBubbles === 20 && s.reflectionX < -.6 && s.reflectionY > .6);
        await delay(500);
        await capture('Strong acceleration');
        acceleration = [-4, -4, -1];
        await until(s => s.extraBubbles === 20 && s.reflectionX > .6 && s.reflectionY < -.6);
        await delay(600);
        await capture('Reversed acceleration');
        acceleration = [0, 0, 0];
        await until(s => s.extraBubbles === 0 && Math.abs(s.reflectionX) < .02 && Math.abs(s.reflectionY) < .02);
        await delay(650);
        await capture('Settled acceleration');
        console.log('PASS Large default, 20 extra bubbles under acceleration, reflected direction changes, and fade back to 12');
        acceleration = [2, 1, -1];
        assert.equal((await toasts()).length, 2, 'healthy samples must not repeat notifications');

        mode = 'stale';
        await until(s => !s.connected && s.message.includes('fresh'), 1800);
        await delay(200);
        const stale = await status();
        assert.equal(stale.connected, false);
        assert.equal(stale.extraBubbles, 0);
        assert.equal(stale.reflectionX, 0);
        assert.equal(stale.reflectionY, 0);
        assert.equal(stale.flowVelocityX, 0);
        assert.equal(stale.flowVelocityY, 0);
        await until(async () => (await toasts()).length === 3);
        assert.ok((await toasts())[2].includes('Motion Cues disconnected'));
        console.log('PASS stale repeated timestamps hide cues');
        mode = 'live'; await until(s => s.connected);

        for (const failure of ['paused', 'invalid', 'http-error', 'timeout']) {
            await delay(150);
            const beforeToasts = (await toasts()).length;
            mode = failure;
            await until(s => !s.connected, 2000);
            const failed = await status();
            assert.doesNotMatch(failed.message, /iphone|android|\bios\b/i);
            if (failure === 'http-error') assert.equal(failed.message, 'Cannot reach phone');
            if (failure === 'timeout') assert.equal(failed.message, 'Phone connection timed out');
            await until(async () => (await toasts()).length === beforeToasts + 1);
            const before = requests;
            await delay(500);
            assert.ok(requests - before <= 1, 'failure retries must be bounded');
            if (failure === 'paused') {
                const wakes = (await status()).timerWakeups;
                await delay(1800);
                assert.ok((await status()).timerWakeups - wakes <= 3,
                    'backoff must not run a 20 Hz poll loop or repeating watchdog');
                console.log('PASS at most 3 timer wakeups in 1.8s of failed-feed backoff');
            }
            assert.equal((await toasts()).length, beforeToasts + 1, 'failed retries must not repeat notifications');
            mode = 'live';
            await until(s => s.connected, 4000);
            console.log(`PASS ${failure}: hide, back off, recover`);
        }
        session = 'second'; clock = 0;
        await until(s => s.connected && s.sample.session === 'second');
        console.log('PASS experiment restart/session change');
        await delay(150);
        const beforeSettingsToasts = (await toasts()).length;
        const saved = JSON.parse(await fs.readFile(configFile, 'utf8'));
        assert.equal(await ipc('configure', '{"mount":"upright","sensitivity":0.5,"futureOption":"keep"}'), 'ok');
        await until(s => s.mount === 'upright' && s.sensitivity === .5 && s.connected);
        await delay(100);
        assert.equal(JSON.parse(await fs.readFile(configFile, 'utf8')).mount, 'upright');
        assert.equal(JSON.parse(await fs.readFile(configFile, 'utf8')).futureOption, 'keep');
        assert.match(await ipc('configure', '{"url":"http://example.com"}'), /^error:/);
        assert.equal((await status()).url, saved.url);
        assert.equal((await toasts()).length, beforeSettingsToasts, 'visual settings changes must not announce a reconnection');
        console.log('PASS persistent configuration and unsafe URL rejection');

        const beforeReconnect = (await toasts()).length;
        assert.equal(await ipc('reconnect'), 'ok');
        await until(s => s.connected);
        await until(async () => (await toasts()).length === beforeReconnect + 2);
        console.log('PASS explicit reconnect announces connecting and connected once');

        replacementServer = http.createServer(handler);
        await new Promise(r => replacementServer.listen(0, '127.0.0.1', r));
        const replacementUrl = `http://127.0.0.1:${replacementServer.address().port}`;
        mode = 'late';
        const heldDeadline = Date.now() + 2000;
        while (!heldResponses.length && Date.now() < heldDeadline) await delay(10);
        assert.ok(heldResponses.length, 'old endpoint must have a request in flight');
        mode = 'live';
        await exec('bash', [path.join(__dirname, '..', 'omarchy-motion-cues'), 'endpoint', replacementUrl], {
            env:{...process.env, XDG_CONFIG_HOME:configRoot}, timeout:3000});
        const switched = await until(s => s.connected && s.url === replacementUrl);
        for (const response of heldResponses)
            response.end(JSON.stringify({status:{measuring:true, session:'obsolete'}, buffer:{
                accX:{buffer:[100]}, accY:{buffer:[100]}, accZ:{buffer:[100]}, acc_time:{buffer:[1000]}
            }}));
        await delay(100);
        assert.notEqual((await status()).sample.session, 'obsolete', 'late old replies must never revive the old feed');
        assert.equal(switched.mount, 'upright');
        assert.equal(switched.sensitivity, .5);
        assert.equal(JSON.parse(await fs.readFile(configFile, 'utf8')).futureOption, 'keep');
        const oldPort = server.address().port;
        const oldCount = portRequests[oldPort];
        await delay(250);
        assert.equal(portRequests[oldPort], oldCount, 'requests to the old endpoint must stop');
        assert.ok(portRequests[replacementServer.address().port] > 0);
        console.log('PASS address change cancels in-flight requests, ignores late replies and preserves settings');
        const starting = requests;
        await delay(1000);
        assert.ok(requests - starting <= 23, 'poll rate is bounded at 20Hz');
        assert.ok(!/TypeError|ReferenceError|Cannot assign|failed to load|Binding loop/i.test(logs), logs);
        console.log('PASS polling bound and clean QML runtime');

        for (const invalid of ['{}', 'broken JSON', '[]']) {
            await fs.writeFile(configFile, invalid);
            await until(s => !s.connected);
            await delay(100);
            const before = requests;
            const wakes = (await status()).timerWakeups;
            await delay(300);
            assert.equal(requests, before, 'unconfigured or malformed settings must stop networking');
            assert.equal((await status()).timerWakeups, wakes);
        }
        await fs.unlink(configFile);
        await delay(300);
        const withoutSettings = requests;
        await delay(300);
        assert.equal(requests, withoutSettings);
        await fs.writeFile(configFile, JSON.stringify({...saved, url:replacementUrl}));
        await until(s => s.connected);
        console.log('PASS missing/blank/malformed settings stop timers and network; corrected settings recover');

        if (protocolTest) {
            const regionIds = [...logs.matchAll(/set_input_region\(wl_region[#@](\d+)\)/g)].map(m => m[1]);
            assert.ok(regionIds.length > 0, 'overlay must set an explicit input region');
            for (const id of regionIds)
                assert.ok(!new RegExp(`wl_region[#@]${id}\\.add\\(`).test(logs), 'input region must be empty');
            assert.match(logs, /set_keyboard_interactivity\(0\)/);
            assert.match(logs, /omarchy-motion-cues-test/);
            console.log('PASS mapped Wayland overlay has empty input region and no keyboard focus');
        }
        for (let i = 0; i < 2; i++) {
            const control = ['-p', harness, 'ipc', 'call', 'motion-cues-lifecycle-test'];
            await exec('quickshell', [...control, 'unload'], {timeout:2000});
            await delay(150);
            const stoppedAt = requests;
            await delay(350);
            assert.equal(requests, stoppedAt, 'unloading only the service must stop all requests');
            await exec('quickshell', [...control, 'unload'], {timeout:2000});
            await exec('quickshell', [...control, 'load'], {timeout:2000});
            await exec('quickshell', [...control, 'load'], {timeout:2000});
            await until(s => s.connected);
        }
        console.log('PASS repeated unload/load is idempotent and stops requests in a running shell');
    } finally {
        child.kill('SIGTERM');
        await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
        const stoppedAt = requests;
        await delay(250);
        assert.equal(requests, stoppedAt, 'requests must stop when service exits');
        server.closeAllConnections();
        await new Promise(r => server.close(r));
        if (replacementServer) {
            replacementServer.closeAllConnections();
            await new Promise(r => replacementServer.close(r));
        }
        console.log('PASS shutdown stops network requests');
        console.log('Test config retained at ' + configFile);
        console.log('Notification calls retained at ' + notifyLog);
        if (protocolTest) {
            const logPath = path.join(directory, 'wayland.log');
            await fs.writeFile(logPath, logs);
            console.log('Wayland protocol log retained at ' + logPath);
        } else console.log(logs);
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
