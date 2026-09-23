
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { MedicalVolumeRenderer, extractSourceThresholdRuns } from './medical-volume.js?v=20260922-build15-wgsl';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
const APP_VERSION='2026.09.23-92';const APP_BUILD='92';
async function ensureLatestDeployedBuild(){
 try{
  const res=await fetch('./version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!res.ok)return;
  const latest=await res.json(),build=String(latest?.build||'');
  if(!build||build===String(APP_BUILD))return;
  const url=new URL(location.href);url.searchParams.set('build',build);location.replace(url.toString());
 }catch(e){console.warn('Version check failed.',e)}
}


const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
const DEMO_SIZE=20800000;
const app=document.querySelector('#app');
let currentLanguage='ja';
const I18N={
 ja:{
  subtitle:'マウス・実験動物画像のためのブラウザDICOM CTビューワー',
  gpuChecking:'WEBGPU 確認中',
  demo:'公開マウスCTデモ',openFolder:'DICOMフォルダを開く',
  dataset:'データセット',series:'DICOMシリーズ',selectData:'データを選択してください',
  selectDataHelp:'ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。',
  display:'表示',ctDisplay:'CT表示',windowCenter:'ウィンドウ中心',windowWidth:'ウィンドウ幅',ctRange:'CT値操作範囲',autoRange:'Auto',fullRange:'Full',rebuild3D:'3D再構築',cancel3D:'再構築をキャンセル',cancelling3D:'キャンセル中…',threeCancelled:'3D再構築をキャンセルしました。以前の3Dを保持しています。',threeCurrent:'3Dは最新',threeStale:'3Dは再構築待ち',threeUpdating:'3D再構築中',mainView:'メインへ',
  segmentation:'セグメンテーション',segments:'組織セグメント',
  bone:'骨',soft:'軟部組織',fat:'脂肪',lung:'肺',min:'最小',max:'最大',opacity:'不透明度',segmentPreset:'セグメントプリセット',addSegment:'セグメントを追加',removeSegment:'削除',opening:'Opening',closing:'Closing',minComponent:'最小連結成分',holeFill:'Hole Filling',
  surfaceSmooth:'表面平滑化',strength:'強度',sigmoidCenter:'中心',filterThreshold:'検出閾値',iterations:'反復回数',passes:'Pass数',searchRadius:'探索半径',patchRadius:'パッチ半径',spatialSigma:'空間Sigma',intensitySigma:'強度Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'STL書き出し',volumeRender:'GPUボリューム',surfaceRender:'サーフェス表示へ',volumeMode:'体積解析',volumeOff:'体積解析を終了',sliceAnalysis:'断面解析',sliceAnalysisOff:'断面解析を終了',sliceAnalysisHint:'3Dを切断する断面を選択してください',sectionReverse:'反転',sectionOff:'解除',sectionPosition:'断面位置',volumeHint:'3D上の部品をクリックしてください',analysisRegions:'解析領域',mergeSelected:'選択を統合',clearRegions:'すべて解除',showRegion:'表示',hideRegion:'非表示',deleteRegion:'削除',mergedRegion:'統合領域',analysisRegion:'領域',mergeNeedsTwo:'2件以上の領域を選択してください',mergingRegions:'領域を統合中…',edit3D:'3D編集',editNavigate:'操作',cutRegion:'ペン切断',lineCutRegion:'直線切断',editTarget:'対象',editAuto:'自動',editReady:'操作を選択してください',editPenHint:'空間または3D上に曲線を描き、その曲線を起点とする切断面を指定します',editLineHint:'空間または3D上で直線を描き、その直線を起点とする平面切断を指定します',editAutoHint:'自動: 最初に触れたセグメントを編集対象にします',removeSelectedRegion:'選択領域を削除',keepSelectedRegion:'選択領域のみ残す',undoEdit:'Undo',redoEdit:'Redo',resetEdit:'編集リセット',cutWidth:'切断厚さ',cutDepth:'切断深さ',cutYaw:'左右角度',cutPitch:'上下角度',cutOffset:'切断面位置',applyCut:'切断を適用',cancelCut:'キャンセル',cutPendingHint:'切断予定範囲を確認し、幅・深さ・角度を調整してから「切断を適用」を押してください',exportSelectedStl:'選択領域STL',selectRegion2D:'2D/3Dで領域を選択',resetFilters:'画像フィルターをリセット',
  controls:'3D: 左ドラッグで回転 / Shift+左ドラッグ・右ドラッグ・中ドラッグで平行移動 / ホイールでズーム。断面画像: 左右スワイプ / マウスホイールでスライス移動',
  seriesUnselected:'シリーズ未選択',selectSeries:'左の一覧からCTシリーズを選択してください。',
  footer:'元のキャリブレーション済みCT値は保持されます。',
  slices:'スライス',matrix:'マトリクス',voxel:'ボクセル',stored:'保存形式',
  estimated:'推定展開サイズ',decoding:'CTボリュームを展開中…',ready:'CTボリューム準備完了',
  demoLoading:'公開マウスPET/CTを取得中…',demoSize:'約20.8MBの公開データです。',
  demoFailed:'公開デモを読み込めませんでした',dicomChecking:'DICOMを確認中…',
  pixelDeferred:'Pixel Dataはまだ展開しません。',noSeries:'DICOMシリーズを検出できませんでした',
  original:'元のキャリブレーション済みCT値',processingReset:'処理をリセットしました。元のキャリブレーション済みCT値を復元しました',
  demoCache:'公開デモ: キャッシュ済みデータを使用',demoDone:'公開デモ: ダウンロード完了。端末キャッシュへ保存中'
 },
 en:{
  subtitle:'Browser-based DICOM CT viewer for mouse and laboratory-animal imaging',
  gpuChecking:'WEBGPU CHECKING',
  demo:'Public mouse CT demo',openFolder:'Open DICOM folder',
  dataset:'DATASET',series:'DICOM Series',selectData:'Select data',
  selectDataHelp:'Use a local folder or the approximately 20.8 MB public mouse PET/CT demo.',
  display:'DISPLAY',ctDisplay:'CT display',windowCenter:'Window Center',windowWidth:'Window Width',ctRange:'CT value range',autoRange:'Auto',fullRange:'Full',rebuild3D:'Rebuild 3D',cancel3D:'Cancel rebuild',cancelling3D:'Cancelling…',threeCancelled:'3D rebuild cancelled. Previous 3D retained.',threeCurrent:'3D is current',threeStale:'3D rebuild pending',threeUpdating:'Rebuilding 3D',mainView:'Main',
  segmentation:'SEGMENTATION',segments:'Tissue segments',
  bone:'Bone',soft:'Soft tissue',fat:'Fat',lung:'Lung',min:'Min',max:'Max',opacity:'Opacity',segmentPreset:'Segment preset',addSegment:'Add segment',removeSegment:'Remove',opening:'Opening',closing:'Closing',minComponent:'Min Component',holeFill:'Hole Filling',
  surfaceSmooth:'Surface Smooth',strength:'Strength',sigmoidCenter:'Center',filterThreshold:'Threshold',iterations:'Iterations',passes:'Passes',searchRadius:'Search Radius',patchRadius:'Patch Radius',spatialSigma:'Spatial Sigma',intensitySigma:'Intensity Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'Export STL',volumeRender:'GPU Volume',surfaceRender:'Back to surface',volumeMode:'Volume analysis',volumeOff:'Exit volume analysis',sliceAnalysis:'Section view',sliceAnalysisOff:'Exit section view',sliceAnalysisHint:'Choose a plane to cut the 3D model',sectionReverse:'Reverse',sectionOff:'Off',sectionPosition:'Section position',volumeHint:'Click a 3D component',analysisRegions:'Analysis regions',mergeSelected:'Merge selected',clearRegions:'Clear all',showRegion:'Show',hideRegion:'Hide',deleteRegion:'Delete',mergedRegion:'Merged region',analysisRegion:'Region',mergeNeedsTwo:'Select at least two regions',mergingRegions:'Merging regions…',edit3D:'3D edit',editNavigate:'Navigate',cutRegion:'Pen cut',lineCutRegion:'Line cut',editTarget:'Target',editAuto:'Auto',editReady:'Choose an edit tool',editPenHint:'Draw a curve in space or on the 3D view to define the cutting surface',editLineHint:'Draw a line in space or on the 3D view to define a planar cut',editAutoHint:'Auto: the first touched segment becomes the edit target',removeSelectedRegion:'Delete selected region',keepSelectedRegion:'Keep selected region only',undoEdit:'Undo',redoEdit:'Redo',resetEdit:'Reset edits',cutWidth:'Cut thickness',cutDepth:'Cut depth',cutYaw:'Horizontal angle',cutPitch:'Vertical angle',cutOffset:'Cut plane position',applyCut:'Apply cut',cancelCut:'Cancel',cutPendingHint:'Review the planned cut, adjust width, depth and angles, then press Apply cut',exportSelectedStl:'Selected region STL',selectRegion2D:'Select a region in 2D or 3D',resetFilters:'Reset image filters',
  controls:'3D: left-drag to rotate / Shift+left-drag, right-drag, or middle-drag to pan / wheel to zoom. MPR: swipe left/right or use the mouse wheel',
  seriesUnselected:'No Series selected',selectSeries:'Select a CT Series from the list on the left.',
  footer:'Original calibrated CT values are preserved.',
  slices:'Slices',matrix:'Matrix',voxel:'Voxel',stored:'Stored',
  estimated:'Estimated decoded size',decoding:'Decoding CT volume…',ready:'CT volume ready',
  demoLoading:'Loading public mouse PET/CT…',demoSize:'Approximately 20.8 MB of public data.',
  demoFailed:'Could not load the public demo',dicomChecking:'Checking DICOM…',
  pixelDeferred:'Pixel Data has not been expanded yet.',noSeries:'No DICOM Series detected',
  original:'Original calibrated CT values',processingReset:'Processing reset. Original calibrated CT values restored.',
  demoCache:'Public demo: using cached data',demoDone:'Public demo: download complete. Saving to device cache'
 }
};
const tr=key=>I18N[currentLanguage][key]??key;
function applyLanguage(lang){
 currentLanguage=lang;
 document.documentElement.lang=lang;
 document.title=lang==='ja'?'Virtual Rodent Lab — DICOMビューワー':'Virtual Rodent Lab — DICOM Viewer';
 document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=tr(key)});
 const toggle=document.querySelector('#language-toggle');if(toggle)toggle.textContent=lang==='ja'?'English':'日本語';
}
app.innerHTML=`
<main class="app-shell"><div id="processing-overlay" class="processing-overlay is-hidden" role="status" aria-live="polite" aria-busy="true"><div class="processing-spinner" aria-hidden="true"></div><strong id="processing-overlay-label">処理中…</strong></div>
<header class="topbar"><div><p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p><h1>Virtual Rodent Lab</h1><p class="subtitle" data-i18n="subtitle">マウス・実験動物画像のためのブラウザDICOM CTビューワー</p></div><div class="topbar-actions"><button id="language-toggle" class="secondary-button" type="button">English</button><div id="gpu-status" class="status status-checking" data-i18n="gpuChecking">WEBGPU 確認中</div><button id="demo-button" class="secondary-button" data-i18n="demo">公開マウスCTデモ</button><button id="open-folder" class="primary-button" data-i18n="openFolder">DICOMフォルダを開く</button><input id="folder-input" class="visually-hidden" type="file" webkitdirectory multiple></div></header>
<section class="workspace"><aside class="sidebar"><div class="sidebar-scroll"><section class="panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="dataset">データセット</p><h2 data-i18n="series">DICOMシリーズ</h2></div></div><div id="scan-state" class="empty-state"><strong data-i18n="selectData">データを選択してください</strong><span data-i18n="selectDataHelp">ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。</span></div><div id="scan-progress" class="progress-wrap is-hidden"><div class="progress-track"><div id="scan-progress-bar" class="progress-bar"></div></div><span id="scan-progress-label">0 / 0</span></div><div id="series-list" class="series-list"></div></section>
<section class="panel compact-panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="display">表示</p><h2 data-i18n="ctDisplay">CT表示</h2></div></div><div class="ct-range-mode"><span data-i18n="ctRange">CT値操作範囲</span><div class="ct-range-buttons"><button id="ct-range-auto" class="range-mode-button is-active" type="button" data-i18n="autoRange" disabled>Auto</button><button id="ct-range-full" class="range-mode-button" type="button" data-i18n="fullRange" disabled>Full</button></div></div><label class="range-row"><span data-i18n="windowCenter">ウィンドウ中心</span><output id="wc-val">—</output><input id="wc" type="range" min="-2000" max="4000" value="500" disabled></label><label class="range-row"><span data-i18n="windowWidth">ウィンドウ幅</span><output id="ww-val">—</output><input id="ww" type="range" min="1" max="8000" value="3000" disabled></label><div class="panel-heading segment-heading"><div><p class="panel-kicker" data-i18n="segmentation">セグメンテーション</p><h2 data-i18n="segments">組織セグメント</h2></div></div><div class="segment-add-row">
  <label class="segment-preset-label"><span data-i18n="segmentPreset">セグメントプリセット</span>
    <select id="segment-add-select" class="filter-select" disabled>
      <option value="bone" data-i18n="bone">骨</option>
      <option value="soft" data-i18n="soft">軟部組織</option>
      <option value="fat" data-i18n="fat">脂肪</option>
      <option value="lung" data-i18n="lung">肺</option>
    </select>
  </label>
  <button id="segment-add-button" class="tool-chip" type="button" data-i18n="addSegment" disabled>セグメントを追加</button>
</div>
<div id="segment-controls" class="segment-controls"><div class="segment-card is-hidden" data-segment="bone">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="bone" checked disabled><strong data-i18n="bone">骨</strong></label><input class="segment-color" data-seg-color="bone" type="color" value="#f3f0e8" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="bone">—</output><input data-seg-min="bone" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="bone">—</output><input data-seg-max="bone" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="bone">0.85</output><input data-seg-opacity="bone" type="range" min="0" max="1" step="0.05" value="0.85" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="bone">0</output><input data-seg-opening="bone" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="bone">0</output><input data-seg-closing="bone" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="bone">0</output><input data-seg-min-component="bone" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="bone" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="bone" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="bone" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="soft">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="soft"  disabled><strong data-i18n="soft">軟部組織</strong></label><input class="segment-color" data-seg-color="soft" type="color" value="#d97f7f" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="soft">—</output><input data-seg-min="soft" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="soft">—</output><input data-seg-max="soft" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="soft">0.28</output><input data-seg-opacity="soft" type="range" min="0" max="1" step="0.05" value="0.28" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="soft">0</output><input data-seg-opening="soft" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="soft">0</output><input data-seg-closing="soft" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="soft">0</output><input data-seg-min-component="soft" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="soft" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="soft" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="soft" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="fat">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="fat"  disabled><strong data-i18n="fat">脂肪</strong></label><input class="segment-color" data-seg-color="fat" type="color" value="#e7c85d" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="fat">—</output><input data-seg-min="fat" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="fat">—</output><input data-seg-max="fat" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="fat">0.35</output><input data-seg-opacity="fat" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="fat">0</output><input data-seg-opening="fat" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="fat">0</output><input data-seg-closing="fat" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="fat">0</output><input data-seg-min-component="fat" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="fat" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="fat" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="fat" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="lung">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="lung" disabled><strong data-i18n="lung">肺</strong></label><input class="segment-color" data-seg-color="lung" type="color" value="#6fb8d6" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="lung">—</output><input data-seg-min="lung" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="lung">—</output><input data-seg-max="lung" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="lung">0.35</output><input data-seg-opacity="lung" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="lung">0</output><input data-seg-opening="lung" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="lung">0</output><input data-seg-closing="lung" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="lung">0</output><input data-seg-min-component="lung" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="lung" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="lung" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="lung" data-i18n="removeSegment" disabled>削除</button>
</div></div><div class="surface-smooth-card">
  <label class="surface-smooth-toggle"><input id="surface-smooth-enabled" type="checkbox" checked disabled><strong data-i18n="surfaceSmooth">表面平滑化</strong></label>
  <label class="segment-range"><span data-i18n="strength">強度</span><output id="surface-smooth-value">0.60</output><input id="surface-smooth-strength" type="range" min="0" max="6" step="0.05" value="0.60" disabled></label>
</div>
<div class="filter-add-row">
  <select id="filter-add-select" class="filter-select">
    <option value="spikeHole">Spike / Hole</option>
    <option value="nlm">Fast NLM 3D</option>
    <option value="anisotropic">Anisotropic Diffusion</option>
    <option value="gaussian">Spatial Filter 3D</option>
    <option value="sigmoid">Sigmoid</option>
    <option value="bilateral">Bilateral 3D</option>
    <option value="tv">TV Denoising 3D</option>
    <option value="unsharp">Unsharp Mask 3D</option>
  </select>
  <button id="filter-add-button" class="tool-chip" type="button">フィルターを追加</button>
</div>
<div class="filter-3d-commit"><button id="filter-rebuild-3d" class="tool-chip filter-rebuild-3d" type="button" data-i18n="rebuild3D" disabled>3D再構築</button><span id="filter-3d-state" class="filter-3d-state is-current" data-i18n="threeCurrent">3Dは最新</span></div>
<div class="filter-control-list">
  <div class="filter-control-card is-hidden" data-filter-key="spikeHole" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-spike-hole" type="checkbox" disabled><strong>Spike / Hole</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="spike-hole-strength-value">0.50</output><input id="spike-hole-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
    <label class="segment-range"><span data-i18n="filterThreshold">検出閾値</span><output id="spike-hole-threshold-value">0.075</output><input id="spike-hole-threshold" type="range" min="0.01" max="0.15" step="0.005" value="0.075" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="nlm" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-nlm" type="checkbox" disabled><strong>Fast NLM 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="nlm-strength-value">0.45</output><input id="nlm-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="searchRadius">探索半径</span><output id="nlm-search-radius-value">1</output><input id="nlm-search-radius" type="range" min="1" max="2" step="1" value="1" disabled></label>
    <label class="segment-range"><span data-i18n="patchRadius">パッチ半径</span><output id="nlm-patch-radius-value">1</output><input id="nlm-patch-radius" type="range" min="0" max="2" step="1" value="1" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="anisotropic" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-anisotropic" type="checkbox" disabled><strong>Anisotropic Diffusion</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="anisotropic-strength-value">0.45</output><input id="anisotropic-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="iterations">反復回数</span><output id="anisotropic-iterations-value">4</output><input id="anisotropic-iterations" type="range" min="1" max="12" step="1" value="4" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="gaussian" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-gaussian" type="checkbox" disabled><strong>Spatial Filter 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span><select id="filter-smoothing-type" class="filter-select" disabled><option value="gaussian">Gaussian 3D</option><option value="median">Median 3D</option></select></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="gaussian-strength-value">0.40</output><input id="gaussian-strength" type="range" min="0" max="1" step="0.05" value="0.40" disabled></label>
    <label class="segment-range"><span data-i18n="passes">Pass数</span><output id="spatial-passes-value">2</output><input id="spatial-passes" type="range" min="1" max="6" step="1" value="2" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="sigmoid" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-sigmoid" type="checkbox" disabled><strong>Sigmoid</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="sigmoid-strength-value">0.50</output><input id="sigmoid-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
    <label class="segment-range"><span data-i18n="sigmoidCenter">中心</span><output id="sigmoid-center-value">—</output><input id="sigmoid-center" type="range" min="0" max="1" step="1" value="0" disabled></label>
  </div>

  <div class="filter-control-card is-hidden" data-filter-key="bilateral" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-bilateral" type="checkbox" disabled><strong>Bilateral 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="bilateral-strength-value">0.45</output><input id="bilateral-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="spatialSigma">空間Sigma</span><output id="bilateral-spatial-value">1.20</output><input id="bilateral-spatial" type="range" min="0.5" max="2.5" step="0.1" value="1.2" disabled></label>
    <label class="segment-range"><span data-i18n="intensitySigma">強度Sigma</span><output id="bilateral-intensity-value">0.08</output><input id="bilateral-intensity" type="range" min="0.01" max="0.25" step="0.01" value="0.08" disabled></label>
    <label class="segment-range"><span data-i18n="passes">Pass数</span><output id="bilateral-passes-value">1</output><input id="bilateral-passes" type="range" min="1" max="3" step="1" value="1" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="tv" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-tv" type="checkbox" disabled><strong>TV Denoising 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="weight">Weight</span><output id="tv-weight-value">0.12</output><input id="tv-weight" type="range" min="0.01" max="0.30" step="0.01" value="0.12" disabled></label>
    <label class="segment-range"><span data-i18n="iterations">反復回数</span><output id="tv-iterations-value">8</output><input id="tv-iterations" type="range" min="1" max="20" step="1" value="8" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="unsharp" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-unsharp" type="checkbox" disabled><strong>Unsharp Mask 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="radius">Radius</span><output id="unsharp-radius-value">1</output><input id="unsharp-radius" type="range" min="1" max="3" step="1" value="1" disabled></label>
    <label class="segment-range"><span data-i18n="amount">Amount</span><output id="unsharp-amount-value">0.80</output><input id="unsharp-amount" type="range" min="0" max="2" step="0.05" value="0.80" disabled></label>
    <label class="segment-range"><span data-i18n="filterThreshold">検出閾値</span><output id="unsharp-threshold-value">0.02</output><input id="unsharp-threshold" type="range" min="0" max="0.20" step="0.01" value="0.02" disabled></label>
  </div>
  <button id="filter-reset" class="tool-chip filter-reset" data-i18n="resetFilters" disabled>画像フィルターをリセット</button>
</div><p class="hint" data-i18n="controls">3D: 左ドラッグで回転 / Shift+左ドラッグ・右ドラッグ・中ドラッグで平行移動 / ホイールでズーム。タッチ: 1本指で回転 / 2本指でズーム・移動。断面画像: 左右スワイプ / マウスホイールでスライス移動</p></section></div></aside>
<section class="viewer-grid" id="viewer-grid"><section id="main-view-slot" class="view-slot view-slot-main"><article class="viewport-card view-card view-card-3d" data-view-key="3d"><div class="viewport-label view-toolbar"><strong>3D</strong><span id="three-label">WebGPU</span><span class="view-drag-handle" data-view-drag-handle aria-label="Drag to swap">⋮⋮</span><button class="view-main-button" type="button" data-view-main="3d" data-i18n="mainView">メインへ</button></div><div class="volume-analysis-panel"><button id="render-mode-toggle" class="tool-chip" data-i18n="volumeRender" disabled>GPUボリューム</button><button id="volume-analysis-toggle" class="tool-chip" data-i18n="volumeMode" disabled>体積解析</button><button id="section-view-toggle" class="tool-chip" data-i18n="sliceAnalysis" disabled>断面解析</button><div id="section-view-result" class="volume-analysis-result is-hidden"><strong data-i18n="sliceAnalysis">断面解析</strong><div class="section-view-actions"><button type="button" data-section-view="axial">Axial</button><button type="button" data-section-view="coronal">Coronal</button><button type="button" data-section-view="sagittal">Sagittal</button><button id="section-reverse" type="button" data-i18n="sectionReverse">反転</button><button type="button" data-section-view="off" data-i18n="sectionOff">解除</button></div><label class="section-position-control"><span data-i18n="sectionPosition">断面位置</span><output id="section-position-value">—</output><input id="section-position" type="range" min="0" max="0" value="0" disabled></label><span id="section-view-readout" data-i18n="sliceAnalysisHint">3Dを切断する断面を選択してください</span></div><div class="three-overlay-controls" aria-label="3D overlays"><button type="button" class="tool-chip is-active" data-3d-overlay="axes">XYZ</button><button type="button" class="tool-chip" data-3d-overlay="axial">Axial</button><button type="button" class="tool-chip" data-3d-overlay="coronal">Coronal</button><button type="button" class="tool-chip" data-3d-overlay="sagittal">Sagittal</button></div><details class="three-edit-panel"><summary class="three-edit-panel-head"><strong data-i18n="edit3D">3D編集</strong><span id="three-edit-status" class="three-edit-status" data-i18n="editReady">操作を選択してください</span></summary><div class="analysis-editor-actions"><button id="analysis-navigate" type="button" class="is-active" data-i18n="editNavigate">操作</button><button id="analysis-cut" type="button" disabled data-i18n="cutRegion">ペン切断</button><button id="analysis-line-cut" type="button" disabled data-i18n="lineCutRegion">直線切断</button><label class="three-edit-target"><span data-i18n="editTarget">対象</span><select id="analysis-edit-target"><option value="auto" data-i18n="editAuto">自動</option><option value="bone">Bone</option><option value="soft">Soft</option><option value="fat">Fat</option><option value="lung">Lung</option></select></label><button id="analysis-undo" type="button" disabled data-i18n="undoEdit">Undo</button><button id="analysis-redo" type="button" disabled data-i18n="redoEdit">Redo</button><button id="analysis-reset-edit" type="button" disabled data-i18n="resetEdit">編集リセット</button><label class="analysis-cut-width"><span data-i18n="cutWidth">切断幅</span><output id="analysis-cut-width-value">0.80 mm</output><input id="analysis-cut-width" type="range" min="0" max="5" step="0.05" value="0.8"></label><label class="analysis-cut-width"><span data-i18n="cutDepth">切断深さ</span><output id="analysis-cut-depth-value">5.0 mm</output><input id="analysis-cut-depth" type="range" min="0.1" max="100" step="0.1" value="5"></label><label class="analysis-cut-width"><span data-i18n="cutYaw">左右角度</span><output id="analysis-cut-yaw-value">0.0°</output><input id="analysis-cut-yaw" type="range" min="-90" max="90" step="0.25" value="0"></label><label class="analysis-cut-width"><span data-i18n="cutPitch">上下角度</span><output id="analysis-cut-pitch-value">0.0°</output><input id="analysis-cut-pitch" type="range" min="-90" max="90" step="0.25" value="0"></label><label class="analysis-cut-width"><span data-i18n="cutOffset">切断面位置</span><output id="analysis-cut-offset-value">0.0 mm</output><input id="analysis-cut-offset" type="range" min="-100" max="100" step="0.1" value="0"></label><div class="analysis-cut-confirm"><button id="analysis-cut-apply" type="button" disabled data-i18n="applyCut">切断を適用</button><button id="analysis-cut-cancel" type="button" disabled data-i18n="cancelCut">キャンセル</button></div></div><div id="three-edit-help" class="three-edit-help" data-i18n="editAutoHint">自動: 最初に触れたセグメントを編集対象にします</div></details><div id="volume-analysis-result" class="volume-analysis-result is-hidden"><div id="analysis-summary" class="analysis-summary"></div><div class="analysis-actions"><button id="analysis-merge" type="button" disabled data-i18n="mergeSelected">選択を統合</button><button id="analysis-clear" type="button" disabled data-i18n="clearRegions">すべて解除</button><button id="analysis-remove-selected" type="button" disabled data-i18n="removeSelectedRegion">選択領域を削除</button><button id="analysis-keep-selected" type="button" disabled data-i18n="keepSelectedRegion">選択領域のみ残す</button><button id="analysis-export-selected" type="button" disabled data-i18n="exportSelectedStl">選択領域STL</button></div><div id="analysis-region-list" class="analysis-region-list"></div></div></div><div id="viewport-3d" class="viewport viewport-3d"></div><canvas id="three-edit-overlay" class="three-edit-overlay" aria-hidden="true"></canvas><div id="three-busy" class="three-busy is-hidden" role="status" aria-live="polite"><div class="three-busy-spinner" aria-hidden="true"></div><strong id="three-busy-label">3D構築中…</strong><button id="three-busy-cancel" class="three-busy-cancel" type="button" data-i18n="cancel3D">再構築をキャンセル</button></div><div id="selected" class="selected-series-overlay"><strong data-i18n="seriesUnselected">シリーズ未選択</strong><span data-i18n="selectSeries">左の一覧からCTシリーズを選択してください。</span></div></article></section><section id="sub-view-slots" class="mpr-column">${['axial','coronal','sagittal'].map(p=>`<section class="view-slot view-slot-sub"><article class="viewport-card view-card view-card-mpr" data-view-key="${p}"><div class="viewport-label view-toolbar"><strong>${p[0].toUpperCase()+p.slice(1)}</strong><span id="${p}-label">—</span><span class="view-drag-handle" data-view-drag-handle aria-label="Drag to swap">⋮⋮</span><button class="view-main-button" type="button" data-view-main="${p}" data-i18n="mainView">メインへ</button></div><canvas id="${p}-canvas" class="mpr-canvas"></canvas><input id="${p}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled></article></section>`).join('')}</section></section></section>
<div id="app-version-badge" class="app-version-badge" aria-label="Application version"></div><footer><span id="footer" data-i18n="footer">元のキャリブレーション済みCT値は保持されます。</span><a href="https://github.com/naomitsu-ozawa/virtual-rodent-la" target="_blank" rel="noopener">Source / License</a></footer></main>`;

const $=s=>document.querySelector(s);
const appVersionBadge=$('#app-version-badge');
const viewport=$('#viewport-3d'),status=$('#gpu-status'),demoBtn=$('#demo-button'),folderBtn=$('#open-folder'),folderInput=$('#folder-input'),state=$('#scan-state'),prog=$('#scan-progress'),bar=$('#scan-progress-bar'),progLabel=$('#scan-progress-label'),list=$('#series-list'),selected=$('#selected'),footer=$('#footer'),threeLabel=$('#three-label'),wc=$('#wc'),ww=$('#ww'),wcVal=$('#wc-val'),wwVal=$('#ww-val'),gaussianBtn=$('#filter-gaussian'),smoothingType=$('#filter-smoothing-type'),spikeHoleBtn=$('#filter-spike-hole'),resetFilterBtn=$('#filter-reset'),nlmBtn=$('#filter-nlm'),anisotropicBtn=$('#filter-anisotropic'),sigmoidBtn=$('#filter-sigmoid'),gaussianStrength=$('#gaussian-strength'),gaussianStrengthValue=$('#gaussian-strength-value'),spatialPasses=$('#spatial-passes'),spatialPassesValue=$('#spatial-passes-value'),spikeHoleStrength=$('#spike-hole-strength'),spikeHoleStrengthValue=$('#spike-hole-strength-value'),spikeHoleThreshold=$('#spike-hole-threshold'),spikeHoleThresholdValue=$('#spike-hole-threshold-value'),nlmStrength=$('#nlm-strength'),nlmStrengthValue=$('#nlm-strength-value'),nlmSearchRadius=$('#nlm-search-radius'),nlmSearchRadiusValue=$('#nlm-search-radius-value'),nlmPatchRadius=$('#nlm-patch-radius'),nlmPatchRadiusValue=$('#nlm-patch-radius-value'),anisotropicStrength=$('#anisotropic-strength'),anisotropicStrengthValue=$('#anisotropic-strength-value'),anisotropicIterations=$('#anisotropic-iterations'),anisotropicIterationsValue=$('#anisotropic-iterations-value'),sigmoidStrength=$('#sigmoid-strength'),sigmoidStrengthValue=$('#sigmoid-strength-value'),sigmoidCenter=$('#sigmoid-center'),sigmoidCenterValue=$('#sigmoid-center-value'),bilateralBtn=$('#filter-bilateral'),bilateralStrength=$('#bilateral-strength'),bilateralStrengthValue=$('#bilateral-strength-value'),bilateralSpatial=$('#bilateral-spatial'),bilateralSpatialValue=$('#bilateral-spatial-value'),bilateralIntensity=$('#bilateral-intensity'),bilateralIntensityValue=$('#bilateral-intensity-value'),bilateralPasses=$('#bilateral-passes'),bilateralPassesValue=$('#bilateral-passes-value'),tvBtn=$('#filter-tv'),tvWeight=$('#tv-weight'),tvWeightValue=$('#tv-weight-value'),tvIterations=$('#tv-iterations'),tvIterationsValue=$('#tv-iterations-value'),unsharpBtn=$('#filter-unsharp'),unsharpRadius=$('#unsharp-radius'),unsharpRadiusValue=$('#unsharp-radius-value'),unsharpAmount=$('#unsharp-amount'),unsharpAmountValue=$('#unsharp-amount-value'),unsharpThreshold=$('#unsharp-threshold'),unsharpThresholdValue=$('#unsharp-threshold-value'),surfaceSmoothEnabled=$('#surface-smooth-enabled'),surfaceSmoothStrength=$('#surface-smooth-strength'),surfaceSmoothValue=$('#surface-smooth-value'),volumeAnalysisToggle=$('#volume-analysis-toggle'),volumeAnalysisResult=$('#volume-analysis-result'),sectionViewToggle=$('#section-view-toggle'),sectionViewResult=$('#section-view-result'),sectionViewReadout=$('#section-view-readout'),sectionPosition=$('#section-position'),sectionPositionValue=$('#section-position-value'),sectionReverse=$('#section-reverse'),analysisSummary=$('#analysis-summary'),analysisMergeButton=$('#analysis-merge'),analysisClearButton=$('#analysis-clear'),analysisRegionList=$('#analysis-region-list'),filterControlList=$('.filter-control-list'),filterAddSelect=$('#filter-add-select'),filterAddButton=$('#filter-add-button'),segmentAddSelect=$('#segment-add-select'),segmentAddButton=$('#segment-add-button'),segmentControls=$('#segment-controls');
const planes=Object.fromEntries(['axial','coronal','sagittal'].map(p=>[p,{canvas:$('#'+p+'-canvas'),slider:$('#'+p+'-slider'),label:$('#'+p+'-label')}]))
const languageToggle=$('#language-toggle'),processingOverlay=$('#processing-overlay'),processingOverlayLabel=$('#processing-overlay-label'),threeBusy=$('#three-busy'),threeBusyLabel=$('#three-busy-label'),threeBusyCancel=$('#three-busy-cancel'),ctRangeAuto=$('#ct-range-auto'),ctRangeFull=$('#ct-range-full'),filterRebuild3D=$('#filter-rebuild-3d'),filter3DState=$('#filter-3d-state'),renderModeToggle=$('#render-mode-toggle'),mainViewSlot=$('#main-view-slot'),subViewSlots=$('#sub-view-slots');
const mprResizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(volume)for(const p of Object.keys(planes))updateMprCanvasPhysicalAspect(p)}):null;
for(const p of Object.keys(planes))if(planes[p].canvas?.parentElement)mprResizeObserver?.observe(planes[p].canvas.parentElement);
const analysisNavigateButton=$('#analysis-navigate'),analysisCutButton=$('#analysis-cut'),analysisLineCutButton=$('#analysis-line-cut'),analysisEditTargetSelect=$('#analysis-edit-target'),threeEditStatus=$('#three-edit-status'),threeEditHelp=$('#three-edit-help'),threeEditOverlay=$('#three-edit-overlay'),analysisRemoveSelected=$('#analysis-remove-selected'),analysisKeepSelected=$('#analysis-keep-selected'),analysisUndo=$('#analysis-undo'),analysisRedo=$('#analysis-redo'),analysisResetEdit=$('#analysis-reset-edit'),analysisExportSelected=$('#analysis-export-selected'),analysisCutWidth=$('#analysis-cut-width'),analysisCutWidthValue=$('#analysis-cut-width-value'),analysisCutDepth=$('#analysis-cut-depth'),analysisCutDepthValue=$('#analysis-cut-depth-value'),analysisCutYaw=$('#analysis-cut-yaw'),analysisCutYawValue=$('#analysis-cut-yaw-value'),analysisCutPitch=$('#analysis-cut-pitch'),analysisCutPitchValue=$('#analysis-cut-pitch-value'),analysisCutOffset=$('#analysis-cut-offset'),analysisCutOffsetValue=$('#analysis-cut-offset-value'),analysisCutApply=$('#analysis-cut-apply'),analysisCutCancel=$('#analysis-cut-cancel');
languageToggle.onclick=()=>{applyLanguage(currentLanguage==='ja'?'en':'ja');renderAnalysisResults();updateSectionViewUi();updateThreeEditUi();updateGpuStatus();updateRenderModeControl()};
applyLanguage('ja');;
if(appVersionBadge)appVersionBadge.textContent='Virtual Rodent Lab · v'+APP_VERSION+' · build '+APP_BUILD;
let volume=null,sourceVolume=null,sceneState=null,activeId=null,activeSeries=null,volumeAnalysisMode=false,volumeAnalysisBusy=false,sourceRenderRevision=0;
let sectionViewOpen=false,sectionViewPlane=null,sectionViewReverse=false,sectionAutoPlane=null;
const mpr3DVisibility={axes:true,axial:false,coronal:false,sagittal:false};
function sectionPlaneLabel(p){return p?p[0].toUpperCase()+p.slice(1):''}
function updateSectionViewUi(){
 if(!sectionViewToggle)return;
 sectionViewToggle.removeAttribute('data-i18n');sectionViewToggle.textContent=sectionViewOpen?tr('sliceAnalysisOff'):tr('sliceAnalysis');sectionViewToggle.classList.toggle('is-active',sectionViewOpen);
 sectionViewResult?.classList.toggle('is-hidden',!sectionViewOpen);
 const active=!!sectionViewPlane&&!!planes[sectionViewPlane],idx=active?+planes[sectionViewPlane].slider.value:0,max=active?+planes[sectionViewPlane].slider.max:0;
 if(sectionPosition){sectionPosition.disabled=!active;sectionPosition.max=String(max);sectionPosition.value=String(idx)}
 if(sectionPositionValue)sectionPositionValue.value=active?(idx+1)+' / '+(max+1):'—';
 if(sectionReverse)sectionReverse.disabled=!active;
 if(sectionViewReadout)sectionViewReadout.textContent=active?sectionPlaneLabel(sectionViewPlane)+' · '+(idx+1)+' / '+(max+1)+(sectionViewReverse?' · '+tr('sectionReverse'):''):tr('sliceAnalysisHint');
}
function sectionLocalPoint(p=sectionViewPlane,idx=p?+planes[p].slider.value:0){
 if(!volume||!p)return null;
 const w=volume.columns,h=volume.rows,d=volume.slices,[sx,sy,sz]=volume.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 if(p==='axial')return new THREE.Vector3(0,0,((idx+.5)*sz-pz/2)*scale);
 if(p==='coronal')return new THREE.Vector3(0,-((idx+.5)*sy-py/2)*scale,0);
 return new THREE.Vector3(((idx+.5)*sx-px/2)*scale,0,0);
}
function sectionLocalStep(p=sectionViewPlane){
 if(!volume||!p)return null;const[sx,sy,sz]=volume.spacing,w=volume.columns,h=volume.rows,d=volume.slices,scale=3.3/Math.max(w*sx,h*sy,d*sz,1);
 return p==='axial'?new THREE.Vector3(0,0,sz*scale):p==='coronal'?new THREE.Vector3(0,-sy*scale,0):new THREE.Vector3(sx*scale,0,0);
}
function sectionLocalNormal(p=sectionViewPlane){
 if(!p)return null;
 const normal=p==='axial'?new THREE.Vector3(0,0,1):p==='coronal'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
 if(sectionViewReverse)normal.negate();return normal;
}
function sectionLocalPlane(){
 if(!volume||!sectionViewPlane)return null;
 const point=sectionLocalPoint(),normal=sectionLocalNormal();return new THREE.Plane(normal,-normal.dot(point));
}
function updateSectionClipPlaneWorld(){
 if(!sceneState?.obj||!sectionViewOpen||!sectionViewPlane)return;
 const localPoint=sectionLocalPoint(),localNormal=sectionLocalNormal();if(!localPoint||!localNormal)return;
 const obj=sceneState.obj;obj.updateMatrixWorld(true);
 const worldPoint=localPoint.clone().applyMatrix4(obj.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(obj.matrixWorld),worldNormal=localNormal.clone().applyMatrix3(normalMatrix).normalize();
 sceneState.sectionClipPlane.setFromNormalAndCoplanarPoint(worldNormal,worldPoint);
 if(sceneState.backend==='WEBGPU'&&sceneState.sectionClipGroup){
  const g=sceneState.sectionClipGroup;g.clippingPlanes=[sceneState.sectionClipPlane];g.enabled=true;
 }
}
function rebindWebGpuSectionClipGroup(){
 if(!sceneState?.obj||sceneState.backend!=='WEBGPU'||!THREE.ClippingGroup||!sectionViewOpen||!sectionViewPlane)return;
 const obj=sceneState.obj,old=sceneState.sectionClipGroup,next=new THREE.ClippingGroup();
 next.name='section_clip_group';next.enabled=true;next.clippingPlanes=[sceneState.sectionClipPlane];
 if(old&&obj.parent===old)old.remove(obj);else obj.parent?.remove?.(obj);
 if(old?.parent)old.parent.remove(old);
 sceneState.scene.add(next);next.add(obj);sceneState.sectionClipGroup=next;obj.updateMatrixWorld(true);
}
function applySectionClippingMaterials(root=sceneState?.obj){
 if(!root||!sceneState)return;
 const active=sectionViewOpen&&!!sectionViewPlane&&sceneState.backend!=='WEBGPU';
 root.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.clippingPlanes=active?[sceneState.sectionClipPlane]:null;m.clipShadows=false;m.needsUpdate=true}});
}
function syncSectionClipParent(){
 if(!sceneState?.obj)return;
 const active=sectionViewOpen&&!!sectionViewPlane;
 if(sceneState.backend==='WEBGPU'&&sceneState.sectionClipGroup){
  const g=sceneState.sectionClipGroup;
  if(active){if(sceneState.obj.parent!==g)g.add(sceneState.obj);g.enabled=true;g.clippingPlanes=[sceneState.sectionClipPlane]}
  else{g.enabled=false;g.clippingPlanes=[];if(sceneState.obj.parent===g){g.remove(sceneState.obj);sceneState.scene.add(sceneState.obj)}}
 }else{
  sceneState.renderer.localClippingEnabled=true;
  applySectionClippingMaterials(sceneState.obj);
 }
}
function restoreSectionAutoPlane(){
 if(!sectionAutoPlane)return;
 const {key,wasVisible}=sectionAutoPlane;sectionAutoPlane=null;
 const entry=sceneState?.mprPlaneEntries?.[key];
 if(entry){entry.mesh.material.opacity=.64;if(entry.highlight){entry.highlight.visible=false;entry.highlight.material.opacity=0}entry.border.material.opacity=.95;entry.label.scale.set(.78,.195,1)}
 setMpr3DOverlayVisible(key,wasVisible);
}
function showSectionPlaneOverlay(key){
 if(sectionAutoPlane?.key===key){
  const entry=sceneState?.mprPlaneEntries?.[key];if(entry){entry.mesh.material.opacity=.96;if(entry.highlight){entry.highlight.visible=true;entry.highlight.material.opacity=.24}entry.border.material.opacity=1;entry.label.scale.set(.95,.238,1);refreshMpr3DPlaneTexture(key)}
  return;
 }
 restoreSectionAutoPlane();
 const wasVisible=!!mpr3DVisibility[key];sectionAutoPlane={key,wasVisible};
 if(!wasVisible)setMpr3DOverlayVisible(key,true);
 const entry=sceneState?.mprPlaneEntries?.[key];
 if(entry){entry.mesh.material.opacity=.96;if(entry.highlight){entry.highlight.visible=true;entry.highlight.material.opacity=.24}entry.border.material.opacity=1;entry.label.scale.set(.95,.238,1);refreshMpr3DPlaneTexture(key)}
}
function clearSectionView(){
 restoreSectionAutoPlane();sectionViewPlane=null;sectionViewReverse=false;
 syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj);updateSectionViewUi();request3DRender();
}
function setSectionView(key){
 if(key==='off'){clearSectionView();return}
 if(!planes[key])return;
 if(threeRenderMode==='volume')deactivateMedicalVolume();
 sectionViewOpen=true;sectionViewPlane=key;showSectionPlaneOverlay(key);
 if(sectionPosition){sectionPosition.max=planes[key].slider.max;sectionPosition.value=planes[key].slider.value}
 updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj);updateMpr3DPlanePositions();updateSectionViewUi();request3DRender();
}
let analysisRegions=[],nextAnalysisRegionId=1,nextAnalysisColorIndex=0,analysisFocusedRegionId=null,analysisEditTool='select',analysisEditTargetKey=null,analysisEditTargetMode='auto',analysisCutStroke=null,analysisCutScreen=[],analysisPendingCut=null,analysisCutApplying=false;
function clearThreeEditOverlay(){const ctx=threeEditOverlay?.getContext('2d');ctx?.clearRect(0,0,threeEditOverlay.width,threeEditOverlay.height)}
const ANALYSIS_REGION_COLORS=[0x00d8ff,0xff9f1c,0x7ae582,0xff4d8d,0xf4e409,0x9b5cff,0xff5a5f,0x2ec4b6];
function nextAnalysisColor(){
 const color=ANALYSIS_REGION_COLORS[nextAnalysisColorIndex%ANALYSIS_REGION_COLORS.length];
 nextAnalysisColorIndex++;return color;
}
function analysisColorCss(color){return '#'+Number(color??0x00d8ff).toString(16).padStart(6,'0')}
function analysisRegionById(id){return analysisRegions.find(r=>r.id===id)||null}
function analysisRegionRepresentativeVoxel(region){
 if(!region?.runsBySlice)return null;
 const nonEmpty=[];for(let z=0;z<region.runsBySlice.length;z++)if(region.runsBySlice[z]?.length)nonEmpty.push(z);
 if(!nonEmpty.length)return null;
 const z=nonEmpty[Math.floor(nonEmpty.length/2)],rec=region.runsBySlice[z],i=Math.floor((rec.length/3)/2)*3;
 return{x:Math.floor((rec[i+1]+rec[i+2])/2),y:rec[i],z};
}
function setAnalysisFocusedRegion(id,voxel=null){
 const region=analysisRegionById(id);analysisFocusedRegionId=region?.id??null;
 for(const r of analysisRegions){
  r.focused=r.id===analysisFocusedRegionId;
  if(r.meshGroup)r.meshGroup.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.opacity=r.focused?.98:.46;m.emissiveIntensity=r.focused?.9:.28}});
 }
 if(region){
  const v=voxel||analysisRegionRepresentativeVoxel(region);
  if(v&&volume){
   planes.axial.slider.value=Math.max(0,Math.min(+planes.axial.slider.max,v.z));
   planes.coronal.slider.value=Math.max(0,Math.min(+planes.coronal.slider.max,v.y));
   planes.sagittal.slider.value=Math.max(0,Math.min(+planes.sagittal.slider.max,v.x));
  }
 }
 for(const p of Object.keys(planes))schedulePlaneRender(p);
 request3DRender();renderAnalysisResults();
}
function analysisRegionAtVoxel(x,y,z){
 const focused=analysisRegionById(analysisFocusedRegionId);
 if(focused?.visible&&analysisRunsContain(focused.runsBySlice,x,y,z))return focused;
 return analysisRegions.find(r=>r.visible&&analysisRunsContain(r.runsBySlice,x,y,z))||null;
}
function mprEventVoxel(p,event){
 if(!volume)return null;const c=planes[p],rect=c.canvas.getBoundingClientRect();
 const cx=Math.max(0,Math.min(c.canvas.width-1,Math.floor((event.clientX-rect.left)/Math.max(rect.width,1)*c.canvas.width)));
 const cy=Math.max(0,Math.min(c.canvas.height-1,Math.floor((event.clientY-rect.top)/Math.max(rect.height,1)*c.canvas.height)));
 const idx=+c.slider.value,d=volume.slices;
 if(p==='axial')return{x:cx,y:cy,z:idx};
 if(p==='coronal')return{x:cx,y:idx,z:d-1-cy};
 return{x:idx,y:cx,z:d-1-cy};
}
function selectAnalysisRegionFromMpr(p,event){
 if(!volumeAnalysisMode)return false;
 const voxel=mprEventVoxel(p,event);if(!voxel)return false;
 const region=analysisRegionAtVoxel(voxel.x,voxel.y,voxel.z);
 if(region){setAnalysisFocusedRegion(region.id,voxel);return true}
 void analyzeVolumeAtVoxel(voxel.x,voxel.y,voxel.z);return true;
}
function drawAnalysisOverlay(p,idx,ctx){
 if(!volumeAnalysisMode||!analysisRegions.length||!ctx)return;
 const d=volume?.slices||0;
 ctx.save();
 for(const region of analysisRegions){
  if(!region.visible)continue;
  const css=analysisColorCss(region.color),focused=region.id===analysisFocusedRegionId;
  ctx.fillStyle=css+(focused?'66':'2e');ctx.strokeStyle=css;ctx.lineWidth=focused?2:1;
  if(p==='axial'){
   const rec=region.runsBySlice?.[idx];if(!rec)continue;
   for(let i=0;i<rec.length;i+=3){const y=rec[i],x0=rec[i+1],x1=rec[i+2];ctx.fillRect(x0,y,x1-x0+1,1);if(focused)ctx.strokeRect(x0-.5,y-.5,x1-x0+1,1)}
  }else if(p==='coronal'){
   for(let z=0;z<d;z++){const rec=region.runsBySlice?.[z];if(!rec)continue;const py=d-1-z;for(let i=0;i<rec.length;i+=3)if(rec[i]===idx){ctx.fillRect(rec[i+1],py,rec[i+2]-rec[i+1]+1,1);if(focused)ctx.strokeRect(rec[i+1]-.5,py-.5,rec[i+2]-rec[i+1]+1,1)}}
  }else{
   for(let z=0;z<d;z++){const rec=region.runsBySlice?.[z];if(!rec)continue;const py=d-1-z;for(let i=0;i<rec.length;i+=3)if(idx>=rec[i+1]&&idx<=rec[i+2]){const y=rec[i];ctx.fillRect(y,py,1,1);if(focused)ctx.strokeRect(y-.5,py-.5,1,1)}}
  }
 }
 ctx.restore();
}
let deferAutomatic3D=false,threeDDirty=false,threeDApplying=false,threeDCancelRequested=false,current3DVolume=null,memoryGpuPreviewActive=false;
let ctRangeMode='auto',ctRangeProfile=null;
const memoryFilterPreviewCache={map:new Map(),bytes:0};
const filterState={spikeHole:false,nlm:false,anisotropic:false,gaussian:false,sigmoid:false,bilateral:false,tv:false,unsharp:false};
const FILTER_CATALOG_ORDER=['spikeHole','nlm','anisotropic','gaussian','sigmoid','bilateral','tv','unsharp'];
let filterOrder=[];
let filterRebuildTimer=null;
let filterRebuildRevision=0;
const SEGMENT_PRESET_ORDER=['bone','soft','fat','lung'];
const segmentEditState=Object.fromEntries(SEGMENT_PRESET_ORDER.map(key=>[key,{baseRuns:null,baseSignature:'',keepRuns:null,excludeRuns:null,finalRuns:null,revision:0,undo:[],redo:[],surfaceGroup:null}]));
const segmentState={
 bone:{active:false,enabled:false,color:'#f3f0e8',opacity:.85,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 soft:{active:false,enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 fat:{active:false,enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 lung:{active:false,enabled:false,color:'#6fb8d6',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''}
};
let segmentRenderTimer=null;
let threeRenderMode='surface';

function set3DState(mode){
 threeDDirty=mode==='stale';threeDApplying=mode==='updating';
 if(!filter3DState||!filterRebuild3D)return;
 filter3DState.classList.toggle('is-stale',mode==='stale');
 filter3DState.classList.toggle('is-updating',mode==='updating');
 filter3DState.classList.toggle('is-current',mode==='current');
 const key=mode==='stale'?'threeStale':mode==='updating'?'threeUpdating':'threeCurrent';filter3DState.dataset.i18n=key;filter3DState.textContent=tr(key);
 const actionKey=mode==='updating'?'cancel3D':'rebuild3D';
 filterRebuild3D.dataset.i18n=actionKey;filterRebuild3D.textContent=tr(actionKey);
 filterRebuild3D.classList.toggle('is-cancel',mode==='updating');
 filterRebuild3D.disabled=!volume||mode==='current';
 const volumeCurrent=threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active,hasSurface3D=mode==='current'&&!!sceneState?.obj&&threeRenderMode==='surface';
 if(volumeAnalysisToggle)volumeAnalysisToggle.disabled=!(volumeCurrent||hasSurface3D);
 if(sectionViewToggle)sectionViewToggle.disabled=!volume;
 for(const key of SEGMENT_PRESET_ORDER){
  const exportBtn=$('[data-seg-export="'+key+'"]');
  if(exportBtn)exportBtn.disabled=!hasSurface3D||!segmentState[key].active||!segmentState[key].enabled;
 }
 updateAnalysisEditorControls();
}
function mark3DStale(){if(volume)set3DState('stale')}
function mark3DCurrent(){set3DState('current')}
function mark3DUpdating(){set3DState('updating')}
function updateRenderModeControl(v=volume){
 if(!renderModeToggle)return;
 const mv=sceneState?.medicalVolume,support=mv&&v?mv.support(v):{ok:false,reason:'WebGPU volume unavailable'};
 renderModeToggle.disabled=!support.ok;
 renderModeToggle.removeAttribute('data-i18n');renderModeToggle.textContent=threeRenderMode==='volume'?tr('surfaceRender'):tr('volumeRender');
 renderModeToggle.title=support.ok?'':(support.reason||'');
}
function ensureVolumeTransformProxy(){
 if(sceneState?.obj)return sceneState.obj;
 const group=new THREE.Group();sceneState.obj=group;sceneState.scene.add(group);return group;
}
function setSurfaceMeshesHiddenForVolume(hidden){
 if(!sceneState?.obj)return;
 sceneState.obj.traverse(o=>{
  if(!o.isMesh)return;
  const isSurface=!!o.userData?.segmentKey||Array.isArray(o.userData?.segmentRanges);
  if(!isSurface)return;
  if(hidden){
   if(o.userData._volumePrevVisible===undefined)o.userData._volumePrevVisible=o.visible;
   o.visible=false;
  }else if(o.userData._volumePrevVisible!==undefined){
   o.visible=!!o.userData._volumePrevVisible;delete o.userData._volumePrevVisible;
  }
 });
}
function setThreeVolumeOverlay(active){
 const state=sceneState;if(!state?.renderer)return;
 const canvas=state.renderer.domElement;
 if(active){
  state._surfaceBackground=state.scene.background;
  state._surfaceClearAlpha=typeof state.renderer.getClearAlpha==='function'?state.renderer.getClearAlpha():1;
  state.scene.background=null;if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(0);
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'2',pointerEvents:'auto'});
  setSurfaceMeshesHiddenForVolume(true);
 }else{
  state.scene.background=state._surfaceBackground||new THREE.Color(0x090c0e);
  if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(state._surfaceClearAlpha??1);
  canvas.style.position='';canvas.style.inset='';canvas.style.zIndex='';canvas.style.pointerEvents='';
  setSurfaceMeshesHiddenForVolume(false);
 }
}
async function activateMedicalVolume(){
 const mv=sceneState?.medicalVolume,target=sourceVolume||volume;if(!mv||!target)return;
 if(sourceFilterStages().length){footer.textContent=currentLanguage==='ja'?'GPUボリュームは現在、未フィルターCTを表示します。フィルター適用中はサーフェス表示を使用してください。':'GPU Volume currently displays unfiltered CT. Use surface mode while filters are active.';return}
 if(!SEGMENT_PRESET_ORDER.some(key=>segmentState[key].active&&segmentState[key].enabled)){footer.textContent=currentLanguage==='ja'?'GPUボリューム: 表示する組織セグメントを追加してください':'GPU Volume: add at least one tissue segment';return}
 const support=mv.support(target);if(!support.ok){footer.textContent='GPU Volume: '+support.reason;updateRenderModeControl(target);return}
 set3DBusy(true,currentLanguage==='ja'?'GPUボリューム準備中…':'Preparing GPU volume…');
 try{
  await mv.ensure(target);ensureVolumeTransformProxy();threeRenderMode='volume';mv.setActive(true);setThreeVolumeOverlay(true);volumeAnalysisToggle.disabled=false;
  threeLabel.textContent=(sceneState.backend||'3D')+' · GPU volume';setGpuComputeBackend('WEBGPU VOLUME RAYCAST');updateRenderModeControl(target);request3DRender();
  footer.textContent=currentLanguage==='ja'?'GPUボリューム · 16-bit CTを3D textureから直接描画':'GPU Volume · direct 16-bit CT 3D-texture ray casting';
 }catch(e){console.error(e);mv.setActive(false);threeRenderMode='surface';setGpuComputeBackend('GPU VOLUME ERROR',e?.message||e);footer.textContent='GPU Volume error: '+String(e.message||e);updateRenderModeControl(target)}
 finally{set3DBusy(false)}
}
function deactivateMedicalVolume(){
 const mv=sceneState?.medicalVolume;if(mv)mv.setActive(false);setThreeVolumeOverlay(false);threeRenderMode='surface';updateRenderModeControl();
 threeLabel.textContent=sceneState?.backend||'3D';request3DRender();
 if(threeDDirty)mark3DStale();else mark3DCurrent();
}
function clear3DForSeriesChange(){
 sourceRenderRevision++;threeDCancelRequested=false;current3DVolume=null;memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();set3DBusy(false);clearAnalysisHighlight();
 if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}
 disposeMprPlaneGroup();request3DRender();mark3DStale();
}
async function buildCpuFilteredVolumeFor3D(){
 const previousDefer=deferAutomatic3D;deferAutomatic3D=true;memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();volume=sourceVolume;
 let base=sourceVolume;
 try{
  for(const key of filterOrder){
   if(!filterState[key])continue;
   if(key==='spikeHole')await applySpikeHole(base);
   else if(key==='nlm')await applyNlm3D(base);
   else if(key==='anisotropic')await applyAnisotropicDiffusion(base);
   else if(key==='gaussian'){if(smoothingType.value==='median')await applyMedian3D(base);else await applyGaussian3D(base)}
   else if(key==='sigmoid')await applySigmoid(base);
   else if(key==='bilateral')await applyBilateral3D(base);
   else if(key==='tv')await applyTvDenoising3D(base);
   else if(key==='unsharp')await applyUnsharpMask3D(base);
   base=volume;
  }
  return base;
 }finally{deferAutomatic3D=previousDefer}
}
function cancel3DRebuild(){
 if(!threeDApplying||threeDCancelRequested)return;
 threeDCancelRequested=true;
 filterRebuildRevision++;
 invalidateSourceFilters();
 if(threeBusyLabel)threeBusyLabel.textContent=tr('cancelling3D');
 if(threeBusyCancel)threeBusyCancel.disabled=true;
 filterRebuild3D.disabled=true;
 footer.textContent=tr('cancelling3D');
}
async function rebuildCurrent3D(){
 if(!volume||threeDApplying)return;
 threeDCancelRequested=false;mark3DUpdating();const settingsRevision=filterRebuildRevision;
 try{
  let buildVolume=sourceVolume||volume;
  if(!buildVolume.sourceBacked){
   const stages=sourceFilterStages();
   if(stages.length){
    set3DBusy(true,'3D再構築 · GPUフィルター処理…');
    try{
     const data=await applyGpuFiltersToMemoryVolume(sourceVolume,stages,settingsRevision);
     if(threeDCancelRequested||settingsRevision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
     buildVolume=cloneVolumeWithData(sourceVolume,data);
    }catch(e){
     if(String(e.message||e)==='__SUPERSEDED__'){
      set3DBusy(false);mark3DStale();
      if(threeDCancelRequested){footer.textContent=tr('threeCancelled');threeLabel.textContent=(sceneState?.backend||'3D')+(sceneState?.obj?' · previous 3D':'')}
      return;
     }
     console.warn('Full GPU filter rebuild failed; using exact CPU filter stack.',e);
     buildVolume=await buildCpuFilteredVolumeFor3D();
     if(threeDCancelRequested){set3DBusy(false);mark3DStale();footer.textContent=tr('threeCancelled');return}
    }
   }
  }
  const ok=await render3D(buildVolume,true);
  if(threeDCancelRequested||!ok){
   set3DBusy(false);mark3DStale();
   if(threeDCancelRequested){footer.textContent=tr('threeCancelled');threeLabel.textContent=(sceneState?.backend||'3D')+(sceneState?.obj?' · previous 3D':'')}
   return;
  }
  resetAnalysisRegistryAfterRebuild();current3DVolume=buildVolume;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
  set3DBusy(false);mark3DStale();
  if(threeDCancelRequested)footer.textContent=tr('threeCancelled');
 }
}
function renderSegmentPresets(){
 const active=new Set(SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active));
 for(const key of SEGMENT_PRESET_ORDER){
  const card=segmentControls.querySelector('[data-segment="'+key+'"]');
  if(card)card.classList.toggle('is-hidden',!active.has(key));
  const option=[...segmentAddSelect.options].find(o=>o.value===key);
  if(option)option.disabled=active.has(key);
 }
 const next=[...segmentAddSelect.options].find(o=>!o.disabled);
 if(next)segmentAddSelect.value=next.value;
 segmentAddSelect.disabled=!volume||!next;
 segmentAddButton.disabled=!volume||!next;
}
function addSegmentPreset(key){
 if(!volume||!SEGMENT_PRESET_ORDER.includes(key)||segmentState[key].active)return;
 const seg=segmentState[key];seg.active=true;seg.enabled=true;
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.checked=true;enabled.disabled=false;color.disabled=false;min.disabled=false;max.disabled=false;opacity.disabled=false;
 opening.disabled=false;closing.disabled=false;minComponent.disabled=false;holeFill.disabled=false;
 if(exportBtn)exportBtn.disabled=true;if(removeBtn)removeBtn.disabled=false;
 renderSegmentPresets();renderAll();scheduleSegment3D();
}
function removeSegmentPreset(key){
 if(!SEGMENT_PRESET_ORDER.includes(key)||!segmentState[key].active)return;
 const seg=segmentState[key];seg.active=false;seg.enabled=false;clearSegmentEditCache(key,true);
 const enabled=$('[data-seg-enabled="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]');
 if(enabled)enabled.checked=false;if(removeBtn)removeBtn.disabled=true;
 renderSegmentPresets();clearAnalysisHighlight();renderAll();scheduleSegment3D();
}
segmentAddButton.onclick=()=>addSegmentPreset(segmentAddSelect.value);
analysisMergeButton.onclick=()=>void mergeSelectedAnalysisRegions();
analysisClearButton.onclick=()=>clearAnalysisHighlight();
analysisNavigateButton.onclick=()=>{if(analysisCutApplying||analysisPendingCut)return;analysisEditTool='select';analysisEditTargetKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;analysisCutStroke=null;analysisCutScreen=[];clearThreeEditOverlay();updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'通常操作':'Navigate');request3DRender()};
analysisCutButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut)return;if(analysisEditTool==='pen'){analysisEditTool='select';updateAnalysisEditorControls();return}try{await ensureGpuResidentCpuPositions(null,currentLanguage==='ja'?'3D編集データを準備中':'Preparing 3D edit data');analysisEditTool='pen';analysisEditTargetKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;updateThreeEditUi(tr('editPenHint'))}catch(e){console.error(e);footer.textContent='3D edit preparation error: '+String(e.message||e)}updateAnalysisEditorControls()};
analysisLineCutButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut)return;if(analysisEditTool==='line'){analysisEditTool='select';updateAnalysisEditorControls();return}try{await ensureGpuResidentCpuPositions(null,currentLanguage==='ja'?'3D編集データを準備中':'Preparing 3D edit data');analysisEditTool='line';analysisEditTargetKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;updateThreeEditUi(tr('editLineHint'))}catch(e){console.error(e);footer.textContent='3D edit preparation error: '+String(e.message||e)}updateAnalysisEditorControls()};
analysisEditTargetSelect.onchange=()=>{if(analysisCutApplying)return;const next=analysisEditTargetSelect.value;analysisEditTargetMode=next;if(analysisPendingCut){if(next==='auto')analysisEditTargetKey=analysisPendingCut.key||null;else{analysisEditTargetKey=next;analysisPendingCut.key=next}}else analysisEditTargetKey=next==='auto'?null:next;updateAnalysisEditorControls();updateThreeEditUi();request3DRender()};
analysisRemoveSelected.onclick=()=>void applyEditRemoveSelected();
analysisKeepSelected.onclick=()=>void applyEditKeepSelected();
analysisUndo.onclick=()=>void undoSegmentEdit();
analysisRedo.onclick=()=>void redoSegmentEdit();
analysisResetEdit.onclick=()=>void resetFocusedSegmentEdit();
function configureCutControlRanges(v=current3DVolume||volume){
 if(!v||!analysisCutWidth)return;
 const [sx,sy,sz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,dims=[w*sx,h*sy,d*sz],diag=Math.hypot(...dims),minSpacing=Math.min(sx,sy,sz),minDim=Math.min(...dims);
 const clamp=(el,min,max,step)=>{el.min=String(min);el.max=String(max);el.step=String(step);el.value=String(Math.max(min,Math.min(max,+el.value)))};
 const widthMax=Math.max(2,Math.min(8,minDim*.22));
 clamp(analysisCutWidth,0,widthMax,.05);
 clamp(analysisCutDepth,Math.max(.1,minSpacing*.5),Math.max(5,diag),.1);
 clamp(analysisCutYaw,-90,90,.25);clamp(analysisCutPitch,-90,90,.25);
 const offsetMax=Math.max(5,diag*.6);clamp(analysisCutOffset,-offsetMax,offsetMax,.1);
}
function cutWidthMm(){
 const value=Number(analysisCutWidth?.value);return Number.isFinite(value)?Math.max(0,value):.8;
}
function refreshCutControlReadouts(){
 analysisCutWidthValue.value=cutWidthMm().toFixed(2)+' mm';
 analysisCutDepthValue.value=(+analysisCutDepth.value).toFixed(1)+' mm';
 analysisCutYawValue.value=(+analysisCutYaw.value).toFixed(1)+'°';
 analysisCutPitchValue.value=(+analysisCutPitch.value).toFixed(1)+'°';
 analysisCutOffsetValue.value=(+analysisCutOffset.value).toFixed(1)+' mm';
}
const onCutControlInput=()=>{refreshCutControlReadouts();updateThreeEditUi();updateCutPreview(sceneState?.editCutPreviewPoint)};
analysisCutWidth.oninput=onCutControlInput;analysisCutDepth.oninput=onCutControlInput;analysisCutYaw.oninput=onCutControlInput;analysisCutPitch.oninput=onCutControlInput;analysisCutOffset.oninput=onCutControlInput;
analysisCutApply.onclick=async()=>{if(!analysisPendingCut||analysisCutApplying)return;const pending=analysisPendingCut;analysisPendingCut=null;analysisCutApplying=true;analysisCutStroke=null;analysisCutScreen=[];clearThreeEditOverlay();if(sceneState)sceneState.editCutPreviewPoint=null;updateCutPreview(null);updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'切断を反映中…':'Applying cut…');let ok=false;try{ok=await applyCutStroke(pending.points,pending.key,pending.mode)}finally{clearCutResultPreview();analysisCutApplying=false;analysisEditTargetKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;if(sceneState)sceneState.editCutPreviewPoint=null;updateAnalysisEditorControls();const ready=ok?(analysisEditTool==='pen'?(currentLanguage==='ja'?'切断を反映しました · 次のペン切断を描けます':'Cut applied · ready for next pen cut'):analysisEditTool==='line'?(currentLanguage==='ja'?'切断を反映しました · 次の直線切断を描けます':'Cut applied · ready for next line cut'):(currentLanguage==='ja'?'切断を反映しました':'Cut applied')):(currentLanguage==='ja'?'切断結果を確認してください':'Check cut result');updateThreeEditUi(ready);request3DRender()}};
analysisCutCancel.onclick=()=>{if(analysisCutApplying)return;analysisPendingCut=null;analysisCutStroke=null;analysisCutScreen=[];clearThreeEditOverlay();clearCutResultPreview();if(sceneState)sceneState.editCutPreviewPoint=null;updateCutPreview(null);analysisEditTargetKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'切断をキャンセルしました':'Cut cancelled');request3DRender()};
analysisExportSelected.onclick=()=>void exportFocusedAnalysisRegionStl();
renderModeToggle.onclick=()=>{if(threeRenderMode==='volume')deactivateMedicalVolume();else void activateMedicalVolume()};
sectionViewToggle.onclick=()=>{if(!volume)return;sectionViewOpen=!sectionViewOpen;if(!sectionViewOpen)clearSectionView();else updateSectionViewUi()};
document.querySelectorAll('[data-section-view]').forEach(button=>button.addEventListener('click',()=>setSectionView(button.dataset.sectionView)));
sectionReverse.onclick=()=>{if(!sectionViewPlane)return;sectionViewReverse=!sectionViewReverse;updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj);updateSectionViewUi();request3DRender()};
sectionPosition.oninput=()=>{if(!sectionViewPlane)return;const p=sectionViewPlane,idx=Math.max(0,Math.min(+planes[p].slider.max,+sectionPosition.value));planes[p].slider.value=idx;planes[p].label.textContent=idx+1;updateMpr3DPlanePositions();updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();updateSectionViewUi();request3DRender();renderSectionPlaneLive(p)};
sectionPosition.onchange=()=>{if(sectionViewPlane)renderSectionPlaneLive(sectionViewPlane)};
volumeAnalysisToggle.onclick=async()=>{
 if(!volume)return;
 if(!volumeAnalysisMode){
  volumeAnalysisToggle.disabled=true;
  if(threeRenderMode!=='volume')try{await ensureGpuResidentCpuPositions(null,currentLanguage==='ja'?'体積解析用データを取得中':'Preparing volume analysis')}catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'体積解析の準備に失敗しました: ':'Volume analysis preparation failed: ')+String(e.message||e);return}finally{volumeAnalysisToggle.disabled=false}
  volumeAnalysisMode=true;
 }else volumeAnalysisMode=false;
 volumeAnalysisToggle.textContent=volumeAnalysisMode?tr('volumeOff'):tr('volumeMode');
 volumeAnalysisToggle.classList.toggle('is-active',volumeAnalysisMode);
 volumeAnalysisResult.classList.toggle('is-hidden',!volumeAnalysisMode);
 if(volumeAnalysisMode)renderAnalysisResults();else clearAnalysisHighlight();
};
folderBtn.onclick=()=>{folderInput.value='';folderInput.click()};
folderInput.onchange=async()=>{const files=[...(folderInput.files||[])];if(files.length)await inspect(files,false)};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('demoLoading')+'</strong><span>'+tr('demoSize')+'</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>'+tr('demoFailed')+'</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=()=>renderMainMprPreview();
wc.onchange=ww.onchange=()=>renderAll();
ctRangeAuto.onclick=()=>applyCtRangeMode('auto');
ctRangeFull.onclick=()=>applyCtRangeMode('full');
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderMainMprPreview();scheduleSegment3D()};
 color.onchange=()=>renderAll();
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 min.onchange=max.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');renderAll()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 opacity.onchange=()=>renderAll();
 const invalidateSegment=(full=false)=>{segmentState[key]._maskCache=null;segmentState[key]._maskCacheKey='';clearSegmentEditCache(key,false);clearAnalysisHighlight();if(full)renderAll();else renderMainMprPreview();scheduleSegment3D();if(full&&volume?.sourceBacked&&segmentNeedsGlobalMask(segmentState[key]))void prepareSourceSegmentPostprocess(key)};
 opening.oninput=()=>{segmentState[key].opening=+opening.value;$('[data-seg-opening-out="'+key+'"]').value=opening.value;invalidateSegment(false)};
 opening.onchange=()=>invalidateSegment(true);
 closing.oninput=()=>{segmentState[key].closing=+closing.value;$('[data-seg-closing-out="'+key+'"]').value=closing.value;invalidateSegment(false)};
 closing.onchange=()=>invalidateSegment(true);
 minComponent.oninput=()=>{segmentState[key].minComponent=+minComponent.value;$('[data-seg-min-component-out="'+key+'"]').value=minComponent.value;invalidateSegment(false)};
 minComponent.onchange=()=>invalidateSegment(true);
 holeFill.onchange=()=>{segmentState[key].holeFill=holeFill.checked;invalidateSegment(true)};
 exportBtn.onclick=()=>void exportSegmentStl(key);
 removeBtn.onclick=()=>removeSegmentPreset(key);
}
async function prepareSourceSegmentPostprocess(key){
 const v=current3DVolume||volume;if(!v?.sourceBacked||!segmentState[key]?.active||!segmentState[key]?.enabled||!segmentNeedsGlobalMask(segmentState[key]))return;
 try{
  await ensureSegmentBaseRuns(key,v);
  if(sceneState?.obj)await refreshEditedSegmentSurface(key,v);
  renderAll();footer.textContent=currentLanguage==='ja'?(tr(key)||key)+'のセグメント処理を更新しました':'Updated segment processing for '+(tr(key)||key);
 }catch(e){if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent='Segment processing error: '+String(e.message||e)}}
}
let smoothingRefreshTimer=null;
function markSmoothingSettingsChanged(){
 clearTimeout(smoothingRefreshTimer);smoothingRefreshTimer=null;
 mark3DStale();
}
surfaceSmoothEnabled.onchange=()=>{
 surfaceSmoothStrength.disabled=!surfaceSmoothEnabled.checked||!volume;
 markSmoothingSettingsChanged();
};
surfaceSmoothStrength.oninput=()=>{
 surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);
 markSmoothingSettingsChanged();
};
surfaceSmoothStrength.onchange=()=>{
 surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);
 markSmoothingSettingsChanged();
};
const liveFilterState={timer:null,base:null,key:null};
function beginLiveFilter(key){
 if(!volume)return;
 if(liveFilterState.key!==key||!liveFilterState.base){
  liveFilterState.key=key;
  liveFilterState.base=volume;
 }
}
function scheduleLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 liveFilterState.timer=setTimeout(()=>void fn(liveFilterState.base),260);
}
function finishLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 void fn(liveFilterState.base).finally(()=>{
  if(liveFilterState.key===key){liveFilterState.base=null;liveFilterState.key=null}
 });
}
function bindLiveSlider(input,output,key,fn){
 input.addEventListener('pointerdown',()=>beginLiveFilter(key));
 input.addEventListener('input',()=>{
  output.value=(+input.value).toFixed(2);
  scheduleLiveFilter(key,fn);
 });
 input.addEventListener('change',()=>finishLiveFilter(key,fn));
}
function renderFilterOrder(){
 if(!filterControlList)return;
 const active=new Set(filterOrder);
 for(const key of FILTER_CATALOG_ORDER){
  const card=filterControlList.querySelector('[data-filter-key="'+key+'"]');
  if(!card)continue;
  card.classList.toggle('is-hidden',!active.has(key));
  if(active.has(key))filterControlList.insertBefore(card,resetFilterBtn);
 }
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  const key=card.dataset.filterKey,index=filterOrder.indexOf(key);
  const up=card.querySelector('[data-filter-move="up"]'),down=card.querySelector('[data-filter-move="down"]');
  if(up)up.disabled=index<=0;
  if(down)down.disabled=index<0||index>=filterOrder.length-1;
 }
 for(const option of filterAddSelect.options)option.disabled=active.has(option.value);
 const next=[...filterAddSelect.options].find(o=>!o.disabled);
 if(next)filterAddSelect.value=next.value;
 filterAddButton.disabled=!next;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function addFilter(key){
 if(!FILTER_CATALOG_ORDER.includes(key)||filterOrder.includes(key))return;
 filterOrder.push(key);
 filterState[key]=true;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=true;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function removeFilter(key){
 const index=filterOrder.indexOf(key);if(index<0)return;
 filterOrder.splice(index,1);filterState[key]=false;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=false;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function moveFilter(key,delta){
 const from=filterOrder.indexOf(key),to=from+delta;
 if(from<0||to<0||to>=filterOrder.length)return;
 [filterOrder[from],filterOrder[to]]=[filterOrder[to],filterOrder[from]];
 renderFilterOrder();
 if(sourceVolume&&filterOrder.length)scheduleFilterRebuild(0);
}
function installFilterReorder(){
 if(!filterControlList)return;
 filterAddButton.addEventListener('click',()=>addFilter(filterAddSelect.value));
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  card.querySelector('[data-filter-move="up"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,-1));
  card.querySelector('[data-filter-move="down"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,1));
  card.querySelector('[data-filter-remove]')?.addEventListener('click',()=>removeFilter(card.dataset.filterKey));
  let draggedKey=null;
  card.addEventListener('dragstart',e=>{
   draggedKey=card.dataset.filterKey;card.classList.add('is-dragging');
   if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedKey)}
  });
  card.addEventListener('dragend',()=>{draggedKey=null;card.classList.remove('is-dragging')});
  card.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'});
  card.addEventListener('drop',e=>{
   e.preventDefault();
   const fromKey=draggedKey||e.dataTransfer?.getData('text/plain'),targetKey=card.dataset.filterKey;
   if(!fromKey||fromKey===targetKey)return;
   const from=filterOrder.indexOf(fromKey),to=filterOrder.indexOf(targetKey);
   if(from<0||to<0)return;
   filterOrder.splice(from,1);filterOrder.splice(to,0,fromKey);
   renderFilterOrder();
   if(sourceVolume)scheduleFilterRebuild(0);
  });
 }
 renderFilterOrder();
}
function syncFilterControls(){
 gaussianStrength.disabled=!sourceVolume||!filterState.gaussian;
 spatialPasses.disabled=!sourceVolume||!filterState.gaussian;
 smoothingType.disabled=!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=!sourceVolume||!filterState.spikeHole;
 spikeHoleThreshold.disabled=!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=!sourceVolume||!filterState.nlm;
 nlmSearchRadius.disabled=!sourceVolume||!filterState.nlm;
 nlmPatchRadius.disabled=!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=!sourceVolume||!filterState.anisotropic;
 anisotropicIterations.disabled=!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=!sourceVolume||!filterState.sigmoid;
 sigmoidCenter.disabled=!sourceVolume||!filterState.sigmoid;
 bilateralStrength.disabled=!sourceVolume||!filterState.bilateral;bilateralSpatial.disabled=!sourceVolume||!filterState.bilateral;bilateralIntensity.disabled=!sourceVolume||!filterState.bilateral;bilateralPasses.disabled=!sourceVolume||!filterState.bilateral;
 tvWeight.disabled=!sourceVolume||!filterState.tv;tvIterations.disabled=!sourceVolume||!filterState.tv;
 unsharpRadius.disabled=!sourceVolume||!filterState.unsharp;unsharpAmount.disabled=!sourceVolume||!filterState.unsharp;unsharpThreshold.disabled=!sourceVolume||!filterState.unsharp;
 gaussianBtn.disabled=!sourceVolume;smoothingType.disabled=!sourceVolume||!filterState.gaussian;spikeHoleBtn.disabled=!sourceVolume;nlmBtn.disabled=!sourceVolume;anisotropicBtn.disabled=!sourceVolume;sigmoidBtn.disabled=!sourceVolume;bilateralBtn.disabled=!sourceVolume;tvBtn.disabled=!sourceVolume;unsharpBtn.disabled=!sourceVolume;
 gaussianBtn.checked=filterState.gaussian;spikeHoleBtn.checked=filterState.spikeHole;nlmBtn.checked=filterState.nlm;anisotropicBtn.checked=filterState.anisotropic;sigmoidBtn.checked=filterState.sigmoid;bilateralBtn.checked=filterState.bilateral;tvBtn.checked=filterState.tv;unsharpBtn.checked=filterState.unsharp;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function scheduleFilterRebuild(delay=120){
 if(threeRenderMode==='volume')deactivateMedicalVolume();
 clearTimeout(filterRebuildTimer);clearMemoryFilterPreviewCache();mark3DStale();
 const finalize3D=!(sourceVolume?.sourceBacked)||delay===0;
 filterRebuildTimer=setTimeout(()=>{filterRebuildTimer=null;void rebuildActiveFilters(finalize3D)},delay);
}
async function rebuildActiveFilters(finalize3D=true){
 if(!sourceVolume)return;
 const revision=++filterRebuildRevision;
 clearTimeout(liveFilterState.timer);liveFilterState.base=null;liveFilterState.key=null;
 if(sourceVolume.sourceBacked){
  invalidateSourceFilters();volume=sourceVolume;scheduleSourceMprWarmup();setProcessingBusy(true,'Full-resolution filters',false);
  try{
   const mainKey=currentMainViewKey(),previewPlane=planes[mainKey]?mainKey:'axial';
   await renderPlane(previewPlane);
   if(revision!==filterRebuildRevision)return;
   mark3DStale();
   footer.textContent=filterOrder.length?'Full-resolution filters · '+gpuFilterRuntime.lastBackend+' · '+filterOrder.length+' stage(s)':tr('original');
  }finally{setProcessingBusy(false,'Full-resolution filters',false);syncFilterControls()}
  return;
 }
 let base=sourceVolume;
 deferAutomatic3D=true;
 try{
  const stages=sourceFilterStages();
  if(!stages.length){
   memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();volume=sourceVolume;renderAll();mark3DStale();footer.textContent=tr('original');return;
  }
  if(gpuStagesSupported(stages)&&!hasGlobalSegmentProcessing()){
   memoryGpuPreviewActive=true;clearMemoryFilterPreviewCache();volume=sourceVolume;setProcessingBusy(true,'WebGPU preview',false);
   try{
    const mainKey=currentMainViewKey(),previewPlane=planes[mainKey]?mainKey:'axial';
    await renderPlane(previewPlane);
    if(revision!==filterRebuildRevision)return;
    mark3DStale();footer.textContent='2D preview · WEBGPU COMPUTE · '+stages.length+' stage(s)';return;
   }catch(e){
    if(String(e.message||e)==='__SUPERSEDED__')return;
    memoryGpuPreviewActive=false;console.warn('In-memory WebGPU preview unavailable; using CPU stack.',e);
   }finally{setProcessingBusy(false,'WebGPU preview',false)}
  }
  memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();
  for(const key of filterOrder){
   if(!filterState[key])continue;
   if(key==='spikeHole')await applySpikeHole(base);
   else if(key==='nlm')await applyNlm3D(base);
   else if(key==='anisotropic')await applyAnisotropicDiffusion(base);
   else if(key==='gaussian'){if(smoothingType.value==='median')await applyMedian3D(base);else await applyGaussian3D(base)}
   else if(key==='sigmoid')await applySigmoid(base);
   else if(key==='bilateral')await applyBilateral3D(base);
   else if(key==='tv')await applyTvDenoising3D(base);
   else if(key==='unsharp')await applyUnsharpMask3D(base);
   if(revision!==filterRebuildRevision)return;
   base=volume;
  }
  if(!filterOrder.length){
   volume=sourceVolume;renderAll();render3D(volume);footer.textContent=tr('original');
  }
 }finally{deferAutomatic3D=false;mark3DStale();syncFilterControls()}
}
smoothingType.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
for(const [input,output,key] of [[spikeHoleStrength,spikeHoleStrengthValue,'spikeHole'],[nlmStrength,nlmStrengthValue,'nlm'],[anisotropicStrength,anisotropicStrengthValue,'anisotropic'],[gaussianStrength,gaussianStrengthValue,'gaussian'],[sigmoidStrength,sigmoidStrengthValue,'sigmoid']]){
 input.oninput=()=>{output.value=(+input.value).toFixed(2);if(filterState[key])scheduleFilterRebuild(360)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
sigmoidCenter.oninput=()=>{sigmoidCenterValue.value=Math.round(+sigmoidCenter.value);if(filterState.sigmoid)scheduleFilterRebuild(360)};
sigmoidCenter.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');if(filterState.sigmoid)scheduleFilterRebuild(0)};
spikeHoleThreshold.oninput=()=>{spikeHoleThresholdValue.value=(+spikeHoleThreshold.value).toFixed(3);if(filterState.spikeHole)scheduleFilterRebuild(360)};
spikeHoleThreshold.onchange=()=>{if(filterState.spikeHole)scheduleFilterRebuild(0)};
anisotropicIterations.oninput=()=>{anisotropicIterationsValue.value=Math.round(+anisotropicIterations.value);if(filterState.anisotropic)scheduleFilterRebuild(360)};
anisotropicIterations.onchange=()=>{if(filterState.anisotropic)scheduleFilterRebuild(0)};
spatialPasses.oninput=()=>{spatialPassesValue.value=Math.round(+spatialPasses.value);if(filterState.gaussian)scheduleFilterRebuild(360)};
spatialPasses.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
nlmSearchRadius.oninput=()=>{nlmSearchRadiusValue.value=Math.round(+nlmSearchRadius.value);if(filterState.nlm)scheduleFilterRebuild(380)};
nlmSearchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};
nlmPatchRadius.oninput=()=>{nlmPatchRadiusValue.value=Math.round(+nlmPatchRadius.value);if(filterState.nlm)scheduleFilterRebuild(380)};
nlmPatchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};

for(const [input,output,key,digits] of [
 [bilateralStrength,bilateralStrengthValue,'bilateral',2],[bilateralSpatial,bilateralSpatialValue,'bilateral',2],[bilateralIntensity,bilateralIntensityValue,'bilateral',2],
 [tvWeight,tvWeightValue,'tv',2],[unsharpAmount,unsharpAmountValue,'unsharp',2],[unsharpThreshold,unsharpThresholdValue,'unsharp',2]
]){
 input.oninput=()=>{output.value=(+input.value).toFixed(digits);if(filterState[key])scheduleFilterRebuild(380)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
for(const [input,output,key] of [[bilateralPasses,bilateralPassesValue,'bilateral'],[tvIterations,tvIterationsValue,'tv'],[unsharpRadius,unsharpRadiusValue,'unsharp']]){
 input.oninput=()=>{output.value=Math.round(+input.value);if(filterState[key])scheduleFilterRebuild(380)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
resetFilterBtn.onclick=()=>{filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();syncFilterControls();resetProcessing()};
filterRebuild3D.onclick=()=>{if(threeDApplying)cancel3DRebuild();else void rebuildCurrent3D()};
threeBusyCancel.onclick=()=>cancel3DRebuild();
installFilterReorder();

const planeRenderTimers={axial:null,coronal:null,sagittal:null};
function paintFastOrthogonalPreview(p,idx){
 if(p==='axial'||!volume?.sourceBacked||sourceFilterStages().length||volumeAnalysisMode)return false;
 if(mpr3DPreviewCache.signature!==mpr3DPreviewSignature(volume)||!mpr3DPreviewCache.planes[p])return false;
 const ok=paintMpr3DPreview(p,idx,planes[p].canvas);
 if(ok){updateMprCanvasPhysicalAspect(p);refreshMpr3DPlaneTexture(p)}
 return ok;
}
function schedulePlaneRender(p,immediate=false){
 cancelSourceMprWarmup();updateMpr3DPlanePositions();clearTimeout(planeRenderTimers[p]);
 const idx=+planes[p].slider.value,revision=++planeRenderRevision[p];planes[p].label.textContent=idx+1;
 if(sectionViewPlane===p){updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();updateSectionViewUi();request3DRender()}
 if(!immediate&&paintFastOrthogonalPreview(p,idx))return;
 refreshMpr3DPlaneTexture(p);
 if(volume?.sourceBacked&&volume.mprData&&!sourceFilterStages().length){
  const values=cachedSourceMprPlane(volume,p,idx),dims=p==='axial'?[volume.columns,volume.rows]:p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices];
  paintSourcePlane(planes[p],dims,values,p,idx);return;
 }
 if(volume?.sourceBacked&&p!=='axial'&&!sourceFilterStages().length){
  const cached=sourceOrthogonalCacheGet(p,idx);
  if(cached){paintSourcePlane(planes[p],p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],cached,p,idx);return}
 }
 const wait=immediate?0:sourceFilterStages().length?16:0;
 planeRenderTimers[p]=setTimeout(()=>{planeRenderTimers[p]=null;if(revision===planeRenderRevision[p])safeRenderPlane(p,revision,idx)},wait);
}
function renderSectionPlaneLive(p){
 if(!volume||!planes[p])return;
 cancelSourceMprWarmup();clearTimeout(planeRenderTimers[p]);planeRenderTimers[p]=null;
 const idx=+planes[p].slider.value,revision=++planeRenderRevision[p];planes[p].label.textContent=idx+1;
 if(paintFastOrthogonalPreview(p,idx))return;
 void renderPlane(p,revision,idx).catch(e=>{if(String(e.message||e)!=='__SUPERSEDED__'){console.warn('Live section render failed.',e);footer.textContent='MPR error: '+String(e.message||e)}});
}
for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>schedulePlaneRender(p);planes[p].slider.onchange=()=>schedulePlaneRender(p,true);installMprTouch(p)}

async function loadDemo(){
 let response=null,fromCache=false,cache=null;
 progLabel.textContent='Cache check…';
 bar.style.width='0%';

 if('caches' in window){
  try{
   cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
   if(cache){
    response=await withTimeout(cache.match(DEMO_URL),1200,null);
    if(response){fromCache=true;footer.textContent=tr('demoCache');}
   }
  }catch(e){
   console.warn('Cache lookup skipped.',e);
  }
 }

 if(!response){
  progLabel.textContent='接続中…';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   response=await fetch(DEMO_URL,{mode:'cors',credentials:'omit',signal:controller.signal,cache:'no-store'});
  }finally{
   clearTimeout(timeout);
  }
 }

 if(!response||!response.ok)throw new Error('Demo download failed: HTTP '+(response?.status??'unknown'));

 const reader=response.body?.getReader();let bytes;
 if(reader){
  const chunks=[];let n=0;
  while(true){
   const q=await reader.read();if(q.done)break;if(!q.value)continue;
   chunks.push(q.value);n+=q.value.byteLength;
   byteProgress(n,DEMO_SIZE,fromCache?'Cache':'Download');
  }
  bytes=new Uint8Array(n);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.byteLength}
 }else{
  bytes=new Uint8Array(await response.arrayBuffer());
  byteProgress(bytes.byteLength,bytes.byteLength,fromCache?'Cache':'Download');
 }

 if(!fromCache&&cache){
  const copy=bytes.slice();
  cache.put(DEMO_URL,new Response(copy,{headers:{'Content-Type':'application/zip','Content-Length':String(copy.byteLength)}}))
   .then(()=>updateDemoCacheBadge())
   .catch(e=>console.warn('Demo cache save failed.',e));
 }

 byteProgress(bytes.byteLength,bytes.byteLength,'Unzip');
 const entries=await new Promise((res,rej)=>unzip(bytes,(e,f)=>e?rej(e):res(f)));
 const out=[];for(const [path,b] of Object.entries(entries)){if(path.endsWith('/')||!b.byteLength)continue;out.push(new File([b],path.split('/').pop()||path))}
 footer.textContent=fromCache?tr('demoCache'):tr('demoDone');
 return out;
}
function withTimeout(promise,ms,timeoutValue){
 return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(timeoutValue),ms))]);
}
async function updateDemoCacheBadge(){
 if(!('caches' in window))return;
 try{
  const cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
  if(cache&&await withTimeout(cache.match(DEMO_URL),1200,null))demoBtn.textContent='公開マウスCTデモ ✓';
 }catch{}
}
void updateDemoCacheBadge();
async function inspect(files,auto){
 activeId=null;resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('dicomChecking')+'</strong><span>'+tr('pixelDeferred')+'</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>'+tr('noSeries')+'</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}

async function parseDicomHeader(file){
 const attempts=[Math.min(file.size,256*1024),Math.min(file.size,1024*1024)];
 let lastError=null;
 for(const size of [...new Set(attempts)]){
  try{return dicomParser.parseDicom(new Uint8Array(await file.slice(0,size).arrayBuffer()),{untilTag:'x7fe00010'})}
  catch(e){lastError=e}
 }
 try{return dicomParser.parseDicom(new Uint8Array(await file.arrayBuffer()),{untilTag:'x7fe00010'})}
 catch(e){throw lastError||e}
}
function parsedSliceMeta(f,ds){
 const seriesUid=ds.string('x0020000e')?.trim();if(!seriesUid)return null;
 const ps=multi(ds.string('x00280030'),2),pos=multi(ds.string('x00200032'),3);
 return{file:f,studyUid:ds.string('x0020000d')?.trim()||'study',seriesUid,description:ds.string('x0008103e')?.trim()||'Unnamed series',modality:ds.string('x00080060')?.trim()||'Unknown',rows:ds.uint16('x00280010')||0,columns:ds.uint16('x00280011')||0,bits:ds.uint16('x00280100')||16,bitsStored:ds.uint16('x00280101')||ds.uint16('x00280100')||16,highBit:ds.uint16('x00280102'),signed:ds.uint16('x00280103')||0,samples:ds.uint16('x00280002')||1,photometricInterpretation:ds.string('x00280004')?.trim()||'MONOCHROME2',planarConfiguration:ds.uint16('x00280006')||0,numberOfFrames:Number(ds.string('x00280008')||1),pixelSpacing:ps?safePair(ps):null,thickness:num(ds.string('x00180050')),spacingBetween:num(ds.string('x00180088')),instance:num(ds.string('x00200013')),pos:pos?safeTriple(pos):null,slope:numberOr(ds.string('x00281053'),1),intercept:numberOr(ds.string('x00281052'),0),windowCenter:num(ds.string('x00281050')),windowWidth:num(ds.string('x00281051')),smallest:ds.uint16('x00280106'),largest:ds.uint16('x00280107'),pixelOffset:ds.elements.x7fe00010?.dataOffset??null,pixelLength:ds.elements.x7fe00010?.length??null,ts:ds.string('x00020010')?.trim()||'1.2.840.10008.1.2.1'};
}
function expandParsedFrames(meta){
 const frames=Math.max(1,meta.numberOfFrames||1);
 if(frames===1||!COMPRESSED_DICOM_TRANSFER_SYNTAXES.has(meta.ts))return[meta];
 const dz=meta.spacingBetween||meta.thickness||1,baseInstance=Number.isFinite(meta.instance)?meta.instance:0;
 return Array.from({length:frames},(_,frameIndex)=>({...meta,frameIndex,sortIndex:baseInstance+frameIndex/Math.max(frames,1),instance:baseInstance+frameIndex,pos:meta.pos?[meta.pos[0],meta.pos[1],meta.pos[2]+frameIndex*dz]:null}));
}
async function parseFiles(files,onProgress){
 const out=new Array(files.length),workers=navigator.maxTouchPoints>0?2:Math.min(4,Math.max(2,navigator.hardwareConcurrency||2));let cursor=0,done=0;
 const work=async()=>{
  while(true){
   const i=cursor++;if(i>=files.length)return;const f=files[i];
   try{const ds=await parseDicomHeader(f),meta=parsedSliceMeta(f,ds);out[i]=meta?expandParsedFrames(meta):null}catch{}
   done++;onProgress?.(done,files.length);
   if((done&31)===0)await frameYield();
  }
 };
 await Promise.all(Array.from({length:Math.min(workers,files.length)},()=>work()));
 return out.flatMap(item=>item||[]);
}

function canDecodeToInt16(slices){
 for(const meta of slices){
  if(meta.bits!==8&&meta.bits!==16)return false;
  if(!Number.isInteger(meta.slope)||!Number.isInteger(meta.intercept))return false;
  const storedBits=meta.bitsStored||meta.bits,rawMin=meta.signed?-(2**(storedBits-1)):0,rawMax=meta.signed?(2**(storedBits-1)-1):(2**storedBits-1);
  const x=rawMin*meta.slope+meta.intercept,y=rawMax*meta.slope+meta.intercept;
  if(Math.min(x,y)<-32768||Math.max(x,y)>32767)return false;
 }
 return true;
}
function sourceRangeFromMetadata(slices){
 let min=Infinity,max=-Infinity;
 for(const meta of slices){
  let rawMin=meta.smallest,rawMax=meta.largest;
  if(rawMin==null||rawMax==null){
   const storedBits=meta.bitsStored||meta.bits;
   rawMin=meta.signed?-(2**(storedBits-1)):0;
   rawMax=meta.signed?(2**(storedBits-1)-1):(2**storedBits-1);
  }else if(meta.signed){
   if(rawMin>32767)rawMin-=65536;
   if(rawMax>32767)rawMax-=65536;
  }
  const x=rawMin*meta.slope+meta.intercept,y=rawMax*meta.slope+meta.intercept;
  min=Math.min(min,x,y);max=Math.max(max,x,y);
 }
 return{min,max};
}
function groupSeries(slices){
 const m=new Map();
 for(const s of slices){const k=s.studyUid+'::'+s.seriesUid;(m.get(k)||m.set(k,[]).get(k)).push(s)}
 return[...m.entries()].map(([id,g])=>{
  g.sort((a,b)=>((a.pos?.[2]??a.sortIndex??a.instance??0)-(b.pos?.[2]??b.sortIndex??b.instance??0)));
  const f=g[0],rows=Math.max(...g.map(x=>x.rows)),columns=Math.max(...g.map(x=>x.columns)),bits=Math.max(...g.map(x=>x.bits)),compact=canDecodeToInt16(g),count=rows*columns*g.length,decodedBytes=count*(compact?2:4),sourceBacked=decodedBytes>256*1024*1024,range=sourceRangeFromMetadata(g);
  let z=f.spacingBetween||f.thickness||1;
  if(g.length>1&&g[0].pos&&g[1].pos)z=Math.abs(g[1].pos[2]-g[0].pos[2])||z;
  const windowCenter=g.find(x=>Number.isFinite(x.windowCenter))?.windowCenter,windowWidth=g.find(x=>Number.isFinite(x.windowWidth)&&x.windowWidth>0)?.windowWidth;
  return{id,description:f.description,modality:f.modality,slices:g,rows,columns,bits,bytes:decodedBytes,decodedBytes,compact,sourceBacked,min:range.min,max:range.max,windowCenter,windowWidth,spacingX:f.pixelSpacing?.[1]??1,spacingY:f.pixelSpacing?.[0]??1,spacingZ:z};
 }).sort((a,b)=>b.slices.length-a.slices.length)
}

function renderSeries(series){list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.decodedBytes)+' · '+(s.sourceBacked?'フル解像度・ストリーミング':(s.compact?'Int16':'Float32'))+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

async function selectSeries(s){
 activeId=s.id;activeSeries=s;clear3DForSeriesChange();
 for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);
 selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+(s.sourceBacked?' · full resolution':'')+'</span><span class="ready-badge">CT volume loading…</span>';
 prog.classList.remove('is-hidden');busy(true);let phase='decode';
 try{
  invalidateSourceFilters();
  sourceVolume=s.sourceBacked?openSourceBackedVolume(s):await decode(s,(x,y)=>progress(x,y));
  if(s.sourceBacked)await prepareSourceMprCache(sourceVolume,(x,y)=>{progress(x,y);const badge=selected.querySelector('.ready-badge');if(badge)badge.textContent='MPR cache '+x+' / '+y});
  volume=sourceVolume;phase='configure';configure(volume);enableProcessingControls(true);scheduleGpuPrewarm();phase='render';renderAll();mark3DStale();
  selected.querySelector('.ready-badge').textContent=s.sourceBacked?(volume.mprData?'CT source ready · MPR cached':'CT source ready · streaming MPR'):'CT volume ready · 2D ready';
  footer.textContent=s.sourceBacked?(volume.mprData?'Full-resolution source DICOM · MPR memory cache '+fmt(volume.mprData.byteLength):'Full-resolution source-backed DICOM · streaming MPR'):'CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · '+volume.data.constructor.name+' '+fmt(volume.data.byteLength);
 }catch(e){
  console.error(e);const label=phase==='decode'?'Decode failed':phase==='configure'?'Configure failed':'Render failed';
  selected.querySelector('.ready-badge').textContent=label;footer.textContent=label+': '+String(e.message||e)
 }finally{prog.classList.add('is-hidden');busy(false)}
}
function openSourceBackedVolume(s){
 return{data:null,mprData:null,mprPlaneBuffers:null,sourceBacked:true,series:s,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min:s.min,max:s.max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:'DICOM source'};
}
function sourceMprCacheLimit(){
 const deviceMemory=Number(navigator.deviceMemory)||0;
 if(navigator.maxTouchPoints>0)return deviceMemory>=8?768*1024*1024:512*1024*1024;
 return deviceMemory>=16?1536*1024*1024:1024*1024*1024;
}
function sourceMprDecodeConcurrency(){
 const hc=Math.max(2,Number(navigator.hardwareConcurrency)||4);
 return navigator.maxTouchPoints>0?Math.max(2,Math.min(4,hc-1)):Math.max(4,Math.min(8,hc-1));
}
async function prepareSourceMprCache(v,onProgress){
 const s=v?.series;if(!s)return false;
 const Ctor=s.compact?Int16Array:Float32Array,w=s.columns,h=s.rows,d=s.slices.length,plane=w*h,count=plane*d,volumeBytes=count*Ctor.BYTES_PER_ELEMENT,limit=sourceMprCacheLimit();
 if(volumeBytes>limit)return false;
 let data,coronalAll=null,sagittalAll=null;
 try{
  data=new Ctor(count);
  if(volumeBytes*3<=limit){coronalAll=new Ctor(count);sagittalAll=new Ctor(count)}
 }catch{return false}
 let next=0,completed=0,min=Infinity,max=-Infinity;
 const decodeOne=async z=>{
  const slice=await decodeSourceSlice(s.slices[z]),base=z*plane,corZ=d-1-z;
  let localMin=Infinity,localMax=-Infinity;
  for(let y=0;y<h;y++){
   const srcRow=y*w,baseRow=base+srcRow;
   for(let x=0;x<w;x++){
    const value=s.compact?slice[srcRow+x]:Number(slice[srcRow+x]);
    data[baseRow+x]=value;if(value<localMin)localMin=value;if(value>localMax)localMax=value;
    if(coronalAll)coronalAll[(y*d+corZ)*w+x]=value;
    if(sagittalAll)sagittalAll[(x*d+corZ)*h+y]=value;
   }
  }
  if(localMin<min)min=localMin;if(localMax>max)max=localMax;
  completed++;onProgress?.(completed,d);
 };
 const runner=async()=>{
  while(true){
   const z=next++;if(z>=d)return;
   await decodeOne(z);
   if((completed&3)===0)await frameYield();
  }
 };
 const concurrency=Math.min(d,sourceMprDecodeConcurrency());
 await Promise.all(Array.from({length:concurrency},()=>runner()));
 v.mprData=data;v.mprCtor=Ctor;v.mprCoronalAll=coronalAll;v.mprSagittalAll=sagittalAll;
 v.mprPlaneBuffers={coronal:coronalAll?null:new Ctor(w*d),sagittal:sagittalAll?null:new Ctor(h*d)};
 if(Number.isFinite(min))v.min=min;if(Number.isFinite(max))v.max=max;
 return true;
}
function cachedSourceMprPlane(v,p,idx){
 const data=v?.mprData;if(!data)return null;
 const Ctor=v.mprCtor||data.constructor,w=v.columns,h=v.rows,d=v.slices,plane=w*h;
 if(p==='axial')return data.subarray(idx*plane,(idx+1)*plane);
 if(p==='coronal'){
  if(v.mprCoronalAll)return v.mprCoronalAll.subarray(idx*d*w,(idx+1)*d*w);
  const out=v.mprPlaneBuffers?.coronal||new Ctor(w*d);
  for(let z=0;z<d;z++){const src=z*plane+idx*w,dst=(d-1-z)*w;out.set(data.subarray(src,src+w),dst)}
  return out;
 }
 if(v.mprSagittalAll)return v.mprSagittalAll.subarray(idx*d*h,(idx+1)*d*h);
 const out=v.mprPlaneBuffers?.sagittal||new Ctor(h*d);
 for(let z=0;z<d;z++){const base=z*plane,dst=(d-1-z)*h;for(let y=0;y<h;y++)out[dst+y]=data[base+y*w+idx]}
 return out;
}
const NATIVE_DICOM_TRANSFER_SYNTAXES=new Set(['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2']);
const COMPRESSED_DICOM_TRANSFER_SYNTAXES=new Set(['1.2.840.10008.1.2.5','1.2.840.10008.1.2.4.50','1.2.840.10008.1.2.4.51','1.2.840.10008.1.2.4.57','1.2.840.10008.1.2.4.70','1.2.840.10008.1.2.4.80','1.2.840.10008.1.2.4.81','1.2.840.10008.1.2.4.90','1.2.840.10008.1.2.4.91','1.2.840.10008.1.2.4.201','1.2.840.10008.1.2.4.202','1.2.840.10008.1.2.4.203']);
let dicomCodecModulePromise=null;
function isNativeDicomTransferSyntax(ts){return NATIVE_DICOM_TRANSFER_SYNTAXES.has(ts)}
async function getDicomCodecModule(){
 if(!dicomCodecModulePromise)dicomCodecModulePromise=import('https://esm.sh/@cornerstonejs/dicom-image-loader@5.10.8?bundle').catch(e=>{dicomCodecModulePromise=null;throw e});
 return dicomCodecModulePromise;
}
function dicomImageFrameInfo(meta){
 const bits=meta.bitsStored||meta.bits,bytesPerPixel=meta.bits<=8?1:2;
 return{samplesPerPixel:meta.samples||1,photometricInterpretation:meta.photometricInterpretation||'MONOCHROME2',planarConfiguration:meta.planarConfiguration||0,rows:meta.rows,columns:meta.columns,bitsAllocated:meta.bits,bitsStored:bits,highBit:meta.highBit??bits-1,pixelRepresentation:meta.signed?1:0,smallestPixelValue:meta.smallest??(meta.signed?-(2**(bits-1)):0),largestPixelValue:meta.largest??(meta.signed?(2**(bits-1)-1):(2**bits-1)),bytesPerPixel,signed:!!meta.signed,componentsPerPixel:meta.samples||1};
}
function encapsulatedFrameBytes(ds,element,ts,frameIndex=0){
 if(!element?.encapsulatedPixelData||!element.fragments?.length)throw new Error('Encapsulated Pixel Data missing');
 const frames=Math.max(1,Number(ds.string('x00280008')||1));if(frameIndex<0||frameIndex>=frames)throw new Error('Compressed DICOM frame out of range: '+frameIndex+' / '+frames);
 if(ts==='1.2.840.10008.1.2.5')return dicomParser.readEncapsulatedPixelDataFromFragments(ds,element,frameIndex,1);
 let bot=element.basicOffsetTable||[];
 if(!bot.length&&frames>1){
  if(typeof dicomParser.createJPEGBasicOffsetTable!=='function')throw new Error('Compressed multi-frame DICOM has no Basic Offset Table');
  bot=dicomParser.createJPEGBasicOffsetTable(ds,element);
 }
 if(bot.length)return dicomParser.readEncapsulatedImageFrame(ds,element,frameIndex,bot);
 if(frames===1)return dicomParser.readEncapsulatedPixelDataFromFragments(ds,element,0,element.fragments.length);
 throw new Error('Unable to resolve compressed DICOM frame boundaries');
}
async function decodeCompressedDicomSlice(meta){
 if(!COMPRESSED_DICOM_TRANSFER_SYNTAXES.has(meta.ts))throw new Error('Unsupported compressed DICOM transfer syntax: '+meta.ts);
 if((meta.samples||1)!==1)throw new Error('Compressed color DICOM is outside the CT viewer scope');
 const bytes=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(bytes),element=ds.elements.x7fe00010,pixelData=encapsulatedFrameBytes(ds,element,meta.ts,meta.frameIndex||0),frame=dicomImageFrameInfo(meta),module=await getDicomCodecModule(),decoders=module.decoders;
 let decoded;
 if(meta.ts==='1.2.840.10008.1.2.5')decoded=await decoders.RLE(frame,pixelData);
 else if(meta.ts==='1.2.840.10008.1.2.4.50')decoded=await decoders.JPEGBaseline8Bit(pixelData,frame);
 else if(meta.ts==='1.2.840.10008.1.2.4.51')decoded=await decoders.JPEGBaseline12Bit(frame,pixelData);
 else if(meta.ts==='1.2.840.10008.1.2.4.57'||meta.ts==='1.2.840.10008.1.2.4.70')decoded=await decoders.JPEGLossless(frame,pixelData);
 else if(meta.ts==='1.2.840.10008.1.2.4.80'||meta.ts==='1.2.840.10008.1.2.4.81')decoded=await decoders.JPEGLS(pixelData,frame);
 else if(meta.ts==='1.2.840.10008.1.2.4.90'||meta.ts==='1.2.840.10008.1.2.4.91')decoded=await decoders.JPEG2000(pixelData,frame);
 else decoded=await decoders.HTJ2K(pixelData,frame);
 const stored=decoded?.pixelData;if(!stored||stored.length<meta.rows*meta.columns)throw new Error('Compressed DICOM decoder returned incomplete pixel data');
 const n=meta.rows*meta.columns,out=new Float32Array(n);for(let i=0;i<n;i++)out[i]=Number(stored[i])*meta.slope+meta.intercept;
 return out;
}
async function decodeSourceSlice(meta){
 if(!isNativeDicomTransferSyntax(meta.ts))return decodeCompressedDicomSlice(meta);
 const bpp=meta.bits===8?1:meta.bits===16?2:0;
 if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 let bytes,offset=meta.pixelOffset;
 if(offset!=null){
  bytes=new Uint8Array(await meta.file.slice(offset,offset+meta.rows*meta.columns*bpp).arrayBuffer());
  offset=0;
 }else{
  const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
  if(!el)throw new Error('Pixel Data missing');bytes=all;offset=el.dataOffset;
 }
 const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=meta.rows*meta.columns,out=new Float32Array(n);
 for(let i=0;i<n;i++){
  let raw;
  if(meta.bits===8){raw=bytes[offset+i];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(offset+i*2,little):view.getUint16(offset+i*2,little);
  out[i]=raw*meta.slope+meta.intercept;
 }
 return out;
}
async function readSourceRow(meta,row){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(!isNativeDicomTransferSyntax(meta.ts)||meta.pixelOffset==null){const full=await decodeSourceSlice(meta);return full.slice(row*meta.columns,(row+1)*meta.columns)}
 const start=meta.pixelOffset+row*meta.columns*bpp,end=start+meta.columns*bpp,bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer),out=new Float32Array(meta.columns);
 for(let x=0;x<meta.columns;x++){let raw;if(meta.bits===8){raw=bytes[x];if(meta.signed&&raw>127)raw-=256}else raw=meta.signed?view.getInt16(x*2,little):view.getUint16(x*2,little);out[x]=raw*meta.slope+meta.intercept}
 return out;
}
async function readSourceRows(meta,rowStart,rowCount){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 const count=Math.max(0,Math.min(rowCount,meta.rows-rowStart));if(!count)return new Float32Array();
 if(!isNativeDicomTransferSyntax(meta.ts)||meta.pixelOffset==null){const full=await decodeSourceSlice(meta);return full.slice(rowStart*meta.columns,(rowStart+count)*meta.columns)}
 const start=meta.pixelOffset+rowStart*meta.columns*bpp,end=start+count*meta.columns*bpp,bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer),out=new Float32Array(count*meta.columns);
 for(let i=0;i<out.length;i++){let raw;if(meta.bits===8){raw=bytes[i];if(meta.signed&&raw>127)raw-=256}else raw=meta.signed?view.getInt16(i*2,little):view.getUint16(i*2,little);out[i]=raw*meta.slope+meta.intercept}
 return out;
}
async function readSourceColumn(meta,column){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(!isNativeDicomTransferSyntax(meta.ts)||meta.pixelOffset==null){const full=await decodeSourceSlice(meta),out=new Float32Array(meta.rows);for(let y=0;y<meta.rows;y++)out[y]=full[y*meta.columns+column];return out}
 const bytes=new Uint8Array(await meta.file.slice(meta.pixelOffset,meta.pixelOffset+meta.rows*meta.columns*bpp).arrayBuffer()),little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Float32Array(meta.rows);
 for(let y=0;y<meta.rows;y++){
  const off=(y*meta.columns+column)*bpp;let raw;
  if(meta.bits===8){raw=bytes[off];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(off,little):view.getUint16(off,little);
  out[y]=raw*meta.slope+meta.intercept;
 }
 return out;
}
async function decode(s,onProgress){
 const Ctor=s.compact?Int16Array:Float32Array,w=s.columns,h=s.rows,d=s.slices.length,plane=w*h,count=plane*d,bytesNeeded=count*Ctor.BYTES_PER_ELEMENT,limit=sourceMprCacheLimit();
 let data,coronalAll=null,sagittalAll=null;
 try{
  data=new Ctor(count);
  if(bytesNeeded*3<=limit){coronalAll=new Ctor(count);sagittalAll=new Ctor(count)}
 }catch(e){throw new Error('Volume memory allocation failed: '+fmt(bytesNeeded)+' ('+Ctor.name+')')}
 let next=0,completed=0,min=Infinity,max=-Infinity;
 const decodeOne=async z=>{
  const slice=await decodeSourceSlice(s.slices[z]),base=z*plane,corZ=d-1-z;let localMin=Infinity,localMax=-Infinity;
  for(let y=0;y<h;y++){
   const srcRow=y*w,baseRow=base+srcRow;
   for(let x=0;x<w;x++){
    const value=s.compact?slice[srcRow+x]:Number(slice[srcRow+x]);
    data[baseRow+x]=value;if(value<localMin)localMin=value;if(value>localMax)localMax=value;
    if(coronalAll)coronalAll[(y*d+corZ)*w+x]=value;
    if(sagittalAll)sagittalAll[(x*d+corZ)*h+y]=value;
   }
  }
  if(localMin<min)min=localMin;if(localMax>max)max=localMax;completed++;onProgress?.(completed,d);
 };
 const runner=async()=>{while(true){const z=next++;if(z>=d)return;await decodeOne(z);if((completed&3)===0)await frameYield()}};
 const concurrency=Math.min(d,sourceMprDecodeConcurrency());await Promise.all(Array.from({length:concurrency},()=>runner()));
 return{data,mprData:data,mprCtor:Ctor,mprCoronalAll:coronalAll,mprSagittalAll:sagittalAll,mprPlaneBuffers:{coronal:coronalAll?null:new Ctor(w*d),sagittal:sagittalAll?null:new Ctor(h*d)},columns:w,rows:h,slices:d,spacing:[s.spacingX,s.spacingY,s.spacingZ],min,max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:Ctor.name,sourceBacked:false};
}


/* Full-resolution source-backed filters: exact local processing in bounded tiles. */
const gpuFilterRuntime={device:null,adapter:null,initPromise:null,disabled:false,pipelines:new Map(),warned:false,lastBackend:'CPU',lastError:'',adapterLabel:'',retryAfter:0,initAttempts:0,bufferPool:new Map(),bufferPoolBytes:0,sharedRendererDevice:false,workgroupSize:128,lastShaderKind:''};
function isDesktopMac(){
 const platform=navigator.userAgentData?.platform||navigator.platform||navigator.userAgent||'';
 return /mac/i.test(platform)&&(navigator.maxTouchPoints||0)===0;
}
function gpuMeshBlockDepth(){
 if(navigator.maxTouchPoints>0)return 2;
 if(!isDesktopMac())return 4;
 const cap=Number(gpuFilterRuntime.device?.limits?.maxStorageBufferBindingSize)||128*1024*1024;
 return cap>=256*1024*1024?32:cap>=128*1024*1024?16:12;
}
function gpuMeshTileStart(){return isDesktopMac()?[1024,1024]:[192,64]}
function gpuResidentSurfaceDrawBudget(){
 if(navigator.maxTouchPoints>0)return 0;
 return isDesktopMac()?48:24;
}
function shouldUseGpuResidentSurface(w,h,d,tx,ty,blockDepth,segmentCount){
 const budget=gpuResidentSurfaceDrawBudget();if(budget<=0)return false;
 const tilesPerBlock=Math.ceil(w/Math.max(1,tx))*Math.ceil(h/Math.max(1,ty));
 const blocks=Math.ceil(d/Math.max(1,blockDepth));
 const estimatedDraws=tilesPerBlock*blocks*Math.max(1,segmentCount||1);
 return estimatedDraws<=budget;
}
function gpuAdapterLabel(adapter){
 try{
  const info=adapter?.info;if(!info)return'';
  return [info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
 }catch{return''}
}
function gpuDeviceMode(device){return device?.features?.has?.('core-features-and-limits')?'CORE':'COMPAT'}
function gpuComputeWorkgroupSize(device=gpuFilterRuntime.device){
 const a=Number(device?.limits?.maxComputeInvocationsPerWorkgroup)||128,b=Number(device?.limits?.maxComputeWorkgroupSizeX)||a;
 const cap=Math.max(1,Math.min(256,a,b));return cap>=256?256:cap>=128?128:cap>=64?64:Math.max(1,cap);
}
function gpuDeviceRequestDescriptor(adapter){
 const requiredFeatures=[];if(adapter?.features?.has?.('core-features-and-limits'))requiredFeatures.push('core-features-and-limits');
 const requiredLimits={};
 if((adapter?.limits?.maxComputeInvocationsPerWorkgroup||0)>=256)requiredLimits.maxComputeInvocationsPerWorkgroup=256;
 if((adapter?.limits?.maxComputeWorkgroupSizeX||0)>=256)requiredLimits.maxComputeWorkgroupSizeX=256;
 return{requiredFeatures,requiredLimits};
}
async function requestVrlGpuAdapter(){
 let adapter=null;
 try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance',featureLevel:'core'})}catch{}
 if(!adapter)try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'})}catch{}
 if(!adapter)try{adapter=await navigator.gpu.requestAdapter()}catch{}
 return adapter;
}
async function requestVrlGpuDevice(){
 const adapter=await requestVrlGpuAdapter();if(!adapter)throw new Error('WebGPU core adapter unavailable');
 const device=await adapter.requestDevice(gpuDeviceRequestDescriptor(adapter));
 return{adapter,device};
}
function updateGpuStatus(){
 if(!status)return;
 const render=sceneState?.backend||'INIT';
 const compute=gpuFilterRuntime.lastBackend||(gpuFilterRuntime.device?'WEBGPU READY':'CPU');
 const adapter=gpuFilterRuntime.adapterLabel?(' · '+gpuFilterRuntime.adapterLabel):'';
 const failure=/FAIL|ERROR|LOST/.test(compute)&&gpuFilterRuntime.lastError?(' · '+gpuFilterRuntime.lastError.slice(0,96)):'';
 status.removeAttribute('data-i18n');
 status.textContent='Render '+render+' · Compute '+compute+failure+adapter;
 const computeGpu=compute.startsWith('WEBGPU'),gpuActive=render==='WEBGPU'||computeGpu;
 status.className=gpuActive?'status status-ok':'status status-warning';
 status.title=gpuFilterRuntime.lastError||'';
}
function setGpuComputeBackend(label,error=''){
 gpuFilterRuntime.lastBackend=label;
 if(error)gpuFilterRuntime.lastError=String(error);
 else if(label.startsWith('WEBGPU'))gpuFilterRuntime.lastError='';
 updateGpuStatus();
}
function installGpuErrorListener(device){
 if(!device||device.__vrlErrorListenerInstalled)return;
 try{
  device.__vrlErrorListenerInstalled=true;
  device.addEventListener?.('uncapturederror',event=>{
   const message=String(event?.error?.message||event?.message||'uncaptured WebGPU error'),kind=gpuFilterRuntime.lastShaderKind?(' ['+gpuFilterRuntime.lastShaderKind+']'):'';
   gpuFilterRuntime.lastError='uncaptured'+kind+': '+message;
   setGpuComputeBackend('WEBGPU GPU FAIL',gpuFilterRuntime.lastError);
   console.error('Virtual Rodent Lab WebGPU error:',event?.error||event);
  });
 }catch{}
}
function gpuCapacityError(error){
 const m=String(error?.message||error||'').toLowerCase();
 return m.includes('__gpu_smooth_capacity__')||m.includes('out of memory')||m.includes('allocation')||m.includes('buffer limit')||m.includes('binding size')||m.includes('maxstoragebufferbindingsize')||m.includes('maxbuffersize');
}
async function gpuValidationScope(device,label,fn){
 if(!device?.pushErrorScope||!device?.popErrorScope)return fn();
 let popped=false;device.pushErrorScope('validation');
 try{
  const result=await fn(),validation=await device.popErrorScope();popped=true;
  if(validation)throw new Error(label+': '+validation.message);
  return result;
 }catch(e){
  if(!popped){
   try{const validation=await device.popErrorScope();popped=true;if(validation&&!String(e?.message||e).includes(validation.message))throw new Error(label+': '+validation.message+' | '+String(e?.message||e))}catch(scopeError){if(scopeError!==e)throw scopeError}
  }
  throw e;
 }
}
const GPU_FILTER_KEYS=new Set(['gaussian','sigmoid','spikeHole','unsharp','anisotropic','tv','bilateral','nlm']);
function gpuStagesSupported(stages){
 return stages.every(stage=>GPU_FILTER_KEYS.has(stage.key));
}
function gpuPoolLimit(){return navigator.maxTouchPoints>0?64*1024*1024:(isDesktopMac()?256:192)*1024*1024}
function gpuBufferBucketSize(bytes){
 let size=4096;while(size<bytes)size*=2;return size;
}
function acquireGpuWorkBuffer(device,bytes){
 const size=gpuBufferBucketSize(bytes),bucket=gpuFilterRuntime.bufferPool.get(size);
 if(bucket?.length){const buffer=bucket.pop();gpuFilterRuntime.bufferPoolBytes-=size;return{buffer,size}}
 return{buffer:device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),size};
}
function releaseGpuWorkBuffer(buffer,size){
 if(!buffer||gpuFilterRuntime.sharedRendererDevice&&gpuFilterRuntime.device?.lost===undefined){try{buffer?.destroy?.()}catch{};return}
 const limit=gpuPoolLimit();
 if(size>limit/2||gpuFilterRuntime.bufferPoolBytes+size>limit){try{buffer.destroy()}catch{};return}
 let bucket=gpuFilterRuntime.bufferPool.get(size);if(!bucket){bucket=[];gpuFilterRuntime.bufferPool.set(size,bucket)}
 if(bucket.length>=2){try{buffer.destroy()}catch{};return}
 bucket.push(buffer);gpuFilterRuntime.bufferPoolBytes+=size;
}
function clearGpuBufferPool(){
 for(const bucket of gpuFilterRuntime.bufferPool.values())for(const buffer of bucket){try{buffer.destroy()}catch{}}
 gpuFilterRuntime.bufferPool.clear();gpuFilterRuntime.bufferPoolBytes=0;
}
async function verifyGpuComputeDevice(device){
 if(!device)return false;const wg=gpuComputeWorkgroupSize(device);gpuFilterRuntime.workgroupSize=wg;
 const out=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
  const code=`struct TestBuffer {
 data : array<u32, 1>
}
@group(0) @binding(0) var<storage, read_write> testBuffer : TestBuffer;
@compute @workgroup_size(${wg})
fn main(@builtin(local_invocation_index) localIndex : u32) {
 if (localIndex == 0u) {
  testBuffer.data[0] = 7u;
 }
}`;
  const module=device.createShaderModule({label:'VRL compute self-test',code});
  if(typeof module.getCompilationInfo==='function'){const info=await module.getCompilationInfo(),errors=(info.messages||[]).filter(m=>m.type==='error');if(errors.length)throw new Error('self-test WGSL: '+errors.map(m=>m.message).join(' | '))}
  const pipeline=await gpuValidationScope(device,'compute self-test pipeline',async()=>device.createComputePipelineAsync?await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}):device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}}));
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:out}}]}),encoder=device.createCommandEncoder({label:'VRL compute self-test'}),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,4);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const value=new Uint32Array(read.getMappedRange().slice(0))[0];read.unmap();
  if(value!==7)throw new Error('compute self-test readback mismatch: '+value);
  return true;
 }finally{try{out.destroy()}catch{}try{read.destroy()}catch{}}
}
function adoptRendererGpuDevice(renderer,adapter=null){
 const device=renderer?.backend?.device;
 if(!device||typeof device.createBuffer!=='function'||gpuFilterRuntime.device===device)return false;
 clearGpuBufferPool();gpuFilterRuntime.pipelines.clear();gpuFilterRuntime.device=device;gpuFilterRuntime.adapter=adapter;gpuFilterRuntime.disabled=false;gpuFilterRuntime.sharedRendererDevice=true;gpuFilterRuntime.initPromise=null;gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.adapterLabel=gpuAdapterLabel(adapter);gpuFilterRuntime.lastBackend='WEBGPU CHECKING';gpuFilterRuntime.workgroupSize=gpuComputeWorkgroupSize(device);gpuPrewarmIndex=0;gpuPrewarmScheduled=false;installGpuErrorListener(device);
 try{device.lost.then(()=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();gpuPrewarmIndex=0;gpuPrewarmScheduled=false;setGpuComputeBackend('GPU DEVICE LOST','WebGPU device lost')}})}catch{}
 void verifyGpuComputeDevice(device).then(async ok=>{if(gpuFilterRuntime.device===device&&ok){await verifyGpuPipelineSet();if(gpuFilterRuntime.device===device)setGpuComputeBackend('WEBGPU '+gpuDeviceMode(device)+' FULL VERIFIED · WG'+gpuFilterRuntime.workgroupSize)}}).catch(e=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.lastError='verify ['+(gpuFilterRuntime.lastShaderKind||'self-test')+']: '+String(e?.message||e);setGpuComputeBackend('WEBGPU RENDER ONLY · COMPUTE FAIL',gpuFilterRuntime.lastError)}});
 updateGpuStatus();return true;
}
async function ensureGpuFilterDevice(){
 if(!('gpu' in navigator)){gpuFilterRuntime.disabled=true;setGpuComputeBackend('CPU · WebGPU unavailable','navigator.gpu is unavailable');return null}
 gpuFilterRuntime.disabled=false;
 if(gpuFilterRuntime.device)return gpuFilterRuntime.device;
 if(gpuFilterRuntime.initPromise)return gpuFilterRuntime.initPromise;
 const now=performance.now();if(gpuFilterRuntime.retryAfter>now)return null;
 gpuFilterRuntime.initPromise=(async()=>{
  gpuFilterRuntime.initAttempts++;setGpuComputeBackend('WEBGPU CHECKING');
  try{
   const {adapter,device}=await requestVrlGpuDevice();
   gpuFilterRuntime.adapter=adapter;gpuFilterRuntime.device=device;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.adapterLabel=gpuAdapterLabel(adapter);gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.warned=false;gpuFilterRuntime.workgroupSize=gpuComputeWorkgroupSize(device);installGpuErrorListener(device);setGpuComputeBackend('WEBGPU CHECKING');
   device.lost.then(info=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();gpuPrewarmIndex=0;gpuPrewarmScheduled=false;gpuFilterRuntime.retryAfter=performance.now()+2000;setGpuComputeBackend('GPU DEVICE LOST',info?.message||'WebGPU device lost')}});
   try{await verifyGpuComputeDevice(device);await verifyGpuPipelineSet();setGpuComputeBackend('WEBGPU '+gpuDeviceMode(device)+' FULL VERIFIED · WG'+gpuFilterRuntime.workgroupSize)}catch(testError){gpuFilterRuntime.lastError='verify ['+(gpuFilterRuntime.lastShaderKind||'self-test')+']: '+String(testError?.message||testError);setGpuComputeBackend('WEBGPU COMPUTE FAIL',gpuFilterRuntime.lastError);throw testError}
   return device;
  }catch(e){
   gpuFilterRuntime.device=null;gpuFilterRuntime.adapter=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.retryAfter=performance.now()+5000;
   setGpuComputeBackend('CPU COMPUTE · GPU ERROR',e?.message||e);
   console.warn('WebGPU compute unavailable for this attempt; exact CPU compute path active. GPU will be retried.',e);
   return null;
  }finally{gpuFilterRuntime.initPromise=null}
 })();
 return gpuFilterRuntime.initPromise;
}
function gpuFilterShader(kind){
 const header=`
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> params: array<f32>;
fn coord(i:u32)->vec3<u32>{
 let w=meta[0];let h=meta[1];let plane=w*h;
 return vec3<u32>(i%w,(i/w)%h,i/plane);
}
fn idx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn cidx(x:i32,y:i32,z:i32)->u32{
 let xx=u32(clamp(x,0,i32(meta[0])-1));let yy=u32(clamp(y,0,i32(meta[1])-1));let zz=u32(clamp(z,0,i32(meta[2])-1));
 return idx(xx,yy,zz);
}
`;
 if(kind==='gaussian')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];let axis=meta[4];
 var x0=c.x;var x1=c.x;var y0=c.y;var y1=c.y;var z0=c.z;var z1=c.z;
 if(axis==0u){x0=select(c.x-1u,0u,c.x==0u);x1=min(w-1u,c.x+1u);}
 if(axis==1u){y0=select(c.y-1u,0u,c.y==0u);y1=min(h-1u,c.y+1u);}
 if(axis==2u){z0=select(c.z-1u,0u,c.z==0u);z1=min(d-1u,c.z+1u);}
 let a=src[idx(x0,y0,z0)];let b=src[i];let cc=src[idx(x1,y1,z1)];
 let blur=(a+2.0*b+cc)*0.25;let s=params[0];dst[i]=b*(1.0-s)+blur*s;
}`;
 if(kind==='median')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let plane=w*h;var vals:array<f32,7>;
 vals[0]=src[i];vals[1]=src[i-1u];vals[2]=src[i+1u];vals[3]=src[i-w];vals[4]=src[i+w];vals[5]=src[i-plane];vals[6]=src[i+plane];
 for(var q:u32=1u;q<7u;q=q+1u){
  let v=vals[q];var j=i32(q)-1;
  loop{
   if(j<0){break;}if(vals[u32(j)]<=v){break;}
   vals[u32(j+1)]=vals[u32(j)];j=j-1;
  }
  vals[u32(j+1)]=v;
 }
 let s=params[0];dst[i]=src[i]*(1.0-s)+vals[3]*s;
}`;
 if(kind==='sigmoid')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let minv=params[0];let maxv=params[1];let strength=params[2];let centerValue=clamp(params[3],minv,maxv);
 let range=max(1.0,maxv-minv);let gain=2.0+strength*10.0;let center=(centerValue-minv)/range;
 let lo=1.0/(1.0+exp(gain*center));let hi=1.0/(1.0+exp(-gain*(1.0-center)));let norm=max(0.000001,hi-lo);
 let x=clamp((src[i]-minv)/range,0.0,1.0);let y=(1.0/(1.0+exp(-gain*(x-center)))-lo)/norm;
 dst[i]=minv+clamp(y,0.0,1.0)*range;
}`;
 if(kind==='spikeHole')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let n0=src[i-1u];let n1=src[i+1u];let n2=src[i-w];let n3=src[i+w];let plane=w*h;let n4=src[i-plane];let n5=src[i+plane];
 let mean=(n0+n1+n2+n3+n4+n5)/6.0;let lo=min(min(min(n0,n1),min(n2,n3)),min(n4,n5));let hi=max(max(max(n0,n1),max(n2,n3)),max(n4,n5));
 let range=max(1.0,params[1]-params[0]);let strength=params[2];let threshold=range*params[3];let guard=threshold*(0.55+0.35*strength);let diff=src[i]-mean;
 if(hi-lo<=guard){if(abs(diff)>threshold){let target=mean+sign(diff)*threshold*0.08;let blend=0.20+0.75*strength;dst[i]=src[i]*(1.0-blend)+target*blend;return;}}dst[i]=src[i];
}`;
 if(kind==='anisotropic')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let strength=params[2];let k=range*(0.025+0.09*strength);let k2=max(k*k,0.000001);let lambda=0.06+0.14*strength;
 var flux=0.0;var diff=src[i-1u]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+1u]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-w]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+w]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-plane]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+plane]-center;flux+=exp(-(diff*diff)/k2)*diff;
 dst[i]=center+lambda*flux;
}`;
 if(kind==='tv')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let weight=params[2];let lambda=min(0.18,0.02+weight*0.45);let eps=range*0.0001;
 var flux=0.0;var diff=src[i-1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-w]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+w]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 dst[i]=center+lambda*flux;
}`;
 if(kind==='unsharp')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=i32(meta[0]);let h=i32(meta[1]);let d=i32(meta[2]);let r=i32(meta[4]);
 var sum=0.0;var count=0.0;
 for(var dz:i32=-r;dz<=r;dz=dz+1){let zz=i32(c.z)+dz;if(zz<0){continue;}if(zz>=d){continue;}
  for(var dy:i32=-r;dy<=r;dy=dy+1){let yy=i32(c.y)+dy;if(yy<0){continue;}if(yy>=h){continue;}
   for(var dx:i32=-r;dx<=r;dx=dx+1){let xx=i32(c.x)+dx;if(xx<0){continue;}if(xx>=w){continue;}sum+=src[u32(zz)*meta[0]*meta[1]+u32(yy)*meta[0]+u32(xx)];count+=1.0;}
  }
 }
 let blur=sum/max(count,1.0);let detail=src[i]-blur;let range=max(1.0,params[1]-params[0]);let threshold=params[3]*range;
 dst[i]=select(src[i],src[i]+params[2]*detail,abs(detail)>=threshold);
}`;
 if(kind==='bilateral')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let strength=params[2];let spatialSigma=params[3];let intensitySigma=max(0.000001,params[4]*max(1.0,params[1]-params[0]));
 let radius=i32(meta[4]);let sp2=2.0*spatialSigma*spatialSigma;let int2=2.0*intensitySigma*intensitySigma;
 var sum=0.0;var wsum=0.0;
 for(var dz:i32=-radius;dz<=radius;dz=dz+1){
  let zz=i32(c.z)+dz;if(zz<0){continue;}if(zz>=i32(meta[2])){continue;}
  for(var dy:i32=-radius;dy<=radius;dy=dy+1){
   let yy=i32(c.y)+dy;if(yy<0){continue;}if(yy>=i32(meta[1])){continue;}
   for(var dx:i32=-radius;dx<=radius;dx=dx+1){
    let xx=i32(c.x)+dx;if(xx<0){continue;}if(xx>=i32(meta[0])){continue;}
    let j=idx(u32(xx),u32(yy),u32(zz));let dv=src[j]-center;
    let sw=exp(-f32(dx*dx+dy*dy+dz*dz)/sp2);let iw=exp(-(dv*dv)/int2);let ww=sw*iw;
    sum+=src[j]*ww;wsum+=ww;
   }
  }
 }
 let filtered=select(center,sum/wsum,wsum>0.0);dst[i]=center*(1.0-strength)+filtered*strength;
}`;
 if(kind==='nlm')return header+`
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let sr=i32(meta[4]);let pr=i32(meta[5]);let range=max(1.0,params[1]-params[0]);let hp=range*(0.018+0.11*params[2]);let h2=max(hp*hp,0.000001);
 var weighted=center;var weightSum=1.0;
 for(var dz:i32=-sr;dz<=sr;dz=dz+1){
  let nz=i32(c.z)+dz;if(nz<0){continue;}if(nz>=i32(meta[2])){continue;}
  for(var dy:i32=-sr;dy<=sr;dy=dy+1){
   let ny=i32(c.y)+dy;if(ny<0){continue;}if(ny>=i32(meta[1])){continue;}
   for(var dx:i32=-sr;dx<=sr;dx=dx+1){
    let nx=i32(c.x)+dx;if(nx<0){continue;}if(nx>=i32(meta[0])){continue;}if(dx==0){if(dy==0){if(dz==0){continue;}}}
    var dist2=0.0;var samples=1.0;
    var dv=src[cidx(i32(c.x),i32(c.y),i32(c.z))]-src[cidx(nx,ny,nz)];dist2+=dv*dv;
    for(var r:i32=1;r<=pr;r=r+1){
     dv=src[cidx(i32(c.x)+r,i32(c.y),i32(c.z))]-src[cidx(nx+r,ny,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x)-r,i32(c.y),i32(c.z))]-src[cidx(nx-r,ny,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y)+r,i32(c.z))]-src[cidx(nx,ny+r,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y)-r,i32(c.z))]-src[cidx(nx,ny-r,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y),i32(c.z)+r)]-src[cidx(nx,ny,nz+r)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y),i32(c.z)-r)]-src[cidx(nx,ny,nz-r)];dist2+=dv*dv;
     samples+=6.0;
    }
    dist2/=samples;let weight=exp(-dist2/h2);let j=idx(u32(nx),u32(ny),u32(nz));weighted+=weight*src[j];weightSum+=weight;
   }
  }
 }
 dst[i]=weighted/weightSum;
}`;
 if(kind==='meshCount')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}var count=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){count=count+1u;}
  if(count>0u){atomicAdd(&counters.values[s],count);}
 }
}`;
 if(kind==='meshWrite')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
@group(0) @binding(5) var<storage, read> geom:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
fn writeFace(base:u32,a:vec3<f32>,b:vec3<f32>,c:vec3<f32>,d:vec3<f32>,e:vec3<f32>,f:vec3<f32>){
 dst[base]=a.x;dst[base+1u]=a.y;dst[base+2u]=a.z;dst[base+3u]=b.x;dst[base+4u]=b.y;dst[base+5u]=b.z;
 dst[base+6u]=c.x;dst[base+7u]=c.y;dst[base+8u]=c.z;dst[base+9u]=d.x;dst[base+10u]=d.y;dst[base+11u]=d.z;
 dst[base+12u]=e.x;dst[base+13u]=e.y;dst[base+14u]=e.z;dst[base+15u]=f.x;dst[base+16u]=f.y;dst[base+17u]=f.z;
}
fn slotFor(s:u32)->u32{return (meta[17u+s]+atomicAdd(&counters.values[s],1u))*18u;}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 let sx=geom[0];let sy=geom[1];let sz=geom[2];let scale=geom[3];let px=geom[4];let py=geom[5];let pz=geom[6];
 let x0=(f32(gx)*sx-px*0.5)*scale;let x1=(f32(gx+1u)*sx-px*0.5)*scale;
 let y0=-(f32(gy)*sy-py*0.5)*scale;let y1=-(f32(gy+1u)*sy-py*0.5)*scale;
 let z0=(f32(gz)*sz-pz*0.5)*scale;let z1=(f32(gz+1u)*sz-pz*0.5)*scale;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y0,z1),vec3f(x0,y1,z1),vec3f(x0,y0,z0),vec3f(x0,y1,z1),vec3f(x0,y1,z0));}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x1,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z1));}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x1,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z1));}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y1,z0),vec3f(x0,y1,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y1,z0));}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y1,z0),vec3f(x1,y1,z0),vec3f(x0,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y0,z0));}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z1),vec3f(x1,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z1));}
 }
}`;
 if(kind==='meshCornerInit')return `
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> corners:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(5) var<storage, read> geom:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegmentAt(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return false;}if(y<0){return false;}if(z<0){return false;}if(x>=i32(meta[0])){return false;}if(y>=i32(meta[1])){return false;}if(z>=i32(meta[2])){return false;}
 let v=src[localIdx(u32(x),u32(y),u32(z))];if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;
}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;let total=cornerCount*meta[10];
 let q=gid.x;if(q>=total){return;}let s=q/cornerCount;let ci=q-s*cornerCount;let cx=ci%cw;let cy=(ci/cw)%ch;let cz=ci/(cw*ch);
 let lx=i32(meta[3]+cx);let ly=i32(meta[4]+cy);let lz=i32(meta[5]+cz);var insideCount=0u;var sampleCount=0u;
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dy:i32=-1;dy<=0;dy=dy+1){for(var dx:i32=-1;dx<=0;dx=dx+1){
  let vx=lx+dx;let vy=ly+dy;let vz=lz+dz;
  var valid=true;if(vx<0){valid=false;}if(vy<0){valid=false;}if(vz<0){valid=false;}if(vx>=i32(meta[0])){valid=false;}if(vy>=i32(meta[1])){valid=false;}if(vz>=i32(meta[2])){valid=false;}if(valid){sampleCount=sampleCount+1u;if(insideSegmentAt(vx,vy,vz,s)){insideCount=insideCount+1u;}}
 }}}
 var activeFlag=false;if(insideCount>0u){if(insideCount<sampleCount){activeFlag=true;}}let active=select(0.0,1.0,activeFlag);
 let gx=meta[11]+meta[3]+cx;let gy=meta[12]+meta[4]+cy;let gz=meta[13]+meta[5]+cz;
 let sx=geom[0];let sy=geom[1];let sz=geom[2];let scale=geom[3];let px=geom[4];let py=geom[5];let pz=geom[6];
 let base=q*4u;corners[base]=(f32(gx)*sx-px*0.5)*scale;corners[base+1u]=-(f32(gy)*sy-py*0.5)*scale;corners[base+2u]=(f32(gz)*sz-pz*0.5)*scale;corners[base+3u]=active;
}`;
 if(kind==='meshCornerSmooth')return `
@group(0) @binding(0) var<storage, read> srcCorners:array<f32>;
@group(0) @binding(1) var<storage, read_write> dstCorners:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> params:array<f32>;
fn baseIndex(s:u32,cx:u32,cy:u32,cz:u32)->u32{
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;
 return (s*cornerCount+cz*cw*ch+cy*cw+cx)*4u;
}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;let total=cornerCount*meta[10];
 let q=gid.x;if(q>=total){return;}let s=q/cornerCount;let ci=q-s*cornerCount;let cx=ci%cw;let cy=(ci/cw)%ch;let cz=ci/(cw*ch);let base=q*4u;
 let active=srcCorners[base+3u];var px=srcCorners[base];var py=srcCorners[base+1u];var pz=srcCorners[base+2u];
 var edge=false;if(active<0.5){edge=true;}if(cx==0u){edge=true;}if(cy==0u){edge=true;}if(cz==0u){edge=true;}if(cx+1u>=cw){edge=true;}if(cy+1u>=ch){edge=true;}if(cz+1u>=cd){edge=true;}if(edge){
  dstCorners[base]=px;dstCorners[base+1u]=py;dstCorners[base+2u]=pz;dstCorners[base+3u]=active;return;
 }
 var ax=0.0;var ay=0.0;var az=0.0;var count=0.0;
 for(var dz:i32=-1;dz<=1;dz=dz+1){for(var dy:i32=-1;dy<=1;dy=dy+1){for(var dx:i32=-1;dx<=1;dx=dx+1){
  if(dx==0){if(dy==0){if(dz==0){continue;}}}if(abs(dx)+abs(dy)+abs(dz)>2){continue;}
  let nb=baseIndex(s,u32(i32(cx)+dx),u32(i32(cy)+dy),u32(i32(cz)+dz));
  if(srcCorners[nb+3u]>0.5){ax+=srcCorners[nb];ay+=srcCorners[nb+1u];az+=srcCorners[nb+2u];count+=1.0;}
 }}}
 if(count>0.0){let factor=params[0];px+=factor*(ax/count-px);py+=factor*(ay/count-py);pz+=factor*(az/count-pz);}
 dstCorners[base]=px;dstCorners[base+1u]=py;dstCorners[base+2u]=pz;dstCorners[base+3u]=active;
}`;
 if(kind==='meshWriteSmooth')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
@group(0) @binding(5) var<storage, read> corners:array<f32>;
@group(0) @binding(6) var<storage, read_write> normals:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
fn insideAt(x:i32,y:i32,z:i32,s:u32)->f32{
 if(x<0){return 0.0;}if(y<0){return 0.0;}if(z<0){return 0.0;}if(x>=i32(meta[0])){return 0.0;}if(y>=i32(meta[1])){return 0.0;}if(z>=i32(meta[2])){return 0.0;}
 return select(0.0,1.0,insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s));
}
fn cornerBase(s:u32,cx:u32,cy:u32,cz:u32)->u32{
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;return (s*cornerCount+cz*cw*ch+cy*cw+cx)*4u;
}
fn cornerPos(s:u32,cx:u32,cy:u32,cz:u32)->vec3<f32>{
 let b=cornerBase(s,cx,cy,cz);return vec3f(corners[b],corners[b+1u],corners[b+2u]);
}
fn cornerNormal(s:u32,cx:u32,cy:u32,cz:u32)->vec3<f32>{
 let vx=i32(meta[3]+cx);let vy=i32(meta[4]+cy);let vz=i32(meta[5]+cz);
 var nx=0.0;var ny=0.0;var nz=0.0;
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dy:i32=-1;dy<=0;dy=dy+1){nx+=insideAt(vx-1,vy+dy,vz+dz,s)-insideAt(vx,vy+dy,vz+dz,s);}}
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dx:i32=-1;dx<=0;dx=dx+1){ny+=insideAt(vx+dx,vy-1,vz+dz,s)-insideAt(vx+dx,vy,vz+dz,s);}}
 for(var dy:i32=-1;dy<=0;dy=dy+1){for(var dx:i32=-1;dx<=0;dx=dx+1){nz+=insideAt(vx+dx,vy+dy,vz-1,s)-insideAt(vx+dx,vy+dy,vz,s);}}
 let n=vec3f(nx,-ny,nz);let len=length(n);if(len>0.00001){return n/len;}return vec3f(0.0,0.0,1.0);
}
fn writeVertex(base:u32,v:vec3<f32>,n:vec3<f32>){dst[base]=v.x;dst[base+1u]=v.y;dst[base+2u]=v.z;normals[base]=n.x;normals[base+1u]=n.y;normals[base+2u]=n.z;}
fn writeFace(base:u32,a:vec3<f32>,na:vec3<f32>,b:vec3<f32>,nb:vec3<f32>,c:vec3<f32>,nc:vec3<f32>,d:vec3<f32>,nd:vec3<f32>,e:vec3<f32>,ne:vec3<f32>,f:vec3<f32>,nf:vec3<f32>){
 writeVertex(base,a,na);writeVertex(base+3u,b,nb);writeVertex(base+6u,c,nc);writeVertex(base+9u,d,nd);writeVertex(base+12u,e,ne);writeVertex(base+15u,f,nf);
}
fn slotFor(s:u32)->u32{return (meta[17u+s]+atomicAdd(&counters.values[s],1u))*18u;}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let p000=cornerPos(s,tx,ty,tz);let p001=cornerPos(s,tx,ty,tz+1u);let p010=cornerPos(s,tx,ty+1u,tz);let p011=cornerPos(s,tx,ty+1u,tz+1u);
  let p100=cornerPos(s,tx+1u,ty,tz);let p101=cornerPos(s,tx+1u,ty,tz+1u);let p110=cornerPos(s,tx+1u,ty+1u,tz);let p111=cornerPos(s,tx+1u,ty+1u,tz+1u);
  let n000=cornerNormal(s,tx,ty,tz);let n001=cornerNormal(s,tx,ty,tz+1u);let n010=cornerNormal(s,tx,ty+1u,tz);let n011=cornerNormal(s,tx,ty+1u,tz+1u);
  let n100=cornerNormal(s,tx+1u,ty,tz);let n101=cornerNormal(s,tx+1u,ty,tz+1u);let n110=cornerNormal(s,tx+1u,ty+1u,tz);let n111=cornerNormal(s,tx+1u,ty+1u,tz+1u);
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,p000,n000,p001,n001,p011,n011,p000,n000,p011,n011,p010,n010);}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,p100,n100,p110,n110,p111,n111,p100,n100,p111,n111,p101,n101);}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){let b=slotFor(s);writeFace(b,p000,n000,p100,n100,p101,n101,p000,n000,p101,n101,p001,n001);}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){let b=slotFor(s);writeFace(b,p010,n010,p011,n011,p111,n111,p010,n010,p111,n111,p110,n110);}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){let b=slotFor(s);writeFace(b,p000,n000,p010,n010,p110,n110,p000,n000,p110,n110,p100,n100);}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){let b=slotFor(s);writeFace(b,p001,n001,p101,n101,p111,n111,p001,n001,p111,n111,p011,n011);}
 }
}`;
 if(kind==='faceCompact')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(value:f32,s:u32)->bool{if(value<thresholds[s*2u]){return false;}if(value>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){faces=faces|1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){faces=faces|2u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){faces=faces|4u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){faces=faces|8u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){faces=faces|16u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){faces=faces|32u;}
  packed=packed|(faces<<shift);
 }
 if(packed!=0u){
  let slot=atomicAdd(&counter.value,1u);
  dst[slot*2u]=i;dst[slot*2u+1u]=packed;
 }
}`;
 if(kind==='faceExtract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(value:f32,s:u32)->bool{if(value<thresholds[s*2u]){return false;}if(value>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){faces=faces|1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){faces=faces|2u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){faces=faces|4u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){faces=faces|8u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){faces=faces|16u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){faces=faces|32u;}
  packed=packed|(faces<<shift);
 }
 dst[i]=packed;
}`;
 if(kind==='maskExtract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;let value=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
 var bits=0u;let segmentCount=meta[10];
 for(var s:u32=0u;s<segmentCount;s=s+1u){
  if(value>=thresholds[s*2u]){if(value<=thresholds[s*2u+1u]){bits=bits|(1u<<s);}}
 }
 dst[i]=bits;
}`;
 if(kind==='analysisRunCount')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn inside(v:f32)->bool{if(v<thresholds[0]){return false;}if(v>thresholds[1]){return false;}return true;}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 if(!inside(src[localIdx(x,y,z)])){return;}
 if(tx>0u){if(inside(src[localIdx(x-1u,y,z)])){return;}}
 atomicAdd(&counter.value,1u);
}`;
 if(kind==='analysisRunWrite')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<u32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn inside(v:f32)->bool{if(v<thresholds[0]){return false;}if(v>thresholds[1]){return false;}return true;}
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 if(!inside(src[localIdx(x,y,z)])){return;}
 if(tx>0u){if(inside(src[localIdx(x-1u,y,z)])){return;}}
 var x1=tx;
 loop{
  if(x1+1u>=tw){break;}
  if(!inside(src[localIdx(meta[3]+x1+1u,y,z)])){break;}
  x1=x1+1u;
 }
 let slot=atomicAdd(&counter.value,1u)*4u;
 dst[slot]=tz;dst[slot+1u]=ty;dst[slot+2u]=tx;dst[slot+3u]=x1;
}`;
 if(kind==='extract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@compute @workgroup_size(${gpuFilterRuntime.workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;
 dst[i]=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
}`;
 throw new Error('Unknown GPU filter shader '+kind);
}
function normalizeVrlWgsl(source){
 return source.replace(/\bmeta\b/g,'vrlMeta').replace(/\bactive\b/g,'vrlActive').replace(/\btarget\b/g,'vrlTarget');
}
async function gpuFilterPipeline(kind){
 const device=await ensureGpuFilterDevice();if(!device)return null;
 if(gpuFilterRuntime.pipelines.has(kind))return gpuFilterRuntime.pipelines.get(kind);
 gpuFilterRuntime.lastShaderKind=kind;
 const source=normalizeVrlWgsl(gpuFilterShader(kind)),module=device.createShaderModule({code:source,label:'VRL '+kind+' compute'});
 if(typeof module.getCompilationInfo==='function'){
  const info=await module.getCompilationInfo(),errors=(info.messages||[]).filter(m=>m.type==='error');
  if(errors.length)throw new Error('WGSL '+kind+': '+errors.map(m=>m.message).join(' | '));
 }
 const desc={layout:'auto',compute:{module,entryPoint:'main'},label:'VRL '+kind};
 const pipeline=await gpuValidationScope(device,'pipeline '+kind,async()=>device.createComputePipelineAsync?await device.createComputePipelineAsync(desc):device.createComputePipeline(desc));
 gpuFilterRuntime.pipelines.set(kind,pipeline);return pipeline;
}
const GPU_PREWARM_KINDS=['gaussian','median','sigmoid','spikeHole','anisotropic','tv','unsharp','bilateral','nlm','extract','maskExtract','faceCompact','meshCount','meshWrite','meshCornerInit','meshCornerSmooth','meshWriteSmooth','analysisRunCount','analysisRunWrite'];
async function verifyGpuPipelineSet(){
 for(const kind of GPU_PREWARM_KINDS){
  gpuFilterRuntime.lastShaderKind=kind;
  await gpuFilterPipeline(kind);
 }
 gpuFilterRuntime.lastShaderKind='';
 return true;
}
let gpuPrewarmScheduled=false,gpuPrewarmIndex=0;
function scheduleGpuPrewarm(){
 if(gpuPrewarmScheduled||gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
 gpuPrewarmScheduled=true;
 const run=async()=>{
  gpuPrewarmScheduled=false;
  if(gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
  const kind=GPU_PREWARM_KINDS[gpuPrewarmIndex++];
  try{await gpuFilterPipeline(kind)}catch(e){console.warn('GPU pipeline prewarm skipped:',kind,e)}
  if(gpuPrewarmIndex<GPU_PREWARM_KINDS.length)scheduleGpuPrewarm();
 };
 if('requestIdleCallback' in window)requestIdleCallback(()=>void run(),{timeout:2500});
 else setTimeout(()=>void run(),180);
}
function gpuSmallBuffer(device,data){
 const buffer=device.createBuffer({size:Math.max(32,Math.ceil(data.byteLength/4)*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(buffer,0,data);return buffer;
}
function createGpuResidentFloat3Attribute(device,vertexCount,label){
 const renderer=sceneState?.renderer,backend=renderer?.backend;
 if(sceneState?.backend!=='WEBGPU'||backend?.device!==device||typeof backend.set!=='function')return null;
 try{
  const attribute=new THREE.Float32BufferAttribute(new Float32Array(vertexCount*3),3);attribute.name=label;
  const buffer=device.createBuffer({label,size:Math.max(4,attribute.array.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
  backend.set(attribute,{buffer});return{attribute,buffer};
 }catch(e){console.warn('GPU-resident attribute allocation failed.',e);return null}
}
function destroyGpuResidentAttribute(entry){
 if(!entry)return;
 const backend=sceneState?.renderer?.backend;
 try{if(backend?.get(entry.attribute)?.buffer===entry.buffer&&typeof backend.destroyAttribute==='function')backend.destroyAttribute(entry.attribute);else entry.buffer?.destroy?.()}catch{try{entry.buffer?.destroy?.()}catch{}}
}
function finishGpuResidentTemps(device,cleanup){
 let completion;
 try{completion=device.queue.onSubmittedWorkDone()}catch{cleanup();return Promise.resolve()}
 completion.then(cleanup,cleanup);return completion;
}
async function runGpuSourceFilters(data,w,h,d,minv,maxv,stages,target,segments=null,faceContext=null){
 const device=await ensureGpuFilterDevice();if(!device||!gpuStagesSupported(stages))return null;
 const bytes=data.byteLength,n=data.length;
 if(bytes>device.limits.maxStorageBufferBindingSize)return null;
 const aw=acquireGpuWorkBuffer(device,bytes),bw=acquireGpuWorkBuffer(device,bytes),a=aw.buffer,b=bw.buffer;device.queue.writeBuffer(a,0,data);
 const small=[];let encoder=device.createCommandEncoder({label:'VRL filter chunk'});let current=a,next=b;
 const dispatch=async(kind,extraU32=[],paramsF32=[])=>{
  const pipeline=await gpuFilterPipeline(kind);if(!pipeline)throw new Error('GPU pipeline unavailable: '+kind);
  const meta=new Uint32Array(8);meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=n;for(let i=0;i<extraU32.length&&i<4;i++)meta[4+i]=extraU32[i]>>>0;
  const params=new Float32Array(8);for(let i=0;i<paramsF32.length&&i<8;i++)params[i]=paramsF32[i];
  const mb=gpuSmallBuffer(device,meta),pb=gpuSmallBuffer(device,params);small.push(mb,pb);
  const bind=pipeline.getBindGroupLayout(0);
  const group=device.createBindGroup({layout:bind,entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:next}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:pb}}
  ]});
  const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/gpuFilterRuntime.workgroupSize));pass.end();
  const t=current;current=next;next=t;
 };
 for(const stage of stages){
  const p=stage.params;
  if(stage.key==='gaussian'){
   if(p.mode==='median'){
    for(let round=0;round<Math.max(1,Math.round(p.passes));round++)await dispatch('median',[],[p.strength]);
   }else{
    for(let round=0;round<Math.max(1,Math.round(p.passes));round++)for(let axis=0;axis<3;axis++)await dispatch('gaussian',[axis],[p.strength]);
   }
  }else if(stage.key==='sigmoid')await dispatch('sigmoid',[],[minv,maxv,p.strength,p.center]);
  else if(stage.key==='spikeHole')await dispatch('spikeHole',[],[minv,maxv,p.strength,p.threshold]);
  else if(stage.key==='anisotropic')for(let iter=0;iter<Math.max(1,Math.round(p.iterations));iter++)await dispatch('anisotropic',[],[minv,maxv,p.strength]);
  else if(stage.key==='tv')for(let iter=0;iter<Math.max(1,Math.round(p.iterations));iter++)await dispatch('tv',[],[minv,maxv,p.weight]);
  else if(stage.key==='unsharp')await dispatch('unsharp',[Math.max(1,Math.round(p.radius))],[minv,maxv,p.amount,p.threshold]);
  else if(stage.key==='bilateral'){
   const radius=Math.max(1,Math.min(3,Math.ceil(p.spatialSigma*1.5)));
   for(let pass=0;pass<Math.max(1,Math.round(p.passes));pass++)await dispatch('bilateral',[radius],[minv,maxv,p.strength,p.spatialSigma,p.intensitySigma]);
  }else if(stage.key==='nlm')await dispatch('nlm',[Math.max(1,Math.round(p.searchRadius)),Math.max(0,Math.round(p.patchRadius))],[minv,maxv,p.strength]);
  else return null;
 }
 if(segments?.length&&faceContext?.analysisRuns){
  const targetCount=target.width*target.height*target.depth,meta=new Uint32Array(12);
  meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=target.x;meta[4]=target.y;meta[5]=target.z;meta[6]=target.width;meta[7]=target.height;meta[8]=target.depth;meta[9]=targetCount;
  const thresholds=new Float32Array([segments[0].seg.min,segments[0].seg.max,0,0]),mb=gpuSmallBuffer(device,meta),tb=gpuSmallBuffer(device,thresholds),counter=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});small.push(mb,tb);device.queue.writeBuffer(counter,0,new Uint32Array([0]));
  const countPipeline=await gpuFilterPipeline('analysisRunCount'),countGroup=device.createBindGroup({layout:countPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counter}}
  ]});
  const countPass=encoder.beginComputePass();countPass.setPipeline(countPipeline);countPass.setBindGroup(0,countGroup);countPass.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));countPass.end();
  const countRead=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(counter,0,countRead,0,4);device.queue.submit([encoder.finish()]);
  await countRead.mapAsync(GPUMapMode.READ);const runCount=new Uint32Array(countRead.getMappedRange().slice(0))[0];countRead.unmap();countRead.destroy();
  if(!runCount){releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU ANALYSIS RLE');return{analysisRuns:true,items:new Uint32Array(0),count:0}}
  const recordBytes=runCount*16,maxOut=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize||device.limits.maxStorageBufferBindingSize);
  if(recordBytes>maxOut){releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();for(const buf of small)buf.destroy();throw new Error('GPU analysis run output exceeds device buffer limit')}
  const records=device.createBuffer({size:recordBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),readback=device.createBuffer({size:recordBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});device.queue.writeBuffer(counter,0,new Uint32Array([0]));
  const writePipeline=await gpuFilterPipeline('analysisRunWrite'),writeGroup=device.createBindGroup({layout:writePipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:records}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counter}}
  ]}),writeEncoder=device.createCommandEncoder({label:'VRL analysis RLE'});
  const writePass=writeEncoder.beginComputePass();writePass.setPipeline(writePipeline);writePass.setBindGroup(0,writeGroup);writePass.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));writePass.end();writeEncoder.copyBufferToBuffer(records,0,readback,0,recordBytes);device.queue.submit([writeEncoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);const items=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();
  releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();records.destroy();readback.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU ANALYSIS RLE');return{analysisRuns:true,items,count:runCount};
 }
 if(segments?.length&&faceContext?.mesh){
  const targetCount=target.width*target.height*target.depth,meta=new Uint32Array(24);
  meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=target.x;meta[4]=target.y;meta[5]=target.z;meta[6]=target.width;meta[7]=target.height;meta[8]=target.depth;meta[9]=targetCount;meta[10]=Math.min(segments.length,4);
  meta[11]=faceContext.boxX;meta[12]=faceContext.boxY;meta[13]=faceContext.boxZ;meta[14]=faceContext.globalW;meta[15]=faceContext.globalH;meta[16]=faceContext.globalD;
  const thresholds=new Float32Array(8);for(let i=0;i<meta[10];i++){thresholds[i*2]=segments[i].seg.min;thresholds[i*2+1]=segments[i].seg.max}
  const mb=gpuSmallBuffer(device,meta),tb=gpuSmallBuffer(device,thresholds);small.push(mb,tb);
  const counters=device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(counters,0,new Uint32Array(4));
  const countPipeline=await gpuFilterPipeline('meshCount'),countGroup=device.createBindGroup({layout:countPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counters}}
  ]});
  const cp=encoder.beginComputePass();cp.setPipeline(countPipeline);cp.setBindGroup(0,countGroup);cp.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));cp.end();
  const countRead=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(counters,0,countRead,0,16);device.queue.submit([encoder.finish()]);
  await countRead.mapAsync(GPUMapMode.READ);const counts=new Uint32Array(countRead.getMappedRange().slice(0));countRead.unmap();countRead.destroy();
  const totalFaces=counts[0]+counts[1]+counts[2]+counts[3],vertexBytes=totalFaces*18*4,maxOut=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize||device.limits.maxStorageBufferBindingSize);
  if(totalFaces===0){
   releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU FILTER+MESH');return{mesh:true,vertices:new Float32Array(0),counts};
  }
  if(vertexBytes<=maxOut){
   let offset=0;for(let i=0;i<4;i++){meta[17+i]=offset;offset+=counts[i]}device.queue.writeBuffer(mb,0,meta);device.queue.writeBuffer(counters,0,new Uint32Array(4));
   const vertexCount=totalFaces*6,gpuSmooth=surfaceSmoothingActive()&&!strongSurfaceSmoothingActive(),smoothStrength=gpuSmooth?Number(surfaceSmoothStrength.value):0;
   const allowGpuResident=faceContext?.gpuResident!==false;
   let residentPosition=allowGpuResident?createGpuResidentFloat3Attribute(device,vertexCount,'VRL GPU resident position'):null,residentNormal=allowGpuResident&&gpuSmooth?createGpuResidentFloat3Attribute(device,vertexCount,'VRL GPU resident normal'):null;
   let gpuResident=allowGpuResident&&!!residentPosition&&(!gpuSmooth||!!residentNormal);
   if(!gpuResident){destroyGpuResidentAttribute(residentPosition);destroyGpuResidentAttribute(residentNormal);residentPosition=residentNormal=null}
   const output=gpuResident?residentPosition.buffer:device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
   const normalOutput=gpuSmooth?(gpuResident?residentNormal.buffer:device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})):null;
   const sx=faceContext.spacingX,sy=faceContext.spacingY,sz=faceContext.spacingZ,px=faceContext.globalW*sx,py=faceContext.globalH*sy,pz=faceContext.globalD*sz,scale=3.3/Math.max(px,py,pz,1);
   const gb=gpuSmallBuffer(device,new Float32Array([sx,sy,sz,scale,px,py,pz,0]));small.push(gb);
   let cornerA=null,cornerB=null,cornerCurrent=null;
   if(gpuSmooth){
    const cornerCount=(target.width+1)*(target.height+1)*(target.depth+1)*meta[10],cornerBytes=cornerCount*16;
    if(cornerBytes>maxOut){
     if(gpuResident){destroyGpuResidentAttribute(residentPosition);destroyGpuResidentAttribute(residentNormal)}else{output.destroy();normalOutput?.destroy()}
     releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();throw new Error('__GPU_SMOOTH_CAPACITY__')
    }
    cornerA=device.createBuffer({size:Math.max(16,cornerBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
    cornerB=device.createBuffer({size:Math.max(16,cornerBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
    const initPipeline=await gpuFilterPipeline('meshCornerInit'),initGroup=device.createBindGroup({layout:initPipeline.getBindGroupLayout(0),entries:[
     {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:cornerA}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:5,resource:{buffer:gb}}
    ]});
    await gpuValidationScope(device,'mesh corner init',async()=>{const initEncoder=device.createCommandEncoder({label:'VRL GPU corner init'}),pass=initEncoder.beginComputePass();pass.setPipeline(initPipeline);pass.setBindGroup(0,initGroup);pass.dispatchWorkgroups(Math.ceil(cornerCount/gpuFilterRuntime.workgroupSize));pass.end();device.queue.submit([initEncoder.finish()])});
    const baseStrength=Math.min(smoothStrength,1),lambda=.34*baseStrength,mu=-.36*baseStrength,iterations=Math.max(1,Math.round(smoothStrength<=1?2+smoothStrength*4:smoothStrength<=3?6+(smoothStrength-1)*18:42+(smoothStrength-3)*24));
    const smoothPipeline=await gpuFilterPipeline('meshCornerSmooth'),pbLambda=gpuSmallBuffer(device,new Float32Array([lambda,0,0,0])),pbMu=gpuSmallBuffer(device,new Float32Array([mu,0,0,0]));small.push(pbLambda,pbMu);let srcCorner=cornerA,dstCorner=cornerB;
    for(let k=0;k<iterations;k++)for(const pbSmooth of [pbLambda,pbMu]){
     const smoothGroup=device.createBindGroup({layout:smoothPipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:srcCorner}},{binding:1,resource:{buffer:dstCorner}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:pbSmooth}}
     ]});
     await gpuValidationScope(device,'mesh smooth pass',async()=>{const smoothEncoder=device.createCommandEncoder({label:'VRL GPU smooth pass'}),pass=smoothEncoder.beginComputePass();pass.setPipeline(smoothPipeline);pass.setBindGroup(0,smoothGroup);pass.dispatchWorkgroups(Math.ceil(cornerCount/gpuFilterRuntime.workgroupSize));pass.end();device.queue.submit([smoothEncoder.finish()])});
     const t=srcCorner;srcCorner=dstCorner;dstCorner=t;
    }
    cornerCurrent=srcCorner;
   }
   const writeEncoder=device.createCommandEncoder({label:gpuSmooth?'VRL GPU mesh write smooth':'VRL GPU mesh vertices'});
   const writeKind=gpuSmooth?'meshWriteSmooth':'meshWrite',writePipeline=await gpuFilterPipeline(writeKind),entries=[
    {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:output}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counters}}
   ];
   entries.push({binding:5,resource:{buffer:gpuSmooth?cornerCurrent:gb}});if(gpuSmooth)entries.push({binding:6,resource:{buffer:normalOutput}});
   const writeGroup=device.createBindGroup({layout:writePipeline.getBindGroupLayout(0),entries}),wp=writeEncoder.beginComputePass();wp.setPipeline(writePipeline);wp.setBindGroup(0,writeGroup);wp.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));wp.end();
   if(gpuResident){
    device.queue.submit([writeEncoder.finish()]);
    const cleanup=()=>{cornerA?.destroy();cornerB?.destroy();releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy()};
    const completion=finishGpuResidentTemps(device,cleanup);
    setGpuComputeBackend(gpuSmooth?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');
    return{mesh:true,gpuResident:true,positionAttribute:residentPosition.attribute,normalAttribute:residentNormal?.attribute||null,counts,gpuSmoothed:gpuSmooth,completion};
   }
   const readback=device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),normalReadback=gpuSmooth?device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;writeEncoder.copyBufferToBuffer(output,0,readback,0,vertexBytes);if(gpuSmooth)writeEncoder.copyBufferToBuffer(normalOutput,0,normalReadback,0,vertexBytes);device.queue.submit([writeEncoder.finish()]);
   await readback.mapAsync(GPUMapMode.READ);const vertices=new Float32Array(readback.getMappedRange().slice(0));readback.unmap();let normals=null;if(gpuSmooth){await normalReadback.mapAsync(GPUMapMode.READ);normals=new Float32Array(normalReadback.getMappedRange().slice(0));normalReadback.unmap()}
   output.destroy();normalOutput?.destroy();readback.destroy();normalReadback?.destroy();cornerA?.destroy();cornerB?.destroy();releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();
   setGpuComputeBackend(gpuSmooth?'WEBGPU FILTER+MESH+SMOOTH':'WEBGPU FILTER+MESH');return{mesh:true,vertices,normals,counts,gpuSmoothed:gpuSmooth};
  }
  counters.destroy();
  encoder=device.createCommandEncoder({label:'VRL compact face extraction'});
  // Oversized vertex output falls through to compact-face extraction using the already filtered GPU buffer.
 }
 const targetCount=target.width*target.height*target.depth,compactFaces=!!(segments?.length&&faceContext),targetBytes=targetCount*(compactFaces?8:4);
 const targetBuffer=device.createBuffer({size:Math.max(4,targetBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const extractMeta=new Uint32Array(20);extractMeta[0]=w;extractMeta[1]=h;extractMeta[2]=d;extractMeta[3]=target.x;extractMeta[4]=target.y;extractMeta[5]=target.z;extractMeta[6]=target.width;extractMeta[7]=target.height;extractMeta[8]=target.depth;extractMeta[9]=targetCount;
 let extractPipeline,extractGroup,counter=null,counterReadback=null;
 const emb=gpuSmallBuffer(device,extractMeta);small.push(emb);
 if(segments?.length){
  extractMeta[10]=Math.min(segments.length,4);
  if(faceContext){
   extractMeta[11]=faceContext.boxX;extractMeta[12]=faceContext.boxY;extractMeta[13]=faceContext.boxZ;
   extractMeta[14]=faceContext.globalW;extractMeta[15]=faceContext.globalH;extractMeta[16]=faceContext.globalD;
  }
  device.queue.writeBuffer(emb,0,extractMeta);
  const thresholdValues=new Float32Array(8);
  for(let i=0;i<Math.min(segments.length,4);i++){thresholdValues[i*2]=segments[i].seg.min;thresholdValues[i*2+1]=segments[i].seg.max}
  const tb=gpuSmallBuffer(device,thresholdValues);small.push(tb);
  extractPipeline=await gpuFilterPipeline(compactFaces?'faceCompact':'maskExtract');
  const entries=[{binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:targetBuffer}},{binding:2,resource:{buffer:emb}},{binding:3,resource:{buffer:tb}}];
  if(compactFaces){
   counter=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
   device.queue.writeBuffer(counter,0,new Uint32Array([0]));
   entries.push({binding:4,resource:{buffer:counter}});
  }
  extractGroup=device.createBindGroup({layout:extractPipeline.getBindGroupLayout(0),entries});
 }else{
  extractPipeline=await gpuFilterPipeline('extract');
  extractGroup=device.createBindGroup({layout:extractPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:targetBuffer}},{binding:2,resource:{buffer:emb}}
  ]});
 }
 const ep=encoder.beginComputePass();ep.setPipeline(extractPipeline);ep.setBindGroup(0,extractGroup);ep.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));ep.end();
 if(compactFaces){
  counterReadback=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  encoder.copyBufferToBuffer(counter,0,counterReadback,0,4);device.queue.submit([encoder.finish()]);
  await counterReadback.mapAsync(GPUMapMode.READ);const count=Math.min(targetCount,new Uint32Array(counterReadback.getMappedRange().slice(0))[0]);counterReadback.unmap();
  let items=new Uint32Array(0);
  if(count){
   const itemBytes=count*8,readback=device.createBuffer({size:itemBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),copyEncoder=device.createCommandEncoder({label:'VRL compact face readback'});
   copyEncoder.copyBufferToBuffer(targetBuffer,0,readback,0,itemBytes);device.queue.submit([copyEncoder.finish()]);
   await readback.mapAsync(GPUMapMode.READ);items=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();readback.destroy();
  }
  releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);targetBuffer.destroy();counter.destroy();counterReadback.destroy();for(const buf of small)buf.destroy();
  setGpuComputeBackend('WEBGPU FILTER+COMPACT FACES');return{compact:true,items};
 }
 const readback=device.createBuffer({size:targetBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 encoder.copyBufferToBuffer(targetBuffer,0,readback,0,targetBytes);device.queue.submit([encoder.finish()]);
 await readback.mapAsync(GPUMapMode.READ);
 const copy=readback.getMappedRange().slice(0),result=segments?.length?new Uint32Array(copy):new Float32Array(copy);readback.unmap();
 releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);targetBuffer.destroy();readback.destroy();for(const buf of small)buf.destroy();
 setGpuComputeBackend(segments?.length?'WEBGPU FILTER+MASK':'WEBGPU COMPUTE');return result;
}

const sourceSliceCache={map:new Map(),bytes:0},sourceOrthogonalPlaneCache=new Map();let sourceOrthogonalPlaneCacheBytes=0;
const mpr3DPreviewCache={token:0,signature:'',buildingSignature:'',building:false,min:0,max:1,planes:{axial:null,coronal:null,sagittal:null},dims:{axial:null,coronal:null,sagittal:null}};
function sourceSliceCacheLimit(){return navigator.maxTouchPoints>0?48*1024*1024:128*1024*1024}
function sourceOrthogonalCacheLimit(){return navigator.maxTouchPoints>0?32*1024*1024:64*1024*1024}
function clearMpr3DPreviewCache(){
 mpr3DPreviewCache.token++;mpr3DPreviewCache.signature='';mpr3DPreviewCache.buildingSignature='';mpr3DPreviewCache.building=false;mpr3DPreviewCache.planes={axial:null,coronal:null,sagittal:null};mpr3DPreviewCache.dims={axial:null,coronal:null,sagittal:null};
}
function clearSourceSliceCache(){cancelSourceMprWarmup();sourceSliceCache.map.clear();sourceSliceCache.bytes=0;sourceOrthogonalPlaneCache.clear();sourceOrthogonalPlaneCacheBytes=0;clearMpr3DPreviewCache()}
function mpr3DPreviewPlan(v){
 const touch=navigator.maxTouchPoints>0,target=touch?384:512,budget=(touch?96:192)*1024*1024,w=v.columns,h=v.rows,d=v.slices;
 const bytesFor=side=>{
  const aw=Math.min(w,side),ah=Math.min(h,side),cw=Math.min(w,side),ch=Math.min(d,side),sw=Math.min(h,side),sh=Math.min(d,side);
  return d*aw*ah+h*cw*ch+w*sw*sh;
 };
 let side=Math.min(target,Math.max(w,h,d));
 while(side>224&&bytesFor(side)>budget)side-=32;
 if(bytesFor(side)>budget)side=224;
 return{side,bytes:bytesFor(side)};
}
function mpr3DPreviewMap(i,n,outN){return outN<=1?0:Math.max(0,Math.min(n-1,Math.round(i*(n-1)/(outN-1))))}
function mpr3DPreviewSignature(v,stages=sourceFilterStages()){return [v?.series?.seriesUid||'',v?.columns||0,v?.rows||0,v?.slices||0,v?.min||0,v?.max||0,sourceFilterSignature(stages)].join('|')}
async function ensureMpr3DPreviewCache(){
 const v=volume;if(!v?.sourceBacked||!v.series)return false;
 const stages=sourceFilterStages(),signature=mpr3DPreviewSignature(v,stages);
 if(mpr3DPreviewCache.signature===signature&&mpr3DPreviewCache.planes.axial)return true;
 if(mpr3DPreviewCache.building&&mpr3DPreviewCache.buildingSignature===signature)return false;
 const token=++mpr3DPreviewCache.token,plan=mpr3DPreviewPlan(v),maxSide=plan.side,w=v.columns,h=v.rows,d=v.slices,series=v.series,min=Number.isFinite(v.min)?v.min:-1024,max=Number.isFinite(v.max)&&v.max>min?v.max:min+1,scale=255/(max-min);
 const dims={axial:[Math.min(w,maxSide),Math.min(h,maxSide)],coronal:[Math.min(w,maxSide),Math.min(d,maxSide)],sagittal:[Math.min(h,maxSide),Math.min(d,maxSide)]};
 const axial=new Uint8Array(d*dims.axial[0]*dims.axial[1]),coronal=new Uint8Array(h*dims.coronal[0]*dims.coronal[1]),sagittal=new Uint8Array(w*dims.sagittal[0]*dims.sagittal[1]);
 const axX=Array.from({length:dims.axial[0]},(_,i)=>mpr3DPreviewMap(i,w,dims.axial[0])),axY=Array.from({length:dims.axial[1]},(_,i)=>mpr3DPreviewMap(i,h,dims.axial[1]));
 const corX=Array.from({length:dims.coronal[0]},(_,i)=>mpr3DPreviewMap(i,w,dims.coronal[0])),sagY=Array.from({length:dims.sagittal[0]},(_,i)=>mpr3DPreviewMap(i,h,dims.sagittal[0]));
 const corRows=new Map(),sagRows=new Map();
 for(let py=0;py<dims.coronal[1];py++){const z=d-1-mpr3DPreviewMap(py,d,dims.coronal[1]);if(!corRows.has(z))corRows.set(z,[]);corRows.get(z).push(py)}
 for(let py=0;py<dims.sagittal[1];py++){const z=d-1-mpr3DPreviewMap(py,d,dims.sagittal[1]);if(!sagRows.has(z))sagRows.set(z,[]);sagRows.get(z).push(py)}
 const q=value=>Math.max(0,Math.min(255,Math.round((value-min)*scale))),blockDepth=stages.length?(navigator.maxTouchPoints>0?2:4):1;
 mpr3DPreviewCache.building=true;mpr3DPreviewCache.buildingSignature=signature;
 try{
  for(let z0=0;z0<d;z0+=blockDepth){
   if(token!==mpr3DPreviewCache.token||volume!==v)throw new Error('__SUPERSEDED__');
   let block=null,depth=Math.min(blockDepth,d-z0);
   if(stages.length){
    const filtered=await getFilteredSourceAxialBlock(z0,depth,series,'mpr3d-preview');
    if(token!==mpr3DPreviewCache.token||volume!==v)throw new Error('__SUPERSEDED__');
    block=filtered?.data;depth=filtered?.coreDepth||depth;
   }
   for(let local=0;local<depth;local++){
    const z=z0+local,src=block?block.subarray(local*w*h,(local+1)*w*h):await getCachedSourceSlice(series.slices[z]),aw=dims.axial[0],ah=dims.axial[1],aoff=z*aw*ah;
    for(let py=0;py<ah;py++){const sy=axY[py]*w,row=aoff+py*aw;for(let px=0;px<aw;px++)axial[row+px]=q(src[sy+axX[px]])}
    const cr=corRows.get(z);if(cr){const cw=dims.coronal[0],ch=dims.coronal[1];for(const py of cr)for(let y=0;y<h;y++){const row=y*cw*ch+py*cw,sy=y*w;for(let px=0;px<cw;px++)coronal[row+px]=q(src[sy+corX[px]])}}
    const sr=sagRows.get(z);if(sr){const sw=dims.sagittal[0],sh=dims.sagittal[1];for(const py of sr)for(let x=0;x<w;x++){const row=x*sw*sh+py*sw;for(let px=0;px<sw;px++)sagittal[row+px]=q(src[sagY[px]*w+x])}}
   }
   await frameYield();
  }
  if(token!==mpr3DPreviewCache.token||volume!==v)throw new Error('__SUPERSEDED__');
  mpr3DPreviewCache.signature=signature;mpr3DPreviewCache.min=min;mpr3DPreviewCache.max=max;mpr3DPreviewCache.dims=dims;mpr3DPreviewCache.planes={axial,coronal,sagittal};
  for(const p of ['axial','coronal','sagittal'])refreshMpr3DPlaneTexture(p);
  return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__')console.warn('3D MPR preview cache build failed.',e);
  return false;
 }finally{
  if(token===mpr3DPreviewCache.token){mpr3DPreviewCache.building=false;mpr3DPreviewCache.buildingSignature=''}
 }
}
function paintMpr3DPreview(p,idx,canvas){
 const data=mpr3DPreviewCache.planes[p],dims=mpr3DPreviewCache.dims[p];if(!data||!dims||!canvas||volumeAnalysisMode)return false;
 const [pw,ph]=dims,count=p==='axial'?volume.slices:p==='coronal'?volume.rows:volume.columns;if(idx<0||idx>=count)return false;
 if(canvas.width!==pw)canvas.width=pw;if(canvas.height!==ph)canvas.height=ph;
 const ctx=canvas.getContext('2d'),img=ctx.createImageData(pw,ph),sliceSize=pw*ph,off=idx*sliceSize,min=mpr3DPreviewCache.min,max=mpr3DPreviewCache.max,range=Math.max(max-min,1),low=+wc.value-(+ww.value)/2,gscale=255/Math.max(+ww.value,1),activeSegs=activeMprSegments();let qout=0;
 for(let py=0;py<ph;py++)for(let px=0;px<pw;px++){
  const hu=min+(data[off+py*pw+px]/255)*range,g=Math.max(0,Math.min(255,Math.round((hu-low)*gscale)));let rr=g,gg=g,bb=g;
  const ix=p==='sagittal'?idx:mpr3DPreviewMap(px,volume.columns,pw),iy=p==='coronal'?idx:(p==='sagittal'?mpr3DPreviewMap(px,volume.rows,pw):mpr3DPreviewMap(py,volume.rows,ph)),iz=p==='axial'?idx:volume.slices-1-mpr3DPreviewMap(py,volume.slices,ph);
  for(const item of activeSegs){const {key,seg,edit,processedMask,processedRuns,rgb,alpha}=item,inside=processedRuns?analysisRunsContain(processedRuns,ix,iy,iz):(segmentEditActive(key)&&edit.finalRuns?analysisRunsContain(edit.finalRuns,ix,iy,iz):(processedMask?processedMask[iz*volume.rows*volume.columns+iy*volume.columns+ix]===1:(hu>=seg.min&&hu<=seg.max)));if(!inside)continue;rr=Math.round(rr*(1-alpha)+rgb[0]*alpha);gg=Math.round(gg*(1-alpha)+rgb[1]*alpha);bb=Math.round(bb*(1-alpha)+rgb[2]*alpha)}
  img.data[qout++]=rr;img.data[qout++]=gg;img.data[qout++]=bb;img.data[qout++]=255;
 }
 ctx.putImageData(img,0,0);return true;
}
function sourceOrthogonalCacheGet(p,idx){
 const key=p+':'+idx,v=sourceOrthogonalPlaneCache.get(key);if(!v)return null;sourceOrthogonalPlaneCache.delete(key);sourceOrthogonalPlaneCache.set(key,v);return v;
}
function sourceOrthogonalCacheSet(p,idx,v){
 const key=p+':'+idx,old=sourceOrthogonalPlaneCache.get(key);if(old)sourceOrthogonalPlaneCacheBytes-=old.byteLength;
 sourceOrthogonalPlaneCache.delete(key);sourceOrthogonalPlaneCache.set(key,v);sourceOrthogonalPlaneCacheBytes+=v.byteLength;
 const limit=sourceOrthogonalCacheLimit();
 while(sourceOrthogonalPlaneCacheBytes>limit&&sourceOrthogonalPlaneCache.size>1){
  const first=sourceOrthogonalPlaneCache.keys().next().value,item=sourceOrthogonalPlaneCache.get(first);sourceOrthogonalPlaneCache.delete(first);sourceOrthogonalPlaneCacheBytes-=item.byteLength;
 }
}
async function buildSourceOrthogonalPlane(p,idx,series,revision){
 const cached=sourceOrthogonalCacheGet(p,idx);if(cached)return cached;
 const dims=p==='coronal'?[series.columns,series.slices.length]:[series.rows,series.slices.length],out=new Float32Array(dims[0]*dims[1]);
 for(let z=0;z<series.slices.length;z++){
  if(revision!==planeRenderRevision[p])throw new Error('__SUPERSEDED__');
  const meta=series.slices[z],base=(series.slices.length-1-z)*dims[0];
  if(p==='coronal'){
   const row=await readSourceRows(meta,idx,1);out.set(row.subarray(0,series.columns),base);
  }else{
   const full=await getCachedSourceSlice(meta);
   for(let y=0;y<series.rows;y++)out[base+y]=full[y*series.columns+idx];
  }
  if((z&31)===0)await frameYield();
 }
 if(revision!==planeRenderRevision[p])throw new Error('__SUPERSEDED__');
 sourceOrthogonalCacheSet(p,idx,out);return out;
}
async function buildSourceOrthogonalNeighborhood(p,idx,series,revision){
 return buildSourceOrthogonalPlane(p,idx,series,revision);
}
async function getCachedSourceSlice(meta){
 const hit=sourceSliceCache.map.get(meta);
 if(hit){sourceSliceCache.map.delete(meta);sourceSliceCache.map.set(meta,hit);return hit}
 const data=await decodeSourceSlice(meta);sourceSliceCache.map.set(meta,data);sourceSliceCache.bytes+=data.byteLength;
 const limit=sourceSliceCacheLimit();
 while(sourceSliceCache.bytes>limit&&sourceSliceCache.map.size>1){
  const key=sourceSliceCache.map.keys().next().value,item=sourceSliceCache.map.get(key);sourceSliceCache.map.delete(key);sourceSliceCache.bytes-=item.byteLength;
 }
 return data;
}
const sourceFilterRuntime={revision:0,workers:[],queue:[],nextId:0,cache:new Map(),cacheBytes:0};
function sourceFilterWorkerMain(){
 function gaussian(input,w,h,d,p){const n=input.length,s=p.strength,r=Math.max(1,Math.round(p.passes));let a=new Float32Array(input),b=new Float32Array(n);for(let rr=0;rr<r;rr++)for(const [dx,dy,dz] of [[1,0,0],[0,1,0],[0,0,1]]){for(let z=0;z<d;z++)for(let y=0;y<h;y++){const row=z*h*w+y*w;for(let x=0;x<w;x++){const i=row+x,x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx),y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy),z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz),i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1,blur=(a[i0]+2*a[i]+a[i1])*.25;b[i]=a[i]*(1-s)+blur*s}}const t=a;a=b;b=t}return a}
 function median(input,w,h,d,p){const n=input.length,s=p.strength,r=Math.max(1,Math.round(p.passes)),vals=new Float32Array(7);let a=new Float32Array(input),b=new Float32Array(n);for(let rr=0;rr<r;rr++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x;vals[0]=a[i];vals[1]=a[i-1];vals[2]=a[i+1];vals[3]=a[i-w];vals[4]=a[i+w];vals[5]=a[i-w*h];vals[6]=a[i+w*h];for(let q=1;q<7;q++){const v=vals[q];let j=q-1;while(j>=0&&vals[j]>v){vals[j+1]=vals[j];j--}vals[j+1]=v}b[i]=a[i]*(1-s)+vals[3]*s}}const t=a;a=b;b=t}return a}
 function spike(input,w,h,d,min,max,p){const out=new Float32Array(input),s=p.strength,range=Math.max(1,max-min),th=range*p.threshold,guard=th*(.55+.35*s),blend=.20+.75*s;for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=input[i],a=input[i-1],b=input[i+1],c0=input[i-w],d0=input[i+w],e=input[i-w*h],f=input[i+w*h],mean=(a+b+c0+d0+e+f)/6,spread=Math.max(a,b,c0,d0,e,f)-Math.min(a,b,c0,d0,e,f),diff=c-mean;if(spread<=guard&&Math.abs(diff)>th){const target=mean+Math.sign(diff)*th*.08;out[i]=c*(1-blend)+target*blend}}}return out}
 function nlm(input,w,h,d,min,max,p){const out=new Float32Array(input.length),range=Math.max(1,max-min),hp=range*(.018+.11*p.strength),h2=hp*hp,sr=Math.max(1,Math.round(p.searchRadius)),pr=Math.max(0,Math.round(p.patchRadius)),offs=[];for(let dz=-sr;dz<=sr;dz++)for(let dy=-sr;dy<=sr;dy++)for(let dx=-sr;dx<=sr;dx++)if(dx||dy||dz)offs.push([dx,dy,dz]);const patch=[[0,0,0]];for(let r=1;r<=pr;r++)patch.push([r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]);const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),sample=(x,y,z)=>input[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const center=input[z*h*w+y*w+x];let weighted=center,ws=1;for(const [dx,dy,dz] of offs){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;let dist=0;for(const [px,py,pz] of patch){const dv=sample(x+px,y+py,z+pz)-sample(nx+px,ny+py,nz+pz);dist+=dv*dv}dist/=patch.length;const weight=Math.exp(-dist/Math.max(h2,1e-6));weighted+=weight*input[nz*h*w+ny*w+nx];ws+=weight}out[z*h*w+y*w+x]=weighted/ws}return out}
 function anisotropic(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),k=range*(.025+.09*p.strength),k2=k*k,lambda=.06+.14*p.strength,it=Math.max(1,Math.round(p.iterations));let a=new Float32Array(input),b=new Float32Array(n);for(let iter=0;iter<it;iter++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;for(const nv of [a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]]){const diff=nv-c;flux+=Math.exp(-(diff*diff)/Math.max(k2,1e-6))*diff}b[i]=c+lambda*flux}}const t=a;a=b;b=t}return a}
 function bilateral(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),s=p.strength,ss=p.spatialSigma,is=Math.max(1e-6,p.intensitySigma*range),passes=Math.max(1,Math.round(p.passes)),r=Math.max(1,Math.min(3,Math.ceil(ss*1.5))),sp2=2*ss*ss,int2=2*is*is,offs=[];for(let dz=-r;dz<=r;dz++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)offs.push([dx,dy,dz,Math.exp(-(dx*dx+dy*dy+dz*dz)/sp2)]);let a=new Float32Array(input),b=new Float32Array(n);for(let pass=0;pass<passes;pass++){for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=z*h*w+y*w+x,center=a[i];let sum=0,ws=0;for(const [dx,dy,dz,sw] of offs){const xx=x+dx,yy=y+dy,zz=z+dz;if(xx<0||yy<0||zz<0||xx>=w||yy>=h||zz>=d)continue;const j=zz*h*w+yy*w+xx,dv=a[j]-center,ww=sw*Math.exp(-(dv*dv)/int2);sum+=a[j]*ww;ws+=ww}const filtered=ws?sum/ws:center;b[i]=center*(1-s)+filtered*s}const t=a;a=b;b=t}return a}
 function tv(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),it=Math.max(1,Math.round(p.iterations)),lambda=Math.min(.18,.02+p.weight*.45),eps=range*1e-4;let a=new Float32Array(input),b=new Float32Array(n);for(let iter=0;iter<it;iter++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;for(const nv of [a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]]){const diff=nv-c;flux+=diff/Math.sqrt(diff*diff+eps*eps)}b[i]=c+lambda*flux}}const t=a;a=b;b=t}return a}
 function box(input,w,h,d,radius){const out=new Float32Array(input.length),r=Math.max(1,Math.round(radius));for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,count=0;for(let dz=-r;dz<=r;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=input[zz*h*w+yy*w+xx];count++}}}out[z*h*w+y*w+x]=sum/Math.max(1,count)}return out}
 function unsharp(input,w,h,d,min,max,p){const blur=box(input,w,h,d,p.radius),out=new Float32Array(input.length),range=Math.max(1,max-min),th=p.threshold*range;for(let i=0;i<input.length;i++){const detail=input[i]-blur[i];out[i]=Math.abs(detail)>=th?input[i]+p.amount*detail:input[i]}return out}
 function sigmoid(input,min,max,p){const out=new Float32Array(input.length),range=Math.max(1,max-min),gain=2+p.strength*10,cv=Math.max(min,Math.min(max,p.center)),center=(cv-min)/range,lo=1/(1+Math.exp(gain*center)),hi=1/(1+Math.exp(-gain*(1-center))),norm=Math.max(1e-6,hi-lo);for(let i=0;i<input.length;i++){const x=Math.max(0,Math.min(1,(input[i]-min)/range)),y=(1/(1+Math.exp(-gain*(x-center)))-lo)/norm;out[i]=min+Math.max(0,Math.min(1,y))*range}return out}
 function stage(input,w,h,d,min,max,s){const p=s.params;if(s.key==='spikeHole')return spike(input,w,h,d,min,max,p);if(s.key==='nlm')return nlm(input,w,h,d,min,max,p);if(s.key==='anisotropic')return anisotropic(input,w,h,d,min,max,p);if(s.key==='gaussian')return p.mode==='median'?median(input,w,h,d,p):gaussian(input,w,h,d,p);if(s.key==='sigmoid')return sigmoid(input,min,max,p);if(s.key==='bilateral')return bilateral(input,w,h,d,min,max,p);if(s.key==='tv')return tv(input,w,h,d,min,max,p);if(s.key==='unsharp')return unsharp(input,w,h,d,min,max,p);return input}
 function extract(data,w,h,t){const out=new Float32Array(t.width*t.height*t.depth);let q=0;for(let z=0;z<t.depth;z++)for(let y=0;y<t.height;y++){const src=((t.z+z)*h+(t.y+y))*w+t.x;out.set(data.subarray(src,src+t.width),q);q+=t.width}return out}
 onmessage=e=>{const m=e.data||{};if(m.type!=='process')return;try{let data=new Float32Array(m.buffer);for(const s of m.stages)data=stage(data,m.w,m.h,m.d,m.min,m.max,s);const out=extract(data,m.w,m.h,m.target);postMessage({id:m.id,buffer:out.buffer},[out.buffer])}catch(error){postMessage({id:m.id,error:String(error?.message||error)})}};
}
function sourceFilterStages(){
 return filterOrder.filter(key=>filterState[key]).map(key=>{
  let params={};
  if(key==='spikeHole')params={strength:+spikeHoleStrength.value,threshold:+spikeHoleThreshold.value};
  else if(key==='nlm')params={strength:+nlmStrength.value,searchRadius:+nlmSearchRadius.value,patchRadius:+nlmPatchRadius.value};
  else if(key==='anisotropic')params={strength:+anisotropicStrength.value,iterations:+anisotropicIterations.value};
  else if(key==='gaussian')params={mode:smoothingType.value,strength:+gaussianStrength.value,passes:+spatialPasses.value};
  else if(key==='sigmoid')params={strength:+sigmoidStrength.value,center:+sigmoidCenter.value};
  else if(key==='bilateral')params={strength:+bilateralStrength.value,spatialSigma:+bilateralSpatial.value,intensitySigma:+bilateralIntensity.value,passes:+bilateralPasses.value};
  else if(key==='tv')params={weight:+tvWeight.value,iterations:+tvIterations.value};
  else if(key==='unsharp')params={radius:+unsharpRadius.value,amount:+unsharpAmount.value,threshold:+unsharpThreshold.value};
  return{key,params};
 });
}
function sourceFilterHalo(stages){
 let halo=0;
 for(const s of stages){
  if(s.key==='spikeHole')halo+=1;
  else if(s.key==='nlm')halo+=Math.max(1,Math.round(s.params.searchRadius))+Math.max(0,Math.round(s.params.patchRadius));
  else if(s.key==='anisotropic')halo+=Math.max(1,Math.round(s.params.iterations));
  else if(s.key==='gaussian')halo+=Math.max(1,Math.round(s.params.passes));
  else if(s.key==='bilateral')halo+=Math.max(1,Math.min(3,Math.ceil(s.params.spatialSigma*1.5)))*Math.max(1,Math.round(s.params.passes));
  else if(s.key==='tv')halo+=Math.max(1,Math.round(s.params.iterations));
  else if(s.key==='unsharp')halo+=Math.max(1,Math.round(s.params.radius));
 }
 return halo;
}
function sourceFilterSignature(stages=sourceFilterStages()){return JSON.stringify(stages)}
function sourceFilterCacheLimit(){
 const touch=navigator.maxTouchPoints>0;return touch?48*1024*1024:128*1024*1024;
}
function sourceFilterCacheGet(key){
 const hit=sourceFilterRuntime.cache.get(key);if(!hit)return null;
 sourceFilterRuntime.cache.delete(key);sourceFilterRuntime.cache.set(key,hit);return hit;
}
function sourceFilterCacheSet(key,data){
 const copy=data;
 sourceFilterRuntime.cache.set(key,copy);sourceFilterRuntime.cacheBytes+=copy.byteLength;
 const limit=sourceFilterCacheLimit();
 while(sourceFilterRuntime.cacheBytes>limit&&sourceFilterRuntime.cache.size>1){
  const first=sourceFilterRuntime.cache.keys().next().value,item=sourceFilterRuntime.cache.get(first);
  sourceFilterRuntime.cache.delete(first);sourceFilterRuntime.cacheBytes-=item.byteLength;
 }
}
function disposeSourceFilterWorkers(){
 const error=new Error('__SUPERSEDED__');
 for(const task of sourceFilterRuntime.queue)task.reject(error);sourceFilterRuntime.queue=[];
 for(const slot of sourceFilterRuntime.workers){if(slot.current)slot.current.reject(error);try{slot.worker.terminate()}catch{}}
 sourceFilterRuntime.workers=[];
}
function invalidateSourceFilters(){
 sourceFilterRuntime.revision++;sourceRenderRevision++;
 sourceFilterRuntime.cache.clear();sourceFilterRuntime.cacheBytes=0;disposeSourceFilterWorkers();
}
function createSourceFilterSlot(){
 const source='('+sourceFilterWorkerMain.toString()+')()',url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),1000);
 const slot={worker,busy:false,current:null};
 worker.onmessage=e=>{const task=slot.current;if(!task)return;slot.current=null;slot.busy=false;if(e.data?.error)task.reject(new Error(e.data.error));else task.resolve(new Float32Array(e.data.buffer));pumpSourceFilterWorkers()};
 worker.onerror=e=>{const task=slot.current;slot.current=null;slot.busy=false;if(task)task.reject(new Error(e.message||'Source filter worker failed'));pumpSourceFilterWorkers()};
 return slot;
}
function ensureSourceFilterWorkers(){
 if(sourceFilterRuntime.workers.length)return;
 const count=navigator.maxTouchPoints>0?1:Math.min(2,Math.max(1,(navigator.hardwareConcurrency||2)-1));
 for(let i=0;i<count;i++)sourceFilterRuntime.workers.push(createSourceFilterSlot());
}
function pumpSourceFilterWorkers(){
 ensureSourceFilterWorkers();
 for(const slot of sourceFilterRuntime.workers){
  if(slot.busy)continue;const task=sourceFilterRuntime.queue.shift();if(!task)break;
  slot.busy=true;slot.current=task;
  const m=task.message;slot.worker.postMessage(m,[m.buffer]);
 }
}
function runSourceFilterWorker(message,key){
 ensureSourceFilterWorkers();
 for(let i=sourceFilterRuntime.queue.length-1;i>=0;i--)if(sourceFilterRuntime.queue[i].key===key){sourceFilterRuntime.queue[i].reject(new Error('__SUPERSEDED__'));sourceFilterRuntime.queue.splice(i,1)}
 return new Promise((resolve,reject)=>{sourceFilterRuntime.queue.push({message,key,resolve,reject});pumpSourceFilterWorkers()});
}
async function readSourceSubregion(meta,x0,y0,width,height,preferFullSliceCache=false){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(preferFullSliceCache||!isNativeDicomTransferSyntax(meta.ts)){
  const full=await getCachedSourceSlice(meta),out=new Float32Array(width*height);let q=0;
  for(let y=0;y<height;y++){out.set(full.subarray((y0+y)*meta.columns+x0,(y0+y)*meta.columns+x0+width),q);q+=width}
  return out;
 }
 if(meta.pixelOffset==null){
  const full=await decodeSourceSlice(meta),out=new Float32Array(width*height);let q=0;
  for(let y=0;y<height;y++){out.set(full.subarray((y0+y)*meta.columns+x0,(y0+y)*meta.columns+x0+width),q);q+=width}
  return out;
 }
 const firstPixel=y0*meta.columns+x0,lastPixel=(y0+height-1)*meta.columns+x0+width,start=meta.pixelOffset+firstPixel*bpp,end=meta.pixelOffset+lastPixel*bpp;
 const bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),little=meta.ts!=='1.2.840.10008.1.2.2',out=new Float32Array(width*height);
 let q=0;
 for(let y=0;y<height;y++){
  const rowBase=y*meta.columns*bpp;
  for(let x=0;x<width;x++){
   const off=rowBase+x*bpp;let raw;
   if(meta.bits===8){raw=bytes[off];if(meta.signed&&raw>127)raw-=256}
   else raw=meta.signed?view.getInt16(off,little):view.getUint16(off,little);
   out[q++]=raw*meta.slope+meta.intercept;
  }
 }
 return out;
}
async function readSourceRegion(series,box,revision,preferFullSliceCache=false){
 const out=new Float32Array(box.width*box.height*box.depth),plane=box.width*box.height;
 for(let z=0;z<box.depth;z++){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const part=await readSourceSubregion(series.slices[box.z+z],box.x,box.y,box.width,box.height,preferFullSliceCache);out.set(part,z*plane);
  if((z&1)===1)await frameYield();
 }
 return out;
}
async function processSourceRegion(series,target,stages,key,revision,preferFullSliceCache=false){
 if(!stages.length)throw new Error('No source filters');
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,preferFullSliceCache);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const gpuResult=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget);
   if(gpuResult){
    if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
    return gpuResult;
   }
  }catch(e){
   gpuFilterRuntime.lastError='filter: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU filter execution failed; using CPU worker.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:localTarget};
 const result=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return result;
}
function valuesToSegmentBits(values,segments){
 const out=new Uint32Array(values.length);
 for(let i=0;i<values.length;i++){const v=values[i];let bits=0;for(let s=0;s<segments.length&&s<4;s++)if(v>=segments[s].seg.min&&v<=segments[s].seg.max)bits|=(1<<s);out[i]=bits}
 return out;
}
async function processSourceRegionMasks(series,target,stages,key,revision,segments){
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const bits=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments);
   if(bits instanceof Uint32Array){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return bits}
  }catch(e){
   gpuFilterRuntime.lastError='mask: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU mask execution failed; using exact CPU mask path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:localTarget};
 const values=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return valuesToSegmentBits(values,segments);
}
function valuesToFaceFlags(values,w,h,d,target,segments,box,series){
 const out=new Uint32Array(target.width*target.height*target.depth);let q=0;
 const local=(x,y,z)=>values[z*w*h+y*w+x],inside=(v,s)=>v>=segments[s].seg.min&&v<=segments[s].seg.max;
 for(let tz=0;tz<target.depth;tz++)for(let ty=0;ty<target.height;ty++)for(let tx=0;tx<target.width;tx++){
  const x=target.x+tx,y=target.y+ty,z=target.z+tz,gx=box.x+x,gy=box.y+y,gz=box.z+z,center=local(x,y,z);let packed=0;
  for(let s=0;s<segments.length&&s<4;s++){
   if(!inside(center,s))continue;let faces=0;
   if(gx===0||!inside(local(x-1,y,z),s))faces|=1;
   if(gx+1>=series.columns||!inside(local(x+1,y,z),s))faces|=2;
   if(gy===0||!inside(local(x,y-1,z),s))faces|=4;
   if(gy+1>=series.rows||!inside(local(x,y+1,z),s))faces|=8;
   if(gz===0||!inside(local(x,y,z-1),s))faces|=16;
   if(gz+1>=series.slices.length||!inside(local(x,y,z+1),s))faces|=32;
   packed|=faces<<(s*6);
  }
  out[q++]=packed;
 }
 return out;
}
function compactFaceFlags(flags){
 let count=0;for(let i=0;i<flags.length;i++)if(flags[i])count++;
 const items=new Uint32Array(count*2);let q=0;
 for(let i=0;i<flags.length;i++)if(flags[i]){items[q++]=i;items[q++]=flags[i]}
 return{compact:true,items};
}
async function processSourceRegionFaces(series,target,stages,key,revision,segments,gpuResident=true){
 const halo=Math.max(1,sourceFilterHalo(stages)),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const compact=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:series.columns,globalH:series.rows,globalD:series.slices.length,spacingX:series.spacingX,spacingY:series.spacingY,spacingZ:series.spacingZ,mesh:true,gpuResident});
   if(compact?.mesh||compact?.compact){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return compact}
  }catch(e){
   if(gpuCapacityError(e))throw e;
   gpuFilterRuntime.lastError='mesh: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU face extraction failed; using exact CPU face extraction path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:{x:0,y:0,z:0,width:box.width,height:box.height,depth:box.depth}};
 const filtered=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return compactFaceFlags(valuesToFaceFlags(filtered,box.width,box.height,box.depth,localTarget,segments,box,series));
}
function sourceTileBudget(){
 if(navigator.maxTouchPoints>0)return 8*1024*1024;
 if(isDesktopMac()&&gpuFilterRuntime.device){const cap=Number(gpuFilterRuntime.device.limits?.maxStorageBufferBindingSize)||128*1024*1024;return Math.max(16*1024*1024,Math.min(32*1024*1024,Math.floor(cap*.25)))}
 return 16*1024*1024;
}
function fitSourceTile(a,b,fixed,halo,startA,startB){
 let ca=Math.max(1,Math.min(a,startA)),cb=Math.max(1,Math.min(b,startB)),budget=sourceTileBudget();
 const bytes=()=>Math.min(a,ca+2*halo)*Math.min(b,cb+2*halo)*Math.max(1,fixed+2*halo)*4;
 while(bytes()>budget&&(ca>16||cb>16)){if(ca>=cb&&ca>16)ca=Math.max(16,Math.floor(ca/2));else if(cb>16)cb=Math.max(16,Math.floor(cb/2));else break}
 return[ca,cb];
}
async function getFilteredSourcePlaneValues(p,idx,series,keyPrefix='mpr',requestRevision=null){
 const stages=sourceFilterStages();if(!stages.length)return null;const stale=()=>requestRevision!=null&&requestRevision!==planeRenderRevision[p];if(stale())throw new Error('__SUPERSEDED__');
 const signature=sourceFilterSignature(stages),cacheKey=signature+'|'+p+'|'+idx,hit=sourceFilterCacheGet(cacheKey);if(hit)return hit;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages);
 let out;
 if(p==='axial'){
  out=new Float32Array(w*h);const [tx,ty]=fitSourceTile(w,h,1,halo,512,192);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegion(series,{x,y,z:idx,width:tw,height:th,depth:1},stages,keyPrefix+':axial',revision,true);
   for(let yy=0;yy<th;yy++)out.set(tile.subarray(yy*tw,(yy+1)*tw),(y+yy)*w+x);
  }
 }else if(p==='coronal'){
  out=new Float32Array(w*d);const [tx,tz]=fitSourceTile(w,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let x=0;x<w;x+=tx){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),td=Math.min(tz,d-z),tile=await processSourceRegion(series,{x,y:idx,z,width:tw,height:1,depth:td},stages,keyPrefix+':coronal',revision);
   for(let zz=0;zz<td;zz++)out.set(tile.subarray(zz*tw,(zz+1)*tw),(d-1-(z+zz))*w+x);
  }
 }else{
  out=new Float32Array(h*d);const [ty,tz]=fitSourceTile(h,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let y=0;y<h;y+=ty){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const th=Math.min(ty,h-y),td=Math.min(tz,d-z),tile=await processSourceRegion(series,{x:idx,y,z,width:1,height:th,depth:td},stages,keyPrefix+':sagittal',revision);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++)out[(d-1-(z+zz))*h+y+yy]=tile[zz*th+yy];
  }
 }
 if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');sourceFilterCacheSet(cacheKey,out);return out;
}
async function getFilteredSourceAxialBlock(zStart,coreDepth,series,keyPrefix='3d-block'){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages),outDepth=Math.min(d-zStart,coreDepth+(zStart+coreDepth<d?1:0));
 const out=new Float32Array(w*h*outDepth),[tx,ty]=fitSourceTile(w,h,outDepth,halo,384,128);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegion(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart,revision,true);
  for(let zz=0;zz<outDepth;zz++)for(let yy=0;yy<th;yy++){
   const src=(zz*th+yy)*tw,dst=(zz*h+y+yy)*w+x;
   out.set(tile.subarray(src,src+tw),dst);
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{data:out,depth:outDepth,coreDepth:Math.min(coreDepth,d-zStart)};
}
async function getFilteredSourceAxialFaceBlock(zStart,coreDepth,series,segments,keyPrefix='3d-face-block'){
 const stages=sourceFilterStages();
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=Math.max(1,sourceFilterHalo(stages)),outDepth=Math.min(d-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(w,h,outDepth,halo,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(w,h,d,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,w-x),height:Math.min(ty,h-y),depth:outDepth});
 while(queue.length){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const target=queue.shift();
  try{
   const compact=await processSourceRegionFaces(series,target,stages,keyPrefix+':'+zStart+':'+target.x+':'+target.y,revision,segments,gpuResident);
   if(compact.mesh){if(compact.gpuResident||compact.vertices?.length)tiles.push(compact);}
   else if(compact.items.length)tiles.push({...target,items:compact.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{tiles,coreDepth:outDepth};
}
async function getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,segments,keyPrefix='3d-mask-block'){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages),outDepth=Math.min(d-zStart,coreDepth+(zStart+coreDepth<d?1:0));
 const out=new Uint32Array(w*h*outDepth),[tx,ty]=fitSourceTile(w,h,outDepth,halo,384,128);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegionMasks(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart,revision,segments);
  for(let zz=0;zz<outDepth;zz++)for(let yy=0;yy<th;yy++){
   const src=(zz*th+yy)*tw,dst=(zz*h+y+yy)*w+x;
   out.set(tile.subarray(src,src+tw),dst);
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{data:out,depth:outDepth,coreDepth:Math.min(coreDepth,d-zStart)};
}
function segmentMasksFromBits(bits,segments){
 const blockSize=16384,states=new Map(segments.map(({key})=>[key,{mask:new Uint8Array(bits.length),blocks:[],block:new Uint32Array(blockSize),used:0}]));
 for(let i=0;i<bits.length;i++){
  const value=bits[i];if(!value)continue;
  for(let s=0;s<segments.length&&s<4;s++)if(value&(1<<s)){
   const state=states.get(segments[s].key);state.mask[i]=1;
   if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}
   state.block[state.used++]=i;
  }
 }
 for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used}
 return states;
}
function segmentMasksFromValues(data,segments){
 const blockSize=16384,states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(data.length),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
 for(let i=0;i<data.length;i++){const v=data[i];for(const state of states.values())if(v>=state.min&&v<=state.max){state.mask[i]=1;if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}state.block[state.used++]=i}}
 for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used;delete state.min;delete state.max}
 return states;
}

function readMemoryRegion(v,box){
 const out=new Float32Array(box.width*box.height*box.depth),src=v.data,w=v.columns,h=v.rows;let q=0;
 for(let z=0;z<box.depth;z++)for(let y=0;y<box.height;y++){
  const off=((box.z+z)*h+(box.y+y))*w+box.x;
  out.set(src.subarray(off,off+box.width),q);q+=box.width;
 }
 return out;
}
async function processMemoryRegion(v,target,stages){
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,stages,local);
 if(!(result instanceof Float32Array))throw new Error('__GPU_UNAVAILABLE__');
 return result;
}
async function applyGpuFiltersToMemoryVolume(v,stages,revision){
 const w=v.columns,h=v.rows,d=v.slices,out=new Float32Array(w*h*d),halo=sourceFilterHalo(stages),coreDepth=gpuMeshBlockDepth(),[tx,ty]=fitSourceTile(w,h,coreDepth,halo,navigator.maxTouchPoints>0?256:(isDesktopMac()?512:384),navigator.maxTouchPoints>0?96:(isDesktopMac()?160:128));
 for(let z=0;z<d;z+=coreDepth){
  const td=Math.min(coreDepth,d-z);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(revision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processMemoryRegion(v,{x,y,z,width:tw,height:th,depth:td},stages);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++){
    const src=(zz*th+yy)*tw,dst=((z+zz)*h+y+yy)*w+x;out.set(tile.subarray(src,src+tw),dst);
   }
  }
  progress(Math.min(d,z+td),d);await frameYield();
 }
 if(revision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
 return out;
}
async function processMemoryMeshRegion(v,target,segments,gpuResident=true){
 const halo=1,x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const [sx,sy,sz]=v.spacing;
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,[],local,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:v.columns,globalH:v.rows,globalD:v.slices,spacingX:sx,spacingY:sy,spacingZ:sz,mesh:true,gpuResident});
 if(result?.mesh||result?.compact)return result;
 throw new Error('__GPU_UNAVAILABLE__');
}
async function getMemoryGpuMeshBlock(v,zStart,coreDepth,segments){
 const outDepth=Math.min(v.slices-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(v.columns,v.rows,outDepth,1,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(v.columns,v.rows,v.slices,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<v.rows;y+=ty)for(let x=0;x<v.columns;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,v.columns-x),height:Math.min(ty,v.rows-y),depth:outDepth});
 while(queue.length){
  const target=queue.shift();
  try{
   const result=await processMemoryMeshRegion(v,target,segments,gpuResident);
   if(result.mesh){if(result.gpuResident||result.vertices?.length)tiles.push(result)}
   else if(result.items.length)tiles.push({...target,items:result.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 return{tiles,coreDepth:outDepth};
}
function enableProcessingControls(enabled){
 if(!enabled){filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;filterOrder=[]}
 gaussianBtn.disabled=!enabled;smoothingType.disabled=!enabled||!filterState.gaussian;spikeHoleBtn.disabled=!enabled;nlmBtn.disabled=!enabled;anisotropicBtn.disabled=!enabled;sigmoidBtn.disabled=!enabled;bilateralBtn.disabled=!enabled;tvBtn.disabled=!enabled;unsharpBtn.disabled=!enabled;filterAddSelect.disabled=!enabled;filterAddButton.disabled=!enabled;
 filterAddSelect.title=volume?.sourceBacked?'フル解像度チャンク処理':'';filterAddButton.title='';
 resetFilterBtn.disabled=!enabled;
 surfaceSmoothEnabled.disabled=!enabled;
 surfaceSmoothStrength.disabled=!enabled||!surfaceSmoothEnabled.checked;
 syncFilterControls();
}
function cloneVolumeWithData(base,data){
 return{data,columns:base.columns,rows:base.rows,slices:base.slices,spacing:[...base.spacing],min:base.min,max:base.max,storage:data.constructor.name,sourceBacked:false};
}
async function applyGaussian3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Gaussian 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data;
  const strength=+gaussianStrength.value;
  let a=new Float32Array(src),b=new Float32Array(n);
  const axes=[[1,0,0],[0,1,0],[0,0,1]];
  const rounds=Math.max(1,Math.round(+spatialPasses.value));
  for(let round=0;round<rounds;round++)for(let pass=0;pass<axes.length;pass++){
   const [dx,dy,dz]=axes[pass];
   for(let z=0;z<d;z++){
    for(let y=0;y<h;y++){
     const row=z*h*w+y*w;
     for(let x=0;x<w;x++){
      const i=row+x;
      const x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx);
      const y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy);
      const z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz);
      const i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1;
      const blurred=(a[i0]+2*a[i]+a[i1])*.25;
      b[i]=a[i]*(1-strength)+blurred*strength;
     }
    }
    if((z&15)===0){progress((round*axes.length+pass)*d+z+1,rounds*axes.length*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Gaussian 3D · live '+(+gaussianStrength.value).toFixed(2);
 }catch(e){console.error(e);footer.textContent='Gaussian error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyMedian3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Median 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data;
  const strength=+gaussianStrength.value;
  let a=new Float32Array(src),b=new Float32Array(n);
  const rounds=Math.max(1,Math.round(+spatialPasses.value));
  const vals=new Float32Array(7);
  for(let round=0;round<rounds;round++){
   b.set(a);
   for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){
     const row=z*h*w+y*w;
     for(let x=1;x<w-1;x++){
      const i=row+x;
      vals[0]=a[i];vals[1]=a[i-1];vals[2]=a[i+1];vals[3]=a[i-w];vals[4]=a[i+w];vals[5]=a[i-w*h];vals[6]=a[i+w*h];
      for(let p=1;p<7;p++){const v=vals[p];let q=p-1;while(q>=0&&vals[q]>v){vals[q+1]=vals[q];q--}vals[q+1]=v}
      const median=vals[3];
      b[i]=a[i]*(1-strength)+median*strength;
     }
    }
    if((z&7)===0){progress(round*d+z+1,rounds*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Median 3D · live '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Median error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySpikeHole(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Spike / Hole');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+spikeHoleStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),thresholdRatio=+spikeHoleThreshold.value,threshold=range*thresholdRatio,edgeGuard=threshold*(.55+.35*strength);
  const correctionBlend=.20+.75*strength;
  let corrected=0;
  for(let z=1;z<d-1;z++){
   for(let y=1;y<h-1;y++){
    const row=z*h*w+y*w;
    for(let x=1;x<w-1;x++){
     const i=row+x,c=src[i];
     const ns=[src[i-1],src[i+1],src[i-w],src[i+w],src[i-w*h],src[i+w*h]];
     let sum=0,min=Infinity,max=-Infinity;for(const v of ns){sum+=v;if(v<min)min=v;if(v>max)max=v}
     const mean=sum/6,spread=max-min,diff=c-mean;
     if(spread<=edgeGuard&&Math.abs(diff)>threshold){
      const target=mean+Math.sign(diff)*threshold*.08;
      out[i]=c*(1-correctionBlend)+target*correctionBlend;corrected++;
     }
    }
   }
   if((z&7)===0){progress(z,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);footer.textContent='Spike / Hole · '+strength.toFixed(2)+' · threshold '+thresholdRatio.toFixed(3)+' · '+corrected.toLocaleString()+' voxels';
 }catch(e){console.error(e);footer.textContent='Spike/Hole error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyNlm3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Fast NLM 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+nlmStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),hParam=range*(.018+.11*strength),h2=hParam*hParam;
  const searchRadius=Math.max(1,Math.round(+nlmSearchRadius.value)),patchRadius=Math.max(0,Math.round(+nlmPatchRadius.value));
  const offsets=[];
  for(let dz=-searchRadius;dz<=searchRadius;dz++)for(let dy=-searchRadius;dy<=searchRadius;dy++)for(let dx=-searchRadius;dx<=searchRadius;dx++){
   if(dx||dy||dz)offsets.push([dx,dy,dz]);
  }
  const patch=[[0,0,0]];
  for(let r=1;r<=patchRadius;r++)patch.push([r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const sample=(x,y,z)=>src[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];
  for(let z=0;z<d;z++){
   for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
     const center=src[z*h*w+y*w+x];
     let weighted=center,weightSum=1;
     for(const [dx,dy,dz] of offsets){
      const nx=x+dx,ny=y+dy,nz=z+dz;
      if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;
      let dist2=0;
      for(const [px,py,pz] of patch){
       const a=sample(x+px,y+py,z+pz),b=sample(nx+px,ny+py,nz+pz),dv=a-b;
       dist2+=dv*dv;
      }
      dist2/=patch.length;
      const weight=Math.exp(-dist2/Math.max(h2,1e-6));
      weighted+=weight*src[nz*h*w+ny*w+nx];
      weightSum+=weight;
     }
     out[z*h*w+y*w+x]=weighted/weightSum;
    }
   }
   if((z&3)===0){progress(z+1,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Fast NLM 3D · '+strength.toFixed(2)+' · search '+searchRadius+' · patch '+patchRadius;
 }catch(e){console.error(e);footer.textContent='NLM error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyAnisotropicDiffusion(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Anisotropic Diffusion');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d;
  let a=new Float32Array(baseVolume.data),b=new Float32Array(n);
  const strength=+anisotropicStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),kappa=range*(.025+.09*strength),kappa2=kappa*kappa,lambda=.06+.14*strength,iterations=Math.max(1,Math.round(+anisotropicIterations.value));
  for(let iter=0;iter<iterations;iter++){
   b.set(a);
   for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){
     const row=z*h*w+y*w;
     for(let x=1;x<w-1;x++){
      const i=row+x,c=a[i];
      const neighbors=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]];
      let flux=0;
      for(const nv of neighbors){
       const diff=nv-c;
       const conduct=Math.exp(-(diff*diff)/Math.max(kappa2,1e-6));
       flux+=conduct*diff;
      }
      b[i]=c+lambda*flux;
     }
    }
    if((z&7)===0){progress(iter*d+z+1,iterations*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);
  footer.textContent='Anisotropic Diffusion · '+strength.toFixed(2)+' · '+iterations+' iterations';
 }catch(e){console.error(e);footer.textContent='Anisotropic error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyBilateral3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Bilateral 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,range=Math.max(1,baseVolume.max-baseVolume.min);
  const strength=+bilateralStrength.value,spatialSigma=+bilateralSpatial.value,intensitySigma=Math.max(1e-6,+bilateralIntensity.value*range),passes=Math.max(1,Math.round(+bilateralPasses.value));
  const radius=Math.max(1,Math.min(3,Math.ceil(spatialSigma*1.5))),sp2=2*spatialSigma*spatialSigma,int2=2*intensitySigma*intensitySigma;
  let a=new Float32Array(baseVolume.data),b=new Float32Array(n);
  for(let pass=0;pass<passes;pass++){
   for(let z=0;z<d;z++){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const i=z*h*w+y*w+x,center=a[i];let sum=0,wsum=0;
     for(let dz=-radius;dz<=radius;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;
      for(let dy=-radius;dy<=radius;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
       for(let dx=-radius;dx<=radius;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;
        const j=zz*h*w+yy*w+xx,dv=a[j]-center,sw=Math.exp(-(dx*dx+dy*dy+dz*dz)/sp2),iw=Math.exp(-(dv*dv)/int2),ww=sw*iw;
        sum+=a[j]*ww;wsum+=ww;
       }
      }
     }
     const filtered=wsum?sum/wsum:center;b[i]=center*(1-strength)+filtered*strength;
    }
    if((z&3)===0){progress(pass*d+z+1,passes*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Bilateral 3D · '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Bilateral error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyTvDenoising3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'TV Denoising 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data,range=Math.max(1,baseVolume.max-baseVolume.min);
  const weight=+tvWeight.value,iterations=Math.max(1,Math.round(+tvIterations.value)),lambda=Math.min(.18,.02+weight*.45);
  let a=new Float32Array(src),b=new Float32Array(n);
  const eps=range*1e-4;
  for(let iter=0;iter<iterations;iter++){
   b.set(a);
   for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){
    const row=z*h*w+y*w;
    for(let x=1;x<w-1;x++){
     const i=row+x,c=a[i],ns=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]];
     let flux=0;
     for(const nv of ns){const diff=nv-c;flux+=diff/Math.sqrt(diff*diff+eps*eps)}
     b[i]=c+lambda*flux;
    }
    if((z&7)===0){progress(iter*d+z+1,iterations*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='TV Denoising 3D · '+weight.toFixed(2)+' · '+iterations+' iterations';
 }catch(e){console.error(e);footer.textContent='TV error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function boxBlur3D(baseVolume,radius){
 const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data,r=Math.max(1,Math.round(radius));
 const out=new Float32Array(n);
 for(let z=0;z<d;z++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sum=0,count=0;
   for(let dz=-r;dz<=r;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;
    for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
     for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=src[zz*h*w+yy*w+xx];count++}
    }
   }
   out[z*h*w+y*w+x]=sum/Math.max(1,count);
  }
  if((z&7)===0)await frameYield();
 }
 return out;
}
async function applyUnsharpMask3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Unsharp Mask 3D');
 try{
  const src=baseVolume.data,blurred=await boxBlur3D(baseVolume,+unsharpRadius.value),out=new Float32Array(src.length),range=Math.max(1,baseVolume.max-baseVolume.min);
  const amount=+unsharpAmount.value,threshold=+unsharpThreshold.value*range;
  for(let i=0;i<src.length;i++){const detail=src[i]-blurred[i];out[i]=Math.abs(detail)>=threshold?src[i]+amount*detail:src[i]}
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);footer.textContent='Unsharp Mask 3D · amount '+amount.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Unsharp error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySigmoid(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Sigmoid');
 try{
  const src=baseVolume.data,out=new Float32Array(src.length);
  const min=baseVolume.min,max=baseVolume.max,range=Math.max(1,max-min);
  const strength=+sigmoidStrength.value,gain=2+strength*10;
  const centerValue=Math.max(min,Math.min(max,+sigmoidCenter.value)),center=(centerValue-min)/range;
  const lo=1/(1+Math.exp(gain*center)),hi=1/(1+Math.exp(-gain*(1-center))),norm=Math.max(1e-6,hi-lo);
  for(let i=0;i<src.length;i++){
   const x=Math.max(0,Math.min(1,(src[i]-min)/range));
   const y=(1/(1+Math.exp(-gain*(x-center)))-lo)/norm;
   out[i]=min+Math.max(0,Math.min(1,y))*range;
   if((i&0x3ffff)===0){progress(i+1,src.length);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Sigmoid · '+strength.toFixed(2)+' · center '+Math.round(centerValue);
 }catch(e){console.error(e);footer.textContent='Sigmoid error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
function resetProcessing(){
 clearTimeout(liveFilterState.timer);clearTimeout(filterRebuildTimer);filterRebuildRevision++;memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();if(sourceVolume?.sourceBacked)invalidateSourceFilters();liveFilterState.base=null;liveFilterState.key=null;
 filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;syncFilterControls();
 if(!sourceVolume)return;volume=sourceVolume;renderAll();mark3DStale();footer.textContent=tr('processingReset');
}
function memoryPreviewCacheLimit(){return navigator.maxTouchPoints>0?24*1024*1024:64*1024*1024}
function clearMemoryFilterPreviewCache(){memoryFilterPreviewCache.map.clear();memoryFilterPreviewCache.bytes=0}
function memoryFilterPreviewGet(key){
 const hit=memoryFilterPreviewCache.map.get(key);if(!hit)return null;
 memoryFilterPreviewCache.map.delete(key);memoryFilterPreviewCache.map.set(key,hit);return hit;
}
function memoryFilterPreviewSet(key,data){
 const old=memoryFilterPreviewCache.map.get(key);if(old){memoryFilterPreviewCache.bytes-=old.byteLength;memoryFilterPreviewCache.map.delete(key)}
 memoryFilterPreviewCache.map.set(key,data);memoryFilterPreviewCache.bytes+=data.byteLength;
 const limit=memoryPreviewCacheLimit();
 while(memoryFilterPreviewCache.bytes>limit&&memoryFilterPreviewCache.map.size>1){
  const first=memoryFilterPreviewCache.map.keys().next().value,item=memoryFilterPreviewCache.map.get(first);memoryFilterPreviewCache.map.delete(first);memoryFilterPreviewCache.bytes-=item.byteLength;
 }
}
function hasGlobalSegmentProcessing(){
 return SEGMENT_PRESET_ORDER.some(key=>{const s=segmentState[key];return s.active&&s.enabled&&segmentNeedsGlobalMask(s)});
}
async function getFilteredMemoryPlaneValues(p,idx,v,requestRevision){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const signature=sourceFilterSignature(stages),cacheKey=signature+'|'+p+'|'+idx,hit=memoryFilterPreviewGet(cacheKey);if(hit)return hit;
 const stale=()=>requestRevision!==planeRenderRevision[p],w=v.columns,h=v.rows,d=v.slices,halo=sourceFilterHalo(stages);let out;
 if(p==='axial'){
  out=new Float32Array(w*h);const [tx,ty]=fitSourceTile(w,h,1,halo,512,192);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(stale())throw new Error('__SUPERSEDED__');const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processMemoryRegion(v,{x,y,z:idx,width:tw,height:th,depth:1},stages);
   for(let yy=0;yy<th;yy++)out.set(tile.subarray(yy*tw,(yy+1)*tw),(y+yy)*w+x);
  }
 }else if(p==='coronal'){
  out=new Float32Array(w*d);const [tx,tz]=fitSourceTile(w,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let x=0;x<w;x+=tx){
   if(stale())throw new Error('__SUPERSEDED__');const tw=Math.min(tx,w-x),td=Math.min(tz,d-z),tile=await processMemoryRegion(v,{x,y:idx,z,width:tw,height:1,depth:td},stages);
   for(let zz=0;zz<td;zz++)out.set(tile.subarray(zz*tw,(zz+1)*tw),(d-1-(z+zz))*w+x);
  }
 }else{
  out=new Float32Array(h*d);const [ty,tz]=fitSourceTile(h,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let y=0;y<h;y+=ty){
   if(stale())throw new Error('__SUPERSEDED__');const th=Math.min(ty,h-y),td=Math.min(tz,d-z),tile=await processMemoryRegion(v,{x:idx,y,z,width:1,height:th,depth:td},stages);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++)out[(d-1-(z+zz))*h+y+yy]=tile[zz*th+yy];
  }
 }
 if(stale())throw new Error('__SUPERSEDED__');memoryFilterPreviewSet(cacheKey,out);return out;
}
async function renderPlaneMemoryFiltered(p,revision,idx){
 const c=planes[p];c.label.textContent=idx+1;if(revision!==planeRenderRevision[p])return;
 try{
  const values=await getFilteredMemoryPlaneValues(p,idx,sourceVolume,revision);
  if(revision!==planeRenderRevision[p])return;
  const dims=p==='axial'?[sourceVolume.columns,sourceVolume.rows]:p==='coronal'?[sourceVolume.columns,sourceVolume.slices]:[sourceVolume.rows,sourceVolume.slices];
  paintSourcePlane(c,dims,values,p,idx);
 }catch(e){
  if(String(e.message||e)==='__SUPERSEDED__')return;
  console.warn('GPU MPR preview failed.',e);memoryGpuPreviewActive=false;throw e;
 }
}
function setProcessingBusy(busyState,label='Processing',lockControls=true){
 if(processingOverlay){
  processingOverlay.classList.toggle('is-hidden',!busyState||!lockControls);
  processingOverlay.setAttribute('aria-busy',busyState?'true':'false');
 }
 if(processingOverlayLabel)processingOverlayLabel.textContent=busyState&&lockControls?label+' · 処理中…':'';
 if(lockControls){
  resetFilterBtn.disabled=busyState||!sourceVolume;
  gaussianBtn.disabled=spikeHoleBtn.disabled=nlmBtn.disabled=anisotropicBtn.disabled=sigmoidBtn.disabled=busyState||!sourceVolume;smoothingType.disabled=busyState||!sourceVolume||!filterState.gaussian;
  gaussianStrength.disabled=busyState||!sourceVolume||!filterState.gaussian;
  spatialPasses.disabled=busyState||!sourceVolume||!filterState.gaussian;
  spikeHoleStrength.disabled=busyState||!sourceVolume||!filterState.spikeHole;
  spikeHoleThreshold.disabled=busyState||!sourceVolume||!filterState.spikeHole;
  nlmStrength.disabled=busyState||!sourceVolume||!filterState.nlm;
  nlmSearchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
  nlmPatchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
  anisotropicStrength.disabled=busyState||!sourceVolume||!filterState.anisotropic;
  anisotropicIterations.disabled=busyState||!sourceVolume||!filterState.anisotropic;
  sigmoidStrength.disabled=busyState||!sourceVolume||!filterState.sigmoid;
  sigmoidCenter.disabled=busyState||!sourceVolume||!filterState.sigmoid;
  bilateralStrength.disabled=bilateralSpatial.disabled=bilateralIntensity.disabled=bilateralPasses.disabled=busyState||!sourceVolume||!filterState.bilateral;
  tvWeight.disabled=tvIterations.disabled=busyState||!sourceVolume||!filterState.tv;
  unsharpRadius.disabled=unsharpAmount.disabled=unsharpThreshold.disabled=busyState||!sourceVolume||!filterState.unsharp;
  folderBtn.disabled=demoBtn.disabled=busyState;
 }
 prog.classList.toggle('is-hidden',!busyState);
 if(busyState){bar.style.width='0%';progLabel.textContent=label}
}
const frameYield=()=>new Promise(resolve=>setTimeout(resolve,0));

function niceCtStep(span){
 const target=Math.max(Math.abs(span)/700,1e-6),power=10**Math.floor(Math.log10(target)),scaled=target/power;
 const nice=scaled<=1?1:scaled<=2?2:scaled<=5?5:10;
 return nice*power;
}
function ctDigits(step){
 if(step>=1)return 0;
 return Math.min(4,Math.max(0,Math.ceil(-Math.log10(step))));
}
function formatCtValue(value,step=1){return Number(value).toFixed(ctDigits(+step||1))}
function setCtSliderRange(el,min,max,step){
 if(!el)return;
 const value=+el.value,lo=Math.min(min,value),hi=Math.max(max,value);
 el.min=String(lo);el.max=String(Math.max(lo+step,hi));el.step=String(step);
 el.value=String(value);
}
function buildCtRangeProfile(v){
 const fullMin=Number.isFinite(v.min)?v.min:0,fullMax=Number.isFinite(v.max)&&v.max>fullMin?v.max:fullMin+1,fullSpan=Math.max(fullMax-fullMin,1e-6);
 const center=Number.isFinite(v.windowCenter)?v.windowCenter:(fullMin+fullMax)/2;
 const width=Number.isFinite(v.windowWidth)&&v.windowWidth>0?v.windowWidth:fullSpan;
 return{fullMin,fullMax,fullSpan,center,width,fullWidthMax:Math.max(fullSpan,width)};
}
function autoAround(value,halfSpan,fullMin,fullMax){
 const v=Number.isFinite(+value)?+value:(fullMin+fullMax)/2;
 let lo=Math.max(fullMin,v-halfSpan),hi=Math.min(fullMax,v+halfSpan);
 if(hi<=lo){lo=fullMin;hi=fullMax}
 return[lo,hi];
}
function applyCtRangeMode(mode=ctRangeMode){
 if(!ctRangeProfile||!volume)return;
 ctRangeMode=mode==='full'?'full':'auto';
 ctRangeAuto.classList.toggle('is-active',ctRangeMode==='auto');
 ctRangeFull.classList.toggle('is-active',ctRangeMode==='full');
 const p=ctRangeProfile,fullStep=niceCtStep(p.fullSpan),autoStep=niceCtStep(Math.max(p.width*2,p.fullSpan/20));
 if(ctRangeMode==='full'){
  setCtSliderRange(wc,p.fullMin,p.fullMax,fullStep);
  setCtSliderRange(ww,Math.max(fullStep,1e-6),p.fullWidthMax,fullStep);
  setCtSliderRange(sigmoidCenter,p.fullMin,p.fullMax,fullStep);
  for(const key of SEGMENT_PRESET_ORDER){
   setCtSliderRange($('[data-seg-min="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
   setCtSliderRange($('[data-seg-max="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
  }
 }else{
  const half=Math.max(p.width,p.fullSpan/200);
  let r=autoAround(+wc.value,half,p.fullMin,p.fullMax);setCtSliderRange(wc,r[0],r[1],autoStep);
  const currentWidth=Math.max(+ww.value,autoStep),wwLo=Math.max(autoStep,currentWidth-p.width),wwHi=Math.min(p.fullWidthMax,Math.max(currentWidth+p.width,currentWidth*1.5));
  setCtSliderRange(ww,wwLo,Math.max(wwLo+autoStep,wwHi),autoStep);
  r=autoAround(+sigmoidCenter.value,half,p.fullMin,p.fullMax);setCtSliderRange(sigmoidCenter,r[0],r[1],autoStep);
  for(const key of SEGMENT_PRESET_ORDER){
   const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
   let rr=autoAround(+minEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(minEl,rr[0],rr[1],autoStep);
   rr=autoAround(+maxEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(maxEl,rr[0],rr[1],autoStep);
  }
 }
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 sigmoidCenterValue.value=formatCtValue(+sigmoidCenter.value,+sigmoidCenter.step);
 for(const key of SEGMENT_PRESET_ORDER)updateSegmentOutputs(key);
}
function configure(v){
 ctRangeMode='auto';ctRangeProfile=buildCtRangeProfile(v);
 const p=ctRangeProfile,center=p.center,initialWidth=p.width;
 wc.min=p.fullMin;wc.max=p.fullMax;wc.value=Math.max(p.fullMin,Math.min(p.fullMax,center));wc.disabled=false;
 ww.min=Math.max(niceCtStep(p.fullSpan),1e-6);ww.max=p.fullWidthMax;ww.value=Math.max(+ww.min,Math.min(p.fullWidthMax,initialWidth));ww.disabled=false;
 sigmoidCenter.min=p.fullMin;sigmoidCenter.max=p.fullMax;sigmoidCenter.value=Math.max(p.fullMin,Math.min(p.fullMax,center));sigmoidCenter.disabled=!filterState.sigmoid;
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [plane,[max,mid]]of Object.entries(vals)){planes[plane].slider.max=max-1;planes[plane].slider.value=Math.floor(mid);planes[plane].slider.disabled=false}
 configureSegments(v);
 ctRangeAuto.disabled=ctRangeFull.disabled=false;applyCtRangeMode('auto');
 volumeAnalysisToggle.disabled=!(v.data||v.mprData||v.sourceBacked);updateRenderModeControl(v);
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  const exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
  const usable=cfg.active;
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=!usable;opening.disabled=closing.disabled=minComponent.disabled=holeFill.disabled=!usable;if(exportBtn)exportBtn.disabled=!usable;if(removeBtn)removeBtn.disabled=!usable;enabled.checked=cfg.enabled;color.value=cfg.color;
  min.min=max.min=Math.floor(v.min);min.max=max.max=Math.ceil(v.max);min.value=cfg.min;max.value=cfg.max;opacity.value=cfg.opacity;opening.value=cfg.opening;closing.value=cfg.closing;minComponent.value=cfg.minComponent;holeFill.checked=cfg.holeFill;$('[data-seg-opening-out="'+key+'"]').value=cfg.opening;$('[data-seg-closing-out="'+key+'"]').value=cfg.closing;$('[data-seg-min-component-out="'+key+'"]').value=cfg.minComponent;cfg._maskCache=null;updateSegmentOutputs(key);
 }
 renderSegmentPresets();
}
function buildThresholdMask(v,seg){
 const mask=new Uint8Array(v.data.length);for(let i=0;i<v.data.length;i++){const x=v.data[i];if(x>=seg.min&&x<=seg.max)mask[i]=1}return mask;
}
function morphMask(mask,w,h,d,radius,dilate){
 let a=new Uint8Array(mask),b=new Uint8Array(mask.length),plane=w*h;
 for(let pass=0;pass<radius;pass++){
  b.fill(0);
  for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=z*plane+y*w+x;
   if(dilate){
    let on=a[i]===1;if(!on&&x>0)on=a[i-1]===1;if(!on&&x<w-1)on=a[i+1]===1;if(!on&&y>0)on=a[i-w]===1;if(!on&&y<h-1)on=a[i+w]===1;if(!on&&z>0)on=a[i-plane]===1;if(!on&&z<d-1)on=a[i+plane]===1;b[i]=on?1:0;
   }else{
    let on=a[i]===1;if(on&&(x===0||a[i-1]===0))on=false;if(on&&(x===w-1||a[i+1]===0))on=false;if(on&&(y===0||a[i-w]===0))on=false;if(on&&(y===h-1||a[i+w]===0))on=false;if(on&&(z===0||a[i-plane]===0))on=false;if(on&&(z===d-1||a[i+plane]===0))on=false;b[i]=on?1:0;
   }
  }
  const t=a;a=b;b=t;
 }
 return a;
}
function fillMaskHoles(mask,w,h,d){
 const n=mask.length,plane=w*h,seen=new Uint8Array(n),stack=[];const push=i=>{if(i>=0&&i<n&&!mask[i]&&!seen[i]){seen[i]=1;stack.push(i)}};
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){push(z*plane+y*w);push(z*plane+y*w+w-1)}
 for(let z=0;z<d;z++)for(let x=0;x<w;x++){push(z*plane+x);push(z*plane+(h-1)*w+x)}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){push(y*w+x);push((d-1)*plane+y*w+x)}
 while(stack.length){const i=stack.pop(),z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);if(z>0)push(i-plane);if(z<d-1)push(i+plane)}
 const out=new Uint8Array(mask);for(let i=0;i<n;i++)if(!mask[i]&&!seen[i])out[i]=1;return out;
}
function removeSmallMaskComponents(mask,w,h,d,minSize){
 if(minSize<=0)return mask;const out=new Uint8Array(mask),seen=new Uint8Array(mask.length),stack=[],plane=w*h;
 for(let seed=0;seed<out.length;seed++){if(!out[seed]||seen[seed])continue;const comp=[];stack.push(seed);seen[seed]=1;while(stack.length){const i=stack.pop();comp.push(i);const z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;const ns=[];if(x>0)ns.push(i-1);if(x<w-1)ns.push(i+1);if(y>0)ns.push(i-w);if(y<h-1)ns.push(i+w);if(z>0)ns.push(i-plane);if(z<d-1)ns.push(i+plane);for(const j of ns)if(out[j]&&!seen[j]){seen[j]=1;stack.push(j)}}if(comp.length<minSize)for(const i of comp)out[i]=0}
 return out;
}
const segmentMaskVolumeIds=new WeakMap();let nextSegmentMaskVolumeId=1;
function segmentMaskVolumeId(v){
 let id=segmentMaskVolumeIds.get(v);if(!id){id=nextSegmentMaskVolumeId++;segmentMaskVolumeIds.set(v,id)}return id;
}
function segmentNeedsGlobalMask(seg){return seg.opening>0||seg.closing>0||seg.holeFill||seg.minComponent>0}
function getProcessedSegmentMask(v,seg){
 const key=[segmentMaskVolumeId(v),seg.min,seg.max,seg.opening,seg.closing,seg.minComponent,seg.holeFill].join('|');if(seg._maskCache&&seg._maskCacheKey===key)return seg._maskCache;
 const w=v.columns,h=v.rows,d=v.slices;let mask=buildThresholdMask(v,seg);
 if(seg.opening>0){mask=morphMask(mask,w,h,d,seg.opening,false);mask=morphMask(mask,w,h,d,seg.opening,true)}
 if(seg.closing>0){mask=morphMask(mask,w,h,d,seg.closing,true);mask=morphMask(mask,w,h,d,seg.closing,false)}
 if(seg.holeFill)mask=fillMaskHoles(mask,w,h,d);
 if(seg.minComponent>0)mask=removeSmallMaskComponents(mask,w,h,d,seg.minComponent);
 seg._maskCache=mask;seg._maskCacheKey=key;return mask;
}
function updateSegmentOutputs(key){
 const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
 $('[data-seg-min-out="'+key+'"]').value=formatCtValue(segmentState[key].min,+minEl?.step||1);
 $('[data-seg-max-out="'+key+'"]').value=formatCtValue(segmentState[key].max,+maxEl?.step||1);
 $('[data-seg-opacity-out="'+key+'"]').value=segmentState[key].opacity.toFixed(2);
}
function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);sourceRenderRevision++;mark3DStale();if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){request3DRender();threeLabel.textContent=(sceneState.backend||'3D')+' · GPU volume'}}
const planeRenderRevision={axial:0,coronal:0,sagittal:0};
let sourceMprWarmupToken=0,sourceMprWarmupPlane=null;
function cancelSourceMprWarmup(){
 sourceMprWarmupToken++;
 if(sourceMprWarmupPlane){planeRenderRevision[sourceMprWarmupPlane]++;sourceMprWarmupPlane=null}
}
function scheduleSourceMprWarmup(){
 if(!volume?.sourceBacked)return;
 const token=++sourceMprWarmupToken;
 const run=async()=>{
  if(token!==sourceMprWarmupToken||!volume?.sourceBacked)return;
  await ensureMpr3DPreviewCache();
  if(token!==sourceMprWarmupToken||!volume?.sourceBacked||sourceFilterStages().length)return;
  for(const p of ['coronal','sagittal']){
   if(token!==sourceMprWarmupToken)return;
   const idx=+planes[p].slider.value,max=p==='coronal'?volume.rows-1:volume.columns-1;
   sourceMprWarmupPlane=p;
   if(!sourceOrthogonalCacheGet(p,idx)){
    const revision=++planeRenderRevision[p];
    try{await renderPlane(p,revision,idx)}catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('MPR warmup failed.',e)}
   }
   if(sourceMprWarmupPlane===p)sourceMprWarmupPlane=null;
   const idleRevision=planeRenderRevision[p];
   for(const offset of [-1,1,-2,2]){
    if(token!==sourceMprWarmupToken||idleRevision!==planeRenderRevision[p])return;
    const near=idx+offset;if(near<0||near>max||sourceOrthogonalCacheGet(p,near))continue;
    try{await buildSourceOrthogonalPlane(p,near,volume.series,idleRevision)}catch(e){if(String(e.message||e)==='__SUPERSEDED__')return;console.warn('MPR neighbor warmup failed.',e);break}
    await frameYield();
   }
  }
 };
 if('requestIdleCallback' in window)requestIdleCallback(()=>void run(),{timeout:900});
 else setTimeout(()=>void run(),180);
}
function safeRenderPlane(p,revision=null,idx=null){
 if(revision==null)revision=++planeRenderRevision[p];
 if(idx==null)idx=+planes[p].slider.value;
 void renderPlane(p,revision,idx).catch(e=>{if(String(e.message||e)!=='__SUPERSEDED__'){console.warn('MPR render failed.',e);footer.textContent='MPR error: '+String(e.message||e)}});
}
function renderMainMprPreview(){
 if(!volume)return;
 const key=currentMainViewKey(),p=planes[key]?key:'axial';
 schedulePlaneRender(p);
}
function renderAll(){
 if(!volume)return;
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 if(volume.sourceBacked&&!sourceFilterStages().length&&volume.mprData){
  for(const p of Object.keys(planes))safeRenderPlane(p);
  return;
 }
 if(volume.sourceBacked&&!sourceFilterStages().length){
  safeRenderPlane('axial');
  for(const p of ['coronal','sagittal']){
   const idx=+planes[p].slider.value,cached=sourceOrthogonalCacheGet(p,idx);
   if(cached)paintSourcePlane(planes[p],p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],cached,p,idx);
  }
  scheduleSourceMprWarmup();return;
 }
 for(const p of Object.keys(planes))safeRenderPlane(p);
}
async function renderPlane(p,revision,idx){
 if(!volume||revision!==planeRenderRevision[p])return;
 updateMprCanvasPhysicalAspect(p);
 if(volume.sourceBacked)return renderPlaneSourceBacked(p,revision,idx);
 if(memoryGpuPreviewActive&&sourceFilterStages().length)return renderPlaneMemoryFiltered(p,revision,idx);
 const c=planes[p];c.label.textContent=idx+1;
 const dims=p==='axial'?[volume.columns,volume.rows]:p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],ctx=c.canvas.getContext('2d');if(c.canvas.width!==dims[0])c.canvas.width=dims[0];if(c.canvas.height!==dims[1])c.canvas.height=dims[1];
 const img=reusableMprImage(p,ctx,dims),values=volume.mprData?cachedSourceMprPlane(volume,p,idx):null,low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1);let q=0;
 const segOrder=['lung','fat','soft','bone'],segMasks={};for(const key of segOrder){const seg=segmentState[key];if(seg.active&&seg.enabled&&segmentNeedsGlobalMask(seg))segMasks[key]=getProcessedSegmentMask(volume,seg)}
 for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  let v;if(values)v=values[y*dims[0]+x];else if(p==='axial')v=volume.data[idx*volume.rows*volume.columns+y*volume.columns+x];else if(p==='coronal'){const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+idx*volume.columns+x]}else{const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+x*volume.columns+idx]}
  const g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  const voxelIndex=p==='axial'?idx*volume.rows*volume.columns+y*volume.columns+x:p==='coronal'?(volume.slices-1-y)*volume.rows*volume.columns+idx*volume.columns+x:(volume.slices-1-y)*volume.rows*volume.columns+x*volume.columns+idx;
  const ix=p==='sagittal'?idx:x,iy=p==='coronal'?idx:(p==='sagittal'?x:y),iz=p==='axial'?idx:volume.slices-1-y;
  for(const key of segOrder){const seg=segmentState[key],mask=segMasks[key],edit=segmentEditState[key];if(!seg.active||!seg.enabled)continue;const inside=segmentEditActive(key)&&edit.finalRuns?analysisRunsContain(edit.finalRuns,ix,iy,iz):(mask?mask[voxelIndex]===1:(v>=seg.min&&v<=seg.max));if(!inside)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255
 }
 ctx.putImageData(img,0,0);drawAnalysisOverlay(p,idx,ctx);refreshMpr3DPlaneTexture(p)
}
const mprPaintCache={axial:null,coronal:null,sagittal:null};
function reusableMprImage(p,ctx,dims){
 let cache=mprPaintCache[p];
 if(!cache||cache.width!==dims[0]||cache.height!==dims[1]){
  cache={width:dims[0],height:dims[1],image:ctx.createImageData(dims[0],dims[1])};mprPaintCache[p]=cache;
 }
 return cache.image;
}
function sourceMprMemoryView(v){
 if(!v?.mprData)return null;
 if(!v._mprMemoryView||v._mprMemoryView.data!==v.mprData)v._mprMemoryView={data:v.mprData,columns:v.columns,rows:v.rows,slices:v.slices,spacing:v.spacing,min:v.min,max:v.max};
 return v._mprMemoryView;
}
function activeMprSegments(){
 const out=[],baseView=volume?.sourceBacked?sourceMprMemoryView(volume):volume;
 for(const key of ['lung','fat','soft','bone']){
  const seg=segmentState[key];if(!seg.active||!seg.enabled)continue;
  const edit=segmentEditState[key],processedMask=baseView&&segmentNeedsGlobalMask(seg)?getProcessedSegmentMask(baseView,seg):null,processedRuns=volume?.sourceBacked&&segmentNeedsGlobalMask(seg)?(edit.finalRuns||edit.baseRuns):null;
  out.push({key,seg,edit,processedMask,processedRuns,rgb:hexRgb(seg.color),alpha:Math.min(.75,seg.opacity*.65)});
 }
 return out;
}
function paintSourcePlane(c,dims,values,p='axial',idx=0){
 updateMprCanvasPhysicalAspect(p);
 const ctx=c.canvas.getContext('2d');if(c.canvas.width!==dims[0])c.canvas.width=dims[0];if(c.canvas.height!==dims[1])c.canvas.height=dims[1];
 const img=reusableMprImage(p,ctx,dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1),activeSegs=activeMprSegments(),hasSegments=activeSegs.length>0;let q=0;
 for(let py=0;py<dims[1];py++)for(let px=0;px<dims[0];px++){
  const i=py*dims[0]+px,v=values[i],g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  if(hasSegments){
   const ix=p==='sagittal'?idx:px,iy=p==='coronal'?idx:(p==='sagittal'?px:py),iz=p==='axial'?idx:(volume.slices-1-py);
   for(const item of activeSegs){const {key,seg,edit,processedMask,processedRuns,rgb,alpha}=item,inside=processedRuns?analysisRunsContain(processedRuns,ix,iy,iz):(segmentEditActive(key)&&edit.finalRuns?analysisRunsContain(edit.finalRuns,ix,iy,iz):(processedMask?processedMask[iz*volume.rows*volume.columns+iy*volume.columns+ix]===1:(v>=seg.min&&v<=seg.max)));if(!inside)continue;rr=Math.round(rr*(1-alpha)+rgb[0]*alpha);gg=Math.round(gg*(1-alpha)+rgb[1]*alpha);bb=Math.round(bb*(1-alpha)+rgb[2]*alpha)}
  }
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255;
 }
 ctx.putImageData(img,0,0);drawAnalysisOverlay(p,idx,ctx);refreshMpr3DPlaneTexture(p);
}
async function renderPlaneSourceBacked(p,revision,idx){
 const c=planes[p],series=volume.series;c.label.textContent=idx+1;if(revision!==planeRenderRevision[p])return;
 try{
  if(!sourceFilterStages().length&&volume.mprData){
   const values=cachedSourceMprPlane(volume,p,idx);if(revision!==planeRenderRevision[p]||!values)return;
   const dims=p==='axial'?[series.columns,series.rows]:p==='coronal'?[series.columns,series.slices.length]:[series.rows,series.slices.length];
   paintSourcePlane(c,dims,values,p,idx);return;
  }
  if(sourceFilterStages().length){
   const values=await getFilteredSourcePlaneValues(p,idx,series,'mpr:'+p,revision);
   if(revision!==planeRenderRevision[p])return;
   const dims=p==='axial'?[series.columns,series.rows]:p==='coronal'?[series.columns,series.slices.length]:[series.rows,series.slices.length];
   paintSourcePlane(c,dims,values,p,idx);return;
  }
  if(p==='axial'){
   const values=await getCachedSourceSlice(series.slices[idx]);if(revision!==planeRenderRevision[p])return;
   paintSourcePlane(c,[series.columns,series.rows],values,p,idx);return;
  }
  const values=await buildSourceOrthogonalNeighborhood(p,idx,series,revision);if(revision!==planeRenderRevision[p]||!values)return;
  paintSourcePlane(c,p==='coronal'?[series.columns,series.slices.length]:[series.rows,series.slices.length],values,p,idx);
 }catch(e){if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent='MPR read error: '+String(e.message||e)}}
}

function updateMprCanvasPhysicalAspect(p){
 if(!volume||!planes[p]?.canvas)return;
 const w=volume.columns,h=volume.rows,d=volume.slices,[sx,sy,sz]=volume.spacing;
 const physical=p==='axial'?[w*sx,h*sy]:p==='coronal'?[w*sx,d*sz]:[h*sy,d*sz];
 const canvas=planes[p].canvas,parent=canvas.parentElement,ratio=physical[0]/Math.max(physical[1],1e-12),rect=parent?.getBoundingClientRect?.();
 let displayW=rect?.width||0,displayH=displayW/Math.max(ratio,1e-12);
 if(rect?.height>0&&displayH>rect.height){displayH=rect.height;displayW=displayH*ratio}
 canvas.style.aspectRatio=String(ratio);canvas.style.position='absolute';canvas.style.inset='0';canvas.style.margin='auto';canvas.style.objectFit='fill';
 if(displayW>0&&displayH>0){canvas.style.width=displayW+'px';canvas.style.height=displayH+'px'}else{canvas.style.width='100%';canvas.style.height='100%'}
 canvas.style.maxWidth='100%';canvas.style.maxHeight='100%';
}
function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}

function installMprTouch(p){const c=planes[p];let id=null,startX=0,startY=0,start=0,moved=false;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startX=e.clientX;startY=e.clientY;start=+c.slider.value;moved=false;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.hypot(dx,dy)>5)moved=true;if(volumeAnalysisMode&&!moved)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientWidth/(max+1)),next=Math.round(start+dx/sens);c.slider.value=Math.max(0,Math.min(max,next));schedulePlaneRender(p)};const end=e=>{if(id!==e.pointerId)return;const wasClick=!moved&&e.type==='pointerup';if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null;if(moved)schedulePlaneRender(p,true);if(wasClick&&selectAnalysisRegionFromMpr(p,e))e.preventDefault()};c.canvas.onpointerup=end;c.canvas.onpointercancel=end;c.canvas.addEventListener('wheel',e=>{if(!volume||c.slider.disabled)return;e.preventDefault();const max=+c.slider.max,delta=e.deltaY===0?e.deltaX:e.deltaY,step=delta>0?1:-1;c.slider.value=Math.max(0,Math.min(max,+c.slider.value+step));schedulePlaneRender(p,true)},{passive:false})}

function setMpr3DInteractive(active){
 if(!sceneState)return;sceneState.mprInteractionActive=!!active;
 if(sceneState.mprPlaneGroup)sceneState.mprPlaneGroup.visible=!!sceneState.obj;
 request3DRender();
}
function setMpr3DOverlayVisible(key,visible){
 if(!(key in mpr3DVisibility))return;mpr3DVisibility[key]=!!visible;
 if(key==='axes'){if(sceneState?.axisWidget)sceneState.axisWidget.visible=!!visible}
 else{
  const entry=sceneState?.mprPlaneEntries?.[key];if(entry){entry.root.visible=!!visible;entry.mesh.visible=!!visible;entry.border.visible=!!visible;entry.label.visible=!!visible;if(visible)refreshMpr3DPlaneTexture(key)}
 }
 const button=document.querySelector('[data-3d-overlay="'+key+'"]');button?.classList.toggle('is-active',!!visible);request3DRender();
}
function installMpr3DOverlayControls(){
 document.querySelectorAll('[data-3d-overlay]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset['3dOverlay'];setMpr3DOverlayVisible(key,!mpr3DVisibility[key])}));
}
installMpr3DOverlayControls();

function disposeMprPlaneGroup(){
 if(!sceneState?.mprPlaneGroup)return;
 sceneState.scene.remove(sceneState.mprPlaneGroup);
 sceneState.mprPlaneGroup.traverse(o=>{o.geometry?.dispose?.();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m?.map?.dispose?.();m?.dispose?.()}});
 sceneState.mprPlaneGroup=null;sceneState.mprPlaneEntries=null;sceneState.mprPlaneSignature='';
}
function makeMprPlaneLabel(text,color){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font='700 26px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='rgba(0,0,0,.9)';ctx.strokeText(text,128,32);ctx.fillStyle=color;ctx.fillText(text,128,32);
 const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(material);sprite.scale.set(.78,.195,1);sprite.renderOrder=82;return sprite;
}
function ensureMpr3DPlanes(){
 if(!sceneState||!volume)return null;
 const [sx,sy,sz]=volume.spacing,w=volume.columns,h=volume.rows,d=volume.slices,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),sig=[w,h,d,sx,sy,sz].join('|');
 if(sceneState.mprPlaneGroup&&sceneState.mprPlaneSignature===sig)return sceneState.mprPlaneEntries;
 disposeMprPlaneGroup();
 const group=new THREE.Group();group.name='mpr_planes_3d';group.renderOrder=70;sceneState.scene.add(group);
 const defs={
  axial:{canvas:planes.axial.canvas,color:0xff5a5a,css:'#ff5a5a',size:[px*scale,py*scale],rotation:[0,0,0],label:'AXIAL'},
  coronal:{canvas:planes.coronal.canvas,color:0x62d96b,css:'#62d96b',size:[px*scale,pz*scale],rotation:[Math.PI/2,0,0],label:'CORONAL'},
  sagittal:{canvas:planes.sagittal.canvas,color:0xf3cc30,css:'#f3cc30',size:[py*scale,pz*scale],basis:true,label:'SAGITTAL'}
 };
 const entries={};
 for(const [key,def] of Object.entries(defs)){
  const root=new THREE.Group();root.name='mpr_plane_'+key;
  if(def.basis)root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0)));else root.rotation.set(...def.rotation);
  const previewCanvas=document.createElement('canvas');previewCanvas.width=Math.max(1,def.canvas.width||1);previewCanvas.height=Math.max(1,def.canvas.height||1);const previewCtx=previewCanvas.getContext('2d');if(def.canvas.width&&def.canvas.height)previewCtx.drawImage(def.canvas,0,0,previewCanvas.width,previewCanvas.height);
  const texture=new THREE.CanvasTexture(previewCanvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const geometry=new THREE.PlaneGeometry(def.size[0],def.size[1]),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.64,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='mpr_texture_'+key;mesh.renderOrder=70;root.add(mesh);
  const highlightMaterial=new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,depthTest:true});
  const highlight=new THREE.Mesh(geometry.clone(),highlightMaterial);highlight.name='mpr_section_highlight_'+key;highlight.position.z=-.003;highlight.renderOrder=69;highlight.visible=false;root.add(highlight);
  const edgeGeometry=new THREE.EdgesGeometry(geometry),edgeMaterial=new THREE.LineBasicMaterial({color:def.color,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
  const border=new THREE.LineSegments(edgeGeometry,edgeMaterial);border.renderOrder=81;root.add(border);
  const label=makeMprPlaneLabel(def.label,def.css);label.position.set(0,def.size[1]*.5+.12,0);root.add(label);
  root.visible=!!mpr3DVisibility[key];mesh.visible=!!mpr3DVisibility[key];border.visible=!!mpr3DVisibility[key];label.visible=!!mpr3DVisibility[key];
  group.add(root);entries[key]={root,texture,mesh,highlight,border,label,previewCanvas};
 }
 sceneState.mprPlaneGroup=group;sceneState.mprPlaneEntries=entries;sceneState.mprPlaneSignature=sig;
 if(sectionViewOpen&&sectionViewPlane)showSectionPlaneOverlay(sectionViewPlane);
 return entries;
}
function updateMpr3DPlanePositions(){
 if(!sceneState||!volume||(!mpr3DVisibility.axial&&!mpr3DVisibility.coronal&&!mpr3DVisibility.sagittal))return;
 const entries=ensureMpr3DPlanes();if(!entries)return;
 const w=volume.columns,h=volume.rows,d=volume.slices,[sx,sy,sz]=volume.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const ai=+planes.axial.slider.value,ci=+planes.coronal.slider.value,si=+planes.sagittal.slider.value;
 entries.axial.root.position.set(0,0,((ai+.5)*sz-pz/2)*scale);
 entries.coronal.root.position.set(0,-((ci+.5)*sy-py/2)*scale,0);
 entries.sagittal.root.position.set(((si+.5)*sx-px/2)*scale,0,0);
 sceneState.mprPlaneGroup.visible=!!sceneState.obj;
 request3DRender();
}
function refreshMpr3DPlaneTexture(p){
 const entry=sceneState?.mprPlaneEntries?.[p];if(!entry||!mpr3DVisibility[p])return;
 const src=planes[p]?.canvas,dst=entry.previewCanvas;
 const useFastPreview=!!sceneState?.mprInteractionActive&&!(sectionViewOpen&&sectionViewPlane===p);
 let painted=false;
 if(useFastPreview)painted=paintMpr3DPreview(p,+planes[p].slider.value,dst);
 if(!painted&&src?.width&&src?.height&&dst){
  if(dst.width!==src.width)dst.width=src.width;
  if(dst.height!==src.height)dst.height=src.height;
  const ctx=dst.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,dst.width,dst.height);ctx.drawImage(src,0,0);
 }
 entry.texture.needsUpdate=true;request3DRender();
}
function request3DRender(){
 if(sceneState)sceneState.needsRender=true;
}
function set3DBusy(busyState,label='3D構築中…'){
 if(threeBusy)threeBusy.classList.toggle('is-hidden',!busyState);
 if(threeBusyLabel)threeBusyLabel.textContent=label;
 if(threeBusyCancel){threeBusyCancel.disabled=!busyState||threeDCancelRequested;threeBusyCancel.textContent=threeDCancelRequested?tr('cancelling3D'):tr('cancel3D')}
}
function currentMainViewKey(){return mainViewSlot?.querySelector('.view-card')?.dataset.viewKey||'3d'}
function swapViewCards(a,b){
 if(!a||!b||a===b)return;
 const placeholder=document.createComment('view-swap'),aParent=a.parentNode;
 aParent.replaceChild(placeholder,a);b.parentNode.replaceChild(a,b);placeholder.replaceWith(b);
 requestAnimationFrame(()=>{sceneState?.resize?.();request3DRender()});
}
function moveViewToMain(key){
 const card=document.querySelector('.view-card[data-view-key="'+key+'"]'),mainCard=mainViewSlot?.querySelector('.view-card');
 if(card&&mainCard&&card!==mainCard)swapViewCards(card,mainCard);
}
function installViewSwapping(){
 document.querySelectorAll('[data-view-main]').forEach(button=>button.addEventListener('click',()=>moveViewToMain(button.dataset.viewMain)));
 let dragCard=null,targetCard=null,pointerId=null;
 const clearTarget=()=>{targetCard?.classList.remove('is-view-drop-target');targetCard=null};
 for(const handle of document.querySelectorAll('[data-view-drag-handle]')){
  handle.addEventListener('pointerdown',e=>{
   dragCard=handle.closest('.view-card');pointerId=e.pointerId;if(!dragCard)return;
   handle.setPointerCapture?.(pointerId);dragCard.classList.add('is-view-dragging');e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
   if(!dragCard||e.pointerId!==pointerId)return;clearTarget();
   const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.view-card');
   if(hit&&hit!==dragCard){targetCard=hit;targetCard.classList.add('is-view-drop-target')}
  });
  const end=e=>{
   if(!dragCard||e.pointerId!==pointerId)return;
   const from=dragCard,to=targetCard;clearTarget();from.classList.remove('is-view-dragging');dragCard=null;pointerId=null;
   if(to)swapViewCards(from,to);
  };
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 }
}
installViewSwapping();
async function start3D(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.005,100);camera.position.z=5.2;scene.add(camera);scene.add(new THREE.HemisphereLight(0xffffff,0x182028,2.0));const keyLight=new THREE.DirectionalLight(0xffffff,2.4);keyLight.position.set(2,3,4);scene.add(keyLight);
 const axisWidget=new THREE.Group();axisWidget.name='orientation_axes';camera.add(axisWidget);
 const axisLength=.34,axisOrigin=new THREE.Vector3(0,0,0),axisDefs=[['X',new THREE.Vector3(1,0,0),0xff5a5a],['Y',new THREE.Vector3(0,1,0),0x62d96b],['Z',new THREE.Vector3(0,0,1),0x5d8dff]];
 const makeAxisLabel=(label,color)=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,64,64);ctx.font='700 38px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(label,32,33);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillText(label,32,33);
  const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(material);sprite.scale.set(.16,.16,1);sprite.renderOrder=1002;return sprite;
 };
 for(const[label,dir,color]of axisDefs){
  const arrow=new THREE.ArrowHelper(dir,axisOrigin,axisLength,color,.085,.05);arrow.renderOrder=1001;arrow.line.material.depthTest=false;arrow.line.material.depthWrite=false;arrow.cone.material.depthTest=false;arrow.cone.material.depthWrite=false;axisWidget.add(arrow);
  const marker=makeAxisLabel(label,color);marker.position.copy(dir).multiplyScalar(axisLength+.09);axisWidget.add(marker);
 }
 const updateAxisWidget=()=>{const depth=1.8,halfH=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth/Math.max(camera.zoom,1e-6),halfW=halfH*camera.aspect,margin=.46;axisWidget.position.set(Math.max(-halfW+.12,halfW-margin),Math.min(halfH-.12,-halfH+margin),-depth)};

 let renderer,backend='WEBGL';
 if('gpu' in navigator){
  try{
   const core=await requestVrlGpuDevice(),gpuRenderer=new THREE.WebGPURenderer({antialias:true,alpha:true,device:core.device});gpuRenderer.setPixelRatio(Math.min(devicePixelRatio,2));await gpuRenderer.init();renderer=gpuRenderer;backend='WEBGPU';adoptRendererGpuDevice(gpuRenderer,core.adapter);
  }catch(error){
   console.warn('WebGPU core init failed; falling back to WebGL.',error);
  }
 }
 if(!renderer){
  renderer=new WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));backend='WEBGL';
 }
 threeLabel.textContent=backend;
 viewport.appendChild(renderer.domElement);
 const sectionClipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0),sectionClipGroup=backend==='WEBGPU'&&THREE.ClippingGroup?new THREE.ClippingGroup():null;
 if(sectionClipGroup){sectionClipGroup.name='section_clip_group';sectionClipGroup.enabled=false;scene.add(sectionClipGroup)}
 sceneState={scene,camera,renderer,obj:null,analysisMesh:null,backend,needsRender:true,medicalVolume:null,mprPlaneGroup:null,mprPlaneEntries:null,mprPlaneSignature:'',mprInteractionActive:false,editCutPreview:null,editCutPreviewPoint:null,cutResultPreviewGroup:null,cutResultPreviewKey:null,axisWidget,sectionClipPlane,sectionClipGroup};
 if(backend==='WEBGPU')try{sceneState.medicalVolume=new MedicalVolumeRenderer({device:renderer.backend.device,host:viewport,rendererCanvas:renderer.domElement,onProgress:(a,b)=>set3DBusy(true,(currentLanguage==='ja'?'GPUボリューム準備中… ':'Preparing GPU volume… ')+a+' / '+b),onStatus:label=>setGpuComputeBackend(label)})}catch(e){console.warn('Medical volume renderer unavailable.',e)}
 updateGpuStatus();updateRenderModeControl();void ensureGpuFilterDevice().then(()=>updateGpuStatus());
 const pointers=new Map();const pointerStarts=new Map();const MIN_3D_DISTANCE=.05,MAX_3D_DISTANCE=12;let distance=5.2,lastPinch=0,lastCenter=null;
 const full3DPixelRatio=Math.min(devicePixelRatio,2);let active3DPixelRatio=full3DPixelRatio,wheelQualityTimer=null;
 const begin3DInteraction=()=>{if(threeRenderMode==='surface')setMpr3DInteractive(true)};
 const end3DInteraction=()=>{if(threeRenderMode==='surface')setMpr3DInteractive(false)};
 const isMousePanStart=e=>e.pointerType==='mouse'&&(e.button===1||e.button===2||e.shiftKey);
 const pan3D=(dx,dy)=>{if(!sceneState.obj)return;const h=Math.max(renderer.domElement.clientHeight,1),worldPerPixel=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/h;sceneState.obj.position.x+=dx*worldPerPixel;sceneState.obj.position.y-=dy*worldPerPixel};
 const clear3DPointerState=(pointerId=null)=>{
  if(pointerId!=null){
   pointers.delete(pointerId);pointerStarts.delete(pointerId);
   try{if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId)}catch{}
  }else{
   for(const id of [...pointers.keys()]){try{if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id)}catch{}}
   pointers.clear();pointerStarts.clear();
  }
  if(pointers.size<2){lastPinch=0;lastCenter=null}
 };
 sceneState.clearPointerState=clear3DPointerState;
 if(threeEditOverlay&&threeEditOverlay.parentElement!==viewport)viewport.appendChild(threeEditOverlay);
 const resizeEditOverlay=()=>{if(!threeEditOverlay)return;threeEditOverlay.width=Math.max(1,Math.round(viewport.clientWidth));threeEditOverlay.height=Math.max(1,Math.round(viewport.clientHeight))};
 const editPoint=e=>{const rect=renderer.domElement.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}};
 const sectionDragHit=e=>{
  if(!sectionViewOpen||!sectionViewPlane||analysisEditTool!=='select'||threeRenderMode!=='surface'||!sceneState.obj)return null;
  const entry=sceneState.mprPlaneEntries?.[sectionViewPlane];if(!entry?.mesh?.visible)return null;
  const rect=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2(((e.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((e.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const targets=[entry.mesh,entry.highlight].filter(Boolean);return raycaster.intersectObjects(targets,false)[0]||null;
 };
 const sectionScreenStep=()=>{
  const p=sectionViewPlane,point=sectionLocalPoint(p),step=sectionLocalStep(p);if(!p||!point||!step||!sceneState.obj)return null;
  sceneState.obj.updateMatrixWorld(true);
  const a=point.clone().applyMatrix4(sceneState.obj.matrixWorld).project(camera),b=point.clone().add(step).applyMatrix4(sceneState.obj.matrixWorld).project(camera),rect=renderer.domElement.getBoundingClientRect();
  const x=(b.x-a.x)*rect.width*.5,y=-(b.y-a.y)*rect.height*.5,len2=x*x+y*y;return len2>=.25?{x,y,len2}:null;
 };
 const dragSectionPlane=(start,e)=>{
  const p=start?.sectionPlane;if(!p||sectionViewPlane!==p||!planes[p])return;
  const step=start.sectionScreenStep,dx=e.clientX-start.x,dy=e.clientY-start.y,delta=step?Math.round((dx*step.x+dy*step.y)/step.len2):Math.round(-dy/8),max=+planes[p].slider.max,idx=Math.max(0,Math.min(max,start.sectionIndex+delta));
  if(idx===+planes[p].slider.value)return;
  planes[p].slider.value=idx;planes[p].label.textContent=idx+1;if(sectionPosition)sectionPosition.value=idx;
  updateMpr3DPlanePositions();updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();updateSectionViewUi();request3DRender();renderSectionPlaneLive(p);
 };
 const drawEditStroke=mode=>{const ctx=threeEditOverlay?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,threeEditOverlay.width,threeEditOverlay.height);if(!analysisCutScreen.length)return;ctx.save();ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(mode==='line'?[8,5]:[]);ctx.beginPath();ctx.moveTo(analysisCutScreen[0].x,analysisCutScreen[0].y);for(let i=1;i<analysisCutScreen.length;i++)ctx.lineTo(analysisCutScreen[i].x,analysisCutScreen[i].y);ctx.stroke();ctx.restore()};
 renderer.domElement.oncontextmenu=e=>e.preventDefault();
 renderer.domElement.onpointerdown=e=>{const cutTool=analysisEditTool==='pen'||analysisEditTool==='line',cutReady=cutTool&&!analysisPendingCut&&!analysisCutApplying&&e.button===0&&!e.altKey&&threeRenderMode==='surface'&&!!sceneState.obj,sectionHit=!cutReady&&e.button===0&&!e.altKey?sectionDragHit(e):null,mode=cutReady?(analysisEditTool==='line'?'cut-line':'cut-pen'):sectionHit?'section-drag':isMousePanStart(e)?'pan':'rotate',point={x:e.clientX,y:e.clientY,mode,pointerType:e.pointerType};if(!cutReady&&!sectionHit)begin3DInteraction();pointers.set(e.pointerId,point);pointerStarts.set(e.pointerId,{x:e.clientX,y:e.clientY,mode,sectionPlane:sectionHit?sectionViewPlane:null,sectionIndex:sectionHit?+planes[sectionViewPlane].slider.value:null,sectionScreenStep:sectionHit?sectionScreenStep():null,cutFrame:null});if(sectionHit){renderer.domElement.style.cursor='grabbing';footer.textContent=(currentLanguage==='ja'?sectionPlaneLabel(sectionViewPlane)+'断面をドラッグ中':'Dragging '+sectionPlaneLabel(sectionViewPlane)+' section')}if(cutReady){analysisCutStroke=[];analysisCutScreen=[editPoint(e)];const preferred=analysisEditTargetMode==='auto'?null:analysisEditTargetMode,frame=createCutPlacementFrame(e,renderer.domElement,camera,preferred);if(!frame){pointers.delete(e.pointerId);pointerStarts.delete(e.pointerId);analysisCutStroke=null;analysisCutScreen=[];clearThreeEditOverlay();updateThreeEditUi(currentLanguage==='ja'?'対象の3D表面上から切断線を開始してください':'Start the cut stroke on the target 3D surface');return}pointerStarts.get(e.pointerId).cutFrame=frame;const v=cutPointerVoxel(e,renderer.domElement,camera,preferred,frame);if(v){if(analysisEditTargetMode==='auto'&&v.key)analysisEditTargetKey=v.key;else if(analysisEditTargetMode!=='auto')analysisEditTargetKey=preferred;analysisCutStroke.push(v);updateThreeEditUi(analysisEditTargetKey?(tr(analysisEditTargetKey)||analysisEditTargetKey)+' · '+(analysisEditTool==='pen'?tr('cutRegion'):tr('lineCutRegion')):(currentLanguage==='ja'?'切断面の対象を確認中':'Resolving cut target'));footer.textContent=analysisEditTargetKey?(currentLanguage==='ja'?(tr(analysisEditTargetKey)||analysisEditTargetKey)+'を編集中':'Editing '+(tr(analysisEditTargetKey)||analysisEditTargetKey)):(currentLanguage==='ja'?'切断面を配置中':'Placing cut surface')}else updateThreeEditUi(currentLanguage==='ja'?'切断面を配置できませんでした':'Could not place cut surface');drawEditStroke(analysisEditTool)}renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size>=2){const[a,b]=[...pointers.values()];lastPinch=Math.hypot(b.x-a.x,b.y-a.y);lastCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2}}};
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId),start=pointerStarts.get(e.pointerId);if(!prev){if((analysisEditTool==='pen'||analysisEditTool==='line')&&!analysisPendingCut&&!analysisCutApplying&&sceneState.obj){const preferred=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;updateCutPreview(cutPointerVoxel(e,renderer.domElement,camera,preferred))}return}pointers.set(e.pointerId,{...prev,x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;if(prev.mode==='section-drag'){dragSectionPlane(start,e);return}if(prev.mode==='cut-pen'||prev.mode==='cut-line'){const preferred=analysisEditTargetMode==='auto'?analysisEditTargetKey:analysisEditTargetMode,v=cutPointerVoxel(e,renderer.domElement,camera,preferred,start?.cutFrame||null),screen=editPoint(e);if(analysisEditTargetMode==='auto'&&!analysisEditTargetKey&&v?.key)analysisEditTargetKey=v.key;updateCutPreview(v);if(prev.mode==='cut-line'){analysisCutScreen=[analysisCutScreen[0],screen];if(v){const first=analysisCutStroke?.[0];analysisCutStroke=first?[first,v]:[v]}}else if(Math.hypot(dx,dy)>=1){analysisCutScreen.push(screen);if(v){const last=analysisCutStroke?.[analysisCutStroke.length-1];if(!last||Math.hypot(v.x-last.x,v.y-last.y,v.z-last.z)>.2)analysisCutStroke.push(v)}}drawEditStroke(prev.mode==='cut-line'?'line':'pen');return}if(prev.mode==='pan'){pan3D(dx,dy);request3DRender();return}const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*.008);const qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*.008);sceneState.obj.quaternion.premultiply(qYaw);sceneState.obj.quaternion.premultiply(qPitch);sceneState.obj.quaternion.normalize();request3DRender();return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastPinch){distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),MIN_3D_DISTANCE,MAX_3D_DISTANCE);camera.position.z=distance}if(lastCenter){pan3D(center.x-lastCenter.x,center.y-lastCenter.y)}lastPinch=d;lastCenter=center;request3DRender()};
 const endPointer=e=>{const start=pointerStarts.get(e.pointerId),wasSingle=pointers.size===1,isCut=start?.mode==='cut-pen'||start?.mode==='cut-line',isSectionDrag=start?.mode==='section-drag',stroke=isCut?[...(analysisCutStroke||[])]:null,screenStroke=isCut?[...(analysisCutScreen||[])]:null;clear3DPointerState(e.pointerId);if(!pointers.size&&!isCut&&!isSectionDrag)end3DInteraction();if(isSectionDrag){renderer.domElement.style.cursor='';if(start?.sectionPlane===sectionViewPlane)schedulePlaneRender(sectionViewPlane,true);footer.textContent=currentLanguage==='ja'?sectionPlaneLabel(sectionViewPlane)+'断面 '+(+planes[sectionViewPlane].slider.value+1)+' / '+(+planes[sectionViewPlane].slider.max+1):sectionPlaneLabel(sectionViewPlane)+' section '+(+planes[sectionViewPlane].slider.value+1)+' / '+(+planes[sectionViewPlane].slider.max+1);return}if(isCut){analysisCutStroke=null;if(e.type==='pointerup'&&stroke?.length>=2&&analysisEditTargetKey){analysisPendingCut={points:stroke,key:analysisEditTargetKey,mode:start?.mode==='cut-line'?'line':'pen'};analysisCutScreen=[];clearThreeEditOverlay();sceneState.editCutPreviewPoint=stroke[stroke.length-1];updateCutPreview(sceneState.editCutPreviewPoint);footer.textContent=currentLanguage==='ja'?'切断予定を作成しました。深さ・幅・角度を調整してください':'Cut plan created. Adjust depth, width and angles.';updateThreeEditUi(tr('cutPendingHint'))}else{analysisCutScreen=[];clearThreeEditOverlay();updateThreeEditUi(currentLanguage==='ja'?'切断線が対象表面にありません':'The cut stroke did not hit the target surface')}return}if(e.type==='pointerup'&&e.button===0&&wasSingle&&start?.mode==='rotate'&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6&&volumeAnalysisMode&&!volumeAnalysisBusy){void analyzeVolumeAtPointer(e,renderer.domElement,camera)}};
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.onlostpointercapture=e=>{const start=pointerStarts.get(e.pointerId);pointers.delete(e.pointerId);pointerStarts.delete(e.pointerId);if(!analysisPendingCut){analysisCutScreen=[];clearThreeEditOverlay()}renderer.domElement.style.cursor='';if(pointers.size<2){lastPinch=0;lastCenter=null}if(!pointers.size&&start?.mode!=='section-drag')end3DInteraction()};
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();begin3DInteraction();clearTimeout(wheelQualityTimer);distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,MIN_3D_DISTANCE,MAX_3D_DISTANCE);camera.position.z=distance;request3DRender();wheelQualityTimer=setTimeout(()=>end3DInteraction(),120)},{passive:false});
 const resize=()=>{camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1);camera.updateProjectionMatrix();updateAxisWidget();renderer.setPixelRatio(active3DPixelRatio);renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);resizeEditOverlay();sceneState?.medicalVolume?.resize();request3DRender()};sceneState.resize=resize;new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>{if(!sceneState?.needsRender)return;sceneState.needsRender=false;if(sceneState.obj){axisWidget.quaternion.copy(sceneState.obj.quaternion);if(sectionViewOpen&&sectionViewPlane)updateSectionClipPlaneWorld();if(sceneState.mprPlaneGroup){sceneState.mprPlaneGroup.visible=true;sceneState.mprPlaneGroup.position.copy(sceneState.obj.position);sceneState.mprPlaneGroup.quaternion.copy(sceneState.obj.quaternion);sceneState.mprPlaneGroup.scale.copy(sceneState.obj.scale)}}else if(sceneState.mprPlaneGroup)sceneState.mprPlaneGroup.visible=false;if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){sceneState.medicalVolume.render(camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);renderer.render(scene,camera)}else renderer.render(scene,camera)});
}
class RunUnionFind{
 constructor(capacity=65536){this.parent=new Uint32Array(capacity);this.size=new Uint32Array(capacity);this.count=0}
 grow(){
  const nextCap=this.parent.length*2,p=new Uint32Array(nextCap),s=new Uint32Array(nextCap);p.set(this.parent);s.set(this.size);this.parent=p;this.size=s;
 }
 add(weight){
  if(this.count>=this.parent.length)this.grow();const id=this.count++;this.parent[id]=id;this.size[id]=weight;return id;
 }
 find(id){
  let root=id;while(this.parent[root]!==root)root=this.parent[root];
  while(this.parent[id]!==id){const next=this.parent[id];this.parent[id]=root;id=next}
  return root;
 }
 union(a,b){
  let ra=this.find(a),rb=this.find(b);if(ra===rb)return ra;
  if(this.size[ra]<this.size[rb]){const t=ra;ra=rb;rb=t}
  this.parent[rb]=ra;this.size[ra]+=this.size[rb];return ra;
 }
}
function unionOverlappingRuns(a,b,uf){
 let i=0,j=0;
 while(i<a.length&&j<b.length){
  const ar=a[i],br=b[j];
  if(ar[1]<br[0]){i++;continue}
  if(br[1]<ar[0]){j++;continue}
  uf.union(ar[2],br[2]);
  if(ar[1]<=br[1])i++;else j++;
 }
}
function sourceRunSlice(mask,w,h,z,seed,uf,prevSliceRows){
 const records=[],rows=new Array(h);let prevRow=[];
 for(let y=0;y<h;y++){
  const runs=[];let x=0,row=y*w;
  while(x<w){
   while(x<w&&!mask[row+x])x++;if(x>=w)break;
   const x0=x;while(x+1<w&&mask[row+x+1])x++;const x1=x,label=uf.add(x1-x0+1),run=[x0,x1,label];runs.push(run);
   if(Math.abs(z-seed.z)<=2&&Math.abs(y-seed.y)<=2){
    const dx=seed.x<x0?x0-seed.x:seed.x>x1?seed.x-x1:0;
    if(dx<=2){
     const dist2=dx*dx+(y-seed.y)*(y-seed.y)+(z-seed.z)*(z-seed.z);
     if(dist2<seed.bestDist2){seed.bestDist2=dist2;seed.label=label}
    }
   }
   records.push(y,x0,x1,label);x++;
  }
  unionOverlappingRuns(runs,prevRow,uf);
  unionOverlappingRuns(runs,prevSliceRows?.[y]||[],uf);
  rows[y]=runs;prevRow=runs;
 }
 return{rows,records:new Uint32Array(records)};
}
async function sourceSegmentMaskBlock(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart);
 if(stages.length){
  const block=await getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,[{key,seg}],'analysis:'+analysisRevision);
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const masks=[];
  for(let z=0;z<block.coreDepth;z++){
   const bits=block.data.subarray(z*series.columns*series.rows,(z+1)*series.columns*series.rows),mask=new Uint8Array(bits.length);
   for(let i=0;i<bits.length;i++)mask[i]=(bits[i]&1)?1:0;
   masks.push(mask);
  }
  return masks;
 }
 const masks=[];
 for(let z=0;z<coreDepth;z++){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const state=(await decodeSourceSegmentMasks(series.slices[zStart+z],[{key,seg}])).get(key);masks.push(state.mask);
 }
 return masks;
}
function sourceRunSliceFromRanges(rowRanges,w,h,z,seed,uf,prevSliceRows){
 const records=[],rows=new Array(h);let prevRow=[];
 for(let y=0;y<h;y++){
  const raw=rowRanges.get(y)||[];raw.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const pair of raw){if(!merged.length||pair[0]>merged[merged.length-1][1]+1)merged.push([pair[0],pair[1]]);else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],pair[1])}
  const runs=[];
  for(const [x0,x1] of merged){
   const label=uf.add(x1-x0+1),run=[x0,x1,label];runs.push(run);
   if(Math.abs(z-seed.z)<=2&&Math.abs(y-seed.y)<=2){
    const dx=seed.x<x0?x0-seed.x:seed.x>x1?seed.x-x1:0,dist2=dx*dx+(y-seed.y)*(y-seed.y)+(z-seed.z)*(z-seed.z);
    if(dx<=2&&dist2<seed.bestDist2){seed.bestDist2=dist2;seed.label=label}
   }
   records.push(y,x0,x1,label);
  }
  unionOverlappingRuns(runs,prevRow,uf);unionOverlappingRuns(runs,prevSliceRows?.[y]||[],uf);rows[y]=runs;prevRow=runs;
 }
 return{rows,records:new Uint32Array(records)};
}
function consumeGpuAnalysisRuns(items,zStart,depth,w,h,seed,uf,prevRows,sliceRuns){
 const bySlice=Array.from({length:depth},()=>new Map());
 for(let i=0;i<items.length;i+=4){
  const lz=items[i],y=items[i+1],x0=items[i+2],x1=items[i+3];if(lz>=depth||y>=h)continue;
  const map=bySlice[lz],arr=map.get(y)||[];arr.push([x0,x1]);map.set(y,arr);
 }
 let rows=prevRows;
 for(let local=0;local<depth;local++){
  const z=zStart+local,result=sourceRunSliceFromRanges(bySlice[local],w,h,z,seed,uf,rows);sliceRuns[z]=result.records;rows=result.rows;
 }
 return rows;
}
async function sourceSegmentRunBlockGpu(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart),device=await ensureGpuFilterDevice();if(!device)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
 let rawError=null;
 if(!stages.length&&series.slices.slice(zStart,zStart+coreDepth).every(meta=>isNativeDicomTransferSyntax(meta.ts))){
  try{
   const raw=await gpuValidationScope(device,'raw DICOM analysis RLE',()=>extractSourceThresholdRuns(device,series,zStart,coreDepth,seg));
   if(raw){setGpuComputeBackend('WEBGPU ANALYSIS RAW-RLE');return raw}
  }catch(e){rawError=e;console.warn('Raw DICOM GPU RLE unavailable; retrying decoded CT on WebGPU.',e)}
 }
 const halo=sourceFilterHalo(stages),z0=Math.max(0,zStart-halo),z1=Math.min(series.slices.length,zStart+coreDepth+halo),box={x:0,y:0,z:z0,width:series.columns,height:series.rows,depth:z1-z0},data=await readSourceRegion(series,box,analysisRevision,true);
 if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const target={x:0,y:0,z:zStart-z0,width:series.columns,height:series.rows,depth:coreDepth};
 try{
  const result=await gpuValidationScope(device,'decoded CT analysis RLE',()=>runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,stages,target,[{key,seg}],{analysisRuns:true}));
  if(!result?.analysisRuns)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
  setGpuComputeBackend(stages.length?'WEBGPU ANALYSIS FILTER+RLE':'WEBGPU ANALYSIS DECODED-RLE',rawError?.message||null);
  return{items:result.items,coreDepth};
 }catch(e){
  if(rawError&&String(e.message||e)==='__GPU_ANALYSIS_UNAVAILABLE__')gpuFilterRuntime.lastError='raw RLE: '+String(rawError.message||rawError);
  throw e;
 }
}
async function connectedComponentVolumeGpuRuns(v,key,seg,x0,y0,z0){
 const device=await ensureGpuFilterDevice();if(!device||segmentNeedsGlobalMask(seg))return null;
 const w=v.columns,h=v.rows,d=v.slices,uf=new RunUnionFind(),sliceRuns=new Array(d),seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity},plane=w*h;
 let prevRows=null,done=0;const blockDepth=navigator.maxTouchPoints>0?4:16;
 try{
  for(let z0b=0;z0b<d;z0b+=blockDepth){
   const coreDepth=Math.min(blockDepth,d-z0b),data=readMemoryRegion(v,{x:0,y:0,z:z0b,width:w,height:h,depth:coreDepth}),target={x:0,y:0,z:0,width:w,height:h,depth:coreDepth};
   const result=await gpuValidationScope(device,'analysis RLE',()=>runGpuSourceFilters(data,w,h,coreDepth,v.min,v.max,[],target,[{key,seg}],{analysisRuns:true}));
   if(!result?.analysisRuns)return null;
   prevRows=consumeGpuAnalysisRuns(result.items,z0b,coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+coreDepth;
   analysisSummary.textContent=(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… ')+done+' / '+d;await frameYield();
  }
 }catch(e){setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',e?.message||e);console.warn('GPU connected-component run extraction failed; CPU analysis will be used.',e);return null}
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];setGpuComputeBackend('WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');return{voxels,mm3,root,uf,sliceRuns};
}
async function connectedComponentVolumeSource(v,key,seg,x0,y0,z0){
 const w=v.columns,h=v.rows,d=v.slices,analysisRevision=sourceFilterRuntime.revision,uf=new RunUnionFind(),sliceRuns=new Array(d);
 const seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity};
 let prevRows=null,done=0,gpuUsed=false,hadCpuPath=false;const blockDepth=navigator.maxTouchPoints>0?4:16;
 for(let z0b=0;z0b<d;z0b+=blockDepth){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  let gpuBlock=null;
  try{gpuBlock=await sourceSegmentRunBlockGpu(v,key,seg,z0b,blockDepth,analysisRevision)}catch(e){if(String(e.message||e)!=='__GPU_ANALYSIS_UNAVAILABLE__'){gpuFilterRuntime.lastError=String(e.message||e);console.warn('GPU source analysis block failed; using CPU mask block.',e)}}
  if(gpuBlock){
   gpuUsed=true;prevRows=consumeGpuAnalysisRuns(gpuBlock.items,z0b,gpuBlock.coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+gpuBlock.coreDepth;
  }else{
   hadCpuPath=true;setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0b,blockDepth,analysisRevision);
   for(let local=0;local<masks.length;local++){const z=z0b+local,result=sourceRunSlice(masks[local],w,h,z,seed,uf,prevRows);sliceRuns[z]=result.records;prevRows=result.rows;done=z+1}
   setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
  }
  analysisSummary.textContent=((gpuUsed&&!hadCpuPath)?(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… '):(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… '))+done+' / '+d;await frameYield();
 }
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
 if(gpuUsed&&!hadCpuPath)setGpuComputeBackend(sourceFilterStages().length?'WEBGPU ANALYSIS FILTER+RLE · CPU CONNECTIVITY':'WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');
 else if(gpuUsed&&hadCpuPath)setGpuComputeBackend('GPU+CPU ANALYSIS',gpuFilterRuntime.lastError||'Some analysis blocks used the exact CPU path');
 return{voxels,mm3,root,uf,sliceRuns};
}
function sourceComponentSliceState(records,w,h,root,uf){
 const mask=new Uint8Array(w*h),blocks=[],blockSize=16384;let block=new Uint32Array(blockSize),used=0;
 const push=i=>{if(used===block.length){blocks.push(block);block=new Uint32Array(blockSize);used=0}block[used++]=i};
 if(records)for(let r=0;r<records.length;r+=4){
  const y=records[r],x0=records[r+1],x1=records[r+2],label=records[r+3];if(uf.find(label)!==root)continue;
  const start=y*w+x0;mask.fill(1,start,start+(x1-x0+1));for(let x=x0;x<=x1;x++)push(y*w+x);
 }
 if(used)blocks.push(block.subarray(0,used));
 return{mask,blocks};
}
async function showSourceAnalysisHighlight(v,result,key){
 clearAnalysisHighlight();if(!sceneState?.obj)return;
 const series=v.series,w=v.columns,h=v.rows,d=v.slices,coords=makeSource3DCoordinates(series),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{
  const positions=builder.take();if(!positions)return;
  const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial());
  mesh.name='analysis_'+key+'_'+z;mesh.renderOrder=20;group.add(mesh);
 };
 let prev=null,curr=sourceComponentSliceState(result.sliceRuns[0],w,h,result.root,result.uf),next=d>1?sourceComponentSliceState(result.sliceRuns[1],w,h,result.root,result.uf):null;
 for(let z=0;z<d;z++){
  appendSourceSliceFacesFast(builder,series,z,prev,curr,next,coords);
  if(builder.length>=floatLimit)flush(z);
  prev=curr;curr=next;next=z+2<d?sourceComponentSliceState(result.sliceRuns[z+2],w,h,result.root,result.uf):null;
  if((z&31)===0)await frameYield();
 }
 flush(d-1);
 if(!group.children.length)return;
 sceneState.analysisMesh=group;sceneState.obj.add(group);request3DRender();
}
function surfacePointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const hits=raycaster.intersectObjects(sceneState.obj.children,true);
 const hit=hits.find(h=>h.object?.userData?.analysisRegionId===analysisFocusedRegionId)||(preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):null)||hits.find(h=>segmentKeyFromIntersection(h)||h.object?.userData?.analysisRegionId);
 if(!hit)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone());
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),hit};
}
function surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const hits=raycaster.intersectObjects(sceneState.obj.children,true),hit=preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):hits.find(h=>segmentKeyFromIntersection(h));
 if(!hit)return null;
 const key=segmentKeyFromIntersection(hit);if(!key)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone()),inv=sceneState.obj.matrixWorld.clone().invert(),toVoxelDir=vec=>{const q=vec.clone().transformDirection(inv).normalize();return{x:q.x,y:-q.y,z:q.z}},localRay=toVoxelDir(raycaster.ray.direction),cameraRight=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)),cameraUp=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1));
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),ray:localRay,right:cameraRight,up:cameraUp,hit,key};
}
function createCutPlacementFrame(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const obj=sceneState.obj,surface=surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey),viewDir=new THREE.Vector3();camera.getWorldDirection(viewDir).normalize();
 let anchorWorld=surface?.hit?.point?.clone?.()||null;
 if(!anchorWorld){
  const box=new THREE.Box3().setFromObject(obj),center=box.getCenter(new THREE.Vector3());
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(viewDir,center);
  anchorWorld=new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(plane,anchorWorld))return null;
 }
 const inv=obj.matrixWorld.clone().invert(),toVoxelDir=vec=>{const q=vec.clone().transformDirection(inv).normalize();return{x:q.x,y:-q.y,z:q.z}};
 return{plane:new THREE.Plane().setFromNormalAndCoplanarPoint(viewDir,anchorWorld),ray:toVoxelDir(raycaster.ray.direction),right:toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)),up:toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1)),key:surface?.key||preferredKey||null,anchor:surface||null};
}
function cutPointerVoxel(event,canvas,camera,preferredKey=null,frame=null){
 if(!sceneState?.obj||!volume)return null;
 const placement=frame||createCutPlacementFrame(event,canvas,camera,preferredKey);if(!placement)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const world=new THREE.Vector3();if(!raycaster.ray.intersectPlane(placement.plane,world))return null;
 const obj=sceneState.obj,v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=obj.worldToLocal(world.clone());
 const surface=surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey),key=surface?.key||preferredKey||placement.key||null;
 return{x:(local.x/scale+px/2)/vx,y:(-local.y/scale+py/2)/vy,z:(local.z/scale+pz/2)/vz,ray:placement.ray,right:placement.right,up:placement.up,hit:surface?.hit||null,key,virtual:!surface};
}
async function segmentKeyAtVoxel(v,x,y,z){
 const w=v.columns,h=v.rows,d=v.slices;if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return null;
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||!(segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg))))continue;
  const runs=await getFinalSegmentRuns(key,v);if(analysisRunsContain(runs,x,y,z))return key;
 }
 let value=null;
 if(v.sourceBacked){
  if(sourceFilterStages().length){
   const values=await getFilteredSourcePlaneValues('axial',z,v.series,'analysis-pick');value=values[y*w+x];
  }else{
   const values=await getCachedSourceSlice(v.series.slices[z]);value=values[y*w+x];
  }
 }else value=v.data[z*h*w+y*w+x];
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg)))continue;
  if(!v.sourceBacked&&segmentNeedsGlobalMask(seg)){const mask=getProcessedSegmentMask(v,seg);if(mask[z*h*w+y*w+x]===1)return key}
  else if(value>=seg.min&&value<=seg.max)return key;
 }
 return null;
}
async function analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z){
 const [vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,seg=segmentState[key];
 if(segmentEditActive(key)||(analysisVolume.sourceBacked&&segmentNeedsGlobalMask(seg))){
  const runs=await getFinalSegmentRuns(key,analysisVolume),comps=componentsFromRuns(runs,w,h,d);let comp=comps.find(item=>analysisRunsContain(item.runsBySlice,x,y,z));
  if(!comp){for(let r=1;r<=2&&!comp;r++)for(let dz=-r;dz<=r&&!comp;dz++)for(let dy=-r;dy<=r&&!comp;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(ix<0||iy<0||iz<0||ix>=w||iy>=h||iz>=d)continue;comp=comps.find(item=>analysisRunsContain(item.runsBySlice,ix,iy,iz));if(comp)break}}
  if(!comp)throw new Error(currentLanguage==='ja'?'処理後の領域を特定できませんでした':'Could not identify the processed component');
  const mm3=comp.voxels*vx*vy*vz;setGpuComputeBackend('PROCESSED RLE · CPU CONNECTIVITY');return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels:comp.voxels,mm3});
 }
 if(analysisVolume.sourceBacked){
  const result=await connectedComponentVolumeSource(analysisVolume,key,seg,x,y,z),runsBySlice=sourceResultToAnalysisRuns(result,d);
  return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
 }
 const gpuResult=await connectedComponentVolumeGpuRuns(analysisVolume,key,seg,x,y,z);
 if(gpuResult){
  const runsBySlice=sourceResultToAnalysisRuns(gpuResult,d);return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:gpuResult.voxels,mm3:gpuResult.mm3});
 }
 setGpuComputeBackend('CPU ANALYSIS');
 const processedMask=getProcessedSegmentMask(analysisVolume,seg),inside=(ix,iy,iz)=>ix>=0&&iy>=0&&iz>=0&&ix<w&&iy<h&&iz<d&&processedMask[iz*h*w+iy*w+ix]===1;
 if(!inside(x,y,z)){
  let found=null;for(let r=1;r<=2&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(inside(ix,iy,iz)){found=[ix,iy,iz];break}}
  if(!found)throw new Error(currentLanguage==='ja'?'選択位置から領域を特定できませんでした':'Could not identify a component at the selected point');
  [x,y,z]=found;
 }
 const result=await connectedComponentVolume(analysisVolume,seg,x,y,z,processedMask),runsBySlice=maskToAnalysisRuns(result.mask,w,h,d);
 return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
}
async function analyzeVolumeAtVoxel(x,y,z,keyHint=null){
 if(!volume||volumeAnalysisBusy)return false;const analysisVolume=current3DVolume||volume;
 volumeAnalysisBusy=true;volumeAnalysisResult.classList.remove('is-hidden');renderAnalysisResults(currentLanguage==='ja'?'解析中…':'Analyzing…');
 try{
  const key=keyHint||await segmentKeyAtVoxel(analysisVolume,x,y,z);
  if(!key){renderAnalysisResults(currentLanguage==='ja'?'選択位置に解析対象の領域がありません':'No analyzable segment at the selected point');return false}
  await analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z);return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'体積解析エラー: ':'Volume analysis error: ')+String(e.message||e))}
  return false;
 }finally{volumeAnalysisBusy=false;renderAnalysisResults()}
}
async function analyzeVolumeAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const analysisVolume=current3DVolume||volume,[vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,px=w*vx,py=h*vy,pz=d*vz;
 let key,x,y,z;
 if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){
  setGpuComputeBackend('WEBGPU VOLUME PICK');
  const picked=await sceneState.medicalVolume.pick(event.clientX,event.clientY,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);
  if(!picked){renderAnalysisResults(tr('volumeHint'));return}
  key=picked.key;x=picked.x;y=picked.y;z=picked.z;
 }else{
  const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(sceneState.obj.children,true),analysisHit=hits.find(h=>h.object?.userData?.analysisRegionId!=null);
  if(analysisHit){const region=analysisRegionById(analysisHit.object.userData.analysisRegionId);if(region){const picked=surfacePointerVoxel(event,canvas,camera,region.segmentKeys[0]);setAnalysisFocusedRegion(region.id,picked?{x:picked.x,y:picked.y,z:picked.z}:null);return}}
  const hit=hits.find(h=>segmentKeyFromIntersection(h));
  if(!hit){renderAnalysisResults(tr('volumeHint'));return}
  key=segmentKeyFromIntersection(hit);const scale=hit.object.userData.displayScale,local=hit.object.worldToLocal(hit.point.clone());
  x=Math.round((local.x/scale+px/2)/vx);y=Math.round((-local.y/scale+py/2)/vy);z=Math.round((local.z/scale+pz/2)/vz);
 }
 await analyzeVolumeAtVoxel(x,y,z,key);
}
async function connectedComponentVolume(v,seg,x0,y0,z0,mask=getProcessedSegmentMask(v,seg)){
 const w=v.columns,h=v.rows,d=v.slices,n=w*h*d,data=v.data,visited=new Uint8Array(n);
 let queue=new Int32Array(65536),head=0,tail=0;
 const grow=()=>{const next=new Int32Array(queue.length*2);next.set(queue);queue=next};
 const start=z0*h*w+y0*w+x0;queue[tail++]=start;visited[start]=1;
 let count=0,steps=0;
 const tryPush=i=>{if(i<0||i>=n||visited[i]||!mask[i])return;visited[i]=1;if(tail>=queue.length)grow();queue[tail++]=i};
 while(head<tail){
  const i=queue[head++];count++;
  const z=Math.floor(i/(h*w)),rem=i-z*h*w,y=Math.floor(rem/w),x=rem-y*w;
  if(x>0)tryPush(i-1);if(x<w-1)tryPush(i+1);if(y>0)tryPush(i-w);if(y<h-1)tryPush(i+w);if(z>0)tryPush(i-h*w);if(z<d-1)tryPush(i+h*w);
  if((++steps&0x3ffff)===0)await frameYield();
 }
 return{voxels:count,mm3:count*v.spacing[0]*v.spacing[1]*v.spacing[2],mask:visited};
}

function createAnalysisMaterial(color=0x00d8ff){
 return new THREE.MeshStandardMaterial({
  color,emissive:color,emissiveIntensity:.55,transparent:true,opacity:.92,
  roughness:.35,metalness:0,side:THREE.DoubleSide,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,flatShading:!surfaceSmoothingActive()
 });
}
function appendDecodedMaskSliceFaces(builder,v,mask,z,coords){
 const w=v.columns,h=v.rows,plane=w*h,{xs,ys,zs}=coords,z0=zs[z],z1=zs[z+1],base=z*plane;
 const inside=(x,y,zz)=>x>=0&&y>=0&&zz>=0&&x<w&&y<h&&zz<v.slices&&mask[zz*plane+y*w+x]===1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=base+y*w+x;if(!mask[i])continue;
  const x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1];
  if(!inside(x-1,y,z))builder.push(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y0,z0,x0,y1,z1,x0,y1,z0);
  if(!inside(x+1,y,z))builder.push(x1,y0,z0,x1,y1,z0,x1,y1,z1,x1,y0,z0,x1,y1,z1,x1,y0,z1);
  if(!inside(x,y-1,z))builder.push(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z0,x1,y0,z1,x0,y0,z1);
  if(!inside(x,y+1,z))builder.push(x0,y1,z0,x0,y1,z1,x1,y1,z1,x0,y1,z0,x1,y1,z1,x1,y1,z0);
  if(!inside(x,y,z-1))builder.push(x0,y0,z0,x0,y1,z0,x1,y1,z0,x0,y0,z0,x1,y1,z0,x1,y0,z0);
  if(!inside(x,y,z+1))builder.push(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y0,z1,x1,y1,z1,x0,y1,z1);
 }
}
function maskToAnalysisRuns(mask,w,h,d){
 const slices=new Array(d);
 for(let z=0;z<d;z++){
  const rec=[];const base=z*w*h;
  for(let y=0;y<h;y++){
   let x=0,row=base+y*w;
   while(x<w){
    while(x<w&&!mask[row+x])x++;if(x>=w)break;
    const x0=x;while(x+1<w&&mask[row+x+1])x++;rec.push(y,x0,x);x++;
   }
  }
  slices[z]=new Uint32Array(rec);
 }
 return slices;
}
function sourceResultToAnalysisRuns(result,d){
 const slices=new Array(d);
 for(let z=0;z<d;z++){
  const src=result.sliceRuns[z],rec=[];
  if(src)for(let i=0;i<src.length;i+=4){
   const y=src[i],x0=src[i+1],x1=src[i+2],label=src[i+3];
   if(result.uf.find(label)===result.root)rec.push(y,x0,x1);
  }
  slices[z]=new Uint32Array(rec);
 }
 return slices;
}
function analysisRunsVoxelCount(runsBySlice){
 let count=0;for(const rec of runsBySlice||[])if(rec)for(let i=0;i<rec.length;i+=3)count+=rec[i+2]-rec[i+1]+1;return count;
}
function analysisRunsContain(runsBySlice,x,y,z){
 const rec=runsBySlice?.[z];if(!rec)return false;
 for(let i=0;i<rec.length;i+=3){if(rec[i]!==y)continue;if(x>=rec[i+1]&&x<=rec[i+2])return true}
 return false;
}
function analysisRunsOverlap(a,b){
 const d=Math.min(a?.length||0,b?.length||0);
 for(let z=0;z<d;z++){
  const ar=a[z],br=b[z];if(!ar?.length||!br?.length)continue;
  let i=0,j=0;
  while(i<ar.length&&j<br.length){
   const ay=ar[i],by=br[j];
   if(ay<by){i+=3;continue}if(by<ay){j+=3;continue}
   const a0=ar[i+1],a1=ar[i+2],b0=br[j+1],b1=br[j+2];
   if(a1<b0){i+=3;continue}if(b1<a0){j+=3;continue}return true;
  }
 }
 return false;
}
function unionAnalysisRuns(regions,d){
 const out=new Array(d);
 for(let z=0;z<d;z++){
  const byRow=new Map();
  for(const region of regions){
   const rec=region.runsBySlice[z];if(!rec)continue;
   for(let i=0;i<rec.length;i+=3){
    const y=rec[i],arr=byRow.get(y)||[];arr.push([rec[i+1],rec[i+2]]);byRow.set(y,arr);
   }
  }
  const merged=[];
  for(const y of [...byRow.keys()].sort((a,b)=>a-b)){
   const intervals=byRow.get(y).sort((a,b)=>a[0]-b[0]);let [s,e]=intervals[0];
   for(let i=1;i<intervals.length;i++){
    const [ns,ne]=intervals[i];
    if(ns<=e+1)e=Math.max(e,ne);else{merged.push(y,s,e);s=ns;e=ne}
   }
   merged.push(y,s,e);
  }
  out[z]=new Uint32Array(merged);
 }
 return out;
}
function rowIntervalsFromRuns(rec){
 const rows=new Map();if(!rec)return rows;
 for(let i=0;i<rec.length;i+=3){const y=rec[i],arr=rows.get(y)||[];arr.push([rec[i+1],rec[i+2]]);rows.set(y,arr)}
 for(const arr of rows.values())arr.sort((a,b)=>a[0]-b[0]);
 return rows;
}
function mergeIntervals(intervals){
 if(!intervals?.length)return[];
 const sorted=intervals.slice().sort((a,b)=>a[0]-b[0]),out=[];let [s,e]=sorted[0];
 for(let i=1;i<sorted.length;i++){const [ns,ne]=sorted[i];if(ns<=e+1)e=Math.max(e,ne);else{out.push([s,e]);s=ns;e=ne}}
 out.push([s,e]);return out;
}
function rowsToRunSlice(rows){
 const rec=[];for(const y of [...rows.keys()].sort((a,b)=>a-b))for(const [x0,x1] of mergeIntervals(rows.get(y)))if(x1>=x0)rec.push(y,x0,x1);
 return new Uint32Array(rec);
}
function unionRunSlice(a,b){
 const rows=rowIntervalsFromRuns(a);for(const [y,arr] of rowIntervalsFromRuns(b)){const dst=rows.get(y)||[];dst.push(...arr);rows.set(y,dst)}return rowsToRunSlice(rows);
}
function intersectRunSlice(a,b){
 const ar=rowIntervalsFromRuns(a),br=rowIntervalsFromRuns(b),out=new Map();
 for(const [y,aa] of ar){const bb=br.get(y);if(!bb)continue;const rr=[];let i=0,j=0;while(i<aa.length&&j<bb.length){const lo=Math.max(aa[i][0],bb[j][0]),hi=Math.min(aa[i][1],bb[j][1]);if(lo<=hi)rr.push([lo,hi]);if(aa[i][1]<bb[j][1])i++;else j++}if(rr.length)out.set(y,rr)}
 return rowsToRunSlice(out);
}
function subtractRunSlice(a,b){
 const ar=rowIntervalsFromRuns(a),br=rowIntervalsFromRuns(b),out=new Map();
 for(const [y,aa] of ar){const bb=br.get(y)||[],rr=[];for(const [a0,a1] of aa){let cursor=a0;for(const [b0,b1] of bb){if(b1<cursor)continue;if(b0>a1)break;if(b0>cursor)rr.push([cursor,Math.min(a1,b0-1)]);cursor=Math.max(cursor,b1+1);if(cursor>a1)break}if(cursor<=a1)rr.push([cursor,a1])}if(rr.length)out.set(y,rr)}
 return rowsToRunSlice(out);
}
function runArraysBinary(a,b,d,op){
 const out=new Array(d);for(let z=0;z<d;z++)out[z]=op(a?.[z],b?.[z]);return out;
}
function unionRunArrays(a,b,d){return runArraysBinary(a,b,d,unionRunSlice)}
function intersectRunArrays(a,b,d){return runArraysBinary(a,b,d,intersectRunSlice)}
function subtractRunArrays(a,b,d){return runArraysBinary(a,b,d,subtractRunSlice)}
function segmentEditActive(key){const s=segmentEditState[key];return !!(s?.keepRuns||s?.excludeRuns)}
function segmentBaseSignature(key,v){
 const s=segmentState[key];return [activeId,key,s.min,s.max,s.opening,s.closing,s.minComponent,s.holeFill,filterRebuildRevision,sourceFilterRuntime.revision,v?.columns,v?.rows,v?.slices].join('|');
}
function clearSegmentEditCache(key,clearEdits=false){
 const st=segmentEditState[key];if(!st)return;st.baseRuns=null;st.baseSignature='';st.finalRuns=null;
 if(clearEdits){st.keepRuns=null;st.excludeRuns=null;st.undo=[];st.redo=[];st.revision=0}
}
function clearAllSegmentEdits(){
 for(const key of SEGMENT_PRESET_ORDER){const st=segmentEditState[key];if(st.surfaceGroup?.parent)st.surfaceGroup.parent.remove(st.surfaceGroup);st.surfaceGroup=null;clearSegmentEditCache(key,true)}
 analysisEditTool='select';analysisEditTargetKey=null;analysisEditTargetMode='auto';if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';analysisCutStroke=null;analysisCutScreen=[];analysisPendingCut=null;clearCutResultPreview();updateThreeEditUi();
}
function thresholdRunsFromMemory(v,seg){
 const w=v.columns,h=v.rows,d=v.slices,out=new Array(d),plane=w*h;
 if(segmentNeedsGlobalMask(seg))return maskToAnalysisRuns(getProcessedSegmentMask(v,seg),w,h,d);
 for(let z=0;z<d;z++){const rec=[],base=z*plane;for(let y=0;y<h;y++){let x=0,row=base+y*w;while(x<w){while(x<w&&(v.data[row+x]<seg.min||v.data[row+x]>seg.max))x++;if(x>=w)break;const x0=x;while(x+1<w&&v.data[row+x+1]>=seg.min&&v.data[row+x+1]<=seg.max)x++;rec.push(y,x0,x);x++}}out[z]=new Uint32Array(rec)}
 return out;
}
function runsSliceToMask(rec,w,h){
 const mask=new Uint8Array(w*h);if(!rec)return mask;
 for(let i=0;i<rec.length;i+=3){const y=rec[i],x0=rec[i+1],x1=rec[i+2],row=y*w;mask.fill(1,row+x0,row+x1+1)}
 return mask;
}
function complementRunArrays(runs,w,h,d){
 const out=new Array(d);
 for(let z=0;z<d;z++){
  const rows=rowIntervalsFromRuns(runs[z]),rec=[];
  for(let y=0;y<h;y++){
   const rr=rows.get(y)||[];let x=0;
   for(const [x0,x1] of rr){if(x<x0)rec.push(y,x,x0-1);x=Math.max(x,x1+1)}
   if(x<w)rec.push(y,x,w-1);
  }
  out[z]=new Uint32Array(rec);
 }
 return out;
}
function componentTouchesVolumeBoundary(comp,w,h,d){
 for(let z=0;z<d;z++){
  const rec=comp.runsBySlice[z];if(!rec?.length)continue;
  if(z===0||z===d-1)return true;
  for(let i=0;i<rec.length;i+=3){const y=rec[i],x0=rec[i+1],x1=rec[i+2];if(y===0||y===h-1||x0===0||x1===w-1)return true}
 }
 return false;
}
async function morphSourceRunArrays(runs,w,h,d,opening,closing){
 if(!opening&&!closing)return runs;
 const out=new Array(d),blockDepth=navigator.maxTouchPoints>0?4:12,halo=2*(opening+closing),plane=w*h;
 for(let z0=0;z0<d;z0+=blockDepth){
  const core=Math.min(blockDepth,d-z0),a=Math.max(0,z0-halo),b=Math.min(d,z0+core+halo),localD=b-a,mask=new Uint8Array(localD*plane);
  for(let z=a;z<b;z++)mask.set(runsSliceToMask(runs[z],w,h),(z-a)*plane);
  let processed=mask;
  if(opening>0){processed=morphMask(processed,w,h,localD,opening,false);processed=morphMask(processed,w,h,localD,opening,true)}
  if(closing>0){processed=morphMask(processed,w,h,localD,closing,true);processed=morphMask(processed,w,h,localD,closing,false)}
  for(let z=0;z<core;z++){const local=z0+z-a,slice=processed.subarray(local*plane,(local+1)*plane);out[z0+z]=maskToAnalysisRuns(slice,w,h,1)[0]}
  await frameYield();
 }
 return out;
}
async function postprocessSourceRuns(runs,v,seg){
 const w=v.columns,h=v.rows,d=v.slices;
 let out=await morphSourceRunArrays(runs,w,h,d,seg.opening,seg.closing);
 if(seg.holeFill){
  const background=complementRunArrays(out,w,h,d),holes=componentsFromRuns(background,w,h,d).filter(comp=>!componentTouchesVolumeBoundary(comp,w,h,d));
  if(holes.length){const holeRuns=unionAnalysisRuns(holes,d);out=unionRunArrays(out,holeRuns,d)}
  await frameYield();
 }
 if(seg.minComponent>0){
  const keep=componentsFromRuns(out,w,h,d).filter(comp=>comp.voxels>=seg.minComponent);
  out=keep.length?unionAnalysisRuns(keep,d):Array.from({length:d},()=>new Uint32Array(0));
  await frameYield();
 }
 return out;
}
async function sourceRunsForSegment(v,key,seg){
 if(segmentNeedsGlobalMask(seg)&&v.mprData){
  const memoryView=sourceMprMemoryView(v);
  return thresholdRunsFromMemory(memoryView,seg);
 }
 const d=v.slices,w=v.columns,h=v.rows,out=Array.from({length:d},()=>new Uint32Array(0)),revision=sourceFilterRuntime.revision,blockDepth=navigator.maxTouchPoints>0?4:16;
 for(let z0=0;z0<d;z0+=blockDepth){
  let gpu=null;try{gpu=await sourceSegmentRunBlockGpu(v,key,seg,z0,blockDepth,revision)}catch(e){console.warn('Edit base GPU RLE failed; using exact CPU RLE path.',e)}
  if(gpu){
   const per=Array.from({length:gpu.coreDepth},()=>[]);
   for(let i=0;i<gpu.items.length;i+=4){const lz=gpu.items[i];if(lz<per.length)per[lz].push(gpu.items[i+1],gpu.items[i+2],gpu.items[i+3])}
   for(let z=0;z<gpu.coreDepth;z++)out[z0+z]=new Uint32Array(per[z]);
  }else{
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0,blockDepth,revision);
   for(let z=0;z<masks.length;z++)out[z0+z]=maskToAnalysisRuns(masks[z],w,h,1)[0];
  }
  if((z0&63)===0)await frameYield();
 }
 return segmentNeedsGlobalMask(seg)?postprocessSourceRuns(out,v,seg):out;
}
async function ensureSegmentBaseRuns(key,v=current3DVolume||volume){
 if(!v||!segmentState[key])return null;const st=segmentEditState[key],sig=segmentBaseSignature(key,v);
 if(st.baseRuns&&st.baseSignature===sig)return st.baseRuns;
 setProcessingBusy(true,currentLanguage==='ja'?'編集領域を準備中':'Preparing editable segment',false);
 try{st.baseRuns=v.sourceBacked?await sourceRunsForSegment(v,key,segmentState[key]):thresholdRunsFromMemory(v,segmentState[key]);st.baseSignature=sig;return st.baseRuns}
 finally{setProcessingBusy(false,'',false)}
}
async function getFinalSegmentRuns(key,v=current3DVolume||volume){
 const st=segmentEditState[key],base=await ensureSegmentBaseRuns(key,v);if(!base)return null;let runs=base,d=v.slices;
 if(st.keepRuns)runs=intersectRunArrays(runs,st.keepRuns,d);
 if(st.excludeRuns)runs=subtractRunArrays(runs,st.excludeRuns,d);
 st.finalRuns=runs;return runs;
}
function snapshotAnalysisRegionsForSegment(key){
 return analysisRegions.filter(r=>r.segmentKeys.length===1&&r.segmentKeys[0]===key).map(r=>({
  runsBySlice:r.runsBySlice,color:r.color,visible:r.visible,selected:r.selected,focused:r.id===analysisFocusedRegionId,merged:r.merged,groupId:r.groupId||null
 }));
}
function editSnapshot(key){const st=segmentEditState[key];return{keepRuns:st.keepRuns,excludeRuns:st.excludeRuns,analysisRefs:snapshotAnalysisRegionsForSegment(key)}}
function pushEditUndo(key){const st=segmentEditState[key];st.undo.push(editSnapshot(key));if(st.undo.length>20)st.undo.shift();st.redo=[]}
function restoreEditSnapshot(key,snap){const st=segmentEditState[key];st.keepRuns=snap?.keepRuns||null;st.excludeRuns=snap?.excludeRuns||null;st.finalRuns=null;st.revision++}
function setBaseSegmentSurfaceVisibility(key,visible){
 sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||o.userData?.editSurface)return;
  if(o.userData?.segmentKey===key){o.visible=visible;return}
  if(Array.isArray(o.userData?.segmentRanges)&&Array.isArray(o.material))for(const r of o.userData.segmentRanges)if(r.key===key&&o.material[r.materialIndex])o.material[r.materialIndex].visible=visible;
 });
}
async function buildEditableRunsGroup(v,runs,key,shouldContinue=null){
 const seg=segmentState[key],smooth=surfaceSmoothingActive();
 if(smooth&&fullVolumeSmoothIsosurfaceFeasible(v)){
  if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
  const mask=maskFromAnalysisRuns(v,runs),mesh=await buildSmoothIsoMesh(v,mask,seg,key,true);
  if(shouldContinue&&!shouldContinue()){if(mesh)dispose(mesh);throw new Error('__SUPERSEDED__')}
  if(!mesh)return null;const group=new THREE.Group();group.add(mesh);return group;
 }
 const coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),limit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const params={color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!smooth};
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions,false,null,!smooth),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(params));mesh.name='edited_segment_'+key+'_'+z;mesh.userData.segmentKey=key;mesh.userData.editSurface=true;mesh.userData.displayScale=coords.scale;group.add(mesh)};
 try{
  for(let z=0;z<v.slices;z++){
   if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
   appendAnalysisRunBoundaryFaces(builder,runs[z],z?runs[z-1]:null,z+1<v.slices?runs[z+1]:null,coords,z);if(builder.length>=limit)flush(z);
   if((z&15)===0){await frameYield();if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__')}
  }
  flush(v.slices-1);
  if(smooth)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
  return group.children.length?group:null;
 }catch(e){dispose(group);throw e}
}
function segmentUsesRunSurface(key,v=current3DVolume||volume){
 return segmentEditActive(key)||!!(v?.sourceBacked&&segmentState[key]?.active&&segmentState[key]?.enabled&&segmentNeedsGlobalMask(segmentState[key]));
}
async function refreshEditedSegmentSurface(key,v=current3DVolume||volume,expectedRevision=null){
 if(!sceneState?.obj||!v)return false;const st=segmentEditState[key],isCurrent=()=>expectedRevision==null||st.revision===expectedRevision;
 if(!segmentUsesRunSurface(key,v)){
  if(!isCurrent())return false;
  if(st.surfaceGroup){const old=st.surfaceGroup;if(old.parent)old.parent.remove(old);dispose(old);st.surfaceGroup=null}
  setBaseSegmentSurfaceVisibility(key,true);request3DRender();renderAll();return true;
 }
 const runs=await getFinalSegmentRuns(key,v);if(!isCurrent())return false;
 const group=await buildEditableRunsGroup(v,runs,key,isCurrent);if(!isCurrent()){if(group)dispose(group);return false}
 const old=st.surfaceGroup;setBaseSegmentSurfaceVisibility(key,false);st.surfaceGroup=group;
 if(group)sceneState.obj.add(group);if(old){if(old.parent)old.parent.remove(old);dispose(old)}
 request3DRender();renderAll();return true;
}
async function restoreEditedSegmentSurfaces(v=current3DVolume||volume){
 for(const key of SEGMENT_PRESET_ORDER)if(segmentUsesRunSurface(key,v))await refreshEditedSegmentSurface(key,v);
}
function componentsFromRuns(runs,w,h,d){
 const uf=new RunUnionFind(),labeled=new Array(d),seed={x:-999999,y:-999999,z:-999999,label:null,bestDist2:Infinity};let prevRows=null;
 for(let z=0;z<d;z++){const map=rowIntervalsFromRuns(runs[z]),res=sourceRunSliceFromRanges(map,w,h,z,seed,uf,prevRows);labeled[z]=res.records;prevRows=res.rows}
 const groups=new Map();
 for(let z=0;z<d;z++){const rec=labeled[z];for(let i=0;i<rec.length;i+=4){const root=uf.find(rec[i+3]);let g=groups.get(root);if(!g){g={root,runsBySlice:Array.from({length:d},()=>[])};groups.set(root,g)}g.runsBySlice[z].push(rec[i],rec[i+1],rec[i+2])}}
 return [...groups.values()].map(g=>{g.runsBySlice=g.runsBySlice.map(a=>new Uint32Array(a));g.voxels=uf.size[uf.find(g.root)];return g}).sort((a,b)=>b.voxels-a.voxels);
}
function componentAtVoxel(runs,w,h,d,x,y,z){
 const comps=componentsFromRuns(runs,w,h,d);return comps.find(comp=>analysisRunsContain(comp.runsBySlice,x,y,z))||null;
}
async function rebuildEditedAnalysisForSegment(key,referenceRegions=null){
 const v=current3DVolume||volume;if(!v)return;
 const refs=referenceRegions||snapshotAnalysisRegionsForSegment(key);
 for(const region of analysisRegions.filter(r=>r.segmentKeys.includes(key)))disposeAnalysisRegionMesh(region);
 analysisRegions=analysisRegions.filter(r=>!r.segmentKeys.includes(key));analysisFocusedRegionId=null;
 if(!refs.length){renderAnalysisResults();renderAll();return}
 const runs=await getFinalSegmentRuns(key,v),comps=componentsFromRuns(runs,v.columns,v.rows,v.slices),usedRefs=new Map();let focusId=null,created=0;
 for(const comp of comps){
  const matches=refs.filter(ref=>analysisRunsOverlap(comp.runsBySlice,ref.runsBySlice));if(!matches.length)continue;
  const primary=matches[0],used=usedRefs.get(primary)||0;usedRefs.set(primary,used+1);
  const id=nextAnalysisRegionId++,voxels=comp.voxels,mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
  const region={id,regionId:'r'+id,groupId:used===0?primary.groupId:null,key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels,mm3,merged:used===0&&!!primary.merged,selected:!!primary.selected,focused:false,visible:primary.visible!==false,meshGroup:null,color:used===0?primary.color:nextAnalysisColor()};
  analysisRegions.push(region);await attachAnalysisRegion(region,v);if(primary.focused&&focusId==null)focusId=id;
  created++;if(created>=64)break;
 }
 if(focusId!=null)setAnalysisFocusedRegion(focusId);else{renderAnalysisResults();renderAll()}
}async function applyEditKeepSelected(){
 const region=analysisRegionById(analysisFocusedRegionId);if(!region||region.segmentKeys.length!==1)return;const key=region.segmentKeys[0],st=segmentEditState[key],refs=snapshotAnalysisRegionsForSegment(key).filter(r=>analysisRunsOverlap(r.runsBySlice,region.runsBySlice));pushEditUndo(key);st.keepRuns=region.runsBySlice;st.excludeRuns=null;st.finalRuns=null;st.revision++;
 await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,refs);footer.textContent=currentLanguage==='ja'?'選択領域だけを残しました':'Kept the selected region only';
}
async function applyEditRemoveSelected(){
 const region=analysisRegionById(analysisFocusedRegionId);if(!region||region.segmentKeys.length!==1)return;const key=region.segmentKeys[0],st=segmentEditState[key],v=current3DVolume||volume,refs=snapshotAnalysisRegionsForSegment(key).filter(r=>!analysisRunsOverlap(r.runsBySlice,region.runsBySlice));pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,region.runsBySlice,v.slices);st.finalRuns=null;st.revision++;
 await refreshEditedSegmentSurface(key,v);await rebuildEditedAnalysisForSegment(key,refs);footer.textContent=currentLanguage==='ja'?'選択領域を削除しました':'Deleted the selected region';
}
async function undoSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].undo.length);if(!key)return;analysisEditTargetKey=key;const st=segmentEditState[key],snap=st.undo.pop();if(!snap)return;st.redo.push(editSnapshot(key));restoreEditSnapshot(key,snap);await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[]);updateAnalysisEditorControls();footer.textContent='Undo';
}
async function redoSegmentEdit(){
 const key=analysisEditTargetKey&&segmentEditState[analysisEditTargetKey].redo.length?analysisEditTargetKey:SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].redo.length);if(!key)return;analysisEditTargetKey=key;const st=segmentEditState[key],snap=st.redo.pop();if(!snap)return;st.undo.push(editSnapshot(key));restoreEditSnapshot(key,snap);await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[]);updateAnalysisEditorControls();footer.textContent='Redo';
}
async function resetFocusedSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditActive(k));if(!key)return;analysisEditTargetKey=key;const refs=snapshotAnalysisRegionsForSegment(key);pushEditUndo(key);const st=segmentEditState[key];st.keepRuns=null;st.excludeRuns=null;st.finalRuns=null;st.revision++;await refreshEditedSegmentSurface(key);if(refs.length)await rebuildEditedAnalysisForSegment(key,refs);updateAnalysisEditorControls();footer.textContent=currentLanguage==='ja'?'編集をリセットしました':'Edits reset';
}
function cutDirectionFromPoint(p,yawDeg=0,pitchDeg=0){
 const norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}};
 const base=norm(p?.ray||{x:0,y:0,z:1}),right=norm(p?.right||{x:1,y:0,z:0}),up=norm(p?.up||{x:0,y:1,z:0});
 const yaw=yawDeg*Math.PI/180,pitch=pitchDeg*Math.PI/180,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 return norm({x:base.x*cy*cp+right.x*sy*cp+up.x*sp,y:base.y*cy*cp+right.y*sy*cp+up.y*sp,z:base.z*cy*cp+right.z*sy*cp+up.z*sp});
}
function cutSurfaceStroke(points,mode='pen',offsetMm=0,v=current3DVolume||volume){
 if(!points?.length)return[];
 const src=mode==='line'&&points.length>1?[points[0],points[points.length-1]]:points;
 if(!v||!offsetMm)return src;
 const [sx,sy,sz]=v.spacing,anchor=src[0],r=anchor?.ray||{x:0,y:0,z:1};
 return src.map(p=>({...p,x:p.x+r.x*offsetMm/sx,y:p.y+r.y*offsetMm/sy,z:p.z+r.z*offsetMm/sz}));
}
function cutPlanDirection(points,yawDeg=0,pitchDeg=0){
 return cutDirectionFromPoint(points?.[0]||null,yawDeg,pitchDeg);
}
function cutSurfaceFrameData(points,mode='pen',offsetMm=0,v=current3DVolume||volume,yawDeg=0,pitchDeg=0){
 const curve=cutSurfaceStroke(points,mode,offsetMm,v),dir=cutPlanDirection(points,yawDeg,pitchDeg);
 if(!v||!curve.length)return{curve,dir,normals:[]};
 const [sx,sy,sz]=v.spacing,norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}},cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,neg=q=>({x:-q.x,y:-q.y,z:-q.z}),delta=(a,b)=>({x:(b.x-a.x)*sx,y:(b.y-a.y)*sy,z:(b.z-a.z)*sz});
 const normals=[];let previous=null;
 for(let i=0;i<curve.length;i++){
  let tangent;
  if(curve.length===1)tangent=norm(curve[0]?.right||{x:1,y:0,z:0});
  else if(i===0)tangent=norm(delta(curve[0],curve[1]));
  else if(i===curve.length-1)tangent=norm(delta(curve[i-1],curve[i]));
  else tangent=norm(delta(curve[i-1],curve[i+1]));
  let normal=cross(tangent,dir),len=Math.hypot(normal.x,normal.y,normal.z);
  if(len<1e-6&&previous)normal={...previous},len=1;
  if(len<1e-6){normal=cross(tangent,curve[i]?.up||curve[0]?.up||{x:0,y:1,z:0});len=Math.hypot(normal.x,normal.y,normal.z)}
  if(len<1e-6){normal=cross(tangent,curve[i]?.right||curve[0]?.right||{x:1,y:0,z:0});len=Math.hypot(normal.x,normal.y,normal.z)}
  if(len<1e-6)normal={x:1,y:0,z:0};else normal=norm(normal);
  if(previous&&dot(normal,previous)<0)normal=neg(normal);
  normals.push(normal);previous=normal;
 }
 return{curve,dir,normals};
}
function cutRunsFromVoxelStroke(v,points,kerfMm,depthMm,yawDeg=0,pitchDeg=0,mode='pen',offsetMm=0){
 const d=v.slices,w=v.columns,h=v.rows,[sx,sy,sz]=v.spacing,minSpacing=Math.min(sx,sy,sz),rows=Array.from({length:d},()=>new Map()),frame=cutSurfaceFrameData(points,mode,offsetMm,v,yawDeg,pitchDeg),curve=frame.curve,dir=frame.dir,normals=frame.normals;
 const addVoxel=(x,y,z)=>{
  const ix=Math.round(x),iy=Math.round(y),iz=Math.round(z);if(ix<0||iy<0||iz<0||ix>=w||iy>=h||iz>=d)return;
  const map=rows[iz],arr=map.get(iy)||[];arr.push([ix,ix]);map.set(iy,arr);
 };
 if(curve.length<2){if(curve[0])addVoxel(curve[0].x,curve[0].y,curve[0].z);return rows.map(rowsToRunSlice)}
 const norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}};
 const sampleStep=Math.max(.05,minSpacing*.65),halfKerf=Math.max(0,Number.isFinite(+kerfMm)?+kerfMm*.5:0),depth=Math.max(.1,+depthMm||.1);
 for(let seg=0;seg<curve.length-1;seg++){
  const a=curve[seg],b=curve[seg+1],tx=(b.x-a.x)*sx,ty=(b.y-a.y)*sy,tz=(b.z-a.z)*sz,segmentMm=Math.hypot(tx,ty,tz);
  if(segmentMm<1e-6)continue;
  const alongSteps=Math.max(1,Math.ceil(segmentMm/sampleStep)),n0=normals[seg]||{x:1,y:0,z:0},n1=normals[seg+1]||n0;
  const depthSteps=Math.max(1,Math.ceil(depth/sampleStep)),kerfSteps=halfKerf>0?Math.max(1,Math.ceil((halfKerf*2)/Math.max(minSpacing*.7,.05))):0;
  for(let si=0;si<=alongSteps;si++){
   const u=si/alongSteps,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u},sheetNormal=norm({x:n0.x+(n1.x-n0.x)*u,y:n0.y+(n1.y-n0.y)*u,z:n0.z+(n1.z-n0.z)*u});
   for(let di=0;di<=depthSteps;di++){
    const dep=depth*di/depthSteps,base={x:p.x+dir.x*dep/sx,y:p.y+dir.y*dep/sy,z:p.z+dir.z*dep/sz};
    for(let ki=0;ki<=kerfSteps;ki++){
     const off=kerfSteps?(-halfKerf+(halfKerf*2)*ki/kerfSteps):0;
     addVoxel(base.x+sheetNormal.x*off/sx,base.y+sheetNormal.y*off/sy,base.z+sheetNormal.z*off/sz);
    }
   }
  }
 }
 return rows.map(rowsToRunSlice);
}
async function applyCutStroke(points,key=analysisEditTargetKey,mode='pen'){
 if(!key||!SEGMENT_PRESET_ORDER.includes(key)||!points?.length)return false;
 const v=current3DVolume||volume;if(!v)return false;
 const label=tr(key)||key,st=segmentEditState[key],refs=snapshotAnalysisRegionsForSegment(key);
 try{
  const cut=cutRunsFromVoxelStroke(v,points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,mode,+analysisCutOffset.value||0);
  pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,cut,v.slices);st.finalRuns=null;st.revision++;analysisEditTargetKey=key;
  const revision=st.revision;
  footer.textContent=currentLanguage==='ja'?label+'を切断しました · 3D更新中…':'Cut '+label+' · updating 3D…';
  updateThreeEditUi(currentLanguage==='ja'?'切断済み · 3D更新中…':'Cut applied · updating 3D…');
  const current=await refreshEditedSegmentSurface(key,v,revision);
  if(!current||st.revision!==revision)return false;
  if(refs.length){
   updateThreeEditUi(currentLanguage==='ja'?'3D更新済み · 解析更新中…':'3D updated · refreshing analysis…');
   await rebuildEditedAnalysisForSegment(key,refs);
   if(st.revision!==revision)return false;
  }
  footer.textContent=currentLanguage==='ja'?label+'の切断を反映しました':'Cut applied to '+label;
  return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent=(currentLanguage==='ja'?'切断後の更新に失敗しました: ':'Cut refresh failed: ')+String(e.message||e);updateThreeEditUi(currentLanguage==='ja'?'切断後の更新に失敗しました':'Cut refresh failed')}
  return false;
 }finally{clearThreeEditOverlay();request3DRender()}
}
function setEditTargetHighlight(key=null){
 if(!sceneState?.obj)return;
 sceneState.obj.traverse(o=>{
  if(!o.isMesh)return;
  const direct=o.userData?.segmentKey||null,ranges=Array.isArray(o.userData?.segmentRanges)?o.userData.segmentRanges:null;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(direct){
   for(const m of mats){if(!m)continue;if(m.userData._editBaseEmissive===undefined){m.userData._editBaseEmissive=m.emissiveIntensity??0;m.userData._editBaseOpacity=m.opacity}
    m.emissiveIntensity=key&&direct===key?Math.max(.55,m.userData._editBaseEmissive):m.userData._editBaseEmissive;
    if(key)m.opacity=direct===key?Math.max(.92,m.userData._editBaseOpacity??1):Math.min(.42,m.userData._editBaseOpacity??1);else if(m.userData._editBaseOpacity!==undefined)m.opacity=m.userData._editBaseOpacity;
   }
  }else if(ranges&&Array.isArray(o.material)){
   for(const r of ranges){const m=o.material[r.materialIndex];if(!m)continue;if(m.userData._editBaseEmissive===undefined){m.userData._editBaseEmissive=m.emissiveIntensity??0;m.userData._editBaseOpacity=m.opacity}
    m.emissiveIntensity=key&&r.key===key?Math.max(.55,m.userData._editBaseEmissive):m.userData._editBaseEmissive;
    if(key)m.opacity=r.key===key?Math.max(.92,m.userData._editBaseOpacity??1):Math.min(.42,m.userData._editBaseOpacity??1);else if(m.userData._editBaseOpacity!==undefined)m.opacity=m.userData._editBaseOpacity;
   }
  }
 });
 request3DRender();
}
let cutResultPreviewRevision=0,cutResultPreviewTimer=null;
function setCutResultSourceHidden(key,hidden){
 const root=sceneState?.obj;if(!root||!key)return;
 root.traverse(o=>{
  if(!o.isMesh||o.userData?.cutResultPreview)return;
  const direct=o.userData?.segmentKey||null;
  if(direct===key){
   if(hidden){if(o.userData._cutPreviewVisible===undefined)o.userData._cutPreviewVisible=o.visible;o.visible=false}
   else if(o.userData._cutPreviewVisible!==undefined){o.visible=!!o.userData._cutPreviewVisible;delete o.userData._cutPreviewVisible}
  }
  const ranges=Array.isArray(o.userData?.segmentRanges)?o.userData.segmentRanges:null;
  if(ranges&&Array.isArray(o.material))for(const r of ranges)if(r.key===key){
   const m=o.material[r.materialIndex];if(!m)continue;
   if(hidden){if(m.userData._cutPreviewVisible===undefined)m.userData._cutPreviewVisible=m.visible;m.visible=false}
   else if(m.userData._cutPreviewVisible!==undefined){m.visible=!!m.userData._cutPreviewVisible;delete m.userData._cutPreviewVisible}
  }
 });
}
function clearCutResultPreview(){
 cutResultPreviewRevision++;clearTimeout(cutResultPreviewTimer);cutResultPreviewTimer=null;
 const state=sceneState;if(!state)return;
 const key=state.cutResultPreviewKey,group=state.cutResultPreviewGroup;
 if(group){if(group.parent)group.parent.remove(group);dispose(group)}
 state.cutResultPreviewGroup=null;state.cutResultPreviewKey=null;
 if(key)setCutResultSourceHidden(key,false);
 request3DRender();
}
function scheduleCutResultPreview(delay=70){
 clearTimeout(cutResultPreviewTimer);const pending=analysisPendingCut;
 if(!pending?.key||analysisCutApplying||!sceneState?.obj)return;
 const revision=++cutResultPreviewRevision;
 cutResultPreviewTimer=setTimeout(()=>{cutResultPreviewTimer=null;void rebuildCutResultPreview(revision,pending)},delay);
}
async function rebuildCutResultPreview(revision,pending){
 const state=sceneState,v=current3DVolume||volume,key=pending?.key;
 if(!state?.obj||!v||!key||analysisCutApplying||pending!==analysisPendingCut)return;
 try{
  const current=await getFinalSegmentRuns(key,v);
  if(revision!==cutResultPreviewRevision||pending!==analysisPendingCut)return;
  const cut=cutRunsFromVoxelStroke(v,pending.points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,pending.mode,+analysisCutOffset.value||0);
  const removedRuns=intersectRunArrays(current,cut,v.slices),isCurrent=()=>revision===cutResultPreviewRevision&&pending===analysisPendingCut&&!analysisCutApplying;
  let group=await buildEditableRunsGroup(v,removedRuns,key,isCurrent);
  if(!isCurrent()){if(group)dispose(group);return}
  if(!group)group=new THREE.Group();
  group.name='cut_remove_preview';
  group.traverse?.(o=>{
   if(!o.isMesh)return;
   o.userData.cutResultPreview=true;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const m of mats){
    if(!m)continue;
    if(m.color?.set)m.color.set(0xff5a36);
    if(m.emissive?.set)m.emissive.set(0x7a1408);
    m.emissiveIntensity=.45;m.transparent=true;m.opacity=.68;m.depthWrite=false;
   }
   o.renderOrder=96;
  });
  const old=state.cutResultPreviewGroup;
  if(old){if(old.parent)old.parent.remove(old);dispose(old)}
  if(state.cutResultPreviewKey)setCutResultSourceHidden(state.cutResultPreviewKey,false);
  setCutResultSourceHidden(key,false);
  state.cutResultPreviewKey=key;state.cutResultPreviewGroup=group;state.obj.add(group);request3DRender();
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__')console.warn('Cut removal preview failed.',e);
 }
}
function cutPreviewDirection(point){return cutDirectionFromPoint(point,+analysisCutYaw.value||0,+analysisCutPitch.value||0)}
function updateCutPreview(point=null){
 const state=sceneState,obj=state?.obj;if(!state||!obj)return;
 if(state.editCutPreview){if(state.editCutPreview.parent)state.editCutPreview.parent.remove(state.editCutPreview);dispose(state.editCutPreview);state.editCutPreview=null}
 const pending=analysisPendingCut;
 if(!pending){
  state.editCutPreviewPoint=point||null;
  if(!analysisCutApplying)clearCutResultPreview();
  request3DRender();return;
 }
 const v=current3DVolume||volume,curve=cutSurfaceStroke(pending.points,pending.mode,+analysisCutOffset.value||0,v);
 scheduleCutResultPreview();
 if(!v||curve.length<2){request3DRender();return}
 const [sx,sy,sz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),depth=Math.max(.1,+analysisCutDepth.value||5),q=cutPlanDirection(pending.points,+analysisCutYaw.value||0,+analysisCutPitch.value||0),dir=new THREE.Vector3(q.x,-q.y,q.z).normalize();
 const localPoint=p=>new THREE.Vector3((p.x*sx-px/2)*scale,-(p.y*sy-py/2)*scale,(p.z*sz-pz/2)*scale),front=curve.map(localPoint),back=front.map(p=>p.clone().addScaledVector(dir,depth*scale)),faces=[],edges=[];
 const quad=(a,b,c,d)=>faces.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,a.x,a.y,a.z,c.x,c.y,c.z,d.x,d.y,d.z);
 for(let i=0;i<front.length-1;i++){quad(front[i],front[i+1],back[i+1],back[i]);edges.push(front[i],front[i+1],back[i],back[i+1])}
 edges.push(front[0],back[0],front[front.length-1],back[back.length-1]);
 const group=new THREE.Group();group.name='cut_preview';
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));geom.computeVertexNormals();
 const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:0x00d8ff,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide}));mesh.name='cut_preview_surface';mesh.renderOrder=95;group.add(mesh);
 const edgeGeom=new THREE.BufferGeometry().setFromPoints(edges),edge=new THREE.LineSegments(edgeGeom,new THREE.LineBasicMaterial({color:0x00e5ff,transparent:true,opacity:.75,depthTest:false,depthWrite:false}));edge.name='cut_preview_outline';edge.renderOrder=97;group.add(edge);
 obj.add(group);state.editCutPreview=group;state.editCutPreviewPoint=curve[curve.length-1];request3DRender();
}
function updateThreeEditUi(message=null){
 configureCutControlRanges();refreshCutControlReadouts();
 const enabledKeys=SEGMENT_PRESET_ORDER.filter(k=>segmentState[k].active&&segmentState[k].enabled);
 const surfaceUsable=threeRenderMode==='surface'&&!!sceneState?.obj&&enabledKeys.length>0;
 const modeLabel=analysisEditTool==='pen'?tr('cutRegion'):analysisEditTool==='line'?tr('lineCutRegion'):tr('editNavigate');
 const targetLabel=analysisEditTargetMode==='auto'?tr('editAuto'):(tr(analysisEditTargetMode)||analysisEditTargetMode);
 analysisNavigateButton?.classList.toggle('is-active',analysisEditTool==='select');
 analysisCutButton?.classList.toggle('is-active',analysisEditTool==='pen');
 analysisLineCutButton?.classList.toggle('is-active',analysisEditTool==='line');
 if(analysisNavigateButton)analysisNavigateButton.disabled=!sceneState?.obj||analysisCutApplying||!!analysisPendingCut;
 if(analysisCutButton)analysisCutButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisLineCutButton)analysisLineCutButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisEditTargetSelect){
  for(const option of analysisEditTargetSelect.options){if(option.value==='auto'){option.disabled=false;continue}option.disabled=!(segmentState[option.value]?.active&&segmentState[option.value]?.enabled)}
  if(analysisEditTargetMode!=='auto'&&analysisEditTargetSelect.querySelector('option[value="'+analysisEditTargetMode+'"]')?.disabled){analysisEditTargetMode='auto';analysisEditTargetKey=analysisPendingCut?.key||null}
  analysisEditTargetSelect.value=analysisEditTargetMode;analysisEditTargetSelect.disabled=!surfaceUsable||analysisCutApplying||!!(analysisPendingCut&&analysisPendingCut.key);
 }
 if(threeEditStatus){
  if(message)threeEditStatus.textContent=message;
  else if(!sceneState?.obj)threeEditStatus.textContent=currentLanguage==='ja'?'3Dを構築すると編集できます':'Build the 3D surface to edit';
  else if(!enabledKeys.length)threeEditStatus.textContent=currentLanguage==='ja'?'編集する組織セグメントを追加してください':'Add a tissue segment to edit';
  else threeEditStatus.textContent=modeLabel+' · '+targetLabel+' · '+(+analysisCutWidth.value).toFixed(2)+' mm × '+(+analysisCutDepth.value).toFixed(1)+' mm · '+(+analysisCutYaw.value).toFixed(1)+'° / '+(+analysisCutPitch.value).toFixed(1)+'°';
 }
 if(analysisCutApply)analysisCutApply.disabled=analysisCutApplying||!analysisPendingCut||!analysisPendingCut.key;
 if(analysisCutCancel)analysisCutCancel.disabled=analysisCutApplying||!analysisPendingCut;
 for(const control of [analysisCutWidth,analysisCutDepth,analysisCutYaw,analysisCutPitch,analysisCutOffset])if(control)control.disabled=analysisCutApplying;
 if(threeEditHelp){
  if(analysisCutApplying)threeEditHelp.textContent=currentLanguage==='ja'?'切断結果を3Dへ反映しています…':'Applying cut result to 3D…';
  else if(analysisPendingCut)threeEditHelp.textContent=tr('cutPendingHint');
  else if(analysisEditTool==='pen')threeEditHelp.textContent=tr('editPenHint');
  else if(analysisEditTool==='line')threeEditHelp.textContent=tr('editLineHint');
  else if(surfaceUsable)threeEditHelp.textContent=currentLanguage==='ja'?'ペン切断または直線切断を選択してください。対象「自動」は最初に触れた組織を編集します。':'Choose Pen cut or Line cut. Auto targets the first tissue you touch.';
  else threeEditHelp.textContent=tr('editAutoHint');
 }
 const cutInteractionReady=(analysisEditTool==='pen'||analysisEditTool==='line')&&!analysisPendingCut&&!analysisCutApplying;
 viewport?.classList.toggle('is-editing-3d',cutInteractionReady);
 viewport?.classList.toggle('is-editing-pen',cutInteractionReady&&analysisEditTool==='pen');
 viewport?.classList.toggle('is-editing-line',cutInteractionReady&&analysisEditTool==='line');
 const visualTarget=analysisEditTool==='select'?null:(analysisEditTargetMode==='auto'?analysisEditTargetKey:analysisEditTargetMode);
 setEditTargetHighlight(visualTarget);
 if(analysisEditTool==='select')updateCutPreview(null);
 else if(sceneState?.editCutPreviewPoint)updateCutPreview(sceneState.editCutPreviewPoint);
}
function updateAnalysisEditorControls(){
 const region=analysisRegionById(analysisFocusedRegionId),single=region?.segmentKeys?.length===1,regionKey=single?region.segmentKeys[0]:null;
 const surfaceUsable=threeRenderMode==='surface'&&!!sceneState?.obj&&SEGMENT_PRESET_ORDER.some(k=>segmentState[k].active&&segmentState[k].enabled);
 const historyKey=analysisEditTargetKey||regionKey||SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].undo.length||segmentEditState[k].redo.length||segmentEditActive(k)),historyState=historyKey?segmentEditState[historyKey]:null;
 if(!surfaceUsable&&(analysisEditTool==='pen'||analysisEditTool==='line'))analysisEditTool='select';
 if(analysisNavigateButton)analysisNavigateButton.disabled=!sceneState?.obj;
 if(analysisCutButton)analysisCutButton.disabled=!surfaceUsable;
 if(analysisLineCutButton)analysisLineCutButton.disabled=!surfaceUsable;
 if(analysisRemoveSelected)analysisRemoveSelected.disabled=!regionKey;
 if(analysisKeepSelected)analysisKeepSelected.disabled=!regionKey;
 if(analysisUndo)analysisUndo.disabled=!historyState?.undo?.length;
 if(analysisRedo)analysisRedo.disabled=!historyState?.redo?.length;
 if(analysisResetEdit)analysisResetEdit.disabled=!historyKey||!segmentEditActive(historyKey);
 if(analysisExportSelected)analysisExportSelected.disabled=!region;
 updateThreeEditUi();
}
function analysisRunSliceState(records,w,h){
 const mask=new Uint8Array(w*h),blocks=[],blockSize=16384;let block=new Uint32Array(blockSize),used=0;
 const push=i=>{if(used===block.length){blocks.push(block);block=new Uint32Array(blockSize);used=0}block[used++]=i};
 if(records)for(let r=0;r<records.length;r+=3){
  const y=records[r],x0=records[r+1],x1=records[r+2],start=y*w+x0;mask.fill(1,start,start+x1-x0+1);
  for(let x=x0;x<=x1;x++)push(y*w+x);
 }
 if(used)blocks.push(block.subarray(0,used));return{mask,blocks};
}
function ensureAnalysisRoot(){
 if(sceneState?.analysisMesh?.parent===sceneState?.obj)return sceneState.analysisMesh;
 const root=new THREE.Group();root.name='analysis_regions';sceneState.analysisMesh=root;sceneState?.obj?.add(root);return root;
}
function analysisRunRows(records){
 const rows=new Map();
 if(records)for(let i=0;i<records.length;i+=3){const y=records[i],arr=rows.get(y)||[];arr.push(records[i+1],records[i+2]);rows.set(y,arr)}
 return rows;
}
function forEachUncoveredRun(x0,x1,cover,fn){
 let cursor=x0;
 if(cover)for(let i=0;i<cover.length;i+=2){
  const a=cover[i],b=cover[i+1];if(b<cursor)continue;if(a>x1)break;
  if(a>cursor)fn(cursor,Math.min(x1,a-1));cursor=Math.max(cursor,b+1);if(cursor>x1)return;
 }
 if(cursor<=x1)fn(cursor,x1);
}
function appendAnalysisRunBoundaryFaces(builder,records,prevRecords,nextRecords,coords,z){
 const {xs,ys,zs}=coords,z0=zs[z],z1=zs[z+1],rows=analysisRunRows(records),prev=analysisRunRows(prevRecords),next=analysisRunRows(nextRecords);
 const quad=(a,b,c,d)=>builder.push(...a,...b,...c,...a,...c,...d);
 for(const [y,intervals] of rows){
  const y0=ys[y],y1=ys[y+1],up=rows.get(y-1),down=rows.get(y+1),front=prev.get(y),back=next.get(y);
  for(let r=0;r<intervals.length;r+=2){
   const x0=intervals[r],x1=intervals[r+1],lx=xs[x0],rx=xs[x1+1];
   quad([lx,y0,z0],[lx,y0,z1],[lx,y1,z1],[lx,y1,z0]);
   quad([rx,y0,z0],[rx,y1,z0],[rx,y1,z1],[rx,y0,z1]);
   const emit=(a,b,face)=>{for(let x=a;x<=b;x++){const xa=xs[x],xb=xs[x+1];face(xa,xb)}};
   forEachUncoveredRun(x0,x1,up,(a,b)=>emit(a,b,(xa,xb)=>quad([xa,y0,z0],[xb,y0,z0],[xb,y0,z1],[xa,y0,z1])));
   forEachUncoveredRun(x0,x1,down,(a,b)=>emit(a,b,(xa,xb)=>quad([xa,y1,z0],[xa,y1,z1],[xb,y1,z1],[xb,y1,z0])));
   forEachUncoveredRun(x0,x1,front,(a,b)=>emit(a,b,(xa,xb)=>quad([xa,y0,z0],[xa,y1,z0],[xb,y1,z0],[xb,y0,z0])));
   forEachUncoveredRun(x0,x1,back,(a,b)=>emit(a,b,(xa,xb)=>quad([xa,y0,z1],[xb,y0,z1],[xb,y1,z1],[xa,y1,z1])));
  }
 }
}
async function buildAnalysisRunsGroup(v,runsBySlice,key,id,color){
 const d=v.slices,coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial(color));mesh.name='analysis_'+key+'_'+id+'_'+z;mesh.renderOrder=20;mesh.userData.analysisRegionId=id;mesh.userData.displayScale=coords.scale;group.add(mesh)};
 for(let z=0;z<d;z++){
  appendAnalysisRunBoundaryFaces(builder,runsBySlice[z],z>0?runsBySlice[z-1]:null,z+1<d?runsBySlice[z+1]:null,coords,z);
  if(builder.length>=floatLimit)flush(z);if((z&31)===0)await frameYield();
 }
 flush(d-1);return group.children.length?group:null;
}
function analysisRegionName(region){
 return region.merged?(tr('mergedRegion')+' '+region.id):(tr('analysisRegion')+' '+region.id);
}
function renderAnalysisResults(statusText=null){
 if(!analysisSummary||!analysisRegionList)return;
 if(statusText)analysisSummary.textContent=statusText;
 else if(!analysisRegions.length)analysisSummary.textContent=tr('volumeHint');
 else analysisSummary.textContent=tr('analysisRegions')+': '+analysisRegions.length;
 analysisMergeButton.disabled=analysisRegions.filter(r=>r.selected).length<2||volumeAnalysisBusy;
 analysisClearButton.disabled=!analysisRegions.length||volumeAnalysisBusy;updateAnalysisEditorControls();
 analysisRegionList.replaceChildren();
 for(const region of analysisRegions){
  const row=document.createElement('div');row.className='analysis-region-row'+(region.id===analysisFocusedRegionId?' is-focused':'');row.dataset.regionId=String(region.id);row.onclick=e=>{if(e.target.closest('button,input'))return;setAnalysisFocusedRegion(region.id)};
  const select=document.createElement('input');select.type='checkbox';select.checked=!!region.selected;select.className='analysis-region-select';select.title=tr('mergeSelected');select.onchange=()=>{region.selected=select.checked;renderAnalysisResults()};
  const swatch=document.createElement('span');swatch.className='analysis-region-swatch';swatch.style.background=analysisColorCss(region.color);swatch.title=analysisColorCss(region.color);
  const info=document.createElement('div');info.className='analysis-region-info';
  const title=document.createElement('strong');title.textContent=analysisRegionName(region);
  const keys=document.createElement('span');keys.textContent=region.segmentKeys.map(k=>tr(k)||k).join(' + ');
  const value=document.createElement('span');value.textContent=region.mm3.toFixed(2)+' mm³ · '+region.voxels.toLocaleString()+' voxels';
  info.append(title,keys,value);
  const visible=document.createElement('button');visible.type='button';visible.className='analysis-region-button';visible.textContent=region.visible?tr('hideRegion'):tr('showRegion');visible.onclick=()=>{region.visible=!region.visible;if(region.meshGroup)region.meshGroup.visible=region.visible;request3DRender();renderAnalysisResults()};
  const remove=document.createElement('button');remove.type='button';remove.className='analysis-region-button analysis-region-delete';remove.textContent=tr('deleteRegion');remove.onclick=()=>removeAnalysisRegion(region.id);
  row.append(select,swatch,info,visible,remove);analysisRegionList.append(row);
 }
}
function disposeAnalysisRegionMesh(region){
 if(!region?.meshGroup)return;if(region.meshGroup.parent)region.meshGroup.parent.remove(region.meshGroup);dispose(region.meshGroup);region.meshGroup=null;
}
function removeAnalysisRegion(id){
 const idx=analysisRegions.findIndex(r=>r.id===id);if(idx<0)return;
 disposeAnalysisRegionMesh(analysisRegions[idx]);analysisRegions.splice(idx,1);
 if(analysisFocusedRegionId===id)analysisFocusedRegionId=null;
 if(!analysisRegions.length&&sceneState?.analysisMesh){if(sceneState.analysisMesh.parent)sceneState.analysisMesh.parent.remove(sceneState.analysisMesh);sceneState.analysisMesh=null}
 request3DRender();renderAnalysisResults();for(const p of Object.keys(planes))schedulePlaneRender(p);
}
async function attachAnalysisRegion(region,v){
 const group=await buildAnalysisRunsGroup(v,region.runsBySlice,region.key,region.id,region.color);region.meshGroup=group;if(group){group.visible=region.visible;ensureAnalysisRoot().add(group)}request3DRender();
}
async function addAnalysisRegion(v,{key,segmentKeys,runsBySlice,voxels,mm3,merged=false}){
 const existing=analysisRegions.find(r=>r.segmentKeys.includes(key)&&analysisRunsOverlap(r.runsBySlice,runsBySlice));
 if(existing){existing.selected=true;existing.visible=true;if(existing.meshGroup)existing.meshGroup.visible=true;renderAnalysisResults();request3DRender();return existing}
 const id=nextAnalysisRegionId++,region={id,regionId:'r'+id,groupId:merged?'g'+id:null,key,segmentKeys:[...new Set(segmentKeys)],runsBySlice,voxels,mm3,merged,selected:false,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};
 analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);return region;
}
async function mergeSelectedAnalysisRegions(){
 if(volumeAnalysisBusy)return;const selected=analysisRegions.filter(r=>r.selected);if(selected.length<2){renderAnalysisResults(tr('mergeNeedsTwo'));return}
 const v=current3DVolume||volume;if(!v)return;volumeAnalysisBusy=true;renderAnalysisResults(tr('mergingRegions'));
 try{
  const runsBySlice=unionAnalysisRuns(selected,v.slices),voxels=analysisRunsVoxelCount(runsBySlice),mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2],segmentKeys=[...new Set(selected.flatMap(r=>r.segmentKeys))],key=segmentKeys.length===1?segmentKeys[0]:'merged';
  for(const region of selected)disposeAnalysisRegionMesh(region);
  const ids=new Set(selected.map(r=>r.id));analysisRegions=analysisRegions.filter(r=>!ids.has(r.id));
  const id=nextAnalysisRegionId++,region={id,regionId:'r'+id,groupId:'g'+id,key,segmentKeys,runsBySlice,voxels,mm3,merged:true,selected:false,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);
 }finally{volumeAnalysisBusy=false;renderAnalysisResults()}
}
function resetAnalysisRegistryAfterRebuild(){
 analysisRegions=[];analysisFocusedRegionId=null;nextAnalysisRegionId=1;nextAnalysisColorIndex=0;if(sceneState)sceneState.analysisMesh=null;renderAnalysisResults();
}
function clearAnalysisHighlight(){
 if(sceneState?.analysisMesh){const root=sceneState.analysisMesh;if(root.parent)root.parent.remove(root);dispose(root);sceneState.analysisMesh=null}
 analysisRegions=[];analysisFocusedRegionId=null;nextAnalysisRegionId=1;nextAnalysisColorIndex=0;request3DRender();renderAnalysisResults();
}
function showAnalysisHighlight(v,mask,key){
 clearAnalysisHighlight();if(!sceneState?.obj||!mask)return;
 const group=buildMaskSurface(v,mask,key);if(!group)return;
 sceneState.analysisMesh=group;sceneState.obj.add(group);request3DRender();
}
function buildMaskSurface(v,mask,key){
 const coords=makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{
  const positions=builder.take();if(!positions)return;
  const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial());
  mesh.name='analysis_'+key+'_'+z;mesh.renderOrder=20;group.add(mesh);
 };
 for(let z=0;z<v.slices;z++){
  appendDecodedMaskSliceFaces(builder,v,mask,z,coords);
  if(builder.length>=floatLimit)flush(z);
 }
 flush(v.slices-1);return group.children.length?group:null;
}

function appendSourceSliceFaces(positions,series,z,prev,curr,next){
 const w=series.columns,h=series.rows,d=series.slices.length,sx=series.spacingX,sy=series.spacingY,sz=series.spacingZ,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const at=(m,x,y)=>m&&x>=0&&y>=0&&x<w&&y<h&&m[y*w+x]===1;
 const quad=(a,b,c,dv)=>positions.push(...a,...b,...c,...a,...c,...dv);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!curr[y*w+x])continue;
  const x0=(x*sx-px/2)*scale,x1=((x+1)*sx-px/2)*scale,y0=-(y*sy-py/2)*scale,y1=-((y+1)*sy-py/2)*scale,z0=(z*sz-pz/2)*scale,z1=((z+1)*sz-pz/2)*scale;
  if(!at(curr,x-1,y))quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
  if(!at(curr,x+1,y))quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]);
  if(!at(curr,x,y-1))quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
  if(!at(curr,x,y+1))quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]);
  if(!at(prev,x,y))quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]);
  if(!at(next,x,y))quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
 }
}
class Float32FaceBuilder{
 constructor(initial=131072){this.data=new Float32Array(initial);this.length=0;this.hasGpuMesh=false;this.hasCpuMesh=false;this.allGpuSmoothed=true}
 ensure(extra){
  const need=this.length+extra;if(need<=this.data.length)return;
  let size=this.data.length;while(size<need)size*=2;
  const next=new Float32Array(size);next.set(this.data.subarray(0,this.length));this.data=next;
 }
 appendArray(values){
  if(!values?.length)return;this.ensure(values.length);this.data.set(values,this.length);this.length+=values.length;
 }
 push(a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r){
  this.ensure(18);const x=this.data,q0=this.length;
  x[q0]=a;x[q0+1]=b;x[q0+2]=c;x[q0+3]=d;x[q0+4]=e;x[q0+5]=f;
  x[q0+6]=g;x[q0+7]=h;x[q0+8]=i;x[q0+9]=j;x[q0+10]=k;x[q0+11]=l;
  x[q0+12]=m;x[q0+13]=n;x[q0+14]=o;x[q0+15]=p;x[q0+16]=q;x[q0+17]=r;
  this.length=q0+18;
 }
 take(){
  if(!this.length)return null;
  const out=this.data.subarray(0,this.length);
  const nextSize=Math.max(131072,Math.min(this.data.length,1048576));
  this.data=new Float32Array(nextSize);this.length=0;this.hasGpuMesh=false;this.hasCpuMesh=false;this.allGpuSmoothed=true;return out;
 }
}
function surfaceSmoothingActive(){
 return !!surfaceSmoothEnabled?.checked&&Number(surfaceSmoothStrength?.value)>0;
}
function strongSurfaceSmoothingActive(){return surfaceSmoothingActive()&&Number(surfaceSmoothStrength?.value)>3;}
function indexedGeometryFromTrianglePositions(positions){
 const vertexRefs=Math.floor((positions?.length||0)/3);
 if(!vertexRefs)return new THREE.BufferGeometry();
 let tableSize=1;while(tableSize<vertexRefs*2)tableSize*=2;
 const table=new Uint32Array(tableSize),mask=tableSize-1,srcBits=new Uint32Array(positions.buffer,positions.byteOffset,positions.length);
 const unique=new Float32Array(positions.length),uniqueBits=new Uint32Array(unique.buffer),indices=new Uint32Array(vertexRefs);
 let uniqueCount=0;
 const normZero=v=>v===0x80000000?0:v;
 const hash3=(x,y,z)=>{let h=Math.imul((x^(x>>>16))>>>0,0x45d9f3b);h=(h^Math.imul((y^(y>>>16))>>>0,0x27d4eb2d))>>>0;h=(h^Math.imul((z^(z>>>16))>>>0,0x165667b1))>>>0;return(h^(h>>>16))>>>0};
 for(let v=0;v<vertexRefs;v++){
  const o=v*3,xb=normZero(srcBits[o]),yb=normZero(srcBits[o+1]),zb=normZero(srcBits[o+2]);let slot=hash3(xb,yb,zb)&mask,id=-1;
  while(table[slot]){
   const candidate=table[slot]-1,u=candidate*3;
   if(normZero(uniqueBits[u])===xb&&normZero(uniqueBits[u+1])===yb&&normZero(uniqueBits[u+2])===zb){id=candidate;break}
   slot=(slot+1)&mask;
  }
  if(id<0){id=uniqueCount++;const u=id*3;unique[u]=positions[o];unique[u+1]=positions[o+1];unique[u+2]=positions[o+2];table[slot]=id+1}
  indices[v]=id;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(unique.slice(0,uniqueCount*3),3));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 return geometry;
}

async function smoothMaskScalarField(mask,w,h,d,strength){
 const fw=w+2,fh=h+2,fd=d+2,plane=fw*fh,n=plane*fd;
 let a=new Float32Array(n),b=new Float32Array(n);
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){
  const src=z*w*h+y*w,dst=(z+1)*plane+(y+1)*fw+1;
  for(let x=0;x<w;x++)a[dst+x]=mask[src+x]?1:0;
 }
 const rounds=Math.max(1,Math.min(8,Math.round(.5+Math.max(0,strength)*1.15))),alpha=.48;
 for(let round=0;round<rounds;round++){
  b.fill(0);
  for(let z=1;z<fd-1;z++)for(let y=1;y<fh-1;y++){
   const row=z*plane+y*fw;
   for(let x=1;x<fw-1;x++){
    const i=row+x,avg=(a[i-1]+a[i+1]+a[i-fw]+a[i+fw]+a[i-plane]+a[i+plane])/6;
    b[i]=a[i]*(1-alpha)+avg*alpha;
   }
  }
  const t=a;a=b;b=t;if((round&1)===1)await frameYield();
 }
 return{data:a,fw,fh,fd};
}
async function smoothIsosurfaceGeometry(v,mask,strength){
 const w=v.columns,h=v.rows,d=v.slices;if(!mask||mask.length!==w*h*d)return null;
 const {data,fw,fh,fd}=await smoothMaskScalarField(mask,w,h,d,strength),plane=fw*fh,[sx,sy,sz]=v.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),iso=.5;
 const positions=[],indices=[],edgeVertices=new Map();
 const cubeCorners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const tetEdges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const gridId=(x,y,z)=>z*plane+y*fw+x,field=(x,y,z)=>data[gridId(x,y,z)];
 const world=(x,y,z)=>[((x-.5)*sx-px/2)*scale,-((y-.5)*sy-py/2)*scale,((z-.5)*sz-pz/2)*scale];
 const edgeVertex=(ax,ay,az,bx,by,bz,va,vb)=>{
  const ia=gridId(ax,ay,az),ib=gridId(bx,by,bz),lo=Math.min(ia,ib),hi=Math.max(ia,ib),key=lo+':'+hi,found=edgeVertices.get(key);if(found!==undefined)return found;
  const den=vb-va,t=Math.abs(den)<1e-8?.5:Math.max(0,Math.min(1,(iso-va)/den)),pa=world(ax,ay,az),pb=world(bx,by,bz),id=positions.length/3;
  positions.push(pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t,pa[2]+(pb[2]-pa[2])*t);edgeVertices.set(key,id);return id;
 };
 const pcoord=id=>[positions[id*3],positions[id*3+1],positions[id*3+2]];
 const emit=(tri,out)=>{
  const a=pcoord(tri[0]),b=pcoord(tri[1]),cc=pcoord(tri[2]),abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=cc[0]-a[0],acy=cc[1]-a[1],acz=cc[2]-a[2],nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  if(nx*nx+ny*ny+nz*nz<1e-14)return;
  if(nx*out[0]+ny*out[1]+nz*out[2]<0){const t=tri[1];tri[1]=tri[2];tri[2]=t}indices.push(tri[0],tri[1],tri[2]);
 };
 for(let z=0;z<fd-1;z++){
  for(let y=0;y<fh-1;y++)for(let x=0;x<fw-1;x++){
   const cv=new Array(8),cg=new Array(8);let min=Infinity,max=-Infinity;
   for(let k=0;k<8;k++){const q=cubeCorners[k],gx=x+q[0],gy=y+q[1],gz=z+q[2],vv=field(gx,gy,gz);cv[k]=vv;cg[k]=[gx,gy,gz];if(vv<min)min=vv;if(vv>max)max=vv}
   if(min>=iso||max<iso)continue;
   for(const tet of tets){
    let inCount=0,outCount=0,ix=0,iy=0,iz=0,ox=0,oy=0,oz=0;
    for(const k of tet){const g=cg[k],p=world(g[0],g[1],g[2]);if(cv[k]>=iso){inCount++;ix+=p[0];iy+=p[1];iz+=p[2]}else{outCount++;ox+=p[0];oy+=p[1];oz+=p[2]}}
    if(inCount===0||inCount===4)continue;
    let crossings=[];
    for(const e of tetEdges){const ka=tet[e[0]],kb=tet[e[1]],va=cv[ka],vb=cv[kb];if((va>=iso)===(vb>=iso))continue;const a=cg[ka],b=cg[kb];crossings.push(edgeVertex(a[0],a[1],a[2],b[0],b[1],b[2],va,vb))}
    crossings=[...new Set(crossings)];
    const out=[ox/Math.max(1,outCount)-ix/Math.max(1,inCount),oy/Math.max(1,outCount)-iy/Math.max(1,inCount),oz/Math.max(1,outCount)-iz/Math.max(1,inCount)];
    if(crossings.length===3)emit([crossings[0],crossings[1],crossings[2]],out);
    else if(crossings.length===4){
     let cx=0,cy=0,cz=0;const pts=crossings.map(id=>{const p=pcoord(id);cx+=p[0];cy+=p[1];cz+=p[2];return{id,p}});cx/=4;cy/=4;cz/=4;
     let nl=Math.hypot(out[0],out[1],out[2])||1,nx=out[0]/nl,ny=out[1]/nl,nz=out[2]/nl;
     let ux=pts[0].p[0]-cx,uy=pts[0].p[1]-cy,uz=pts[0].p[2]-cz,ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
     let vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
     pts.sort((aa,bb)=>{const ap=aa.p,bp=bb.p,ax=ap[0]-cx,ay=ap[1]-cy,az=ap[2]-cz,bx=bp[0]-cx,by=bp[1]-cy,bz=bp[2]-cz;return Math.atan2(ax*vx+ay*vy+az*vz,ax*ux+ay*uy+az*uz)-Math.atan2(bx*vx+by*vy+bz*vz,bx*ux+by*uy+bz*uz)});
     emit([pts[0].id,pts[1].id,pts[2].id],out);emit([pts[0].id,pts[2].id,pts[3].id],out);
    }
   }
  }
  if((z&3)===3)await frameYield();
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
 taubinSmoothGeometry(geometry,Math.max(0,strength));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function maskFromAnalysisRuns(v,runs){
 const out=new Uint8Array(v.columns*v.rows*v.slices),w=v.columns,h=v.rows;
 for(let z=0;z<v.slices;z++){const a=runs?.[z];if(!a)continue;for(let i=0;i<a.length;i+=3){const y=a[i],x0=a[i+1],x1=a[i+2],base=z*w*h+y*w;out.fill(1,base+x0,base+x1+1)}}
 return out;
}
async function buildSmoothIsoMesh(v,mask,seg,key,editSurface=false){
 const geometry=await smoothIsosurfaceGeometry(v,mask,+surfaceSmoothStrength.value);if(!geometry)return null;
 const material=new THREE.MeshStandardMaterial({color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:false}),mesh=new THREE.Mesh(geometry,material);
 mesh.name='segment_'+key+'_isosurface';mesh.userData.segmentKey=key;mesh.userData.editSurface=!!editSurface;mesh.userData.displayScale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;return mesh;
}
function fullVolumeSmoothIsosurfaceFeasible(v){
 if(!v)return false;
 const w=Number(v.columns)||0,h=Number(v.rows)||0,d=Number(v.slices)||0;
 if(w<=0||h<=0||d<=0)return false;
 const voxels=w*h*d,padded=(w+2)*(h+2)*(d+2);
 // Minimum working set before mesh arrays: binary mask + two Float32 scalar fields.
 const estimatedBytes=voxels+padded*8;
 const limit=(navigator.maxTouchPoints||0)>0?48*1024*1024:96*1024*1024;
 return estimatedBytes<=limit;
}
async function render3DSmoothIsosurface(v){
 if(!sceneState||!surfaceSmoothingActive())return false;
 const revision=++sourceRenderRevision,previous=sceneState.obj,group=new THREE.Group();if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 set3DBusy(true,'3D等値面を構築中…');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';
 try{
  for(let ai=0;ai<active.length;ai++){
   const {key,seg}=active[ai];if(revision!==sourceRenderRevision){dispose(group);return null}
   footer.textContent=(currentLanguage==='ja'?'滑らかな3D表面を構築中… ':'Building smooth 3D surface… ')+(ai+1)+' / '+active.length;
   let mask;
   if(v.sourceBacked){
    const runs=await ensureSegmentBaseRuns(key,v);if(revision!==sourceRenderRevision){dispose(group);return null}
    mask=maskFromAnalysisRuns(v,runs);
   }else mask=getProcessedSegmentMask(v,seg);
   const mesh=await buildSmoothIsoMesh(v,mask,seg,key,false);if(mesh)group.add(mesh);await frameYield();
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(active.length&&!group.children.some(o=>o?.isMesh))throw new Error('Smooth isosurface produced no mesh');
  if(previous){previous.parent?.remove(previous);dispose(previous)}sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  setGpuComputeBackend('CPU ISOSURFACE · WEBGPU RENDER');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';footer.textContent=currentLanguage==='ja'?'3D滑面表示 · フル解像度':'3D smooth surface · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){dispose(group);set3DBusy(false);console.error(e);threeLabel.textContent=(sceneState.backend||'3D')+' · smooth surface error';footer.textContent='3D isosurface error: '+String(e.message||e);mark3DStale();request3DRender();return false}
}
function geometryFromSourcePositions(positions,alreadyGpuSmoothed=false,normals=null,applySmoothing=true){
 if(!positions||!positions.length)return null;
 let geometry;
 if(surfaceSmoothingActive()&&!alreadyGpuSmoothed&&applySmoothing){
  geometry=indexedGeometryFromTrianglePositions(positions);
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 }else{
  geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  if(alreadyGpuSmoothed&&normals?.length===positions.length)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3);
 }
 return geometry;
}
function consolidateSegmentForStrongSmoothing(group,key,strength){
 const meshes=(group?.children||[]).filter(m=>m?.isMesh&&m.userData?.segmentKey===key&&!m.userData?.gpuResident);
 if(!meshes.length)return null;
 let floats=0;for(const mesh of meshes)floats+=mesh.geometry?.getAttribute?.('position')?.array?.length||0;
 if(!floats)return null;
 const positions=new Float32Array(floats);let q=0;
 for(const mesh of meshes){const a=mesh.geometry.getAttribute('position').array;positions.set(a,q);q+=a.length}
 const geometry=indexedGeometryFromTrianglePositions(positions);taubinSmoothGeometry(geometry,strength);
 const first=meshes[0],material=Array.isArray(first.material)?first.material[0].clone():first.material.clone(),merged=new THREE.Mesh(geometry,material);
 merged.name='segment_'+key+'_global_smooth';merged.userData.segmentKey=key;merged.userData.displayScale=first.userData.displayScale;if(first.userData.editSurface)merged.userData.editSurface=true;
 for(const mesh of meshes){mesh.parent?.remove(mesh);dispose(mesh)}
 group.add(merged);return merged;
}
function thresholdSourceMask(data,seg){
 const mask=new Uint8Array(data.length);
 for(let i=0;i<data.length;i++)if(data[i]>=seg.min&&data[i]<=seg.max)mask[i]=1;
 return mask;
}
async function decodeSourceSegmentMasks(meta,segments){
 if(!isNativeDicomTransferSyntax(meta.ts)){
  const values=await getCachedSourceSlice(meta),n=meta.rows*meta.columns,blockSize=16384,states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
  for(let i=0;i<n;i++){const value=values[i];for(const state of states.values())if(value>=state.min&&value<=state.max){state.mask[i]=1;if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}state.block[state.used++]=i}}
  for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used;delete state.min;delete state.max}
  return states;
 }
 const bpp=meta.bits===8?1:meta.bits===16?2:0;
 if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 let bytes,offset=meta.pixelOffset;
 if(offset!=null){
  bytes=new Uint8Array(await meta.file.slice(offset,offset+meta.rows*meta.columns*bpp).arrayBuffer());
  offset=0;
 }else{
  const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
  if(!el)throw new Error('Pixel Data missing');bytes=all;offset=el.dataOffset;
 }
 const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=meta.rows*meta.columns,blockSize=16384;
 const states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
 const pushIndex=(state,i)=>{
  if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}
  state.block[state.used++]=i;
 };
 for(let i=0;i<n;i++){
  let raw;
  if(meta.bits===8){raw=bytes[offset+i];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(offset+i*2,little):view.getUint16(offset+i*2,little);
  const value=Math.fround(raw*meta.slope+meta.intercept);
  for(const state of states.values()){
   if(value>=state.min&&value<=state.max){state.mask[i]=1;pushIndex(state,i)}
  }
 }
 for(const state of states.values()){
  if(state.used)state.blocks.push(state.block.subarray(0,state.used));
  state.block=null;delete state.used;delete state.min;delete state.max;
 }
 return states;
}
function makeVolume3DCoordinates(v){
 const w=v.columns,h=v.rows,d=v.slices,[sx,sy,sz]=v.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const xs=new Float64Array(w+1),ys=new Float64Array(h+1),zs=new Float64Array(d+1);
 for(let x=0;x<=w;x++)xs[x]=(x*sx-px/2)*scale;
 for(let y=0;y<=h;y++)ys[y]=-(y*sy-py/2)*scale;
 for(let z=0;z<=d;z++)zs[z]=(z*sz-pz/2)*scale;
 return{xs,ys,zs,scale};
}
function makeSource3DCoordinates(series){
 const w=series.columns,h=series.rows,d=series.slices.length,sx=series.spacingX,sy=series.spacingY,sz=series.spacingZ,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const xs=new Float64Array(w+1),ys=new Float64Array(h+1),zs=new Float64Array(d+1);
 for(let x=0;x<=w;x++)xs[x]=(x*sx-px/2)*scale;
 for(let y=0;y<=h;y++)ys[y]=-(y*sy-py/2)*scale;
 for(let z=0;z<=d;z++)zs[z]=(z*sz-pz/2)*scale;
 return{xs,ys,zs,scale};
}
function appendGpuMeshTile(positionsByKey,normalsByKey,tile,active){
 let faceOffset=0;
 for(let s=0;s<active.length&&s<4;s++){
  const faces=tile.counts[s]||0,floatCount=faces*18;
  if(floatCount){const builder=positionsByKey.get(active[s].key);if(builder){builder.appendArray(tile.vertices.subarray(faceOffset*18,faceOffset*18+floatCount));builder.hasGpuMesh=true;if(!tile.gpuSmoothed)builder.allGpuSmoothed=false;}if(tile.gpuSmoothed&&tile.normals){normalsByKey.get(active[s].key)?.appendArray(tile.normals.subarray(faceOffset*18,faceOffset*18+floatCount));}}
  faceOffset+=faces;
 }
}
function addGpuResidentTileMesh(group,tile,active,materialParamsByKey,displayScale,name){
 if(!tile?.gpuResident||!tile.positionAttribute)return false;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',tile.positionAttribute);if(tile.normalAttribute)geometry.setAttribute('normal',tile.normalAttribute);
 const materials=[],ranges=[];let start=0,total=0;
 for(let s=0;s<active.length&&s<4;s++){
  const count=(tile.counts[s]||0)*6,key=active[s].key;
  if(count){const materialIndex=materials.length;materials.push(new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));geometry.addGroup(start,count,materialIndex);ranges.push({key,start,count,materialIndex});}
  start+=count;total+=count;
 }
 if(!total){geometry.dispose();return false}
 geometry.setDrawRange(0,total);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3.6);
 const mesh=new THREE.Mesh(geometry,materials);mesh.name=name;mesh.userData.segmentRanges=ranges;mesh.userData.displayScale=displayScale;mesh.userData.gpuResident=true;mesh.userData.gpuPositionReady=false;mesh.userData.gpuCompletion=tile.completion||null;
 if(ranges.length===1)mesh.userData.segmentKey=ranges[0].key;
 group.add(mesh);return true;
}
function appendSourceFacesFromCompactTile(positionsByKey,series,tile,active,coords){
 const {xs,ys,zs}=coords,plane=tile.width*tile.height,items=tile.items;
 for(let q=0;q<items.length;q+=2){
  const i=items[q],packed=items[q+1],tz=Math.floor(i/plane),rem=i-tz*plane,ty=Math.floor(rem/tile.width),tx=rem-ty*tile.width;
  const x=tile.x+tx,y=tile.y+ty,z=tile.z+tz,x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1],z0=zs[z],z1=zs[z+1];
  for(let s=0;s<active.length&&s<4;s++){
   const faces=(packed>>>(s*6))&63;if(!faces)continue;const positions=positionsByKey.get(active[s].key);if(!positions)continue;positions.hasCpuMesh=true;
   if(faces&1)positions.push(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y0,z0,x0,y1,z1,x0,y1,z0);
   if(faces&2)positions.push(x1,y0,z0,x1,y1,z0,x1,y1,z1,x1,y0,z0,x1,y1,z1,x1,y0,z1);
   if(faces&4)positions.push(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z0,x1,y0,z1,x0,y0,z1);
   if(faces&8)positions.push(x0,y1,z0,x0,y1,z1,x1,y1,z1,x0,y1,z0,x1,y1,z1,x1,y1,z0);
   if(faces&16)positions.push(x0,y0,z0,x0,y1,z0,x1,y1,z0,x0,y0,z0,x1,y1,z0,x1,y0,z0);
   if(faces&32)positions.push(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y0,z1,x1,y1,z1,x0,y1,z1);
  }
 }
}
function appendSourceSliceFacesFromFlags(positionsByKey,series,z,flags,active,coords){
 const w=series.columns,{xs,ys,zs}=coords,z0=zs[z],z1=zs[z+1];
 for(let i=0;i<flags.length;i++){
  const packed=flags[i];if(!packed)continue;const y=Math.floor(i/w),x=i-y*w,x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1];
  for(let s=0;s<active.length&&s<4;s++){
   const faces=(packed>>>(s*6))&63;if(!faces)continue;const positions=positionsByKey.get(active[s].key);if(!positions)continue;
   if(faces&1)positions.push(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y0,z0,x0,y1,z1,x0,y1,z0);
   if(faces&2)positions.push(x1,y0,z0,x1,y1,z0,x1,y1,z1,x1,y0,z0,x1,y1,z1,x1,y0,z1);
   if(faces&4)positions.push(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z0,x1,y0,z1,x0,y0,z1);
   if(faces&8)positions.push(x0,y1,z0,x0,y1,z1,x1,y1,z1,x0,y1,z0,x1,y1,z1,x1,y1,z0);
   if(faces&16)positions.push(x0,y0,z0,x0,y1,z0,x1,y1,z0,x0,y0,z0,x1,y1,z0,x1,y0,z0);
   if(faces&32)positions.push(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y0,z1,x1,y1,z1,x0,y1,z1);
  }
 }
}
function appendSourceSliceFacesFromBits(positionsByKey,series,z,prevBits,currBits,nextBits,active,coords){
 const w=series.columns,h=series.rows,{xs,ys,zs}=coords,z0=zs[z],z1=zs[z+1];
 for(let i=0;i<currBits.length;i++){
  const bits=currBits[i];if(!bits)continue;
  const y=Math.floor(i/w),x=i-y*w,x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1];
  for(let s=0;s<active.length&&s<4;s++){
   const bit=1<<s;if(!(bits&bit))continue;
   const positions=positionsByKey.get(active[s].key);if(!positions)continue;
   if(x===0||!(currBits[i-1]&bit))positions.push(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y0,z0,x0,y1,z1,x0,y1,z0);
   if(x===w-1||!(currBits[i+1]&bit))positions.push(x1,y0,z0,x1,y1,z0,x1,y1,z1,x1,y0,z0,x1,y1,z1,x1,y0,z1);
   if(y===0||!(currBits[i-w]&bit))positions.push(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z0,x1,y0,z1,x0,y0,z1);
   if(y===h-1||!(currBits[i+w]&bit))positions.push(x0,y1,z0,x0,y1,z1,x1,y1,z1,x0,y1,z0,x1,y1,z1,x1,y1,z0);
   if(!prevBits||!(prevBits[i]&bit))positions.push(x0,y0,z0,x0,y1,z0,x1,y1,z0,x0,y0,z0,x1,y1,z0,x1,y0,z0);
   if(!nextBits||!(nextBits[i]&bit))positions.push(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y0,z1,x1,y1,z1,x0,y1,z1);
  }
 }
}
function appendSourceSliceFacesFast(positions,series,z,prev,curr,next,coords){
 const w=series.columns,h=series.rows,m=curr.mask,{xs,ys,zs}=coords,z0=zs[z],z1=zs[z+1],pm=prev?.mask,nm=next?.mask;
 for(const block of curr.blocks)for(let bi=0;bi<block.length;bi++){
  const i=block[bi],y=Math.floor(i/w),x=i-y*w,x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1];
  if(x===0||!m[i-1])positions.push(x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y0,z0,x0,y1,z1,x0,y1,z0);
  if(x===w-1||!m[i+1])positions.push(x1,y0,z0,x1,y1,z0,x1,y1,z1,x1,y0,z0,x1,y1,z1,x1,y0,z1);
  if(y===0||!m[i-w])positions.push(x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z0,x1,y0,z1,x0,y0,z1);
  if(y===h-1||!m[i+w])positions.push(x0,y1,z0,x0,y1,z1,x1,y1,z1,x0,y1,z0,x1,y1,z1,x1,y1,z0);
  if(!pm||!pm[i])positions.push(x0,y0,z0,x0,y1,z0,x1,y1,z0,x0,y0,z0,x1,y1,z0,x1,y0,z0);
  if(!nm||!nm[i])positions.push(x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y0,z1,x1,y1,z1,x0,y1,z1);
 }
}
async function render3DSourceBacked(v){
 if(!sceneState||!v.series)return;
 const revision=++sourceRenderRevision,series=v.series,previous=sceneState.obj;
 const group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 const processedActive=active.filter(({seg})=>segmentNeedsGlobalMask(seg)&&!!v.mprData),streamActive=active.filter(({seg})=>!(segmentNeedsGlobalMask(seg)&&!!v.mprData));
 threeLabel.textContent=(sceneState.backend||'3D')+' · building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);
  syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeSource3DCoordinates(series),positionsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),strongSmooth=strongSurfaceSmoothingActive();
 const materialParamsByKey=new Map(streamActive.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}]));
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,positions=builder.take(),geometry=geometryFromSourcePositions(positions,alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();
  if(geometry){
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));
   mesh.name='segment_'+key+'_full_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
  }
 };
 try{
  for(const {key,seg} of processedActive){
   const memoryView=sourceMprMemoryView(v);
   const runs=thresholdRunsFromMemory(memoryView,seg),processedGroup=await buildEditableRunsGroup(v,runs,key);
   if(processedGroup){processedGroup.name='processed_segment_'+key;group.add(processedGroup)}
   await frameYield();
  }
  const filtered=sourceFilterStages().length>0,useGpuMesh=streamActive.length>0&&(filtered||('gpu' in navigator&&!gpuFilterRuntime.disabled));
  if(useGpuMesh){
   const filterBlockDepth=gpuMeshBlockDepth();
   for(let z0=0;z0<series.slices.length;z0+=filterBlockDepth){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const block=await getFilteredSourceAxialFaceBlock(z0,filterBlockDepth,series,streamActive,'3d:'+revision);
    for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,streamActive,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,streamActive);else appendSourceFacesFromCompactTile(positionsByKey,series,tile,streamActive,coords)}}
    const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+series.slices.length);await frameYield()}
   }
  }else if(streamActive.length){
   let prev=null,curr=await decodeSourceSegmentMasks(series.slices[0],streamActive);
   let next=streamActive.length&&series.slices.length>1?await decodeSourceSegmentMasks(series.slices[1],streamActive):null;
   for(let z=0;z<series.slices.length;z++){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const nz=z+2,nextPromise=streamActive.length&&nz<series.slices.length?decodeSourceSegmentMasks(series.slices[nz],streamActive):Promise.resolve(null);
    for(const {key} of streamActive)appendSourceSliceFacesFast(positionsByKey.get(key),series,z,prev?.get(key),curr.get(key),next?.get(key),coords);
    const flush=(z%chunkDepth===chunkDepth-1)||z===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,z);footer.textContent='3D building · CPU · '+(z+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(z+1)+' / '+series.slices.length);await frameYield()}
    prev=curr;curr=next;next=await nextPromise;
   }
  }
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(strongSmooth){
   for(const {key} of streamActive)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution');
  if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · source DICOM · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · source DICOM · no resampling';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);
  if(revision===sourceRenderRevision){threeLabel.textContent=(sceneState.backend||'3D')+' · build error';footer.textContent='3D build error: '+String(e.message||e);set3DBusy(false);mark3DStale()}
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
 }
}

async function render3DMemoryGpu(v){
 const device=await ensureGpuFilterDevice();if(!device)return false;
 const revision=++sourceRenderRevision,previous=sceneState.obj,group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 threeLabel.textContent=(sceneState.backend||'3D')+' · GPU building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeVolume3DCoordinates(v),positionsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),materialParamsByKey=new Map(active.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}])),strongSmooth=strongSurfaceSmoothingActive();
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,geometry=geometryFromSourcePositions(builder.take(),alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();if(!geometry)return;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));mesh.name='segment_'+key+'_gpu_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
 };
 try{
  const blockDepth=gpuMeshBlockDepth();
  for(let z0=0;z0<v.slices;z0+=blockDepth){
   if(revision!==sourceRenderRevision){dispose(group);return null}
   const block=await getMemoryGpuMeshBlock(v,z0,blockDepth,active);
   for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,active,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,active);else appendSourceFacesFromCompactTile(positionsByKey,{columns:v.columns,rows:v.rows},tile,active,coords)}}
   const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===v.slices-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
   if(flush){for(const {key} of active)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+v.slices;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+v.slices);await frameYield()}
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(strongSmooth){
   for(const {key} of active)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution · GPU');if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · '+gpuFilterRuntime.lastBackend;set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);set3DBusy(false);
  if(revision!==sourceRenderRevision||threeDCancelRequested)return null;
  if(String(e.message||e)!=='__GPU_UNAVAILABLE__')console.warn('GPU decoded-volume mesh failed.',e);
  return false;
 }
}
async function render3D(v,force=false){
 if(!sceneState)return false;
 if(deferAutomatic3D&&!force){mark3DStale();return false}
 let ok;
 if(v.sourceBacked)ok=await render3DSourceBacked(v);
 else ok=await render3DMemoryGpu(v);
 if(ok!==true){
  if(ok===null||threeDCancelRequested)return false;
  threeLabel.textContent=(sceneState.backend||'3D')+(surfaceSmoothingActive()?' · smooth surface error':' · 3D build error');
  footer.textContent=currentLanguage==='ja'?(surfaceSmoothingActive()?'表面平滑化3Dの構築に失敗しました。以前の3D表示を保持しています。':'3D生成に失敗しました。以前の3D表示を保持しています。'):(surfaceSmoothingActive()?'Smooth 3D build failed. The previous 3D view was preserved.':'3D build failed. The previous 3D view was preserved.');
  mark3DStale();return false;
 }
 await restoreEditedSegmentSurfaces(v);
 return true;
}
function meshSegmentRanges(mesh,key){
 const pos=mesh?.geometry?.getAttribute?.('position');if(!pos)return[];
 if(mesh.userData?.segmentKey===key)return[{start:0,count:mesh.geometry.index?mesh.geometry.index.count:pos.count}];
 return Array.isArray(mesh.userData?.segmentRanges)?mesh.userData.segmentRanges.filter(r=>r.key===key):[];
}
function segmentKeyFromIntersection(hit){
 const direct=hit?.object?.userData?.segmentKey;if(direct)return direct;
 const mi=hit?.face?.materialIndex,ranges=hit?.object?.userData?.segmentRanges;
 if(Array.isArray(ranges)&&Number.isInteger(mi)){const match=ranges.find(r=>r.materialIndex===mi);if(match)return match.key}
 return null;
}
async function ensureGpuResidentCpuPositions(key=null,label='GPU readback'){
 const renderer=sceneState?.renderer;if(!renderer||typeof renderer.getArrayBufferAsync!=='function')return;
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||!o.userData?.gpuResident||o.userData?.gpuPositionReady)return;if(key&&meshSegmentRanges(o,key).length===0)return;meshes.push(o)});
 if(!meshes.length)return;
 const previousBackend=gpuFilterRuntime.lastBackend;setGpuComputeBackend('WEBGPU GPU-RESIDENT READBACK');setProcessingBusy(true,label);
 try{
  for(const mesh of meshes){
   if(mesh.userData.gpuCompletion)await mesh.userData.gpuCompletion;
   const attr=mesh.geometry.getAttribute('position'),buffer=await renderer.getArrayBufferAsync(attr),values=new Float32Array(buffer);
   if(values.length!==attr.array.length)throw new Error('GPU position readback size mismatch');
   attr.array.set(values);mesh.userData.gpuPositionReady=true;
  }
 }finally{setProcessingBusy(false,label);setGpuComputeBackend(previousBackend)}
}
function eachGeometryTriangleRange(geometry,start,count,callback){
 const pos=geometry?.getAttribute?.('position');if(!pos)return;
 const index=geometry.index,total=index?index.count:pos.count,first=Math.max(0,start||0),end=Math.min(total,count==null?total:first+Math.max(0,count));
 const a=new THREE.Vector3(),b=new THREE.Vector3(),cc=new THREE.Vector3();
 for(let i=first;i+2<end;i+=3){
  const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
  a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);cc.fromBufferAttribute(pos,ic);callback(a,b,cc);
 }
}
function eachGeometryTriangle(geometry,callback){
 const pos=geometry?.getAttribute?.('position');if(!pos)return;
 eachGeometryTriangleRange(geometry,0,geometry.index?geometry.index.count:pos.count,callback);
}
function currentSegmentMeshes(key){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(o.isMesh&&o.geometry&&meshSegmentRanges(o,key).length)meshes.push(o)});return meshes;
}
function currentSegmentDisplayScale(key){
 const mesh=currentSegmentMeshes(key)[0];return Number(mesh?.userData?.displayScale)||1;
}
function currentSegmentVolumeMm3(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return 0;
 const scale=currentSegmentDisplayScale(key),inv3=1/Math.max(scale*scale*scale,1e-18),cross=new THREE.Vector3();let signed=0;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(a,b,c)=>{signed+=a.dot(cross.crossVectors(b,c))/6});
 return Math.abs(signed)*inv3;
}
function currentSegmentTriangleCount(key){
 let count=0;for(const mesh of currentSegmentMeshes(key))for(const range of meshSegmentRanges(mesh,key))count+=Math.floor(range.count/3);return count;
}
function groupTriangleCount(group){
 let count=0;group?.traverse?.(o=>{if(o.isMesh&&o.geometry){const pos=o.geometry.getAttribute('position');count+=o.geometry.index?Math.floor(o.geometry.index.count/3):Math.floor((pos?.count||0)/3)}});return count;
}
function groupToBinaryStl(group,name='region',inverseScale=1){
 const triCount=groupTriangleCount(group);if(!triCount)return null;const buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer),header=new TextEncoder().encode('Virtual Rodent Lab '+name);new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));view.setUint32(80,triCount,true);
 const ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();let off=84;
 group.traverse(o=>{if(!o.isMesh||!o.geometry)return;eachGeometryTriangle(o.geometry,(aa,bb,cc)=>{const a=aa.clone().multiplyScalar(inverseScale),b=bb.clone().multiplyScalar(inverseScale),c=cc.clone().multiplyScalar(inverseScale);ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}view.setUint16(off,0,true);off+=2})});
 return new Blob([buffer],{type:'model/stl'});
}
function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();const url=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportFocusedAnalysisRegionStl(){
 const region=analysisRegionById(analysisFocusedRegionId),v=current3DVolume||volume;if(!region||!v)return;if(!region.meshGroup)await attachAnalysisRegion(region,v);
 const scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale,blob=groupToBinaryStl(region.meshGroup,'region-'+region.id,1/Math.max(scale,1e-12));if(!blob)return;
 const filename='virtual-rodent-region-'+region.id+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
function currentSegmentToBinaryStl(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return null;
 const triCount=currentSegmentTriangleCount(key),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer),header=new TextEncoder().encode('Virtual Rodent Lab '+key);
 new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));view.setUint32(80,triCount,true);
 const scale=currentSegmentDisplayScale(key),inverseScale=1/Math.max(scale,1e-12),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();let off=84;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(aa,bb,cc)=>{
  const a=aa.clone().multiplyScalar(inverseScale),b=bb.clone().multiplyScalar(inverseScale),c=cc.clone().multiplyScalar(inverseScale);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 });
 return new Blob([buffer],{type:'model/stl'});
}
async function exportSegmentStl(key){
 if(!sceneState?.obj||threeDDirty){footer.textContent=currentLanguage==='ja'?'STL: 先に3Dを再構築してください':'STL: rebuild 3D first';return}
 let blob=null;
 if(segmentEditActive(key)){
  if(!segmentEditState[key].surfaceGroup)await refreshEditedSegmentSurface(key);
  const v=current3DVolume||volume,scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;blob=groupToBinaryStl(segmentEditState[key].surfaceGroup,'edited-'+key,1/Math.max(scale,1e-12));
 }else{
  try{await ensureGpuResidentCpuPositions(key,currentLanguage==='ja'?'STL用メッシュを取得中':'Preparing STL mesh')}catch(e){console.error(e);footer.textContent='STL readback error: '+String(e.message||e);return}
  blob=currentSegmentToBinaryStl(key);
 }
 if(!blob){footer.textContent='STL: segment is empty';return}
 const names={bone:'bone',soft:'soft-tissue',fat:'fat',lung:'lung'},filename='virtual-rodent-'+(names[key]||key)+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
function geometryToBinaryStl(geometry,name='segment'){
 const pos=geometry.getAttribute('position'),index=geometry.index;
 if(!pos||!index)throw new Error('Indexed geometry required for STL export');
 const triCount=Math.floor(index.count/3),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer);
 const header=new TextEncoder().encode('Virtual Rodent Lab '+name);new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));
 view.setUint32(80,triCount,true);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
 let off=84;
 for(let t=0;t<triCount;t++){
  const ia=index.getX(t*3),ib=index.getX(t*3+1),ic=index.getX(t*3+2);
  a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 }
 return new Blob([buffer],{type:'model/stl'});
}
function taubinSmoothGeometry(geometry,strength){
 const pos=geometry.getAttribute('position');
 const index=geometry.index;
 if(!pos||!index||strength<=0)return;
 const vertexCount=pos.count;
 const neighbors=Array.from({length:vertexCount},()=>[]);
 const addNeighbor=(a,b)=>{const list=neighbors[a];for(let i=0;i<list.length;i++)if(list[i]===b)return;list.push(b)};
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  addNeighbor(a,b);addNeighbor(a,c);
  addNeighbor(b,a);addNeighbor(b,c);
  addNeighbor(c,a);addNeighbor(c,b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const baseStrength=Math.min(strength,1),lambda=.34*baseStrength,mu=-.36*baseStrength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(ns.length===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.length;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(strength<=1?2+strength*4:strength<=3?6+(strength-1)*18:42+(strength-3)*24));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function resetVolume(){sourceRenderRevision++;threeDCancelRequested=false;current3DVolume=null;analysisEditTool='select';analysisEditTargetKey=null;analysisEditTargetMode='auto';analysisCutStroke=null;analysisCutScreen=[];analysisPendingCut=null;if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();invalidateSourceFilters();clearSourceSliceCache();activeSeries=null;sectionViewOpen=false;clearSectionView();updateSectionViewUi();if(threeRenderMode==='volume')setThreeVolumeOverlay(false);threeRenderMode='surface';sceneState?.medicalVolume?.resetData();clearAllSegmentEdits();clearAnalysisHighlight();smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();volumeAnalysisMode=false;volumeAnalysisBusy=false;volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');sectionViewToggle.disabled=true;volumeAnalysisResult.classList.add('is-hidden');clearAnalysisHighlight();filterRebuildRevision++;filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;volume=null;sourceVolume=null;enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;ctRangeProfile=null;ctRangeMode='auto';ctRangeAuto.disabled=ctRangeFull.disabled=true;ctRangeAuto.classList.add('is-active');ctRangeFull.classList.remove('is-active');for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}set3DBusy(false);updateRenderModeControl(null);updateAnalysisEditorControls();updateThreeEditUi();request3DRender();set3DState('current');threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{const release=()=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()};const pending=c.userData?.gpuCompletion;if(pending?.then)pending.then(release,release);else release()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
function fmt(n){if(!n)return'0 B';const u=['B','KiB','MiB','GiB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return(n/1024**i).toFixed(i?2:0)+' '+u[i]}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}function numberOr(v,f){const n=Number(v);return Number.isFinite(n)?n:f}function multi(v,n){if(!v)return null;const a=v.split('\\').map(Number);return a.length>=n&&a.every(Number.isFinite)?a.slice(0,n):null}function safePair(a){return[a[0],a[1]]}function safeTriple(a){return[a[0],a[1],a[2]]}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
void ensureLatestDeployedBuild();
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
