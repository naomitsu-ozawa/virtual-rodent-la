// Settings dialog (build 280). Tabs: 描画 (rendering) and デバッグ (debug);
// add a tab button + panel in ui-shell.js to extend it.
import { settings } from './app-settings.js?v=20260928-build281';
import { request3DRender } from './scene3d.js?v=20260928-build281';
import { updateGpuStatus } from './gpu-compute.js?v=20260928-build281';
export function initSettingsDialog(){
 const dlg=document.getElementById('settings-dialog'),open=document.getElementById('settings-open');if(!dlg||!open)return;
 open.onclick=()=>{sync();dlg.showModal?dlg.showModal():dlg.setAttribute('open','')};
 document.getElementById('settings-close').onclick=()=>dlg.close?dlg.close():dlg.removeAttribute('open');
 dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close?.()});
 for(const tab of dlg.querySelectorAll('[data-settings-tab]'))tab.onclick=()=>{
  for(const t of dlg.querySelectorAll('[data-settings-tab]'))t.classList.toggle('is-active',t===tab);
  for(const p of dlg.querySelectorAll('[data-settings-panel]'))p.hidden=p.dataset.settingsPanel!==tab.dataset.settingsTab;
 };
 const bind=(id,key,rerender=true)=>{const el=document.getElementById(id);if(!el)return;el.onchange=()=>{settings.set(key,el.type==='checkbox'?el.checked:el.value);if(rerender)request3DRender();if(key==='debug'||key==='showPerf')updateGpuStatus()}};
 bind('set-drag-quality','dragQuality');bind('set-rest-quality','restQuality');bind('set-step-quality','stepQuality');bind('set-show-perf','showPerf');bind('set-debug','debug');
 function sync(){
  const v=settings.all(),put=(id,val)=>{const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=!!val;else el.value=String(val)};
  put('set-drag-quality',v.dragQuality);put('set-rest-quality',v.restQuality);put('set-step-quality',v.stepQuality);put('set-show-perf',v.showPerf);put('set-debug',v.debug);
 }
}
