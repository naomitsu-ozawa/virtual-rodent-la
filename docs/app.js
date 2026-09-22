
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
const APP_VERSION='2026.09.21-1849';const APP_BUILD='05';

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
  surfaceSmooth:'表面平滑化',strength:'強度',sigmoidCenter:'中心',filterThreshold:'検出閾値',iterations:'反復回数',passes:'Pass数',searchRadius:'探索半径',patchRadius:'パッチ半径',spatialSigma:'空間Sigma',intensitySigma:'強度Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'STL書き出し',volumeMode:'体積解析',volumeOff:'体積解析を終了',volumeHint:'3D上の部品をクリックしてください',analysisRegions:'解析領域',mergeSelected:'選択を統合',clearRegions:'すべて解除',showRegion:'表示',hideRegion:'非表示',deleteRegion:'削除',mergedRegion:'統合領域',analysisRegion:'領域',mergeNeedsTwo:'2件以上の領域を選択してください',mergingRegions:'領域を統合中…',resetFilters:'画像フィルターをリセット',
  controls:'断面画像: 左右スワイプ / マウスホイールでスライス移動',
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
  surfaceSmooth:'Surface Smooth',strength:'Strength',sigmoidCenter:'Center',filterThreshold:'Threshold',iterations:'Iterations',passes:'Passes',searchRadius:'Search Radius',patchRadius:'Patch Radius',spatialSigma:'Spatial Sigma',intensitySigma:'Intensity Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'Export STL',volumeMode:'Volume analysis',volumeOff:'Exit volume analysis',volumeHint:'Click a 3D component',analysisRegions:'Analysis regions',mergeSelected:'Merge selected',clearRegions:'Clear all',showRegion:'Show',hideRegion:'Hide',deleteRegion:'Delete',mergedRegion:'Merged region',analysisRegion:'Region',mergeNeedsTwo:'Select at least two regions',mergingRegions:'Merging regions…',resetFilters:'Reset image filters',
  controls:'MPR slices: swipe left/right or use the mouse wheel',
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
  <label class="segment-range"><span data-i18n="strength">強度</span><output id="surface-smooth-value">0.60</output><input id="surface-smooth-strength" type="range" min="0" max="3" step="0.05" value="0.60" disabled></label>
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
</div><p class="hint" data-i18n="controls">1本指: 3D回転 / 2本指: ズーム・移動 / MPRは上下ドラッグでスライス移動</p></section></div></aside>
<section class="viewer-grid" id="viewer-grid"><section id="main-view-slot" class="view-slot view-slot-main"><article class="viewport-card view-card view-card-3d" data-view-key="3d"><div class="viewport-label view-toolbar"><strong>3D</strong><span id="three-label">WebGPU</span><span class="view-drag-handle" data-view-drag-handle aria-label="Drag to swap">⋮⋮</span><button class="view-main-button" type="button" data-view-main="3d" data-i18n="mainView">メインへ</button></div><div class="volume-analysis-panel"><button id="volume-analysis-toggle" class="tool-chip" data-i18n="volumeMode" disabled>体積解析</button><div id="volume-analysis-result" class="volume-analysis-result is-hidden"><div id="analysis-summary" class="analysis-summary"></div><div class="analysis-actions"><button id="analysis-merge" type="button" disabled data-i18n="mergeSelected">選択を統合</button><button id="analysis-clear" type="button" disabled data-i18n="clearRegions">すべて解除</button></div><div id="analysis-region-list" class="analysis-region-list"></div></div></div><div id="viewport-3d" class="viewport viewport-3d"></div><div id="three-busy" class="three-busy is-hidden" role="status" aria-live="polite"><div class="three-busy-spinner" aria-hidden="true"></div><strong id="three-busy-label">3D構築中…</strong><button id="three-busy-cancel" class="three-busy-cancel" type="button" data-i18n="cancel3D">再構築をキャンセル</button></div><div id="selected" class="selected-series-overlay"><strong data-i18n="seriesUnselected">シリーズ未選択</strong><span data-i18n="selectSeries">左の一覧からCTシリーズを選択してください。</span></div></article></section><section id="sub-view-slots" class="mpr-column">${['axial','coronal','sagittal'].map(p=>`<section class="view-slot view-slot-sub"><article class="viewport-card view-card view-card-mpr" data-view-key="${p}"><div class="viewport-label view-toolbar"><strong>${p[0].toUpperCase()+p.slice(1)}</strong><span id="${p}-label">—</span><span class="view-drag-handle" data-view-drag-handle aria-label="Drag to swap">⋮⋮</span><button class="view-main-button" type="button" data-view-main="${p}" data-i18n="mainView">メインへ</button></div><canvas id="${p}-canvas" class="mpr-canvas"></canvas><input id="${p}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled></article></section>`).join('')}</section></section></section>
<div id="app-version-badge" class="app-version-badge" aria-label="Application version"></div><footer><span id="footer" data-i18n="footer">元のキャリブレーション済みCT値は保持されます。</span><a href="https://github.com/naomitsu-ozawa/virtual-rodent-la" target="_blank" rel="noopener">Source / License</a></footer></main>`;

const $=s=>document.querySelector(s);
const appVersionBadge=$('#app-version-badge');
const viewport=$('#viewport-3d'),status=$('#gpu-status'),demoBtn=$('#demo-button'),folderBtn=$('#open-folder'),folderInput=$('#folder-input'),state=$('#scan-state'),prog=$('#scan-progress'),bar=$('#scan-progress-bar'),progLabel=$('#scan-progress-label'),list=$('#series-list'),selected=$('#selected'),footer=$('#footer'),threeLabel=$('#three-label'),wc=$('#wc'),ww=$('#ww'),wcVal=$('#wc-val'),wwVal=$('#ww-val'),gaussianBtn=$('#filter-gaussian'),smoothingType=$('#filter-smoothing-type'),spikeHoleBtn=$('#filter-spike-hole'),resetFilterBtn=$('#filter-reset'),nlmBtn=$('#filter-nlm'),anisotropicBtn=$('#filter-anisotropic'),sigmoidBtn=$('#filter-sigmoid'),gaussianStrength=$('#gaussian-strength'),gaussianStrengthValue=$('#gaussian-strength-value'),spatialPasses=$('#spatial-passes'),spatialPassesValue=$('#spatial-passes-value'),spikeHoleStrength=$('#spike-hole-strength'),spikeHoleStrengthValue=$('#spike-hole-strength-value'),spikeHoleThreshold=$('#spike-hole-threshold'),spikeHoleThresholdValue=$('#spike-hole-threshold-value'),nlmStrength=$('#nlm-strength'),nlmStrengthValue=$('#nlm-strength-value'),nlmSearchRadius=$('#nlm-search-radius'),nlmSearchRadiusValue=$('#nlm-search-radius-value'),nlmPatchRadius=$('#nlm-patch-radius'),nlmPatchRadiusValue=$('#nlm-patch-radius-value'),anisotropicStrength=$('#anisotropic-strength'),anisotropicStrengthValue=$('#anisotropic-strength-value'),anisotropicIterations=$('#anisotropic-iterations'),anisotropicIterationsValue=$('#anisotropic-iterations-value'),sigmoidStrength=$('#sigmoid-strength'),sigmoidStrengthValue=$('#sigmoid-strength-value'),sigmoidCenter=$('#sigmoid-center'),sigmoidCenterValue=$('#sigmoid-center-value'),bilateralBtn=$('#filter-bilateral'),bilateralStrength=$('#bilateral-strength'),bilateralStrengthValue=$('#bilateral-strength-value'),bilateralSpatial=$('#bilateral-spatial'),bilateralSpatialValue=$('#bilateral-spatial-value'),bilateralIntensity=$('#bilateral-intensity'),bilateralIntensityValue=$('#bilateral-intensity-value'),bilateralPasses=$('#bilateral-passes'),bilateralPassesValue=$('#bilateral-passes-value'),tvBtn=$('#filter-tv'),tvWeight=$('#tv-weight'),tvWeightValue=$('#tv-weight-value'),tvIterations=$('#tv-iterations'),tvIterationsValue=$('#tv-iterations-value'),unsharpBtn=$('#filter-unsharp'),unsharpRadius=$('#unsharp-radius'),unsharpRadiusValue=$('#unsharp-radius-value'),unsharpAmount=$('#unsharp-amount'),unsharpAmountValue=$('#unsharp-amount-value'),unsharpThreshold=$('#unsharp-threshold'),unsharpThresholdValue=$('#unsharp-threshold-value'),surfaceSmoothEnabled=$('#surface-smooth-enabled'),surfaceSmoothStrength=$('#surface-smooth-strength'),surfaceSmoothValue=$('#surface-smooth-value'),volumeAnalysisToggle=$('#volume-analysis-toggle'),volumeAnalysisResult=$('#volume-analysis-result'),analysisSummary=$('#analysis-summary'),analysisMergeButton=$('#analysis-merge'),analysisClearButton=$('#analysis-clear'),analysisRegionList=$('#analysis-region-list'),filterControlList=$('.filter-control-list'),filterAddSelect=$('#filter-add-select'),filterAddButton=$('#filter-add-button'),segmentAddSelect=$('#segment-add-select'),segmentAddButton=$('#segment-add-button'),segmentControls=$('#segment-controls');
const planes=Object.fromEntries(['axial','coronal','sagittal'].map(p=>[p,{canvas:$('#'+p+'-canvas'),slider:$('#'+p+'-slider'),label:$('#'+p+'-label')}]))
const languageToggle=$('#language-toggle'),processingOverlay=$('#processing-overlay'),processingOverlayLabel=$('#processing-overlay-label'),threeBusy=$('#three-busy'),threeBusyLabel=$('#three-busy-label'),threeBusyCancel=$('#three-busy-cancel'),ctRangeAuto=$('#ct-range-auto'),ctRangeFull=$('#ct-range-full'),filterRebuild3D=$('#filter-rebuild-3d'),filter3DState=$('#filter-3d-state'),mainViewSlot=$('#main-view-slot'),subViewSlots=$('#sub-view-slots');
languageToggle.onclick=()=>{applyLanguage(currentLanguage==='ja'?'en':'ja');renderAnalysisResults();updateGpuStatus()};
applyLanguage('ja');;
if(appVersionBadge)appVersionBadge.textContent='Virtual Rodent Lab · v'+APP_VERSION+' · build '+APP_BUILD;
let volume=null,sourceVolume=null,sceneState=null,activeId=null,activeSeries=null,volumeAnalysisMode=false,volumeAnalysisBusy=false,sourceRenderRevision=0;
let analysisRegions=[],nextAnalysisRegionId=1,nextAnalysisColorIndex=0;
const ANALYSIS_REGION_COLORS=[0x00d8ff,0xff9f1c,0x7ae582,0xff4d8d,0xf4e409,0x9b5cff,0xff5a5f,0x2ec4b6];
function nextAnalysisColor(){
 const color=ANALYSIS_REGION_COLORS[nextAnalysisColorIndex%ANALYSIS_REGION_COLORS.length];
 nextAnalysisColorIndex++;return color;
}
function analysisColorCss(color){return '#'+Number(color??0x00d8ff).toString(16).padStart(6,'0')}
let deferAutomatic3D=false,threeDDirty=false,threeDApplying=false,threeDCancelRequested=false,current3DVolume=null,memoryGpuPreviewActive=false;
let ctRangeMode='auto',ctRangeProfile=null;
const memoryFilterPreviewCache={map:new Map(),bytes:0};
const filterState={spikeHole:false,nlm:false,anisotropic:false,gaussian:false,sigmoid:false,bilateral:false,tv:false,unsharp:false};
const FILTER_CATALOG_ORDER=['spikeHole','nlm','anisotropic','gaussian','sigmoid','bilateral','tv','unsharp'];
let filterOrder=[];
let filterRebuildTimer=null;
let filterRebuildRevision=0;
const SEGMENT_PRESET_ORDER=['bone','soft','fat','lung'];
const segmentState={
 bone:{active:false,enabled:false,color:'#f3f0e8',opacity:.85,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 soft:{active:false,enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 fat:{active:false,enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 lung:{active:false,enabled:false,color:'#6fb8d6',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''}
};
let segmentRenderTimer=null;

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
 const hasCurrent3D=mode==='current'&&!!sceneState?.obj;
 if(volumeAnalysisToggle)volumeAnalysisToggle.disabled=!hasCurrent3D;
 for(const key of SEGMENT_PRESET_ORDER){
  const exportBtn=$('[data-seg-export="'+key+'"]');
  if(exportBtn)exportBtn.disabled=!hasCurrent3D||!segmentState[key].active||!segmentState[key].enabled;
 }
}
function mark3DStale(){if(volume)set3DState('stale')}
function mark3DCurrent(){set3DState('current')}
function mark3DUpdating(){set3DState('updating')}
function clear3DForSeriesChange(){
 sourceRenderRevision++;threeDCancelRequested=false;current3DVolume=null;memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();set3DBusy(false);clearAnalysisHighlight();
 if(sceneState?.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}
 request3DRender();mark3DStale();
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
 const sourceMode=volume?.sourceBacked===true;opening.disabled=sourceMode;closing.disabled=sourceMode;minComponent.disabled=sourceMode;holeFill.disabled=sourceMode;
 if(exportBtn)exportBtn.disabled=true;if(removeBtn)removeBtn.disabled=false;
 renderSegmentPresets();renderAll();scheduleSegment3D();
}
function removeSegmentPreset(key){
 if(!SEGMENT_PRESET_ORDER.includes(key)||!segmentState[key].active)return;
 const seg=segmentState[key];seg.active=false;seg.enabled=false;
 const enabled=$('[data-seg-enabled="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]');
 if(enabled)enabled.checked=false;if(removeBtn)removeBtn.disabled=true;
 renderSegmentPresets();clearAnalysisHighlight();renderAll();scheduleSegment3D();
}
segmentAddButton.onclick=()=>addSegmentPreset(segmentAddSelect.value);
analysisMergeButton.onclick=()=>void mergeSelectedAnalysisRegions();
analysisClearButton.onclick=()=>clearAnalysisHighlight();
volumeAnalysisToggle.onclick=()=>{
 if(!volume)return;
 volumeAnalysisMode=!volumeAnalysisMode;
 volumeAnalysisToggle.textContent=volumeAnalysisMode?tr('volumeOff'):tr('volumeMode');
 volumeAnalysisToggle.classList.toggle('is-active',volumeAnalysisMode);
 volumeAnalysisResult.classList.toggle('is-hidden',!volumeAnalysisMode);
 if(volumeAnalysisMode)renderAnalysisResults();else clearAnalysisHighlight();
};
folderBtn.onclick=()=>{folderInput.value='';folderInput.click()};
folderInput.onchange=async()=>{const files=[...(folderInput.files||[])];if(files.length)await inspect(files,false)};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('demoLoading')+'</strong><span>'+tr('demoSize')+'</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>'+tr('demoFailed')+'</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=()=>renderMainMprPreview();
wc.onchange=ww.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');renderAll()};
ctRangeAuto.onclick=()=>applyCtRangeMode('auto');
ctRangeFull.onclick=()=>applyCtRangeMode('full');
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderMainMprPreview();scheduleSegment3D()};
 color.onchange=()=>renderAll();
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;segmentState[key]._maskCache=null;updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;segmentState[key]._maskCache=null;updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 min.onchange=max.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');renderAll()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 opacity.onchange=()=>renderAll();
 const invalidateSegment=(full=false)=>{segmentState[key]._maskCache=null;segmentState[key]._maskCacheKey='';clearAnalysisHighlight();if(full)renderAll();else renderMainMprPreview();scheduleSegment3D()};
 opening.oninput=()=>{segmentState[key].opening=+opening.value;$('[data-seg-opening-out="'+key+'"]').value=opening.value;invalidateSegment(false)};
 opening.onchange=()=>invalidateSegment(true);
 closing.oninput=()=>{segmentState[key].closing=+closing.value;$('[data-seg-closing-out="'+key+'"]').value=closing.value;invalidateSegment(false)};
 closing.onchange=()=>invalidateSegment(true);
 minComponent.oninput=()=>{segmentState[key].minComponent=+minComponent.value;$('[data-seg-min-component-out="'+key+'"]').value=minComponent.value;invalidateSegment(false)};
 minComponent.onchange=()=>invalidateSegment(true);
 holeFill.onchange=()=>{segmentState[key].holeFill=holeFill.checked;invalidateSegment(true)};
 exportBtn.onclick=()=>exportSegmentStl(key);
 removeBtn.onclick=()=>removeSegmentPreset(key);
}
surfaceSmoothEnabled.onchange=()=>{surfaceSmoothStrength.disabled=!surfaceSmoothEnabled.checked||!volume;scheduleSegment3D()};
surfaceSmoothStrength.oninput=()=>{surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);scheduleSegment3D()};
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
 clearTimeout(filterRebuildTimer);clearMemoryFilterPreviewCache();mark3DStale();
 const finalize3D=!(sourceVolume?.sourceBacked)||delay===0;
 filterRebuildTimer=setTimeout(()=>{filterRebuildTimer=null;void rebuildActiveFilters(finalize3D)},delay);
}
async function rebuildActiveFilters(finalize3D=true){
 if(!sourceVolume)return;
 const revision=++filterRebuildRevision;
 clearTimeout(liveFilterState.timer);liveFilterState.base=null;liveFilterState.key=null;
 if(sourceVolume.sourceBacked){
  invalidateSourceFilters();volume=sourceVolume;setProcessingBusy(true,'Full-resolution filters',false);
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
 input.oninput=()=>{output.value=(+input.value).toFixed(2);if(filterState[key])scheduleFilterRebuild(160)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
sigmoidCenter.oninput=()=>{sigmoidCenterValue.value=Math.round(+sigmoidCenter.value);if(filterState.sigmoid)scheduleFilterRebuild(160)};
sigmoidCenter.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');if(filterState.sigmoid)scheduleFilterRebuild(0)};
spikeHoleThreshold.oninput=()=>{spikeHoleThresholdValue.value=(+spikeHoleThreshold.value).toFixed(3);if(filterState.spikeHole)scheduleFilterRebuild(160)};
spikeHoleThreshold.onchange=()=>{if(filterState.spikeHole)scheduleFilterRebuild(0)};
anisotropicIterations.oninput=()=>{anisotropicIterationsValue.value=Math.round(+anisotropicIterations.value);if(filterState.anisotropic)scheduleFilterRebuild(160)};
anisotropicIterations.onchange=()=>{if(filterState.anisotropic)scheduleFilterRebuild(0)};
spatialPasses.oninput=()=>{spatialPassesValue.value=Math.round(+spatialPasses.value);if(filterState.gaussian)scheduleFilterRebuild(160)};
spatialPasses.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
nlmSearchRadius.oninput=()=>{nlmSearchRadiusValue.value=Math.round(+nlmSearchRadius.value);if(filterState.nlm)scheduleFilterRebuild(180)};
nlmSearchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};
nlmPatchRadius.oninput=()=>{nlmPatchRadiusValue.value=Math.round(+nlmPatchRadius.value);if(filterState.nlm)scheduleFilterRebuild(180)};
nlmPatchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};

for(const [input,output,key,digits] of [
 [bilateralStrength,bilateralStrengthValue,'bilateral',2],[bilateralSpatial,bilateralSpatialValue,'bilateral',2],[bilateralIntensity,bilateralIntensityValue,'bilateral',2],
 [tvWeight,tvWeightValue,'tv',2],[unsharpAmount,unsharpAmountValue,'unsharp',2],[unsharpThreshold,unsharpThresholdValue,'unsharp',2]
]){
 input.oninput=()=>{output.value=(+input.value).toFixed(digits);if(filterState[key])scheduleFilterRebuild(180)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
for(const [input,output,key] of [[bilateralPasses,bilateralPassesValue,'bilateral'],[tvIterations,tvIterationsValue,'tv'],[unsharpRadius,unsharpRadiusValue,'unsharp']]){
 input.oninput=()=>{output.value=Math.round(+input.value);if(filterState[key])scheduleFilterRebuild(180)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
resetFilterBtn.onclick=()=>{filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();syncFilterControls();resetProcessing()};
filterRebuild3D.onclick=()=>{if(threeDApplying)cancel3DRebuild();else void rebuildCurrent3D()};
threeBusyCancel.onclick=()=>cancel3DRebuild();
installFilterReorder();

const planeRenderTimers={axial:null,coronal:null,sagittal:null};
function schedulePlaneRender(p){
 clearTimeout(planeRenderTimers[p]);
 const wait=volume?.sourceBacked&&sourceFilterStages().length?70:0;
 if(wait)planeRenderTimers[p]=setTimeout(()=>{planeRenderTimers[p]=null;safeRenderPlane(p)},wait);
 else requestAnimationFrame(()=>safeRenderPlane(p));
}
for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>schedulePlaneRender(p);installMprTouch(p)}

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
function withTimeout(promise,ms,fallback){
 return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
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
 return{file:f,studyUid:ds.string('x0020000d')?.trim()||'study',seriesUid,description:ds.string('x0008103e')?.trim()||'Unnamed series',modality:ds.string('x00080060')?.trim()||'Unknown',rows:ds.uint16('x00280010')||0,columns:ds.uint16('x00280011')||0,bits:ds.uint16('x00280100')||16,bitsStored:ds.uint16('x00280101')||ds.uint16('x00280100')||16,highBit:ds.uint16('x00280102'),signed:ds.uint16('x00280103')||0,samples:ds.uint16('x00280002')||1,pixelSpacing:ps?safePair(ps):null,thickness:num(ds.string('x00180050')),spacingBetween:num(ds.string('x00180088')),instance:num(ds.string('x00200013')),pos:pos?safeTriple(pos):null,slope:numberOr(ds.string('x00281053'),1),intercept:numberOr(ds.string('x00281052'),0),windowCenter:num(ds.string('x00281050')),windowWidth:num(ds.string('x00281051')),smallest:ds.uint16('x00280106'),largest:ds.uint16('x00280107'),pixelOffset:ds.elements.x7fe00010?.dataOffset??null,pixelLength:ds.elements.x7fe00010?.length??null,ts:ds.string('x00020010')?.trim()||'1.2.840.10008.1.2.1'};
}
async function parseFiles(files,onProgress){
 const out=new Array(files.length),workers=navigator.maxTouchPoints>0?2:Math.min(4,Math.max(2,navigator.hardwareConcurrency||2));let cursor=0,done=0;
 const work=async()=>{
  while(true){
   const i=cursor++;if(i>=files.length)return;const f=files[i];
   try{const ds=await parseDicomHeader(f);out[i]=parsedSliceMeta(f,ds)}catch{}
   done++;onProgress?.(done,files.length);
   if((done&31)===0)await frameYield();
  }
 };
 await Promise.all(Array.from({length:Math.min(workers,files.length)},()=>work()));
 return out.filter(Boolean);
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
  g.sort((a,b)=>((a.pos?.[2]??a.instance??0)-(b.pos?.[2]??b.instance??0)));
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
  volume=sourceVolume;phase='configure';configure(volume);enableProcessingControls(true);scheduleGpuPrewarm();phase='render';renderAll();mark3DStale();
  selected.querySelector('.ready-badge').textContent=s.sourceBacked?'CT source ready · 2D ready':'CT volume ready · 2D ready';
  footer.textContent=s.sourceBacked?'Full-resolution source-backed DICOM · no resampling':'CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · '+volume.data.constructor.name+' '+fmt(volume.data.byteLength);
 }catch(e){
  console.error(e);const label=phase==='decode'?'Decode failed':phase==='configure'?'Configure failed':'Render failed';
  selected.querySelector('.ready-badge').textContent=label;footer.textContent=label+': '+String(e.message||e)
 }finally{prog.classList.add('is-hidden');busy(false)}
}
function openSourceBackedVolume(s){
 return{data:null,sourceBacked:true,series:s,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min:s.min,max:s.max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:'DICOM source'};
}
async function decodeSourceSlice(meta){
 if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);
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
 if(meta.pixelOffset==null){const full=await decodeSourceSlice(meta);return full.slice(row*meta.columns,(row+1)*meta.columns)}
 const start=meta.pixelOffset+row*meta.columns*bpp,end=start+meta.columns*bpp,bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer),out=new Float32Array(meta.columns);
 for(let x=0;x<meta.columns;x++){let raw;if(meta.bits===8){raw=bytes[x];if(meta.signed&&raw>127)raw-=256}else raw=meta.signed?view.getInt16(x*2,little):view.getUint16(x*2,little);out[x]=raw*meta.slope+meta.intercept}
 return out;
}
async function readSourceColumn(meta,column){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(meta.pixelOffset==null){const full=await decodeSourceSlice(meta),out=new Float32Array(meta.rows);for(let y=0;y<meta.rows;y++)out[y]=full[y*meta.columns+column];return out}
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
 const Ctor=s.compact?Int16Array:Float32Array,count=s.columns*s.rows*s.slices.length,bytesNeeded=count*Ctor.BYTES_PER_ELEMENT;
 let data;try{data=new Ctor(count)}catch(e){throw new Error('Volume memory allocation failed: '+fmt(bytesNeeded)+' ('+Ctor.name+')')}
 let min=Infinity,max=-Infinity;
 for(let z=0;z<s.slices.length;z++){
  const slice=await decodeSourceSlice(s.slices[z]);data.set(slice,z*s.rows*s.columns);
  for(let i=0;i<slice.length;i++){const v=slice[i];if(v<min)min=v;if(v>max)max=v}
  onProgress?.(z+1,s.slices.length);if((z&7)===0)await frameYield();
 }
 return{data,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min,max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:Ctor.name,sourceBacked:false};
}


/* Full-resolution source-backed filters: exact local processing in bounded tiles. */
const gpuFilterRuntime={device:null,adapter:null,initPromise:null,disabled:false,pipelines:new Map(),warned:false,lastBackend:'CPU',lastError:'',adapterLabel:'',retryAfter:0,initAttempts:0,bufferPool:new Map(),bufferPoolBytes:0,sharedRendererDevice:false};
function gpuAdapterLabel(adapter){
 try{
  const info=adapter?.info;if(!info)return'';
  return [info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
 }catch{return''}
}
function updateGpuStatus(){
 if(!status)return;
 const render=sceneState?.backend||'INIT';
 const compute=gpuFilterRuntime.device?(gpuFilterRuntime.lastBackend.startsWith('WEBGPU')?gpuFilterRuntime.lastBackend:'WEBGPU READY'):(gpuFilterRuntime.lastBackend||'CPU');
 const adapter=gpuFilterRuntime.adapterLabel?(' · '+gpuFilterRuntime.adapterLabel):'';
 status.removeAttribute('data-i18n');
 status.textContent='Render '+render+' · Compute '+compute+adapter;
 const gpuActive=render==='WEBGPU'||compute.startsWith('WEBGPU');
 status.className=gpuActive?'status status-ok':'status status-warning';
 status.title=gpuFilterRuntime.lastError||'';
}
function setGpuComputeBackend(label,error=''){
 gpuFilterRuntime.lastBackend=label;if(error)gpuFilterRuntime.lastError=String(error);updateGpuStatus();
}
const GPU_FILTER_KEYS=new Set(['gaussian','sigmoid','spikeHole','unsharp','anisotropic','tv','bilateral','nlm']);
function gpuStagesSupported(stages){
 return stages.every(stage=>GPU_FILTER_KEYS.has(stage.key));
}
function gpuPoolLimit(){return navigator.maxTouchPoints>0?64*1024*1024:192*1024*1024}
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
function adoptRendererGpuDevice(renderer){
 const device=renderer?.backend?.device;
 if(!device||typeof device.createBuffer!=='function'||gpuFilterRuntime.device===device)return false;
 clearGpuBufferPool();gpuFilterRuntime.pipelines.clear();gpuFilterRuntime.device=device;gpuFilterRuntime.adapter=null;gpuFilterRuntime.disabled=false;gpuFilterRuntime.sharedRendererDevice=true;gpuFilterRuntime.initPromise=null;gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.lastBackend='WEBGPU READY';gpuPrewarmIndex=0;gpuPrewarmScheduled=false;
 try{device.lost.then(()=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();gpuPrewarmIndex=0;gpuPrewarmScheduled=false;setGpuComputeBackend('GPU DEVICE LOST','WebGPU device lost')}})}catch{}
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
   let adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
   if(!adapter)adapter=await navigator.gpu.requestAdapter();
   if(!adapter)throw new Error('WebGPU adapter unavailable');
   const device=await adapter.requestDevice();
   gpuFilterRuntime.adapter=adapter;gpuFilterRuntime.device=device;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.adapterLabel=gpuAdapterLabel(adapter);gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.warned=false;setGpuComputeBackend('WEBGPU READY');
   device.lost.then(info=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();gpuPrewarmIndex=0;gpuPrewarmScheduled=false;gpuFilterRuntime.retryAfter=performance.now()+2000;setGpuComputeBackend('GPU DEVICE LOST',info?.message||'WebGPU device lost')}});
   return device;
  }catch(e){
   gpuFilterRuntime.device=null;gpuFilterRuntime.adapter=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.retryAfter=performance.now()+5000;
   setGpuComputeBackend('CPU FALLBACK',e?.message||e);
   console.warn('WebGPU compute unavailable for this attempt; CPU fallback active. GPU will be retried.',e);
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
@compute @workgroup_size(256)
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
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u||c.y==0u||c.z==0u||c.x+1u>=w||c.y+1u>=h||c.z+1u>=d){dst[i]=src[i];return;}
 let plane=w*h;var vals:array<f32,7>;
 vals[0]=src[i];vals[1]=src[i-1u];vals[2]=src[i+1u];vals[3]=src[i-w];vals[4]=src[i+w];vals[5]=src[i-plane];vals[6]=src[i+plane];
 for(var q:u32=1u;q<7u;q=q+1u){
  let v=vals[q];var j=i32(q)-1;
  loop{
   if(j<0||vals[u32(j)]<=v){break;}
   vals[u32(j+1)]=vals[u32(j)];j=j-1;
  }
  vals[u32(j+1)]=v;
 }
 let s=params[0];dst[i]=src[i]*(1.0-s)+vals[3]*s;
}`;
 if(kind==='sigmoid')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let minv=params[0];let maxv=params[1];let strength=params[2];let centerValue=clamp(params[3],minv,maxv);
 let range=max(1.0,maxv-minv);let gain=2.0+strength*10.0;let center=(centerValue-minv)/range;
 let lo=1.0/(1.0+exp(gain*center));let hi=1.0/(1.0+exp(-gain*(1.0-center)));let norm=max(0.000001,hi-lo);
 let x=clamp((src[i]-minv)/range,0.0,1.0);let y=(1.0/(1.0+exp(-gain*(x-center)))-lo)/norm;
 dst[i]=minv+clamp(y,0.0,1.0)*range;
}`;
 if(kind==='spikeHole')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u||c.y==0u||c.z==0u||c.x+1u>=w||c.y+1u>=h||c.z+1u>=d){dst[i]=src[i];return;}
 let n0=src[i-1u];let n1=src[i+1u];let n2=src[i-w];let n3=src[i+w];let plane=w*h;let n4=src[i-plane];let n5=src[i+plane];
 let mean=(n0+n1+n2+n3+n4+n5)/6.0;let lo=min(min(min(n0,n1),min(n2,n3)),min(n4,n5));let hi=max(max(max(n0,n1),max(n2,n3)),max(n4,n5));
 let range=max(1.0,params[1]-params[0]);let strength=params[2];let threshold=range*params[3];let guard=threshold*(0.55+0.35*strength);let diff=src[i]-mean;
 if(hi-lo<=guard&&abs(diff)>threshold){let target=mean+sign(diff)*threshold*0.08;let blend=0.20+0.75*strength;dst[i]=src[i]*(1.0-blend)+target*blend;}else{dst[i]=src[i];}
}`;
 if(kind==='anisotropic')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u||c.y==0u||c.z==0u||c.x+1u>=w||c.y+1u>=h||c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let strength=params[2];let k=range*(0.025+0.09*strength);let k2=max(k*k,0.000001);let lambda=0.06+0.14*strength;
 var flux=0.0;var diff=src[i-1u]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+1u]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-w]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+w]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-plane]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+plane]-center;flux+=exp(-(diff*diff)/k2)*diff;
 dst[i]=center+lambda*flux;
}`;
 if(kind==='tv')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u||c.y==0u||c.z==0u||c.x+1u>=w||c.y+1u>=h||c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let weight=params[2];let lambda=min(0.18,0.02+weight*0.45);let eps=range*0.0001;
 var flux=0.0;var diff=src[i-1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-w]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+w]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 dst[i]=center+lambda*flux;
}`;
 if(kind==='unsharp')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=i32(meta[0]);let h=i32(meta[1]);let d=i32(meta[2]);let r=i32(meta[4]);
 var sum=0.0;var count=0.0;
 for(var dz:i32=-r;dz<=r;dz=dz+1){let zz=i32(c.z)+dz;if(zz<0||zz>=d){continue;}
  for(var dy:i32=-r;dy<=r;dy=dy+1){let yy=i32(c.y)+dy;if(yy<0||yy>=h){continue;}
   for(var dx:i32=-r;dx<=r;dx=dx+1){let xx=i32(c.x)+dx;if(xx<0||xx>=w){continue;}sum+=src[u32(zz)*meta[0]*meta[1]+u32(yy)*meta[0]+u32(xx)];count+=1.0;}
  }
 }
 let blur=sum/max(count,1.0);let detail=src[i]-blur;let range=max(1.0,params[1]-params[0]);let threshold=params[3]*range;
 dst[i]=select(src[i],src[i]+params[2]*detail,abs(detail)>=threshold);
}`;
 if(kind==='bilateral')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let strength=params[2];let spatialSigma=params[3];let intensitySigma=max(0.000001,params[4]*max(1.0,params[1]-params[0]));
 let radius=i32(meta[4]);let sp2=2.0*spatialSigma*spatialSigma;let int2=2.0*intensitySigma*intensitySigma;
 var sum=0.0;var wsum=0.0;
 for(var dz:i32=-radius;dz<=radius;dz=dz+1){
  let zz=i32(c.z)+dz;if(zz<0||zz>=i32(meta[2])){continue;}
  for(var dy:i32=-radius;dy<=radius;dy=dy+1){
   let yy=i32(c.y)+dy;if(yy<0||yy>=i32(meta[1])){continue;}
   for(var dx:i32=-radius;dx<=radius;dx=dx+1){
    let xx=i32(c.x)+dx;if(xx<0||xx>=i32(meta[0])){continue;}
    let j=idx(u32(xx),u32(yy),u32(zz));let dv=src[j]-center;
    let sw=exp(-f32(dx*dx+dy*dy+dz*dz)/sp2);let iw=exp(-(dv*dv)/int2);let ww=sw*iw;
    sum+=src[j]*ww;wsum+=ww;
   }
  }
 }
 let filtered=select(center,sum/wsum,wsum>0.0);dst[i]=center*(1.0-strength)+filtered*strength;
}`;
 if(kind==='nlm')return header+`
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let sr=i32(meta[4]);let pr=i32(meta[5]);let range=max(1.0,params[1]-params[0]);let hp=range*(0.018+0.11*params[2]);let h2=max(hp*hp,0.000001);
 var weighted=center;var weightSum=1.0;
 for(var dz:i32=-sr;dz<=sr;dz=dz+1){
  let nz=i32(c.z)+dz;if(nz<0||nz>=i32(meta[2])){continue;}
  for(var dy:i32=-sr;dy<=sr;dy=dy+1){
   let ny=i32(c.y)+dy;if(ny<0||ny>=i32(meta[1])){continue;}
   for(var dx:i32=-sr;dx<=sr;dx=dx+1){
    let nx=i32(c.x)+dx;if(nx<0||nx>=i32(meta[0])||(dx==0&&dy==0&&dz==0)){continue;}
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
fn insideSegment(v:f32,s:u32)->bool{return v>=thresholds[s*2u]&&v<=thresholds[s*2u+1u];}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}var count=0u;
  if(gx==0u||!insideSegment(src[localIdx(x-1u,y,z)],s)){count++;}
  if(gx+1u>=meta[14]||!insideSegment(src[localIdx(x+1u,y,z)],s)){count++;}
  if(gy==0u||!insideSegment(src[localIdx(x,y-1u,z)],s)){count++;}
  if(gy+1u>=meta[15]||!insideSegment(src[localIdx(x,y+1u,z)],s)){count++;}
  if(gz==0u||!insideSegment(src[localIdx(x,y,z-1u)],s)){count++;}
  if(gz+1u>=meta[16]||!insideSegment(src[localIdx(x,y,z+1u)],s)){count++;}
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
fn insideSegment(v:f32,s:u32)->bool{return v>=thresholds[s*2u]&&v<=thresholds[s*2u+1u];}
fn writeFace(base:u32,a:vec3<f32>,b:vec3<f32>,c:vec3<f32>,d:vec3<f32>,e:vec3<f32>,f:vec3<f32>){
 dst[base]=a.x;dst[base+1u]=a.y;dst[base+2u]=a.z;dst[base+3u]=b.x;dst[base+4u]=b.y;dst[base+5u]=b.z;
 dst[base+6u]=c.x;dst[base+7u]=c.y;dst[base+8u]=c.z;dst[base+9u]=d.x;dst[base+10u]=d.y;dst[base+11u]=d.z;
 dst[base+12u]=e.x;dst[base+13u]=e.y;dst[base+14u]=e.z;dst[base+15u]=f.x;dst[base+16u]=f.y;dst[base+17u]=f.z;
}
fn slotFor(s:u32)->u32{return (meta[17u+s]+atomicAdd(&counters.values[s],1u))*18u;}
@compute @workgroup_size(256)
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
  if(gx==0u||!insideSegment(src[localIdx(x-1u,y,z)],s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y0,z1),vec3f(x0,y1,z1),vec3f(x0,y0,z0),vec3f(x0,y1,z1),vec3f(x0,y1,z0));}
  if(gx+1u>=meta[14]||!insideSegment(src[localIdx(x+1u,y,z)],s)){let b=slotFor(s);writeFace(b,vec3f(x1,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z1));}
  if(gy==0u||!insideSegment(src[localIdx(x,y-1u,z)],s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x1,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z1));}
  if(gy+1u>=meta[15]||!insideSegment(src[localIdx(x,y+1u,z)],s)){let b=slotFor(s);writeFace(b,vec3f(x0,y1,z0),vec3f(x0,y1,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y1,z0));}
  if(gz==0u||!insideSegment(src[localIdx(x,y,z-1u)],s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y1,z0),vec3f(x1,y1,z0),vec3f(x0,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y0,z0));}
  if(gz+1u>=meta[16]||!insideSegment(src[localIdx(x,y,z+1u)],s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z1),vec3f(x1,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z1));}
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
fn insideSegment(value:f32,s:u32)->bool{return value>=thresholds[s*2u]&&value<=thresholds[s*2u+1u];}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(gx==0u||!insideSegment(src[localIdx(x-1u,y,z)],s)){faces=faces|1u;}
  if(gx+1u>=meta[14]||!insideSegment(src[localIdx(x+1u,y,z)],s)){faces=faces|2u;}
  if(gy==0u||!insideSegment(src[localIdx(x,y-1u,z)],s)){faces=faces|4u;}
  if(gy+1u>=meta[15]||!insideSegment(src[localIdx(x,y+1u,z)],s)){faces=faces|8u;}
  if(gz==0u||!insideSegment(src[localIdx(x,y,z-1u)],s)){faces=faces|16u;}
  if(gz+1u>=meta[16]||!insideSegment(src[localIdx(x,y,z+1u)],s)){faces=faces|32u;}
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
fn insideSegment(value:f32,s:u32)->bool{return value>=thresholds[s*2u]&&value<=thresholds[s*2u+1u];}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(gx==0u||!insideSegment(src[localIdx(x-1u,y,z)],s)){faces=faces|1u;}
  if(gx+1u>=meta[14]||!insideSegment(src[localIdx(x+1u,y,z)],s)){faces=faces|2u;}
  if(gy==0u||!insideSegment(src[localIdx(x,y-1u,z)],s)){faces=faces|4u;}
  if(gy+1u>=meta[15]||!insideSegment(src[localIdx(x,y+1u,z)],s)){faces=faces|8u;}
  if(gz==0u||!insideSegment(src[localIdx(x,y,z-1u)],s)){faces=faces|16u;}
  if(gz+1u>=meta[16]||!insideSegment(src[localIdx(x,y,z+1u)],s)){faces=faces|32u;}
  packed=packed|(faces<<shift);
 }
 dst[i]=packed;
}`;
 if(kind==='maskExtract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;let value=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
 var bits=0u;let segmentCount=meta[10];
 for(var s:u32=0u;s<segmentCount;s=s+1u){
  if(value>=thresholds[s*2u]&&value<=thresholds[s*2u+1u]){bits=bits|(1u<<s);}
 }
 dst[i]=bits;
}`;
 if(kind==='extract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;
 dst[i]=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
}`;
 throw new Error('Unknown GPU filter shader '+kind);
}
async function gpuFilterPipeline(kind){
 const device=await ensureGpuFilterDevice();if(!device)return null;
 if(gpuFilterRuntime.pipelines.has(kind))return gpuFilterRuntime.pipelines.get(kind);
 const module=device.createShaderModule({code:gpuFilterShader(kind),label:'VRL '+kind+' compute'});
 const desc={layout:'auto',compute:{module,entryPoint:'main'},label:'VRL '+kind};
 const pipeline=device.createComputePipelineAsync?await device.createComputePipelineAsync(desc):device.createComputePipeline(desc);
 gpuFilterRuntime.pipelines.set(kind,pipeline);return pipeline;
}
const GPU_PREWARM_KINDS=['gaussian','median','sigmoid','spikeHole','anisotropic','tv','unsharp','bilateral','nlm','extract','maskExtract','faceCompact','meshCount','meshWrite'];
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
  const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/256));pass.end();
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
  const cp=encoder.beginComputePass();cp.setPipeline(countPipeline);cp.setBindGroup(0,countGroup);cp.dispatchWorkgroups(Math.ceil(targetCount/256));cp.end();
  const countRead=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(counters,0,countRead,0,16);device.queue.submit([encoder.finish()]);
  await countRead.mapAsync(GPUMapMode.READ);const counts=new Uint32Array(countRead.getMappedRange().slice(0));countRead.unmap();countRead.destroy();
  const totalFaces=counts[0]+counts[1]+counts[2]+counts[3],vertexBytes=totalFaces*18*4,maxOut=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize||device.limits.maxStorageBufferBindingSize);
  if(totalFaces===0){
   releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU FILTER+MESH');return{mesh:true,vertices:new Float32Array(0),counts};
  }
  if(vertexBytes<=maxOut){
   let offset=0;for(let i=0;i<4;i++){meta[17+i]=offset;offset+=counts[i]}device.queue.writeBuffer(mb,0,meta);device.queue.writeBuffer(counters,0,new Uint32Array(4));
   const output=device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
   const sx=faceContext.spacingX,sy=faceContext.spacingY,sz=faceContext.spacingZ,px=faceContext.globalW*sx,py=faceContext.globalH*sy,pz=faceContext.globalD*sz,scale=3.3/Math.max(px,py,pz,1);
   const gb=gpuSmallBuffer(device,new Float32Array([sx,sy,sz,scale,px,py,pz,0]));small.push(gb);
   const writePipeline=await gpuFilterPipeline('meshWrite'),writeGroup=device.createBindGroup({layout:writePipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:output}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counters}},{binding:5,resource:{buffer:gb}}
   ]});
   const writeEncoder=device.createCommandEncoder({label:'VRL GPU mesh vertices'}),wp=writeEncoder.beginComputePass();wp.setPipeline(writePipeline);wp.setBindGroup(0,writeGroup);wp.dispatchWorkgroups(Math.ceil(targetCount/256));wp.end();
   const readback=device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});writeEncoder.copyBufferToBuffer(output,0,readback,0,vertexBytes);device.queue.submit([writeEncoder.finish()]);
   await readback.mapAsync(GPUMapMode.READ);const vertices=new Float32Array(readback.getMappedRange().slice(0));readback.unmap();
   output.destroy();readback.destroy();releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();
   setGpuComputeBackend('WEBGPU FILTER+MESH');return{mesh:true,vertices,counts};
  }
  counters.destroy();
  encoder=device.createCommandEncoder({label:'VRL compact face fallback'});
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
 const ep=encoder.beginComputePass();ep.setPipeline(extractPipeline);ep.setBindGroup(0,extractGroup);ep.dispatchWorkgroups(Math.ceil(targetCount/256));ep.end();
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

