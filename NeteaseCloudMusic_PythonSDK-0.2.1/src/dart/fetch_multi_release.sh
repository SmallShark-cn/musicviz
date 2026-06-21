#!/bin/bash
# 用法: ./fetch_multi_custom.sh win64:/home/user/win64 linux64:/home/user/linux64 macos64:/home/user/macos64


for arg in "$@"; do
  ARCH="${arg%%:*}"
  TARGET="${arg#*:}"

  case $ARCH in
    win64) PATTERN="windows-x64" ;;
    win32) PATTERN="windows-x86" ;;
    winarm) PATTERN="windows-arm64" ;;
    linux64) PATTERN="linux-x64" ;;
    linuxarm) PATTERN="linux-arm64" ;;
    macos64) PATTERN="macos-x64" ;;
    macosarm) PATTERN="macos-arm64" ;;
    *) echo "未知架构: $ARCH"; continue ;;
  esac

  mkdir -p "$TARGET"

  # 获取 Release 资源列表并模糊匹配 zip 文件名
  ZIP_URL=""
  ZIP_NAME=""
  RELEASE_JSON=$(curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/2061360308/MusicLibrary/releases/latest")
  ZIP_NAME=$(echo "$RELEASE_JSON" | grep -oP '"name":\s*"'$PATTERN'.*?\.zip"' | head -n1 | sed 's/"name":\s*"//;s/"//')
  if [ -z "$ZIP_NAME" ]; then
    echo "未找到 $ARCH 对应的 zip 文件"
    continue
  fi
  ZIP_URL=$(echo "$RELEASE_JSON" | grep -A 10 "$ZIP_NAME" | grep 'browser_download_url' | head -n1 | sed 's/.*"browser_download_url":\s*"//;s/"//')
  if [ -z "$ZIP_URL" ]; then
    echo "未找到 $ARCH zip 的下载链接"
    continue
  fi

  echo "下载 $ZIP_NAME 到 $TARGET ..."
  curl -L -o "$TARGET/$ZIP_NAME" "$ZIP_URL"

  echo "解压 $ZIP_NAME ..."
  unzip -o "$TARGET/$ZIP_NAME" -d "$TARGET"

  echo "清理 lib 目录 ..."
  find "$TARGET/lib" -type f ! -name '*.dll' ! -name '*.so' ! -name '*.dylib' -delete

  # 删除 zip 文件
  rm -f "$TARGET/$ZIP_NAME"
  echo "已删除 $ZIP_NAME"

  echo "$ARCH 完成"
  echo
done

echo "全部完成"