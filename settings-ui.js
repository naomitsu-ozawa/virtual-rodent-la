// Settings dialog (build 280). Tabs: 描画 (rendering) and デバッグ (debug);
// add a tab button + panel in ui-shell.js to extend it.
import { settings } from './app-settings.js?v=20261009-build531';
import { request3DRender } from './scene3d.js?v=20261009-build531';
import { updateGpuStatus } from './gpu-compute.js?v=20261009-build531';
import { volumeCache, updateVolumeCacheControl, volumeCacheBudget } from './gpu-volume-data.js?v=20261009-build531';
import { tr } from './i18n.js?v=20261009-build531';
import { fmt } from './utils.js?v=20261009-build531';
import { gpuPreferenceSupported, gpuEffectivePreference, gpuHybridModeSupported, gpuEffectiveHybridMode } from './gpu-preference.js?v=20261009-build531';
import { initGpuDiagnosticsUi } from './gpu-diagnostics-ui.js?v=20261009-build531';
import { collectGpuDiagnostics } from './gpu-diagnostics-collect.js?v=20261009-build531';
export function initSettingsDialog(){
 const dlg=document.getElementById('settings-dialog'),open=document.getElementById('settings-open');if(!dlg||!open)return;
 open.onclick=()=>{sync();dlg.showModal?dlg.showModal():dlg.setAttribute('open','')};
 document.getElementById('settings-close').onclick=()=>dlg.close?dlg.close():dlg.removeAttribute('open');
 dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close?.()});
 for(const tab of dlg.querySelectorAll('[data-settings-tab]'))tab.onclick=()=>{
  for(const t of dlg.querySelectorAll('[data-settings-tab]'))t.classList.toggle('is-active',t===tab);
  for(const p of dlg.querySelectorAll('[data-settings-panel]'))p.hidden=p.dataset.settingsPanel!==tab.dataset.settingsTab;
  if(tab.dataset.settingsTab==='cache')void renderCacheList();
 };
 const bind=(id,key,rerender=true)=>{const el=document.getElementById(id);if(!el)return;el.onchange=()=>{settings.set(key,el.type==='checkbox'?el.checked:el.value);if(rerender)request3DRender();if(key==='debug'||key==='showPerf')updateGpuStatus()}};
 bind('set-drag-quality','dragQuality');bind('set-rest-quality','restQuality');bind('set-step-quality','stepQuality');bind('set-refine','refine');bind('set-interp','interp');bind('set-drag-lowres','dragLowerRes');bind('set-show-perf','showPerf');bind('set-debug','debug');bind('set-cache-autoprune','cacheAutoPrune',false);bind('set-cache-limit','cacheLimit',false);bind('set-mpr-alpha','mpr2dAlpha',false);
 // build 515: 「使う GPU」, shown on Linux / Windows only. The WebGPU device is created at start-up, so a change needs a reload.
 const gpuRow=document.getElementById('gpu-pref-row'),gpuSel=document.getElementById('set-gpu-preference'),gpuReload=document.getElementById('gpu-pref-reload');
 if(gpuRow&&gpuSel){
  const loadedGpuPref=gpuEffectivePreference(settings.get('gpuPreference'));
  gpuRow.hidden=!gpuPreferenceSupported();
  gpuSel.onchange=()=>{settings.set('gpuPreference',gpuSel.value);if(gpuReload)gpuReload.hidden=gpuSel.value===loadedGpuPref};
  const gpuReloadBtn=document.getElementById('gpu-pref-reload-btn');if(gpuReloadBtn)gpuReloadBtn.onclick=()=>location.reload();
 }
 // build 517: 「ハイブリッド環境での処理」, shown on Linux only (the stored value is ignored elsewhere); like 「使う GPU」 it applies after a reload
 const hybRow=document.getElementById('gpu-hybrid-row'),hybSel=document.getElementById('set-gpu-hybrid'),hybHint=document.getElementById('gpu-hybrid-hint'),hybReload=document.getElementById('gpu-hybrid-reload');
 if(hybRow&&hybSel){
  const loadedHybrid=gpuEffectiveHybridMode(settings.get('gpuHybridMode'));
  const hybOn=gpuHybridModeSupported();hybRow.hidden=!hybOn;if(hybHint)hybHint.hidden=!hybOn;
  hybSel.onchange=()=>{settings.set('gpuHybridMode',hybSel.value);if(hybReload)hybReload.hidden=hybSel.value===loadedHybrid};
  const hybReloadBtn=document.getElementById('gpu-hybrid-reload-btn');if(hybReloadBtn)hybReloadBtn.onclick=()=>location.reload();
 }
 // build 520: the GPU info tab (adapter / limit ladder / hybrid split / copyable report) exists only in debug mode (gpu-diagnostics-ui.js)
 initGpuDiagnosticsUi({collect:collectGpuDiagnostics});
 const limitSel=document.getElementById('set-cache-limit'),limitChange=limitSel?.onchange;if(limitSel)limitSel.onchange=async()=>{limitChange?.();await pruneToLimit(true)};
 const pruneBtn=document.getElementById('set-cache-prune');if(pruneBtn)pruneBtn.onclick=()=>pruneToLimit(false);
 const clearBtn=document.getElementById('set-cache-clear');if(clearBtn)clearBtn.onclick=async()=>{if(!confirm(tr('volumeCacheConfirm')))return;const c=await volumeCache();if(c)await c.clear();void updateVolumeCacheControl();void renderCacheList()};
 function sync(){
  const v=settings.all(),put=(id,val)=>{const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=!!val;else el.value=String(val)};
  put('set-drag-quality',v.dragQuality);put('set-rest-quality',v.restQuality);put('set-step-quality',v.stepQuality);put('set-refine',v.refine);put('set-interp',v.interp);put('set-drag-lowres',v.dragLowerRes);put('set-show-perf',v.showPerf);put('set-debug',v.debug);put('set-cache-autoprune',v.cacheAutoPrune);put('set-cache-limit',v.cacheLimit);put('set-mpr-alpha',v.mpr2dAlpha);put('set-gpu-preference',gpuEffectivePreference(v.gpuPreference));put('set-gpu-hybrid',gpuEffectiveHybridMode(v.gpuHybridMode));
 }
}