const sourceSliceCache={map:new Map(),bytes:0};
function sourceSliceCacheLimit(){return navigator.maxTouchPoints>0?48*1024*1024:128*1024*1024}
function clearSourceSliceCache(){sourceSliceCache.map.clear();sourceSliceCache.bytes=0}
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
 if(preferFullSliceCache){
  const full=await getCachedSourceSlice(meta),out=new Float32Array(width*height);let q=0;
  for(let y=0;y<height;y++){out.set(full.subarray((y0+y)*meta.columns+x0,(y0+y)*meta.columns+x0+width),q);q+=width}
  return out;
 }
 if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);
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
   if(!gpuFilterRuntime.warned){console.warn('WebGPU filter execution failed; using CPU worker.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend('CPU WORKER');
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
   if(!gpuFilterRuntime.warned){console.warn('WebGPU mask execution failed; using CPU fallback.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend('CPU WORKER');
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
async function processSourceRegionFaces(series,target,stages,key,revision,segments){
 const halo=Math.max(1,sourceFilterHalo(stages)),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const compact=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:series.columns,globalH:series.rows,globalD:series.slices.length,spacingX:series.spacingX,spacingY:series.spacingY,spacingZ:series.spacingZ,mesh:true});
   if(compact?.mesh||compact?.compact){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return compact}
  }catch(e){
   if(!gpuFilterRuntime.warned){console.warn('WebGPU face extraction failed; using CPU fallback.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend('CPU WORKER');
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:{x:0,y:0,z:0,width:box.width,height:box.height,depth:box.depth}};
 const filtered=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return compactFaceFlags(valuesToFaceFlags(filtered,box.width,box.height,box.depth,localTarget,segments,box,series));
}
function sourceTileBudget(){return navigator.maxTouchPoints>0?8*1024*1024:16*1024*1024}
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
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=Math.max(1,sourceFilterHalo(stages)),outDepth=Math.min(d-zStart,coreDepth),tiles=[],[tx,ty]=fitSourceTile(w,h,outDepth,halo,192,64);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),compact=await processSourceRegionFaces(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart+':'+x+':'+y,revision,segments);
  if(compact.mesh){if(compact.vertices.length)tiles.push({mesh:true,vertices:compact.vertices,counts:compact.counts});}
  else if(compact.items.length)tiles.push({x,y,z:zStart,width:tw,height:th,depth:outDepth,items:compact.items});
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
 const w=v.columns,h=v.rows,d=v.slices,out=new Float32Array(w*h*d),halo=sourceFilterHalo(stages),coreDepth=navigator.maxTouchPoints>0?2:4,[tx,ty]=fitSourceTile(w,h,coreDepth,halo,navigator.maxTouchPoints>0?256:384,navigator.maxTouchPoints>0?96:128);
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
async function processMemoryMeshRegion(v,target,segments){
 const halo=1,x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const [sx,sy,sz]=v.spacing;
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,[],local,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:v.columns,globalH:v.rows,globalD:v.slices,spacingX:sx,spacingY:sy,spacingZ:sz,mesh:true});
 if(result?.mesh||result?.compact)return result;
 throw new Error('__GPU_UNAVAILABLE__');
}
async function getMemoryGpuMeshBlock(v,zStart,coreDepth,segments){
 const outDepth=Math.min(v.slices-zStart,coreDepth),tiles=[],[tx,ty]=fitSourceTile(v.columns,v.rows,outDepth,1,192,64);
 for(let y=0;y<v.rows;y+=ty)for(let x=0;x<v.columns;x+=tx){
  const tw=Math.min(tx,v.columns-x),th=Math.min(ty,v.rows-y),result=await processMemoryMeshRegion(v,{x,y,z:zStart,width:tw,height:th,depth:outDepth},segments);
  if(result.mesh){if(result.vertices.length)tiles.push({mesh:true,vertices:result.vertices,counts:result.counts})}
  else if(result.items.length)tiles.push({x,y,z:zStart,width:tw,height:th,depth:outDepth,items:result.items});
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
async function renderPlaneMemoryFiltered(p){
 const c=planes[p],idx=+c.slider.value,revision=++planeRenderRevision[p];c.label.textContent=idx+1;
 try{
  const values=await getFilteredMemoryPlaneValues(p,idx,sourceVolume,revision);
  if(revision!==planeRenderRevision[p])return;
  const dims=p==='axial'?[sourceVolume.columns,sourceVolume.rows]:p==='coronal'?[sourceVolume.columns,sourceVolume.slices]:[sourceVolume.rows,sourceVolume.slices];
  paintSourcePlane(c,dims,values);
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
 volumeAnalysisToggle.disabled=v.sourceBacked===true;
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  const exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
  const usable=cfg.active,sourceMode=v.sourceBacked===true;
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=!usable;opening.disabled=closing.disabled=minComponent.disabled=holeFill.disabled=!usable||sourceMode;if(exportBtn)exportBtn.disabled=!usable||sourceMode;if(removeBtn)removeBtn.disabled=!usable;enabled.checked=cfg.enabled;color.value=cfg.color;
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
function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);sourceRenderRevision++;mark3DStale()}
const planeRenderRevision={axial:0,coronal:0,sagittal:0};
function safeRenderPlane(p){
 void renderPlane(p).catch(e=>{if(String(e.message||e)!=='__SUPERSEDED__'){console.warn('MPR render failed.',e);footer.textContent='MPR error: '+String(e.message||e)}});
}
function renderMainMprPreview(){
 if(!volume)return;
 const key=currentMainViewKey(),p=planes[key]?key:'axial';
 schedulePlaneRender(p);
}
function renderAll(){
 if(!volume)return;
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 for(const p of Object.keys(planes))safeRenderPlane(p);
}
async function renderPlane(p){
 if(!volume)return;
 if(volume.sourceBacked)return renderPlaneSourceBacked(p);
 if(memoryGpuPreviewActive&&sourceFilterStages().length)return renderPlaneMemoryFiltered(p);
 const c=planes[p],idx=+c.slider.value;c.label.textContent=idx+1;
 const dims=p==='axial'?[volume.columns,volume.rows]:p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],ctx=c.canvas.getContext('2d');c.canvas.width=dims[0];c.canvas.height=dims[1];
 const img=ctx.createImageData(...dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1);let q=0;
 const segOrder=['lung','fat','soft','bone'],segMasks={};for(const key of segOrder){const seg=segmentState[key];if(seg.active&&seg.enabled&&segmentNeedsGlobalMask(seg))segMasks[key]=getProcessedSegmentMask(volume,seg)}
 for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  let v;if(p==='axial')v=volume.data[idx*volume.rows*volume.columns+y*volume.columns+x];else if(p==='coronal'){const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+idx*volume.columns+x]}else{const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+x*volume.columns+idx]}
  const g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  const voxelIndex=p==='axial'?idx*volume.rows*volume.columns+y*volume.columns+x:p==='coronal'?(volume.slices-1-y)*volume.rows*volume.columns+idx*volume.columns+x:(volume.slices-1-y)*volume.rows*volume.columns+x*volume.columns+idx;
  for(const key of segOrder){const seg=segmentState[key],mask=segMasks[key];if(!seg.active||!seg.enabled)continue;const inside=mask?mask[voxelIndex]===1:(v>=seg.min&&v<=seg.max);if(!inside)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255
 }
 ctx.putImageData(img,0,0)
}
function paintSourcePlane(c,dims,values){
 const ctx=c.canvas.getContext('2d');c.canvas.width=dims[0];c.canvas.height=dims[1];
 const img=ctx.createImageData(...dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1),segOrder=['lung','fat','soft','bone'];let q=0;
 for(let i=0;i<values.length;i++){
  const v=values[i],g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  for(const key of segOrder){const seg=segmentState[key];if(!seg.active||!seg.enabled||v<seg.min||v>seg.max)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255;
 }
 ctx.putImageData(img,0,0);
}
async function renderPlaneSourceBacked(p){
 const c=planes[p],idx=+c.slider.value,series=volume.series,revision=++planeRenderRevision[p];c.label.textContent=idx+1;
 try{
  if(sourceFilterStages().length){
   const values=await getFilteredSourcePlaneValues(p,idx,series,'mpr:'+p,revision);
   if(revision!==planeRenderRevision[p])return;
   const dims=p==='axial'?[series.columns,series.rows]:p==='coronal'?[series.columns,series.slices.length]:[series.rows,series.slices.length];
   paintSourcePlane(c,dims,values);return;
  }
  if(p==='axial'){
   const values=await getCachedSourceSlice(series.slices[idx]);if(revision!==planeRenderRevision[p])return;
   paintSourcePlane(c,[series.columns,series.rows],values);return;
  }
  if(p==='coronal'){
   const values=new Float32Array(series.columns*series.slices.length);
   for(let z=0;z<series.slices.length;z++){
    const row=await readSourceRow(series.slices[z],idx);
    values.set(row,(series.slices.length-1-z)*series.columns);
    if((z&31)===0)await frameYield();
    if(revision!==planeRenderRevision[p])return;
   }
   paintSourcePlane(c,[series.columns,series.slices.length],values);return;
  }
  const values=new Float32Array(series.rows*series.slices.length);
  for(let z=0;z<series.slices.length;z++){
   const column=await readSourceColumn(series.slices[z],idx),base=(series.slices.length-1-z)*series.rows;
   values.set(column,base);
   if((z&15)===0)await frameYield();
   if(revision!==planeRenderRevision[p])return;
  }
  paintSourcePlane(c,[series.rows,series.slices.length],values);
 }catch(e){if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent='MPR read error: '+String(e.message||e)}}
}

