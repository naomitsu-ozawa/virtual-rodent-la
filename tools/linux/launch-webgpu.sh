#!/usr/bin/env bash
# Launch Chrome/Chromium on Linux with WebGPU on the high-performance (discrete) GPU.
#   tools/linux/launch-webgpu.sh [URL]
# Env: BROWSER_BIN=/path/to/chrome   override the browser
#      VRL_USER_DATA_DIR=/path       use a separate profile (default: the normal profile)
#      VRL_GPU_MODE=nvidia|dri|none  override GPU auto-detection
set -eu

URL="${1:-https://naomitsu-ozawa.github.io/virtual-rodent-la/}"

BIN="${BROWSER_BIN:-}"
if [ -z "$BIN" ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then BIN="$c"; break; fi
  done
fi
if [ -z "$BIN" ] || ! command -v "$BIN" >/dev/null 2>&1; then
  echo "Chrome/Chromium not found. Set BROWSER_BIN=/path/to/chrome" >&2
  exit 1
fi

# Which GPU path? NVIDIA present -> PRIME render offload; otherwise Mesa DRI_PRIME for AMD/other hybrids.
MODE="${VRL_GPU_MODE:-}"
if [ -z "$MODE" ]; then
  if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
    MODE=nvidia
  elif command -v lspci >/dev/null 2>&1 && lspci 2>/dev/null | grep -Eiq '(vga|3d|display).*nvidia'; then
    MODE=nvidia
  elif command -v lspci >/dev/null 2>&1 && [ "$(lspci 2>/dev/null | grep -Eic '(vga|3d|display)')" -ge 2 ]; then
    MODE=dri
  else
    MODE=none
  fi
fi

case "$MODE" in
  nvidia)
    echo "[launch-webgpu] GPU path: NVIDIA PRIME render offload"
    export __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only ;;
  dri)
    echo "[launch-webgpu] GPU path: Mesa DRI_PRIME=1 (hybrid AMD/Intel)"
    export DRI_PRIME=1 ;;
  *)
    echo "[launch-webgpu] GPU path: single GPU / no offload variables" ;;
esac

ARGS=(--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-high-performance)
if [ -n "${VRL_USER_DATA_DIR:-}" ]; then ARGS+=("--user-data-dir=$VRL_USER_DATA_DIR"); fi

echo "[launch-webgpu] $BIN ${ARGS[*]} $URL"
echo "[launch-webgpu] Verify at chrome://gpu and the in-app GPU status bar."
exec "$BIN" "${ARGS[@]}" "$URL"