// settings > cache: list the stored entries with a delete button each (build 296)
async function renderCacheList(){
 const box=document.getElementById('set-cache-list'),total=document.getElementById('set-cache-total');if(!box)return;
 const cache=await volumeCache();const all=cache?(await cache.list()).filter(e=>e.complete).sort((a,b)=>b.lastUsed-a.lastUsed):[];
 if(total)total.textContent=tr('cacheTotal')+' '+fmt(all.reduce((a,e)=>a+(e.bytes||0),0));
 box.replaceChildren();
 if(!all.length){const p=document.createElement('p');p.className='hint';p.textContent=tr('cacheEmpty');box.append(p);return}
 for(const e of all){
  const i=e.info||{},row=document.createElement('div');row.className='settings-cache-row';
  const text=document.createElement('div');text.className='settings-cache-text';
  const kind=i.kind==='segment-runs'?tr('cacheRuns'):tr('cacheVolume');
  const filter=i.filter?String(i.filter).slice(0,60):'';
  text.textContent=kind+(i.description?' · '+i.description:'')+(i.plan?' · '+i.plan:'')+' · '+fmt(e.bytes||0)+' · '+new Date(e.lastUsed).toLocaleString();
  if(filter){const f=document.createElement('small');f.textContent=filter;text.append(document.createElement('br'),f)}
  const del=document.createElement('button');del.type='button';del.className='secondary-button';del.textContent=tr('cacheDelete');
  del.onclick=async()=>{await cache.remove(e.key);void updateVolumeCacheControl();void renderCacheList()};
  row.append(text,del);box.append(row);
 }
}

// build 297: after lowering the limit, offer to drop the least recently used
// entries over it now (otherwise it only applied at the next store)
async function pruneToLimit(ask){
 const cache=await volumeCache();if(!cache)return;
 const live=(await cache.list()).filter(e=>e.complete),total=live.reduce((a,e)=>a+(e.bytes||0),0),budget=await volumeCacheBudget();
 if(total<=budget){if(!ask)alert(tr('cacheWithinLimit'));return}
 if(!confirm(tr('cachePruneConfirm').replace('{total}',fmt(total)).replace('{limit}',fmt(budget))))return;
 await cache.prune(budget);void updateVolumeCacheControl();void renderCacheList();
}
