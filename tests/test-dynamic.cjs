const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./model.cjs');
const layout=M.flowLayout(1800,1125,26);

test('random seed produces varied, reproducible positions, sizes, speeds and fade times',()=>{
    const first=M.flowInitial(layout,1789);
    assert.deepEqual(first,M.flowInitial(layout,1789));
    assert.notDeepEqual(first,M.flowInitial(layout,1790));
    for(const key of ['scale','speed','fadeSeconds','phase','frequency'])
        assert.ok(new Set(first.map(p=>p[key].toFixed(4))).size>24,key);
    assert.ok(Math.max(...first.slice(0,6).map(p=>p.x))-Math.min(...first.slice(0,6).map(p=>p.x))>75);
    for(const p of first) {
        assert.ok(p.scale>=.82 && p.scale<=1.18);
        assert.ok(p.speed>=.76 && p.speed<=1.24);
        assert.ok(p.fadeSeconds>=.26 && p.fadeSeconds<=.48);
    }
});

test('gentle curves differ between bubbles without reversing the primary motion',()=>{
    let p=M.flowInitial(layout,901), curves=0;
    for(let frame=0;frame<300;frame++) {
        const next=M.flowStep(p,layout,100,0,1/60);
        for(let i=0;i<12;i++) if(next[i].generation===p[i].generation) {
            const dx=next[i].x-p[i].x,dy=next[i].y-p[i].y;
            assert.ok(dx>0);
            assert.ok(Math.abs(dy)<dx*.25,'sway must not overwhelm the motion cue');
            if(Math.abs(dy)>.02) curves++;
        }
        p=next;
    }
    assert.ok(curves>1000);
});

test('renewal varies appearance and entry lane only while the recycled bubble is invisible',()=>{
    let p=M.flowInitial(layout,1877), changes=0;
    for(let frame=0;frame<900;frame++) {
        const next=M.flowStep(p,layout,-100,0,1/60);
        for(let i=0;i<12;i++) {
            if(next[i].generation!==p[i].generation) {
                assert.equal(next[i].opacity,0);
                assert.notEqual(next[i].scale,p[i].scale);
                assert.notEqual(next[i].fadeSeconds,p[i].fadeSeconds);
                const motion=M.flowDisplacement(p[i],-100,0,1/60);
                assert.ok(Math.abs(next[i].y-p[i].y-motion.y)<=18);
                changes++;
            } else assert.equal(next[i].scale,p[i].scale);
        }
        p=next;
    }
    assert.ok(changes>60);
});

test('many different random arrangements stay finite and stop completely at rest',()=>{
    for(let seed=1;seed<=24;seed++) {
        let p=M.flowInitial(layout,seed);
        for(let frame=0;frame<240;frame++) {
            p=M.flowStep(p,layout,130,-170,1/60);
            p.forEach((dot,i)=>{
                const b=layout[i].bounds;
                assert.ok(dot.x>=b.minX && dot.x<=b.maxX && dot.y>=b.minY && dot.y<=b.maxY);
                assert.ok(dot.opacity>=0 && dot.opacity<=1);
                assert.ok(dot.scale>=.82 && dot.scale<=1.18);
            });
        }
        for(let i=0;i<30;i++) p=M.flowStep(p,layout,0,0,1/60);
        assert.deepEqual(M.flowStep(p,layout,0,0,1/60),p);
    }
});
