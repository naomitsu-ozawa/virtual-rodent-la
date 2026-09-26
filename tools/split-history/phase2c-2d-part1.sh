# Exact extraction steps used for PR "phase 2c/2d part 1" (run from repo root on
# the pre-PR docs/). Kept as a record; re-running requires the original files.
set -e
X="node tools/extract-module.mjs"
DOM=$(node -e '
const acorn=require("acorn");const fs=require("fs");const s=fs.readFileSync("docs/app.js","utf8");
const ast=acorn.parse(s,{ecmaVersion:"latest",sourceType:"module"});const out=[];
for(const x of ast.body) if(x.type==="VariableDeclaration"&&x.kind==="const") for(const d of x.declarations){const init=d.init?s.slice(d.init.start,d.init.end):"";if(d.id.type==="Identifier"&&/^(\$\(|document\.querySelector(All)?\()/.test(init)&&d.id.name!=="app")out.push(d.id.name)}
console.log(out.join(" "))')
LINE=$(grep -n '^app.innerHTML=`' docs/app.js | cut -d: -f1)
$X docs/app.js docs/ui-shell.js app @line:$LINE '$' $DOM planes | grep -v '^REVIEW'
$X docs/app.js docs/settings.js surfaceSmoothingActive strongSurfaceSmoothingActive
$X docs/app.js docs/gpu-compute.js GPU_FILTER_KEYS acquireGpuWorkBuffer adoptRendererGpuDevice clearGpuBufferPool createGpuResidentFloat3Attribute destroyGpuResidentAttribute ensureGpuFilterDevice finishGpuResidentTemps gpuAdapterLabel gpuBufferBucketSize gpuComputeWorkgroupSize gpuDeviceMode gpuDeviceRequestDescriptor gpuFilterPipeline gpuFilterRuntime gpuPoolLimit gpuSmallBuffer gpuStagesSupported gpuValidationScope installGpuErrorListener releaseGpuWorkBuffer requestVrlGpuAdapter requestVrlGpuDevice runGpuSourceFilters setGpuComputeBackend updateGpuStatus verifyGpuComputeDevice verifyGpuPipelineSet
$X docs/app.js docs/volume-io.js getDicomCodecModule decode sourceMprDecodeConcurrency decodeSourceSlice decodeCompressedDicomSlice sourceMprCacheLimit readSourceColumn sourceSliceCache readSourceRows readSourceRow cachedSagittalDisplayPlane cachedSourceMprPlane prepareSourceMprCache
$X --append docs/app.js docs/dicom.js parseFiles
$X --append docs/app.js docs/i18n.js tr
# modules that now import state/other modules: make the header accurate
for f in docs/dicom.js docs/i18n.js; do sed -i 's#^// Self-contained: depends only on the imports below (no module state).#// Depends only on the imports below; never imports from app.js (no cycles).#' $f; done
