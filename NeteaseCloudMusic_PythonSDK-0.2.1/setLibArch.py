import os
import re
import shutil
import requests
from urllib.parse import unquote

ARCH_TO_PATTERN = {
    "win64": r"windows-x64.*\.zip$",
    "win32": r"windows-x86.*\.zip$",
    "winarm": r"windows-arm64.*\.zip$",
    "linux64": r"linux-x64.*\.zip$",
    "linuxarm": r"linux-arm64.*\.zip$",
    "macos64": r"macos-x64.*\.zip$",
    "macosarm": r"macos-arm64.*\.zip$"
}

# 架构到环境变量名称的映射
ARCH_TO_ENV = {
    "win64": "win64",
    "win32": "win32", 
    "winarm": "winarm",
    "linux64": "linux64",
    "linuxarm": "linuxarm",
    "macos64": "macos64",
    "macosarm": "macosarm"
}

REPO = "2061360308/MusicLibrary"
GITHUB_API = f"https://api.github.com/repos/{REPO}/releases/latest"

base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),"src", "python/MusicLibrary")

def download_file(url, filename):
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    with open(filename, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

def find_matching_asset(assets, pattern):
    """根据正则模式模糊匹配资产文件"""
    regex = re.compile(pattern, re.IGNORECASE)
    for asset in assets:
        if regex.search(asset["name"]):
            return asset
    return None

def get_local_latest_version(pattern):
    """获取本地匹配该模式的最新的文件名"""
    regex = re.compile(pattern, re.IGNORECASE)
    matching_files = []
    for file in os.listdir("."):
        if regex.search(file):
            matching_files.append(file)
    return matching_files[0] if matching_files else None

def main(arch):
    pattern = ARCH_TO_PATTERN.get(arch)
    if not pattern:
        print(f"未知架构: {arch}")
        return

    # 获取最新 release
    resp = requests.get(GITHUB_API)
    resp.raise_for_status()
    assets = resp.json().get("assets", [])

    # 查找匹配的资产
    remote_asset = find_matching_asset(assets, pattern)
    if not remote_asset:
        print(f"未找到匹配架构 {arch} 的 release 资源")
        return

    remote_filename = remote_asset["name"]

    # 检查本地是否已有匹配的文件
    local_filename = get_local_latest_version(pattern)

    # 如果本地文件不是最新的或者不存在，则下载
    if local_filename and local_filename == remote_filename:
        print(f"{remote_filename} 已是最新版本，跳过下载")
        filename = remote_filename
    else:
        if local_filename:
            print(f"检测到新版本: {remote_filename} (当前: {local_filename})")
        print(f"正在下载 {remote_filename} ...")
        download_file(remote_asset["browser_download_url"], remote_filename)
        print("下载完成")

        # 删除旧版本的文件
        if local_filename and local_filename != remote_filename:
            print(f"删除旧版本: {local_filename}")
            os.remove(local_filename)

        filename = remote_filename

    # 删除 MusicLibrary/include 和 lib 目录
    for subdir in ["include", "lib"]:
        target = os.path.join(base_dir, subdir)
        if os.path.exists(target):
            print(f"删除目录: {target}")
            shutil.rmtree(target)

    # 解压 zip 到 MusicLibrary/，但只保留 lib 目录下的动态库文件
    import zipfile
    with zipfile.ZipFile(filename, "r") as zip_ref:
        for member in zip_ref.infolist():
            # 统一使用 / 判断路径前缀
            name = member.filename.replace("\\", "/")

            # 跳过目录条目
            if name.endswith("/"):
                continue

            # lib/ 下只保留动态库文件（.dll/.so/.dylib），其它（.lib/.exp 等）跳过
            if name.startswith("lib/"):
                # 从文件名中提取后缀
                suffix = os.path.splitext(name)[1].lower()
                # 检测是否为动态库文件
                dynamic_lib_suffixes = {".dll", ".so", ".dylib"}
                if suffix not in dynamic_lib_suffixes:
                    continue

            zip_ref.extract(member, base_dir)

    print(f"已解压 {filename} 到 {base_dir}")
    print(f"已为 {arch} 架构更换配置")
    print(f"\n构建 wheel 时请设置环境变量: set MUSICLIB_ARCH={arch}")
    print(f"或 PowerShell: $env:MUSICLIB_ARCH='{arch}'")

if __name__ == "__main__":
    import sys

    # 处理命令行参数
    if len(sys.argv) == 1:
        print("用法: python setLibArch.py <arch>")
        print("\n支持的架构:")
        for arch in ARCH_TO_PATTERN.keys():
            print(f"  - {arch}")
    else:
        main(sys.argv[1])