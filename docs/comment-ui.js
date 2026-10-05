// Position comments UI (Issue #88, stage 2): a small panel in the display drawer. "Add" records the current position (the linked
// crosshair, or the three slices on show) with the text; "View this place" moves the crosshair and the three sliders there. Nothing
// here runs by itself on load, and no pointer handler is added to the image canvases (the click / swipe on them is untouched).
import { planes } from './ui-shell.js?v=20261005-build459';
import { volume, activeSeries, getCrosshair, currentLanguage } from './state.js?v=20261005-build459';
import { tr } from './i18n.js?v=20261005-build459';
import { datasetFingerprint } from './project-file.js?v=20261005-build459';
import { createComment, addComment, removeComment, restoreComment, hasUnsavedComments, getComments, onCommentsChange, commentMatchesSeries, commentTarget } from './comments.js?v=20261005-build459';
import { showCrosshairAt, crosshairModeActive } from './crosshair-ui.js?v=20261005-build459';

let root=null,listEl=null,textEl=null,addBtn=null,noteEl=null,undoEl=null,undoTimer=0,lastDeleted=null;
const dimsOf=()=>volume?{columns:volume.columns,rows:volume.rows,slices:volume.slices}:null;
const fingerprint=()=>activeSeries?datasetFingerprint(activeSeries):null;
const ready=()=>!!volume&&!!activeSeries&&!!planes.axial?.slider&&!planes.axial.slider.disabled;

// where the comment goes: the crosshair, else the three slices on show
export function currentCommentPosition(){
 const c=getCrosshair();if(c)return c;
 if(!volume)return null;
 const s=p=>+planes[p].slider.value;return{i:s('sagittal'),j:s('coronal'),k:s('axial')};
}
export function addCommentHere(text){
 const position=currentCommentPosition(),series=fingerprint();if(!position||!series)return null;
 return addComment(createComment({text,position,series}));
}
// "View this place": only for a comment of the open series; the position is clamped into the volume
export function viewComment(id){
 const c=getComments().find(x=>x.id===id),fp=fingerprint();
 if(!c||!ready()||!commentMatchesSeries(c,fp))return null;
 const target=commentTarget(c,dimsOf());return target?showCrosshairAt(target,'comment'):null;
}

// delete = remove + an "undo" that stays until the next add / delete / view (or 20 s): a click on a 6-12 px neighbour must not lose data
function clearUndo(){clearTimeout(undoTimer);lastDeleted=null;if(undoEl){undoEl.hidden=true}}
function deleteWithUndo(id){
 const index=getComments().findIndex(c=>c.id===id),c=getComments()[index];if(!c)return;
 removeComment(id);lastDeleted={c,index};
 undoEl.querySelector('.comment-undo-text').textContent=tr('commentDeleted');undoEl.querySelector('.comment-undo-btn').textContent=tr('commentUndo');
 undoEl.hidden=false;noteEl.textContent='';clearTimeout(undoTimer);undoTimer=setTimeout(clearUndo,20000);
 undoEl.querySelector('.comment-undo-btn').focus(); // the delete button is gone: keep the keyboard focus inside the panel
}
function undoDelete(){
 const d=lastDeleted;if(!d)return;clearUndo();
 if(restoreComment(d.c,d.index))listEl.querySelector('[data-comment-id="'+CSS.escape(d.c.id)+'"] .comment-view')?.focus();
}
function fmtTime(iso){try{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString(currentLanguage==='ja'?'ja-JP':'en-US',{dateStyle:'short',timeStyle:'short'})}catch{return''}}
function render(){
 if(!root)return;
 const fp=fingerprint(),list=getComments(),ok=ready();
 addBtn.disabled=!ok;
 listEl.replaceChildren();
 if(!list.length){const e=document.createElement('p');e.className='comment-empty';e.textContent=tr('commentEmpty');listEl.appendChild(e);return}
 for(const c of list){
  const same=commentMatchesSeries(c,fp),li=document.createElement('li');li.className='comment-item';li.dataset.commentId=c.id;
  const body=document.createElement('div');body.className='comment-body';
  const t=document.createElement('p');t.className='comment-text';t.textContent=c.text;
  const m=document.createElement('p');m.className='comment-meta';
  m.textContent=`i ${c.position.i} · j ${c.position.j} · k ${c.position.k}`+(c.createdAt?' · '+fmtTime(c.createdAt):'')+(same?'':' · '+tr('commentOtherSeries')+' · '+tr('commentNotSaved'));
  body.append(t,m);
  const acts=document.createElement('div');acts.className='comment-actions';
  const view=document.createElement('button');view.type='button';view.className='tool-chip comment-view';view.textContent=tr('commentView');
  view.disabled=!same||!ok;view.title=same?'':tr('commentOtherSeriesTitle');
  view.addEventListener('click',()=>{clearUndo();const wasOn=crosshairModeActive(),at=viewComment(c.id);noteEl.textContent=at?tr('commentViewed')+(wasOn?'':tr('commentViewedModeOn')):''});
  const del=document.createElement('button');del.type='button';del.className='tool-chip comment-delete';del.textContent=tr('commentDelete');
  del.addEventListener('click',()=>deleteWithUndo(c.id));
  acts.append(view,del);li.append(body,acts);listEl.appendChild(li);
 }
}
export function refreshCommentsUi(){
 if(!root)return;
 root.querySelector('summary').textContent=tr('commentsTitle');
 root.querySelector('.comment-hint').textContent=tr('commentsHint');
 textEl.placeholder=tr('commentPlaceholder');textEl.setAttribute('aria-label',tr('commentPlaceholder'));addBtn.textContent=tr('commentAdd');
 render();
}
export function installComments(){
 const host=document.querySelector('.sidebar-scroll > .panel.compact-panel')||document.querySelector('.sidebar-scroll');
 if(!host||root)return;
 root=document.createElement('details');root.id='comment-panel';root.className='comment-panel';
 root.innerHTML='<summary></summary><p class="comment-hint"></p><textarea class="comment-input" rows="2" maxlength="2000"></textarea><button type="button" class="tool-chip comment-add"></button><p class="comment-note" role="status"></p><div class="comment-undo" hidden role="status"><span class="comment-undo-text"></span> <button type="button" class="tool-chip comment-undo-btn"></button></div><ul class="comment-list"></ul>';
 host.appendChild(root);
 listEl=root.querySelector('.comment-list');textEl=root.querySelector('.comment-input');addBtn=root.querySelector('.comment-add');noteEl=root.querySelector('.comment-note');undoEl=root.querySelector('.comment-undo');
 undoEl.querySelector('.comment-undo-btn').addEventListener('click',undoDelete);
 addBtn.addEventListener('click',()=>{if(addCommentHere(textEl.value)){textEl.value='';clearUndo()}});
 // unsaved comments (added / deleted / edited since the last project save or load) are lost on reload: ask the browser to confirm
 window.addEventListener('beforeunload',e=>{if(hasUnsavedComments()){e.preventDefault();e.returnValue=''}});
 onCommentsChange(render);
  // (render() rebuilds the buttons: never on pointerdown, it would swallow the click that follows)
 root.addEventListener('toggle',render);
 // (no render on vrl-crosshairchange: the list does not depend on it, and rebuilding it made "view this place" lose the focus)
 document.addEventListener('vrl-serieschange',render);
 const mo=typeof MutationObserver!=='undefined'?new MutationObserver(render):null;
 mo?.observe(planes.axial.slider,{attributes:true,attributeFilter:['disabled']});
 refreshCommentsUi();
}
