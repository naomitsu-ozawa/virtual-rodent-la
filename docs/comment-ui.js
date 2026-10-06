// Position comments UI (Issue #88, stage 2): a small panel in the display drawer. "Add" records the current position (the linked
// crosshair, or the three slices on show) with the text; "View this place" moves the crosshair and the three sliders there. Nothing
// here runs by itself on load, and no pointer handler is added to the image canvases (the click / swipe on them is untouched).
import { planes } from './ui-shell.js?v=20261006-build467';
import { volume, activeSeries, getCrosshair, currentLanguage } from './state.js?v=20261006-build467';
import { tr } from './i18n.js?v=20261006-build467';
import { datasetFingerprint } from './project-file.js?v=20261006-build467';
import { COMMENT_MAX_TEXT, createComment, addComment, removeComment, restoreComment, updateCommentText, hasUnsavedComments, getComments, onCommentsChange, commentMatchesSeries, commentTarget, commentMarkers, getMarkersShown, setMarkersShown, onMarkersShownChange } from './comments.js?v=20261006-build467';
import { showCrosshairAt, crosshairModeActive, setOverlayPainter, requestOverlayDraw } from './crosshair-ui.js?v=20261006-build467';

let pop=null,popText=null,popPos=null,popStatus=null,popTimer=0,popFrom=null;
let root=null,listEl=null,textEl=null,addBtn=null,noteEl=null,undoEl=null,undoTimer=0,lastDeleted=null;
let showEl=null,bubble=null,bubbleTimer=0;
let editId=null,editDraft='',editFocus=false; // the comment being edited in the list (the draft survives a re-render of the list)
const hits={axial:[],coronal:[],sagittal:[]}; // exact markers last drawn per plane (CSS px on the overlay canvas), for the tap test
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

