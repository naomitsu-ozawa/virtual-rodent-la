// GPU info tab of the settings dialog (build 503): GPU preference (Linux / Windows only), a diagnostics report that can
// be copied without any terminal, and short GUI-only hints. Opened from the settings dialog or by clicking the GPU status bar.
import { settings } from './app-settings.js?v=20261008-build505';
import { gpuFilterRuntime, gpuLastAdapterRequest, requestVrlGpuAdapter, vrlGpuPreference, gpuAdapterInfo } from './gpu-compute.js?v=20261008-build505';
import { gpuPlatformOs, gpuPreferenceSupported, gpuAdapterKind, gpuPreferenceNote, buildGpuReport, getGpuErrorLog, gpuBrowserDisabled } from './gpu-diagnostics.js?v=20261008-build505';
import { tr } from './i18n.js?v=20261008-build505';
import { APP_BUILD } from './version.js?v=20261008-build505';

const LIMIT_KEYS = ['maxTextureDimension2D', 'maxTextureDimension3D', 'maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeWorkgroupStorageSize', 'maxComputeInvocationsPerWorkgroup', 'maxComputeWorkgroupSizeX', 'maxStorageBuffersPerShaderStage'];

export async function collectGpuDiagnostics() {
  const nav = globalThis.navigator || {};
  const hasGpu = 'gpu' in nav;
  let adapter = gpuFilterRuntime.adapter;
  if (!adapter && hasGpu) { try { adapter = await requestVrlGpuAdapter(); } catch {} }
  let adapterData = null;
  if (adapter) {
    const lim = {}; for (const k of LIMIT_KEYS) { const v = adapter.limits?.[k]; if (v !== undefined) lim[k] = v; }
    const info = gpuAdapterInfo(adapter) || {};
    adapterData = { info: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description }, isFallback: adapter.isFallbackAdapter, limits: lim, features: [...(adapter.features || [])].sort() };
  }
  const effective = hasGpu ? vrlGpuPreference() : 'auto';
  const req = { stored: String(settings.get('gpuPreference') ?? 'auto'), effective, option: gpuLastAdapterRequest.option, optionIndex: gpuLastAdapterRequest.optionIndex };
  const kind = adapterData ? gpuAdapterKind(adapterData.info) : '';
  const os = gpuPlatformOs(nav);
  const hint = adapterData && gpuPreferenceNote(effective, adapterData.info) ? tr('gpuPrefNote') : '';
  return {
    time: new Date().toISOString(), build: APP_BUILD, userAgent: nav.userAgent, platform: nav.userAgentData?.platform || nav.platform || '', os,
    navigatorGpu: hasGpu, requested: req, adapter: adapterData, backend: gpuFilterRuntime.lastBackend, mode: gpuFilterRuntime.device ? (gpuFilterRuntime.device.features?.has?.('core-features-and-limits') ? 'CORE' : 'COMPAT') : '',
    errors: getGpuErrorLog(), lastError: gpuFilterRuntime.lastError, hint, kind
  };
}

export async function gpuReportText() { return buildGpuReport(await collectGpuDiagnostics(), tr); }

export function initGpuDiagnosticsUi() {
  const dlg = document.getElementById('settings-dialog'); if (!dlg) return;
  const $ = id => document.getElementById(id);
  const sel = $('set-gpu-preference'), prefRow = $('gpu-pref-row'), reloadRow = $('gpu-pref-reload'), hintEl = $('gpu-hint'), area = $('gpu-report'), msg = $('gpu-copy-msg');
  const supported = gpuPreferenceSupported();
  const loadedPref = String(settings.get('gpuPreference') ?? 'auto');
  if (prefRow) prefRow.hidden = !supported;
  if (sel) {
    sel.value = supported ? loadedPref : 'auto';
    sel.onchange = () => { settings.set('gpuPreference', sel.value); if (reloadRow) reloadRow.hidden = sel.value === loadedPref; };
  }
  const reloadBtn = $('gpu-pref-reload-btn'); if (reloadBtn) reloadBtn.onclick = () => location.reload();
  let seq = 0;
  async function refresh() {
    const my = ++seq; if (msg) msg.textContent = '';
    let d; try { d = await collectGpuDiagnostics(); } catch (e) { if (area) area.value = String(e?.stack || e); return; }
    if (my !== seq) return;
    if (area) area.value = buildGpuReport(d, tr);
    if (hintEl) {
      const lines = [];
      if (d.hint) lines.push(d.hint);
      if (gpuBrowserDisabled(d)) lines.push(tr('gpuBrowserOff'));
      if (d.os === 'linux' && d.kind) {
        lines.push(d.kind === 'software' ? tr('gpuHintSw') : tr('gpuHintInt'));
      }
      hintEl.hidden = !lines.length; hintEl.textContent = lines.join('\n'); hintEl.style.whiteSpace = 'pre-wrap';
    }
  }
  const copyBtn = $('gpu-copy');
  if (copyBtn) copyBtn.onclick = async () => {
    await refresh();
    const text = area?.value || '';
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    if (!ok && area) { try { area.focus(); area.select(); ok = document.execCommand?.('copy') === true; } catch {} }
    if (msg) msg.textContent = ok ? tr('gpuCopied') : tr('gpuCopyManual');
    if (!ok && area) { area.focus(); area.select(); }
  };
  const tab = dlg.querySelector('[data-settings-tab="gpu"]'); if (tab) tab.addEventListener('click', () => void refresh());
  const open = () => { const o = $('settings-open'); if (o && !dlg.open) o.click(); tab?.click(); };
  const bar = $('gpu-status-bar'); if (bar) { bar.setAttribute('role', 'button'); bar.tabIndex = 0; bar.title = tr('settingsTabGpu'); bar.addEventListener('click', open); bar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); }
  globalThis.__vrlOpenGpuInfo = open;
}
