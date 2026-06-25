# MusicLibrary Dart 绑定

[![Dart Version](https://img.shields.io/badge/dart-3.0+-blue.svg)](https://dart.dev/get-dart)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](https://github.com/2061360308/MusicLibrary)

这是 MusicLibrary 的 Dart 语言绑定，提供了对网易云音乐、酷狗音乐等音乐平台 API 的 Dart FFI 接口访问。

## 📦 安装

### 添加依赖

在 `pubspec.yaml` 中添加：

```yaml
dependencies:
  musiclibrary:
    git:
      url: https://github.com/2061360308/MusicLibrary.git
      path: src/dart
```

或发布到 pub.dev 后：

```yaml
dependencies:
  musiclibrary: ^0.0.1
```

## 🚀 快速开始

```dart
import 'package:musiclibrary/music_library.dart';

final ncm = NeteaseCloudMusicApi();
final response = await ncm.playlistMyLike();

if (response.status == 200) {
  final songs = response.body['playlist']['tracks'];
}
print(response);
```

## 📚 API 文档

### 网易云音乐 API

- `playlistMyLike()` 获取用户歌单
- `songDetail()` 获取歌曲详情
- `searchDefault()` 搜索歌曲
- 更多方法请查看 `netease_cloud_music_api.dart` 源码

### 酷狗音乐 API

- `topSong()` 获取新歌速递
- `albumDetail()` 获取专辑详情
- `searchDefault()` 搜索歌曲
- 更多方法请查看 `kugou_music_api.dart` 源码

## 🔧 平台资源配置

> 上游仓库已完成预编译，只需下载对应平台的预编译库。

### 自动下载资源

可使用脚本自动下载并配置动态库：

- PowerShell: `fetch_multi_release.ps1 win64:./libs linux64:./libs_linux macos64:./libs_macos`
- Bash: `./fetch_multi_release.sh win64:/home/user/libs linux64:/home/user/libs_linux macos64:/home/user/libs_macos`

lib 目录只保留 `.dll`、`.so`、`.dylib` 文件。

### 支持的架构

| 架构参数 | 平台 | 说明 |
|---------|------|------|
| `win64` | Windows | 64 位 Windows |
| `win32` | Windows | 32 位 Windows |
| `winarm` | Windows | ARM64 Windows |
| `linux64` | Linux | x86_64 Linux |
| `linuxarm` | Linux | ARM64 Linux |
| `macos64` | macOS | Intel 芯片 macOS |
| `macosarm` | macOS | Apple Silicon (M1/M2/M3) |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

贡献流程：
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 🔗 相关链接

- [主仓库](https://github.com/2061360308/MusicLibrary) - C 语言核心库
- [总 README](../../README.md) - 项目总览
- [Python 绑定](../python/) - Python 语言绑定
- [API 特性列表](../../README.md#-特性) - 完整 API 接口列表

## ⚖️ 许可证

本项目采用 MIT 许可证开源。详见 [LICENSE](../../LICENSE) 文件。
