import os
import sys

from setuptools import setup
from wheel.bdist_wheel import bdist_wheel as _bdist_wheel


class bdist_wheel(_bdist_wheel):
    """Mark wheels as platform-specific and control platform tag by env var.

    使用环境变量 MUSICLIB_ARCH 来区分目标架构：
    Windows 平台：
    - "win64"  -> win_amd64
    - "win32"  -> win32
    - "winarm" -> win_arm64

    Linux 平台：
    - "linux64"  -> manylinux2014_x86_64
    - "linuxarm" -> manylinux2014_aarch64

    macOS 平台：
    - "macos64"  -> macosx_11_0_x86_64
    - "macosarm" -> macosx_11_0_arm64
    """

    def finalize_options(self):
        super().finalize_options()
        # 包含 DLL/so/dylib，必须标记为非纯 Python
        self.root_is_pure = False

    def get_tag(self):
        python, abi, plat = super().get_tag()

        arch = os.environ.get("MUSICLIB_ARCH")
        py_ver = os.environ.get("PYTHON_VERSION", "cp311")

        # ctypes 调用动态库，接口稳定，使用 abi3
        # 这样 wheel 可以跨 Python 3.x 版本使用
        abi = "abi3"

        # 根据环境变量设置 Python 版本标签
        python = py_ver

        if arch == "win64":
            plat = "win_amd64"
        elif arch == "win32":
            plat = "win32"
        elif arch == "winarm":
            plat = "win_arm64"
        elif arch == "linux64":
            plat = "manylinux2014_x86_64"
        elif arch == "linuxarm":
            plat = "manylinux2014_aarch64"
        elif arch == "macos64":
            plat = "macosx_11_0_x86_64"
        elif arch == "macosarm":
            plat = "macosx_11_0_arm64"
        else:
            # 默认情况
            if not arch:
                print("Warning: MUSICLIB_ARCH not set, using default win_amd64")
                plat = "win_amd64"

        return python, abi, plat


setup(
    name="pymusiclibrary",
    version="0.0.4",
    description="Python bindings for MusicLibrary - access NetEase Cloud Music and KuGou Music APIs",
    long_description=open("README.md", "r", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="LuTong",
    author_email="2061360308@qq.com",
    url="https://github.com/2061360308/MusicLibrary",
    license="MIT",
    packages=["MusicLibrary"],
    python_requires=">=3.7",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Multimedia :: Sound/Audio",
    ],
    keywords=["music", "netease", "kugou", "api", "music-library"],
    include_package_data=True,
    cmdclass={"bdist_wheel": bdist_wheel},
)
