#!/bin/bash
set -euo pipefail
MAC_ROOT="$(cd "$(dirname "$0")" && pwd)"
export CLANG_MODULE_CACHE_PATH="${TMPDIR:-/tmp}/bsk-mac-clang"
export SWIFTPM_MODULECACHE_OVERRIDE="${TMPDIR:-/tmp}/bsk-mac-swift"
swift build --package-path "$MAC_ROOT" -c release --disable-sandbox
BSK_BIN_DIR="$(swift build --package-path "$MAC_ROOT" -c release --disable-sandbox --show-bin-path)"
BSK_APP="$MAC_ROOT/dist/BSK.app"
mkdir -p "$BSK_APP/Contents/MacOS" "$BSK_APP/Contents/Resources"
cp "$BSK_BIN_DIR/BSKMac" "$BSK_APP/Contents/MacOS/BSKMac"
cp "$MAC_ROOT/Resources/Info.plist" "$BSK_APP/Contents/Info.plist"
BSK_ICON="$MAC_ROOT/../ios/BSK/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
if [[ -f "$BSK_ICON" ]]; then
  BSK_ICONSET="$MAC_ROOT/.build/AppIcon.iconset"
  mkdir -p "$BSK_ICONSET"
  for BSK_SIZE in 16 32 128 256 512; do
    sips -z "$BSK_SIZE" "$BSK_SIZE" "$BSK_ICON" --out "$BSK_ICONSET/icon_${BSK_SIZE}x${BSK_SIZE}.png" >/dev/null
    BSK_DOUBLE=$((BSK_SIZE * 2))
    sips -z "$BSK_DOUBLE" "$BSK_DOUBLE" "$BSK_ICON" --out "$BSK_ICONSET/icon_${BSK_SIZE}x${BSK_SIZE}@2x.png" >/dev/null
  done
  iconutil -c icns "$BSK_ICONSET" -o "$BSK_APP/Contents/Resources/AppIcon.icns"
fi
# Lokal signatur för användning på byggdatorn. Distribution kräver Developer ID.
codesign --force --sign - --entitlements "$MAC_ROOT/Resources/BSK.entitlements" "$BSK_APP"
codesign --verify --deep --strict "$BSK_APP"
ditto -c -k --sequesterRsrc --keepParent "$BSK_APP" "$MAC_ROOT/dist/BSK-Mac.zip"
printf 'Byggd: %s\n' "$BSK_APP"