function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}

function installMprTouch(p){const c=planes[p];let id=null,startX=0,start=0;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startX=e.clientX;start=+c.slider.value;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientWidth/(max+1)),next=Math.round(start+(e.clientX-startX)/sens);c.slider.value=Math.max(0,Math.min(max,next));schedulePlaneRender(p)};const end=e=>{if(id!==e.pointerId)return;if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null};c.canvas.onpointerup=end;c.canvas.onpointercancel=end;c.canvas.addEventListener('wheel',e=>{if(!volume||c.slider.disabled)return;e.preventDefault();const max=+c.slider.max,delta=e.deltaY===0?e.deltaX:e.deltaY,step=delta>0?1:-1;c.slider.value=Math.max(0,Math.min(max,+c.slider.value+step));schedulePlaneRender(p)},{passive:false})}

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
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5.2;scene.add(new THREE.HemisphereLight(0xffffff,0x182028,2.0));const keyLight=new THREE.DirectionalLight(0xffffff,2.4);keyLight.position.set(2,3,4);scene.add(keyLight);
 let renderer,backend='WEBGL';
 if('gpu' in navigator){
  try{
   const gpuRenderer=new THREE.WebGPURenderer({antialias:true});gpuRenderer.setPixelRatio(Math.min(devicePixelRatio,2));await gpuRenderer.init();renderer=gpuRenderer;backend='WEBGPU';adoptRendererGpuDevice(gpuRenderer);
  }catch(error){
   console.warn('WebGPU init failed; falling back to WebGL.',error);
  }
 }
 if(!renderer){
  renderer=new WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));backend='WEBGL';
 }
 threeLabel.textContent=backend;
 viewport.appendChild(renderer.domElement);sceneState={scene,camera,renderer,obj:null,analysisMesh:null,backend,needsRender:true};updateGpuStatus();void ensureGpuFilterDevice().then(()=>updateGpuStatus());
 const pointers=new Map();const pointerStarts=new Map();let distance=5.2,lastPinch=0,lastCenter=null;
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
 renderer.domElement.oncontextmenu=e=>e.preventDefault();
 renderer.domElement.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerStarts.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size>=2){const[a,b]=[...pointers.values()];lastPinch=Math.hypot(b.x-a.x,b.y-a.y);lastCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2}}};
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*.008);const qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*.008);sceneState.obj.quaternion.premultiply(qYaw);sceneState.obj.quaternion.premultiply(qPitch);sceneState.obj.quaternion.normalize();request3DRender();return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastPinch){distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),2.2,12);camera.position.z=distance}if(lastCenter){const ps=distance*.0015;sceneState.obj.position.x+=(center.x-lastCenter.x)*ps;sceneState.obj.position.y-=(center.y-lastCenter.y)*ps}lastPinch=d;lastCenter=center;request3DRender()};
 const endPointer=e=>{const start=pointerStarts.get(e.pointerId);const wasSingle=pointers.size===1;clear3DPointerState(e.pointerId);if(e.type==='pointerup'&&wasSingle&&start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6&&volumeAnalysisMode&&!volumeAnalysisBusy){void analyzeVolumeAtPointer(e,renderer.domElement,camera)}};
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.onlostpointercapture=e=>clear3DPointerState(e.pointerId);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,2.2,12);camera.position.z=distance;request3DRender()},{passive:false});
 const resize=()=>{camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);request3DRender()};sceneState.resize=resize;new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>{if(!sceneState?.needsRender)return;sceneState.needsRender=false;renderer.render(scene,camera)});
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
async function connectedComponentVolumeSource(v,key,seg,x0,y0,z0){
 const w=v.columns,h=v.rows,d=v.slices,analysisRevision=sourceFilterRuntime.revision,uf=new RunUnionFind(),sliceRuns=new Array(d);
 const seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity};
 let prevRows=null,done=0;const blockDepth=navigator.maxTouchPoints>0?2:4;
 for(let z0b=0;z0b<d;z0b+=blockDepth){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const masks=await sourceSegmentMaskBlock(v,key,seg,z0b,blockDepth,analysisRevision);
  for(let local=0;local<masks.length;local++){
   const z=z0b+local,result=sourceRunSlice(masks[local],w,h,z,seed,uf,prevRows);
   sliceRuns[z]=result.records;prevRows=result.rows;done=z+1;
   if((z&7)===0){analysisSummary.textContent=(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… ')+done+' / '+d;await frameYield()}
  }
 }
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
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
async function analyzeVolumeAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj)return;
 const analysisVolume=current3DVolume||volume;
 volumeAnalysisBusy=true;volumeAnalysisResult.classList.remove('is-hidden');renderAnalysisResults(currentLanguage==='ja'?'解析中…':'Analyzing…');
 try{
  const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObjects(sceneState.obj.children,true).find(h=>h.object?.userData?.segmentKey);
  if(!hit){renderAnalysisResults(tr('volumeHint'));return}
  const key=hit.object.userData.segmentKey,seg=segmentState[key],scale=hit.object.userData.displayScale,local=hit.object.worldToLocal(hit.point.clone());
  const [vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,px=w*vx,py=h*vy,pz=d*vz;
  let x=Math.round((local.x/scale+px/2)/vx),y=Math.round((-local.y/scale+py/2)/vy),z=Math.round((local.z/scale+pz/2)/vz);
  if(analysisVolume.sourceBacked){
   const result=await connectedComponentVolumeSource(analysisVolume,key,seg,x,y,z),runsBySlice=sourceResultToAnalysisRuns(result,d);
   await addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
   return;
  }
  const processedMask=getProcessedSegmentMask(analysisVolume,seg),inside=(ix,iy,iz)=>ix>=0&&iy>=0&&iz>=0&&ix<w&&iy<h&&iz<d&&processedMask[iz*h*w+iy*w+ix]===1;
  if(!inside(x,y,z)){
   let found=null;for(let r=1;r<=2&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(inside(ix,iy,iz)){found=[ix,iy,iz];break}}
   if(!found){renderAnalysisResults(currentLanguage==='ja'?'選択位置から領域を特定できませんでした':'Could not identify a component at the selected point');return}
   [x,y,z]=found;
  }
  const result=await connectedComponentVolume(analysisVolume,seg,x,y,z,processedMask),runsBySlice=maskToAnalysisRuns(result.mask,w,h,d);
  await addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'体積解析エラー: ':'Volume analysis error: ')+String(e.message||e))}
 }finally{volumeAnalysisBusy=false;sceneState?.clearPointerState?.();renderAnalysisResults()}
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
async function buildAnalysisRunsGroup(v,runsBySlice,key,id,color){
 const w=v.columns,h=v.rows,d=v.slices,coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),series={columns:w,rows:h},group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial(color));mesh.name='analysis_'+key+'_'+id+'_'+z;mesh.renderOrder=20;group.add(mesh)};
 let prev=null,curr=analysisRunSliceState(runsBySlice[0],w,h),next=d>1?analysisRunSliceState(runsBySlice[1],w,h):null;
 for(let z=0;z<d;z++){
  appendSourceSliceFacesFast(builder,series,z,prev,curr,next,coords);if(builder.length>=floatLimit)flush(z);
  prev=curr;curr=next;next=z+2<d?analysisRunSliceState(runsBySlice[z+2],w,h):null;
  if((z&31)===0)await frameYield();
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
 analysisClearButton.disabled=!analysisRegions.length||volumeAnalysisBusy;
 analysisRegionList.replaceChildren();
 for(const region of analysisRegions){
  const row=document.createElement('div');row.className='analysis-region-row';
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
 if(!analysisRegions.length&&sceneState?.analysisMesh){if(sceneState.analysisMesh.parent)sceneState.analysisMesh.parent.remove(sceneState.analysisMesh);sceneState.analysisMesh=null}
 request3DRender();renderAnalysisResults();
}
async function attachAnalysisRegion(region,v){
 const group=await buildAnalysisRunsGroup(v,region.runsBySlice,region.key,region.id,region.color);region.meshGroup=group;if(group){group.visible=region.visible;ensureAnalysisRoot().add(group)}request3DRender();
}
async function addAnalysisRegion(v,{key,segmentKeys,runsBySlice,voxels,mm3,merged=false}){
 const existing=analysisRegions.find(r=>r.segmentKeys.includes(key)&&analysisRunsOverlap(r.runsBySlice,runsBySlice));
 if(existing){existing.selected=true;existing.visible=true;if(existing.meshGroup)existing.meshGroup.visible=true;renderAnalysisResults();request3DRender();return existing}
 const region={id:nextAnalysisRegionId++,key,segmentKeys:[...new Set(segmentKeys)],runsBySlice,voxels,mm3,merged,selected:false,visible:true,meshGroup:null,color:nextAnalysisColor()};
 analysisRegions.push(region);await attachAnalysisRegion(region,v);renderAnalysisResults();return region;
}
async function mergeSelectedAnalysisRegions(){
 if(volumeAnalysisBusy)return;const selected=analysisRegions.filter(r=>r.selected);if(selected.length<2){renderAnalysisResults(tr('mergeNeedsTwo'));return}
 const v=current3DVolume||volume;if(!v)return;volumeAnalysisBusy=true;renderAnalysisResults(tr('mergingRegions'));
 try{
  const runsBySlice=unionAnalysisRuns(selected,v.slices),voxels=analysisRunsVoxelCount(runsBySlice),mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2],segmentKeys=[...new Set(selected.flatMap(r=>r.segmentKeys))],key=segmentKeys.length===1?segmentKeys[0]:'merged';
  for(const region of selected)disposeAnalysisRegionMesh(region);
  const ids=new Set(selected.map(r=>r.id));analysisRegions=analysisRegions.filter(r=>!ids.has(r.id));
  const region={id:nextAnalysisRegionId++,key,segmentKeys,runsBySlice,voxels,mm3,merged:true,selected:false,visible:true,meshGroup:null,color:nextAnalysisColor()};analysisRegions.push(region);await attachAnalysisRegion(region,v);
 }finally{volumeAnalysisBusy=false;sceneState?.clearPointerState?.();renderAnalysisResults()}
}
function resetAnalysisRegistryAfterRebuild(){
 analysisRegions=[];nextAnalysisRegionId=1;nextAnalysisColorIndex=0;if(sceneState)sceneState.analysisMesh=null;renderAnalysisResults();
}
function clearAnalysisHighlight(){
 if(sceneState?.analysisMesh){const root=sceneState.analysisMesh;if(root.parent)root.parent.remove(root);dispose(root);sceneState.analysisMesh=null}
 analysisRegions=[];nextAnalysisRegionId=1;nextAnalysisColorIndex=0;request3DRender();renderAnalysisResults();
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
 constructor(initial=131072){this.data=new Float32Array(initial);this.length=0}
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
  this.data=new Float32Array(nextSize);this.length=0;return out;
 }
}
function surfaceSmoothingActive(){
 return !!surfaceSmoothEnabled?.checked&&Number(surfaceSmoothStrength?.value)>0;
}
function indexedGeometryFromTrianglePositions(positions){
 const unique=[],indices=[],map=new Map();
 for(let i=0;i<positions.length;i+=3){
  const x=positions[i],y=positions[i+1],z=positions[i+2],key=x+'|'+y+'|'+z;
  let id=map.get(key);
  if(id===undefined){id=unique.length/3;map.set(key,id);unique.push(x,y,z)}
  indices.push(id);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(unique,3));
 geometry.setIndex(indices);
 return geometry;
}
function geometryFromSourcePositions(positions){
 if(!positions||!positions.length)return null;
 let geometry;
 if(surfaceSmoothingActive()){
  geometry=indexedGeometryFromTrianglePositions(positions);
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 }else{
  geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3);
 }
 return geometry;
}
function thresholdSourceMask(data,seg){
 const mask=new Uint8Array(data.length);
 for(let i=0;i<data.length;i++)if(data[i]>=seg.min&&data[i]<=seg.max)mask[i]=1;
 return mask;
}
async function decodeSourceSegmentMasks(meta,segments){
 if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);
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
function appendGpuMeshTile(positionsByKey,tile,active){
 let faceOffset=0;
 for(let s=0;s<active.length&&s<4;s++){
  const faces=tile.counts[s]||0,floatCount=faces*18;
  if(floatCount){positionsByKey.get(active[s].key)?.appendArray(tile.vertices.subarray(faceOffset*18,faceOffset*18+floatCount));}
  faceOffset+=faces;
 }
}
function appendSourceFacesFromCompactTile(positionsByKey,series,tile,active,coords){
 const {xs,ys,zs}=coords,plane=tile.width*tile.height,items=tile.items;
 for(let q=0;q<items.length;q+=2){
  const i=items[q],packed=items[q+1],tz=Math.floor(i/plane),rem=i-tz*plane,ty=Math.floor(rem/tile.width),tx=rem-ty*tile.width;
  const x=tile.x+tx,y=tile.y+ty,z=tile.z+tz,x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1],z0=zs[z],z1=zs[z+1];
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
 threeLabel.textContent=(sceneState.backend||'3D')+' · building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(previous){sceneState.scene.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeSource3DCoordinates(series),positionsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()]));
 const materialParamsByKey=new Map(active.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}]));
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const positions=builder.take(),geometry=geometryFromSourcePositions(positions);
  if(geometry){
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));
   mesh.name='segment_'+key+'_full_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
  }
 };
 try{
  const filtered=sourceFilterStages().length>0,useGpuMesh=filtered||('gpu' in navigator&&!gpuFilterRuntime.disabled);
  if(useGpuMesh){
   const filterBlockDepth=navigator.maxTouchPoints>0?2:4;
   for(let z0=0;z0<series.slices.length;z0+=filterBlockDepth){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const block=await getFilteredSourceAxialFaceBlock(z0,filterBlockDepth,series,active,'3d:'+revision);
    for(const tile of block.tiles){if(tile.mesh)appendGpuMeshTile(positionsByKey,tile,active);else appendSourceFacesFromCompactTile(positionsByKey,series,tile,active,coords)}
    const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of active)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+series.slices.length);await frameYield()}
   }
  }else{
   let prev=null,curr=await decodeSourceSegmentMasks(series.slices[0],active);
   let next=series.slices.length>1?await decodeSourceSegmentMasks(series.slices[1],active):null;
   for(let z=0;z<series.slices.length;z++){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const nz=z+2,nextPromise=nz<series.slices.length?decodeSourceSegmentMasks(series.slices[nz],active):Promise.resolve(null);
    for(const {key} of active)appendSourceSliceFacesFast(positionsByKey.get(key),series,z,prev?.get(key),curr.get(key),next?.get(key),coords);
    const flush=(z%chunkDepth===chunkDepth-1)||z===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of active)flushSegment(key,z);footer.textContent='3D building · CPU · '+(z+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(z+1)+' / '+series.slices.length);await frameYield()}
    prev=curr;curr=next;next=await nextPromise;
   }
  }
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(previous){sceneState.scene.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);
  threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';
  footer.textContent='3D full resolution · source DICOM · no resampling';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);
  if(revision===sourceRenderRevision){threeLabel.textContent=(sceneState.backend||'3D')+' · build error';footer.textContent='3D build error: '+String(e.message||e);set3DBusy(false);mark3DStale()}
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
 }
}

