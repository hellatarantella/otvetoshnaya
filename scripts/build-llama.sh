#!/usr/bin/env bash
# Сервер встроенной модели (llama.cpp) для сборки программы: один файл без внешних библиотек.
# Mac: arm64 + x86_64 → универсальный файл, Metal; Windows: x64, без OpenMP и без VC++ Redistributable.
set -euo pipefail
TAG="${LLAMA_TAG:-b11500}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/bin"
mkdir -p "$OUT"
W="$(mktemp -d)"
git clone -q --depth 1 --branch "$TAG" https://github.com/ggml-org/llama.cpp "$W/src"
COMMON=(-DBUILD_SHARED_LIBS=OFF -DLLAMA_OPENSSL=OFF -DLLAMA_USE_PREBUILT_UI=OFF -DLLAMA_BUILD_UI=OFF
        -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_APP=OFF -DGGML_NATIVE=OFF
        -DCMAKE_BUILD_TYPE=Release)
JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)"
case "$(uname -s)" in
  Darwin)
    for A in arm64 x86_64; do
      EXTRA=()
      if [ "$A" = x86_64 ]; then EXTRA=(-DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON); fi
      cmake -S "$W/src" -B "$W/b-$A" "${COMMON[@]}" ${EXTRA[@]+"${EXTRA[@]}"} -DCMAKE_OSX_ARCHITECTURES="$A" \
        -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DGGML_OPENMP=OFF
      cmake --build "$W/b-$A" --config Release --target llama-server -j "$JOBS"
    done
    cp "$W/b-arm64/bin/llama-server" "$OUT/llama-server-aarch64-apple-darwin"
    cp "$W/b-x86_64/bin/llama-server" "$OUT/llama-server-x86_64-apple-darwin"
    lipo -create "$OUT/llama-server-aarch64-apple-darwin" "$OUT/llama-server-x86_64-apple-darwin" -output "$OUT/llama-server-universal-apple-darwin"
    for f in "$OUT"/llama-server-*; do codesign -s - -f "$f"; done
    ;;
  MINGW*|MSYS*|CYGWIN*)
    # генератор — самая новая Visual Studio на машине (на windows-latest это уже не 2022)
    cmake -S "$W/src" -B "$W/b" -A x64 "${COMMON[@]}" -DGGML_OPENMP=OFF \
      -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON
    cmake --build "$W/b" --config Release --target llama-server -j "$JOBS"
    cp "$W/b/bin/Release/llama-server.exe" "$OUT/llama-server-x86_64-pc-windows-msvc.exe"
    ;;
  *)
    cmake -S "$W/src" -B "$W/b" "${COMMON[@]}"
    cmake --build "$W/b" --target llama-server -j "$JOBS"
    T="$(rustc -vV | sed -n 's/^host: //p')"
    cp "$W/b/bin/llama-server" "$OUT/llama-server-$T"
    ;;
esac
ls -la "$OUT"
"$OUT"/llama-server-* --version 2>&1 | head -3 || true
