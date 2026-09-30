// One observed late frame can pause the next draw; this cannot cancel work
// already submitted to the GPU. No automatic retry or quality reduction.
export class VrFrameGuard {
 constructor(){this.paused=true;this.reason='ready';this.epoch=0;this.last=null;this.lateFrames=0;this.lateGpu=0}
 resume(){this.paused=false;this.reason='';this.epoch++;this.last=null;this.lateFrames=0;this.lateGpu=0}
 pause(reason='manual'){this.paused=true;this.reason=reason;this.epoch++;this.last=null;return true}
 frame(now,rate=72){
  if(this.paused)return false;
  const dt=this.last===null?0:now-this.last;this.last=now;
  this.lateFrames=dt>1000/rate*1.4?this.lateFrames+1:0;
  return dt>=100||this.lateFrames>=3?this.pause('frame'):false;
 }
 gpu(ms,rate=72,epoch=this.epoch){
  if(this.paused||epoch!==this.epoch||!Number.isFinite(ms))return false;
  this.lateGpu=ms>1000/rate*1.15?this.lateGpu+1:0;
  return ms>=50||this.lateGpu>=3?this.pause('gpu'):false;
 }
}