// ---- markers (drawn on the crosshair overlay canvases, never on the slice canvases) ----
const MARK='#4dd8ff';
function paintMarkers(ctx,p,g){
 hits[p]=[];if(!ctx||!getMarkersShown()||!volume)return;
 const fp=fingerprint(),dims=dimsOf();if(!fp||!dims)return;
 const ms=commentMarkers(p,getComments(),fp,+planes[p].slider.value,dims);if(!ms.length)return;
 const ipad=document.documentElement.classList.contains('vrl-ipad-ui'),R=ipad?13:11,r=R*0.62;
 ms.sort((a,b)=>a.exact-b.exact); // faint ones first, exact ones on top
 for(const m of ms){
  const x=g.x0+m.fx*g.w,y=g.y0+m.fy*g.h;
  if(m.exact){
   ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fillStyle=MARK;ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.stroke();
   ctx.fillStyle='#04202a';ctx.font='800 '+(R*1.05)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(m.number),x,y+0.5);
   hits[p].push({id:m.id,x,y,r:Math.max(R,ipad?22:16)});
  }else{ // a few slices away: a thin ring (dark halo under a light one), no number
   ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.stroke();ctx.lineWidth=1.8;ctx.strokeStyle=MARK;ctx.stroke();ctx.globalAlpha=1;
  }
 }
}
function closeBubble(){clearTimeout(bubbleTimer);if(bubble)bubble.hidden=true;listEl?.querySelectorAll('.is-highlight').forEach(e=>e.classList.remove('is-highlight'))}
function showBubble(p,hit){
 const c=getComments().find(x=>x.id===hit.id);if(!c)return;
 const card=planes[p].canvas.closest('.view-card');if(!card)return;
 if(!bubble){bubble=document.createElement('div');bubble.className='comment-bubble';bubble.setAttribute('role','status');bubble.innerHTML='<b class="comment-bubble-no"></b><span class="comment-bubble-text"></span>'}
 if(bubble.parentNode!==card)card.appendChild(bubble);
 const n=getComments().findIndex(x=>x.id===hit.id)+1;
 bubble.querySelector('.comment-bubble-no').textContent=n;bubble.querySelector('.comment-bubble-text').textContent=c.text||'—';
 bubble.hidden=false;
 const cv=document.getElementById(p+'-crosshair'),cr=cv.getBoundingClientRect(),kr=card.getBoundingClientRect();
 const bw=Math.min(260,kr.width-16);bubble.style.maxWidth=bw+'px';
 bubble.style.left=Math.max(8,Math.min(kr.width-bw-8,hit.x+cr.left-kr.left-bw/2))+'px';
 const y=hit.y+cr.top-kr.top;bubble.style.top=Math.max(8,y+22)+'px';
 listEl?.querySelectorAll('.is-highlight').forEach(e=>e.classList.remove('is-highlight'));
 listEl?.querySelector('[data-comment-id="'+CSS.escape(hit.id)+'"]')?.classList.add('is-highlight');
 clearTimeout(bubbleTimer);bubbleTimer=setTimeout(closeBubble,7000);
}
// Tap on a marker: listeners are ADDED (app.js keeps its own pointer handlers), nothing is prevented or stopped, and a tap that moved
// (a swipe) or is made in crosshair mode is ignored, so slice swiping and crosshair placement behave as before.
function installMarkerTap(){
 for(const p of Object.keys(hits)){
  const cv=planes[p].canvas;let d=null;
  cv.addEventListener('pointerdown',e=>{d={id:e.pointerId,x:e.clientX,y:e.clientY}});
  cv.addEventListener('pointerup',e=>{
   const s=d;d=null;if(!s||s.id!==e.pointerId||crosshairModeActive()||!getMarkersShown())return;
   if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>6)return;
   const o=document.getElementById(p+'-crosshair').getBoundingClientRect(),x=e.clientX-o.left,y=e.clientY-o.top;
   let best=null,bd=1e9;for(const h of hits[p]){const dd=Math.hypot(h.x-x,h.y-y);if(dd<=h.r&&dd<bd){best=h;bd=dd}}
   if(best)showBubble(p,{...best});else if(bubble&&!bubble.hidden)closeBubble();
  });
  cv.addEventListener('pointercancel',()=>{d=null});
 }
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
// edit = the text of that list item turns into an input in place; save keeps position / time / series (comments.js updateCommentText)
function startEdit(id){const c=getComments().find(x=>x.id===id);if(!c)return;clearUndo();noteEl.textContent='';editId=id;editDraft=c.text;editFocus=true;render()}
function stopEdit(id){const had=editId;editId=null;editDraft='';render();if(had)listEl.querySelector('[data-comment-id="'+CSS.escape(id||had)+'"] .comment-edit')?.focus()}
function saveEdit(id){
 if(updateCommentText(id,editDraft)===null){noteEl.textContent=tr('commentEmptyNotSaved');return} // blank: nothing changes, stay in the editor
 noteEl.textContent='';stopEdit(id); // (a changed text re-rendered the list already; an unchanged one did not)
}
function fmtTime(iso){try{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString(currentLanguage==='ja'?'ja-JP':'en-US',{dateStyle:'short',timeStyle:'short'})}catch{return''}}
function render(){
 if(!root)return;
 const fp=fingerprint(),list=getComments(),ok=ready();
 addBtn.disabled=!ok;
 document.querySelectorAll('[data-comment-toggle]').forEach(b=>{b.disabled=!ok;b.title=tr('commentAddTitle')});
 if(!ok)closePopover();
 requestOverlayDraw();closeBubble();
 if(editId&&!list.some(c=>c.id===editId)){editId=null;editDraft=''}
 listEl.replaceChildren();
 if(!list.length){const e=document.createElement('p');e.className='comment-empty';e.textContent=tr('commentEmpty');listEl.appendChild(e);return}
 for(const c of list){
  const same=commentMatchesSeries(c,fp),li=document.createElement('li');li.className='comment-item';li.dataset.commentId=c.id;
  const body=document.createElement('div');body.className='comment-body';
  const no=document.createElement('span');no.className='comment-no';no.textContent=String(list.indexOf(c)+1);no.setAttribute('aria-hidden','true');
  const t=document.createElement('p');t.className='comment-text';t.textContent=c.text;
  const m=document.createElement('p');m.className='comment-meta';
  m.textContent=`i ${c.position.i} · j ${c.position.j} · k ${c.position.k}`+(c.createdAt?' · '+fmtTime(c.createdAt):'')+(same?'':' · '+tr('commentOtherSeries')+' · '+tr('commentNotSaved'));
  const editing=c.id===editId;
  if(editing){
   const ta=document.createElement('textarea');ta.className='comment-input comment-edit-input';ta.rows=2;ta.maxLength=COMMENT_MAX_TEXT;ta.value=editDraft;
   ta.setAttribute('aria-label',tr('commentEditLabel'));
   ta.addEventListener('input',()=>{editDraft=ta.value;if(noteEl.textContent===tr('commentEmptyNotSaved'))noteEl.textContent=''});
   // Esc cancels only this edit (not the crosshair mode / drawer); Ctrl/Cmd+Enter saves
   ta.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();noteEl.textContent='';stopEdit(c.id)}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveEdit(c.id)}});
   body.append(no,ta,m);
   const ea=document.createElement('div');ea.className='comment-actions';
   const sv=document.createElement('button');sv.type='button';sv.className='tool-chip comment-edit-save';sv.textContent=tr('commentSave');sv.addEventListener('click',()=>saveEdit(c.id));
   const cn=document.createElement('button');cn.type='button';cn.className='tool-chip comment-edit-cancel';cn.textContent=tr('commentCancel');cn.addEventListener('click',()=>{noteEl.textContent='';stopEdit(c.id)});
   ea.append(sv,cn);li.append(body,ea);listEl.appendChild(li);
   if(editFocus){editFocus=false;ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}
   continue;
  }
  body.append(no,t,m);
  const acts=document.createElement('div');acts.className='comment-actions';
  const view=document.createElement('button');view.type='button';view.className='tool-chip comment-view';view.textContent=tr('commentView');
  view.disabled=!same||!ok;view.title=same?'':tr('commentOtherSeriesTitle');
  view.addEventListener('click',()=>{clearUndo();const wasOn=crosshairModeActive(),at=viewComment(c.id);noteEl.textContent=at?tr('commentViewed')+(wasOn?'':tr('commentViewedModeOn')):''});
  const del=document.createElement('button');del.type='button';del.className='tool-chip comment-delete';del.textContent=tr('commentDelete');
  del.addEventListener('click',()=>deleteWithUndo(c.id));
  const ed=document.createElement('button');ed.type='button';ed.className='tool-chip comment-edit';ed.textContent=tr('commentEdit');
  ed.addEventListener('click',()=>startEdit(c.id));
  acts.append(view,ed,del);li.append(body,acts);listEl.appendChild(li);
 }
}
export function refreshCommentsUi(){
 if(!root)return;
 root.querySelector('summary').textContent=tr('commentsTitle');
 root.querySelector('.comment-hint').textContent=tr('commentsHint');
 textEl.placeholder=tr('commentPlaceholder');textEl.setAttribute('aria-label',tr('commentPlaceholder'));addBtn.textContent=tr('commentAdd');
 if(pop){pop.setAttribute('aria-label',tr('commentAddShort'));popText.placeholder=tr('commentPlaceholder');popText.setAttribute('aria-label',tr('commentPlaceholder'));pop.querySelector('.comment-pop-save').textContent=tr('commentSave');pop.querySelector('.comment-pop-cancel').textContent=tr('commentCancel')}
 if(showEl)showEl.nextElementSibling.textContent=tr('commentShowMarkers');
 render();
}
// Toolbar "add comment" button (next to the crosshair button of each MPR card): a small popover inside that card, so it works on the iPad
// workspace UI without opening the drawer. Saving, the list and "view this place" stay in the panel. It records the position at the
// moment of saving (the same rule as the panel).
function closePopover(restoreFocus){
 clearTimeout(popTimer);if(!pop||pop.hidden)return;
 pop.hidden=true;document.querySelectorAll('[data-comment-toggle]').forEach(b=>b.setAttribute('aria-expanded','false'));
 if(restoreFocus&&popFrom?.isConnected)popFrom.focus();
}
function openPopover(btn){
 clearTimeout(popTimer);
 const card=btn.closest('.view-card');if(!card||!ready())return;
 if(pop.parentNode!==card)card.appendChild(pop);
 document.querySelectorAll('[data-comment-toggle]').forEach(b=>b.setAttribute('aria-expanded',b===btn?'true':'false'));
 popFrom=btn;popStatus.textContent='';popStatus.hidden=true;pop.querySelector('.comment-pop-form').hidden=false;
 const c=currentCommentPosition();popPos.textContent=c?tr('commentAtPos')+' i '+c.i+' · j '+c.j+' · k '+c.k:'';
 pop.hidden=false;popText.focus();
}
function savePopover(){
 const saved=addCommentHere(popText.value);if(!saved)return;
 popText.value='';clearUndo();
 pop.querySelector('.comment-pop-form').hidden=true;popStatus.textContent=tr('commentSaved')+' · i '+saved.position.i+' · j '+saved.position.j+' · k '+saved.position.k;popStatus.hidden=false;
 popTimer=setTimeout(()=>closePopover(true),1800);
}
function installPopover(){
 pop=document.createElement('div');pop.className='comment-popover';pop.setAttribute('role','dialog');pop.hidden=true;
 pop.innerHTML='<div class="comment-pop-form" style="display:grid;gap:6px"><p class="comment-pop-pos"></p><textarea class="comment-input" rows="2" maxlength="2000"></textarea><div class="comment-pop-actions"><button type="button" class="tool-chip comment-pop-save"></button><button type="button" class="tool-chip comment-pop-cancel"></button></div></div><p class="comment-pop-pos" role="status" hidden></p>';
 popText=pop.querySelector('.comment-input');popPos=pop.querySelector('.comment-pop-pos');popStatus=pop.querySelector('[role=status]');
 pop.querySelector('.comment-pop-save').addEventListener('click',savePopover);
 pop.querySelector('.comment-pop-cancel').addEventListener('click',()=>closePopover(true));
 // Esc closes only this popover (the crosshair mode keeps its own Esc); the key never reaches the document handler while typing
 pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePopover(true)}});
 document.querySelectorAll('[data-comment-toggle]').forEach(b=>b.addEventListener('click',()=>{if(!pop.hidden&&popFrom===b)closePopover();else openPopover(b)}));
}
export function installComments(){
 const host=document.querySelector('.sidebar-scroll > .panel.compact-panel')||document.querySelector('.sidebar-scroll');
 if(!host||root)return;
 root=document.createElement('details');root.id='comment-panel';root.className='comment-panel';
 root.innerHTML='<summary></summary><p class="comment-hint"></p><label class="comment-show"><input type="checkbox" class="comment-show-input" checked><span></span></label><textarea class="comment-input" rows="2" maxlength="2000"></textarea><button type="button" class="tool-chip comment-add"></button><p class="comment-note" role="status"></p><div class="comment-undo" hidden role="status"><span class="comment-undo-text"></span> <button type="button" class="tool-chip comment-undo-btn"></button></div><ul class="comment-list"></ul>';
 host.appendChild(root);
 showEl=root.querySelector('.comment-show-input');showEl.addEventListener('change',()=>setMarkersShown(showEl.checked));onMarkersShownChange(on=>{if(showEl.checked!==on)showEl.checked=on;closeBubble();requestOverlayDraw()});
 setOverlayPainter(paintMarkers);installMarkerTap();document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBubble()});
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
 installPopover();
 refreshCommentsUi();
}
