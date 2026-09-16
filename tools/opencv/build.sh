#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
#
# Builds the OpenCV.js this extension embeds.
#
# In a container, so that the result depends on the pinned OpenCV tag and the
# pinned Emscripten image rather than on what happens to be installed here.
# Nothing is installed on the host.
#
#   ./tools/opencv/build.sh
#
# Output: vendor/opencv.js
set -euo pipefail

OPENCV_TAG="${OPENCV_TAG:-4.12.0}"
EMSDK_IMAGE="${EMSDK_IMAGE:-emscripten/emsdk:4.0.7}"
VOLUME="${VOLUME:-turbowarp-opencv-build}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mkdir -p "${ROOT}/vendor"

# The source and every object file live in a Docker volume, not on the host.
# A bind mount would put OpenCV's configure and compile -- hundreds of
# thousands of small file operations -- through macOS's filesystem bridge,
# where they run several times slower. Measured: eleven minutes without
# reaching the first compiled object. Only the finished file crosses back, and
# that is one write.
docker volume create "${VOLUME}" >/dev/null

# SINGLE_FILE is the default and is kept: a TurboWarp extension ships as one
# standalone file, so a separate .wasm has nowhere to be fetched from.
#
# ENVIRONMENT=web,worker is the reason for building this at all. The stock
# build takes Emscripten's worker branch, which replaces setImmediate with one
# that posts a message to the page and waits for the page to post it back --
# its own worker harness protocol, which a plain Web Worker does not
# implement, so its deferred work never runs and initialization never
# finishes.
docker run --rm \
  -v "${VOLUME}:/work" \
  -v "${ROOT}/tools/opencv:/config:ro" \
  -v "${ROOT}/vendor:/out" \
  -e "OPENCV_TAG=${OPENCV_TAG}" \
  "${EMSDK_IMAGE}" \
  bash -lc '
    set -euo pipefail
    if [ ! -d /work/opencv ]; then
      git clone --depth 1 --branch "${OPENCV_TAG}" \
        https://github.com/opencv/opencv.git /work/opencv
    fi
    cd /work/opencv
    # OpenCV 4.12.0 passes -s DEMANGLE_SUPPORT=1 unconditionally, and
    # Emscripten removed that setting: it is an error, not a warning, so the
    # link fails outright. It only ever added C++ name demangling to stack
    # traces, which a production build does not need. Dropped here rather than
    # pinning the toolchain back to before its removal.
    sed -i "s/ -s DEMANGLE_SUPPORT=1//" modules/js/CMakeLists.txt
    python3 ./platforms/js/build_js.py /work/build \
      --build_wasm \
      --config /config/opencv_js.config.py \
      --emscripten_dir "${EMSDK}/upstream/emscripten" \
      --build_flags="-s ENVIRONMENT=web,worker"
    cp /work/build/bin/opencv.js /out/opencv.js
  '

echo "Built $(wc -c < "${ROOT}/vendor/opencv.js") bytes into vendor/opencv.js"
