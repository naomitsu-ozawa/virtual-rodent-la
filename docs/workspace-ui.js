// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { set3DBusy } from './three-status.js?v=20260927-build261';
import { useWorkspaceUi, updateRenderModeControl, clearResidentMprJobs, prepareResidentGpuVolume, activateMedicalVolume, setThreeVolumeOverlay } from './data-load.js?v=20260927-build261';
import { appVersionBadge, planes, ipadGpuQualityControl, ipadGpuQuality, footer } from './ui-shell.js?v=20260927-build261';
import { sceneState, volume, currentLanguage, ipadGpuTargetSide, setIpadGpuTargetSide, sourceVolume, threeRenderMode, setResidentMprReadbackDisabled, setThreeRenderMode } from './state.js?v=20260927-build261';
import { updateMprCanvasPhysicalAspect, schedulePlaneRender } from './mpr-render.js?v=20260927-build261';
import { request3DRender } from './scene3d.js?v=20260927-build261';
import { applyLanguage } from './i18n.js?v=20260927-build261';
import { isIPadRuntime, fmt } from './utils.js?v=20260927-build261';
export function initIPadWorkspaceUi(){
 if(!useWorkspaceUi())return;
 const shell=document.querySelector('.app-shell'),workspace=document.querySelector('.workspace'),sidebar=document.querySelector('.sidebar'),sidebarScroll=document.querySelector('.sidebar-scroll'),viewer=document.querySelector('#viewer-grid'),topbar=document.querySelector('.topbar');
 if(!shell||!workspace||!sidebar||!sidebarScroll||!viewer||!topbar)return;
 document.documentElement.classList.add('vrl-ipad-ui','ipad-settings-persistent');
 shell.classList.add('ipad-mode-3d');

 const toolbar=document.createElement('div');
 toolbar.id='ipad-workspace-toolbar';toolbar.className='ipad-workspace-toolbar';
 toolbar.innerHTML='<div class="ipad-view-modes" role="group" aria-label="View mode"><button type="button" class="is-active" data-ipad-view-mode="3d" data-i18n="ipadView3d">3D</button><button type="button" data-ipad-view-mode="2d" data-i18n="ipadView2d">2D</button><button type="button" data-ipad-view-mode="split" data-i18n="ipadViewSplit">分割</button></div><div class="ipad-mpr-tabs" role="tablist" aria-label="MPR plane"><button type="button" class="is-active" data-ipad-mpr="axial">Axial</button><button type="button" data-ipad-mpr="coronal">Coronal</button><button type="button" data-ipad-mpr="sagittal">Sagittal</button></div>';
 topbar.after(toolbar);

 const settingsHead=document.createElement('div');settingsHead.className='ipad-drawer-head ipad-settings-head';
 settingsHead.innerHTML='<strong data-i18n="ipadSettings">設定</strong>';
 sidebar.insertBefore(settingsHead,sidebarScroll);
 const drawerTabs=document.createElement('div');drawerTabs.className='ipad-drawer-tabs';
 drawerTabs.innerHTML='<button type="button" data-ipad-drawer-tab="data" data-i18n="ipadData">データ</button><button type="button" class="is-active" data-ipad-drawer-tab="display" data-i18n="ipadDisplay">表示・Seg</button><button type="button" data-ipad-drawer-tab="edit" data-i18n="ipadEdit">3D編集</button>';
 sidebarScroll.insertBefore(drawerTabs,sidebarScroll.firstChild);

 const panels=[...sidebarScroll.querySelectorAll(':scope > .panel')];
 const dataPanel=panels[0]||null,displayPanel=panels.find(p=>p.classList.contains('compact-panel'))||panels[1]||null;
 if(dataPanel)dataPanel.dataset.ipadDrawerSection='data';
 if(displayPanel)displayPanel.dataset.ipadDrawerSection='display';

 const editDetails=document.querySelector('.three-edit-panel');
 if(editDetails){
  const editPanel=document.createElement('section');editPanel.className='panel ipad-edit-drawer-panel';editPanel.dataset.ipadDrawerSection='edit';
  editPanel.appendChild(editDetails);sidebarScroll.appendChild(editPanel);editDetails.open=true;
 }
 const ctRange=document.querySelector('.ct-range-mode'),gpuQuality=document.querySelector('#ipad-gpu-quality-control'),mprOpacity=document.querySelector('.mpr-opacity-settings');
 if(displayPanel&&ctRange&&gpuQuality){gpuQuality.classList.remove('is-hidden');gpuQuality.style.display='inline-flex';ctRange.insertAdjacentElement('afterend',gpuQuality)}
 if(displayPanel&&mprOpacity)displayPanel.appendChild(mprOpacity);

 const sectionResult=document.querySelector('#section-view-result'),analysisResult=document.querySelector('#volume-analysis-result');
 if(displayPanel&&(sectionResult||analysisResult)){
  const analysisSettings=document.createElement('div');analysisSettings.className='ipad-analysis-settings';
  if(sectionResult)analysisSettings.appendChild(sectionResult);
  if(analysisResult)analysisSettings.appendChild(analysisResult);
  const anchor=gpuQuality?.parentElement===displayPanel?gpuQuality:ctRange;
  if(anchor)anchor.insertAdjacentElement('afterend',analysisSettings);else displayPanel.prepend(analysisSettings);
 }

 const footerBar=document.querySelector('.app-shell > footer');
 if(appVersionBadge&&footerBar)footerBar.appendChild(appVersionBadge);

 let drawerTab='display',viewMode='3d',mprPlane='axial';
 let layoutRefreshToken=0;
 const refreshLayout=()=>{
  const token=++layoutRefreshToken;
  const run=()=>{
   if(token!==layoutRefreshToken)return;
   try{sceneState?.resize?.()}catch{}
   try{if(volume)for(const p of Object.keys(planes))updateMprCanvasPhysicalAspect(p)}catch{}
   try{request3DRender()}catch{}
  };
  requestAnimationFrame(()=>{run();requestAnimationFrame(run)});
  setTimeout(run,120);
 };
 const setDrawerTab=tab=>{
  drawerTab=tab;
  sidebarScroll.querySelectorAll('[data-ipad-drawer-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadDrawerTab===tab));
  sidebarScroll.querySelectorAll('[data-ipad-drawer-section]').forEach(p=>p.classList.toggle('is-ipad-drawer-hidden',p.dataset.ipadDrawerSection!==tab));
  if(tab==='edit'&&editDetails)editDetails.open=true;
  refreshLayout();
 };
 const onSettingsTabRequest=e=>{
  const tab=e?.detail?.tab;
  if(['data','display','edit'].includes(tab))setDrawerTab(tab);
 };
 document.addEventListener('vrl-ipad-settings-tab',onSettingsTabRequest);

 const setMprPlane=plane=>{
  mprPlane=['axial','coronal','sagittal'].includes(plane)?plane:'axial';
  toolbar.querySelectorAll('[data-ipad-mpr]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadMpr===mprPlane));
  document.querySelectorAll('#sub-view-slots .view-slot-sub').forEach(slot=>slot.classList.toggle('is-ipad-active',slot.querySelector('[data-view-key]')?.dataset.viewKey===mprPlane));
  try{schedulePlaneRender(mprPlane,true)}catch{}
  refreshLayout();
 };
 const setViewMode=mode=>{
  viewMode=['3d','2d','split'].includes(mode)?mode:'3d';
  shell.classList.remove('ipad-mode-3d','ipad-mode-2d','ipad-mode-split');shell.classList.add('ipad-mode-'+viewMode);
  toolbar.querySelectorAll('[data-ipad-view-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadViewMode===viewMode));
  setMprPlane(mprPlane);
 };
 drawerTabs.querySelectorAll('[data-ipad-drawer-tab]').forEach(b=>b.addEventListener('click',()=>setDrawerTab(b.dataset.ipadDrawerTab)));
 toolbar.querySelectorAll('[data-ipad-view-mode]').forEach(b=>b.addEventListener('click',()=>setViewMode(b.dataset.ipadViewMode)));
 toolbar.querySelectorAll('[data-ipad-mpr]').forEach(b=>b.addEventListener('click',()=>setMprPlane(b.dataset.ipadMpr)));
 window.addEventListener('orientationchange',refreshLayout,{passive:true});
 window.addEventListener('resize',()=>{if(useWorkspaceUi())refreshLayout()},{passive:true});
 setDrawerTab('data');setMprPlane('axial');setViewMode('3d');applyLanguage(currentLanguage);
}
export function initIPadGpuQualityControl(){
 if(!ipadGpuQualityControl||!ipadGpuQuality)return;
 if(!isIPadRuntime()){ipadGpuQualityControl.classList.add('is-hidden');ipadGpuQualityControl.style.display='none';return}
 ipadGpuQualityControl.classList.remove('is-hidden');ipadGpuQualityControl.style.display='inline-flex';ipadGpuQuality.value=String(ipadGpuTargetSide);
 ipadGpuQuality.onchange=async()=>{
  const next=+ipadGpuQuality.value===768?768:512;if(next===ipadGpuTargetSide)return;
  setIpadGpuTargetSide(next);
  const mv=sceneState?.medicalVolume,target=sourceVolume||volume,wasVolume=threeRenderMode==='volume'&&!!mv?.active;
  if(!mv||!target?.sourceBacked){updateRenderModeControl(target);return}
  clearResidentMprJobs();setResidentMprReadbackDisabled(true);mv.resetData();
  set3DBusy(true,'iPad GPU '+next+' 準備中…');
  const ok=await prepareResidentGpuVolume(target);
  if(ok&&wasVolume)await activateMedicalVolume();
  else if(ok){mv.setActive(false);setThreeRenderMode('surface');setThreeVolumeOverlay(false);updateRenderModeControl(target);request3DRender()}
  if(ok)footer.textContent='iPad GPU '+next+' · '+(mv.textureDims||[]).join('×')+' · '+fmt(mv.textureBytes);
 };
}
