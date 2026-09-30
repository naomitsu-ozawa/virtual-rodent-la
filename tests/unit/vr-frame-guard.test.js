import { it,expect } from 'vitest';
import { VrFrameGuard } from '../../docs/vr-frame-guard.js';
it('starts paused and does not automatically resume',()=>{const g=new VrFrameGuard();expect(g.paused).toBe(true);g.frame(1000);g.gpu(100);expect(g.reason).toBe('ready');g.resume();g.pause();g.frame(2000);expect(g.paused).toBe(true)});
it('permits stable 72 and 90 Hz frames',()=>{for(const rate of [72,90]){const g=new VrFrameGuard();g.resume();for(let i=0;i<200;i++){expect(g.frame(i*1000/rate,rate)).toBe(false);expect(g.gpu(1000/rate*0.9,rate)).toBe(false)}expect(g.paused).toBe(false)}});
it('pauses after three consecutively missed frames',()=>{const g=new VrFrameGuard();g.resume();[0,14,42,70].forEach(t=>g.frame(t));expect(g.paused).toBe(false);expect(g.frame(98)).toBe(true);expect(g.reason).toBe('frame')});
it('pauses after a single severe frame stall',()=>{const g=new VrFrameGuard();g.resume();g.frame(0);expect(g.frame(100)).toBe(true)});
it('pauses after three over-budget GPU passes or one 50ms pass',()=>{const g=new VrFrameGuard();g.resume();expect(g.gpu(17)).toBe(false);expect(g.gpu(17)).toBe(false);expect(g.gpu(17)).toBe(true);g.resume();expect(g.gpu(50)).toBe(true)});
it('ignores delayed GPU results from before a pause or resume',()=>{const g=new VrFrameGuard();g.resume();const old=g.epoch;g.pause();g.resume();expect(g.gpu(200,72,old)).toBe(false);expect(g.paused).toBe(false)});
it('resets isolated late frames and starts each resume with no stale interval',()=>{const g=new VrFrameGuard();g.resume();[0,28,42,70,84].forEach(t=>g.frame(t));expect(g.paused).toBe(false);g.pause();g.resume();expect(g.frame(10000)).toBe(false)});