function surfaceSamplingStep(){return 1}
async function render3DMemoryGpu(v){
 const device=await ensureGpuFilterDevice();if(!device)return false;
 const revision=++sourceRenderRevision,previous=sceneState.obj,group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 threeLabel.textContent=(sceneState.backend||'3D')+' · GPU building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(previous){sceneState.scene.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeVolume3DCoordinates(v),positionsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),materialParamsByKey=new Map(active.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}]));
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const geometry=geometryFromSourcePositions(builder.take());if(!geometry)return;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));mesh.name='segment_'+key+'_gpu_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
 };
 try{
  const blockDepth=navigator.maxTouchPoints>0?2:4;
  for(let z0=0;z0<v.slices;z0+=blockDepth){
   if(revision!==sourceRenderRevision){dispose(group);return null}
   const block=await getMemoryGpuMeshBlock(v,z0,blockDepth,active);
   for(const tile of block.tiles){if(tile.mesh)appendGpuMeshTile(positionsByKey,tile,active);else appendSourceFacesFromCompactTile(positionsByKey,{columns:v.columns,rows:v.rows},tile,active,coords)}
   const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===v.slices-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
   if(flush){for(const {key} of active)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+v.slices;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+v.slices);await frameYield()}
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(previous){sceneState.scene.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution · GPU';footer.textContent='3D full resolution · '+gpuFilterRuntime.lastBackend;set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);set3DBusy(false);
  if(revision!==sourceRenderRevision||threeDCancelRequested)return null;
  if(String(e.message||e)!=='__GPU_UNAVAILABLE__')console.warn('GPU decoded-volume mesh failed; CPU fallback.',e);
  return false;
 }
}
function render3DMemoryCpu(v){
 sourceRenderRevision++;
 sceneState.analysisMesh=null;
 let savedTransform=null;
 if(sceneState.obj){savedTransform={position:sceneState.obj.position.clone(),quaternion:sceneState.obj.quaternion.clone(),scale:sceneState.obj.scale.clone()};sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj)}
 const group=new THREE.Group();if(savedTransform){group.position.copy(savedTransform.position);group.quaternion.copy(savedTransform.quaternion);group.scale.copy(savedTransform.scale)}
 const step=surfaceSamplingStep(v);
 for(const key of ['lung','fat','soft','bone']){const seg=segmentState[key];if(!seg.active||!seg.enabled)continue;const mesh=buildSegmentSurface(v,seg,step,key);if(mesh)group.add(mesh)}
 sceneState.obj=group;sceneState.scene.add(group);threeLabel.textContent=(sceneState.backend||'3D')+' · CPU fallback · step '+step;request3DRender();mark3DCurrent();return true;
}
function render3D(v,force=false){
 if(!sceneState)return Promise.resolve(false);
 if(deferAutomatic3D&&!force){mark3DStale();return Promise.resolve(false)}
 if(v.sourceBacked)return render3DSourceBacked(v);
 return (async()=>{
  const ok=await render3DMemoryGpu(v);
  if(ok===true)return true;
  if(ok===null||threeDCancelRequested)return false;
  return render3DMemoryCpu(v);
 })();
}
function buildSegmentSurface(v,seg,step,key){
 const w=v.columns,h=v.rows,d=v.slices,[sx,sy,sz]=v.spacing,mask=getProcessedSegmentMask(v,seg);
 const positions=[],indices=[],vertexMap=new Map();
 const px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const inside=(x,y,z)=>{
  if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return false;
  return mask[z*h*w+y*w+x]===1;
 };
 const vertex=(gx,gy,gz)=>{
  const k=gx+','+gy+','+gz;
  let id=vertexMap.get(k);if(id!==undefined)return id;
  id=positions.length/3;vertexMap.set(k,id);
  positions.push((gx*sx-px/2)*scale,-(gy*sy-py/2)*scale,(gz*sz-pz/2)*scale);
  return id;
 };
 const face=(a,b,c,dv)=>{
  const ia=vertex(...a),ib=vertex(...b),ic=vertex(...c),id=vertex(...dv);
  indices.push(ia,ib,ic,ia,ic,id);
 };
 const maxFaces=key==='bone'?600000:300000;let faces=0;
 outer:for(let z=0;z<d;z+=step)for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  if(!inside(x,y,z))continue;
  const x1=Math.min(w,x+step),y1=Math.min(h,y+step),z1=Math.min(d,z+step);
  const nx=x-step,ny=y-step,nz=z-step,pxn=x+step,pyn=y+step,pzn=z+step;
  if(!inside(nx,y,z)){face([x,y,z],[x,y,z1],[x,y1,z1],[x,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(pxn,y,z)){face([x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,ny,z)){face([x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,pyn,z)){face([x,y1,z],[x,y1,z1],[x1,y1,z1],[x1,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,nz)){face([x,y,z],[x,y1,z],[x1,y1,z],[x1,y,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,pzn)){face([x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]);if(++faces>=maxFaces)break outer}
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,
  roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,
  depthWrite:seg.opacity>.55
 });
 if(surfaceSmoothingActive()){
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.name='segment_'+key;mesh.userData.segmentKey=key;mesh.userData.displayScale=scale;return mesh;
}


function eachGeometryTriangle(geometry,callback){
 const pos=geometry?.getAttribute?.('position');if(!pos)return;
 const index=geometry.index;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const triCount=index?Math.floor(index.count/3):Math.floor(pos.count/3);
 for(let t=0;t<triCount;t++){
  const ia=index?index.getX(t*3):t*3,ib=index?index.getX(t*3+1):t*3+1,ic=index?index.getX(t*3+2):t*3+2;
  a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);callback(a,b,c);
 }
}
function currentSegmentMeshes(key){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(o.isMesh&&o.userData?.segmentKey===key&&o.geometry)meshes.push(o)});return meshes;
}
function currentSegmentDisplayScale(key){
 const mesh=currentSegmentMeshes(key)[0];return Number(mesh?.userData?.displayScale)||1;
}
function currentSegmentVolumeMm3(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return 0;
 const scale=currentSegmentDisplayScale(key),inv3=1/Math.max(scale*scale*scale,1e-18);let signed=0;
 for(const mesh of meshes)eachGeometryTriangle(mesh.geometry,(a,b,c)=>{signed+=a.dot(new THREE.Vector3().crossVectors(b,c))/6});
 return Math.abs(signed)*inv3;
}
function currentSegmentTriangleCount(key){
 let count=0;for(const mesh of currentSegmentMeshes(key)){const pos=mesh.geometry.getAttribute('position');count+=mesh.geometry.index?Math.floor(mesh.geometry.index.count/3):Math.floor((pos?.count||0)/3)}return count;
}
function currentSegmentToBinaryStl(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return null;
 const triCount=currentSegmentTriangleCount(key),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer),header=new TextEncoder().encode('Virtual Rodent Lab '+key);
 new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));view.setUint32(80,triCount,true);
 const scale=currentSegmentDisplayScale(key),inverseScale=1/Math.max(scale,1e-12),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();let off=84;
 for(const mesh of meshes)eachGeometryTriangle(mesh.geometry,(aa,bb,cc)=>{
  const a=aa.clone().multiplyScalar(inverseScale),b=bb.clone().multiplyScalar(inverseScale),c=cc.clone().multiplyScalar(inverseScale);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 });
 return new Blob([buffer],{type:'model/stl'});
}
function exportSegmentStl(key){
 if(!sceneState?.obj||threeDDirty){footer.textContent=currentLanguage==='ja'?'STL: 先に3Dを再構築してください':'STL: rebuild 3D first';return}
 const blob=currentSegmentToBinaryStl(key);
 if(!blob){footer.textContent='STL: segment is empty';return}
 const names={bone:'bone',soft:'soft-tissue',fat:'fat',lung:'lung'},a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='virtual-rodent-'+(names[key]||key)+'.stl';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+a.download;
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
 const neighbors=Array.from({length:vertexCount},()=>new Set());
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  neighbors[a].add(b);neighbors[a].add(c);
  neighbors[b].add(a);neighbors[b].add(c);
  neighbors[c].add(a);neighbors[c].add(b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const baseStrength=Math.min(strength,1),lambda=.34*baseStrength,mu=-.36*baseStrength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(ns.size===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.size;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(strength<=1?2+strength*4:6+(strength-1)*18));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function resetVolume(){sourceRenderRevision++;threeDCancelRequested=false;current3DVolume=null;memoryGpuPreviewActive=false;clearMemoryFilterPreviewCache();invalidateSourceFilters();clearSourceSliceCache();activeSeries=null;clearAnalysisHighlight();smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();volumeAnalysisMode=false;volumeAnalysisBusy=false;volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');volumeAnalysisResult.classList.add('is-hidden');clearAnalysisHighlight();filterRebuildRevision++;filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;volume=null;sourceVolume=null;enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;ctRangeProfile=null;ctRangeMode='auto';ctRangeAuto.disabled=ctRangeFull.disabled=true;ctRangeAuto.classList.add('is-active');ctRangeFull.classList.remove('is-active');for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}set3DBusy(false);request3DRender();set3DState('current');threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
function fmt(n){if(!n)return'0 B';const u=['B','KiB','MiB','GiB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return(n/1024**i).toFixed(i?2:0)+' '+u[i]}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}function numberOr(v,f){const n=Number(v);return Number.isFinite(n)?n:f}function multi(v,n){if(!v)return null;const a=v.split('\\').map(Number);return a.length>=n&&a.every(Number.isFinite)?a.slice(0,n):null}function safePair(a){return[a[0],a[1]]}function safeTriple(a){return[a[0],a[1],a[2]]}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
