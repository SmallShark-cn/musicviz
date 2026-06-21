#!/usr/bin/env python3
"""构建所有架构的 wheel 包脚本"""

import os
import sys
import subprocess

ARCH_LIST = ["win64", "win32", "winarm", "linux64", "linuxarm", "macos64", "macosarm"]
PYTHON_VERSIONS = ["cp37", "cp38", "cp39", "cp310", "cp311", "cp312", "cp313", "cp314"]


def main():
    original_dir = os.getcwd()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, "..", "..")
    python_dir = script_dir

    print(f"开始构建 {len(ARCH_LIST)} 个架构 × {len(PYTHON_VERSIONS)} 个 Python 版本的 wheel 包...")
    print(f"项目根目录: {project_root}")
    print(f"Python 目录: {python_dir}")
    print("-" * 50)

    # 切换到项目根目录
    os.chdir(project_root)

    success_count = 0
    failed_builds = []
    total_builds = len(ARCH_LIST) * len(PYTHON_VERSIONS)

    for arch in ARCH_LIST:
        print(f"\n[{arch}] 开始处理...")

        try:
            # 1. 运行 setLibArch.py 下载并配置库
            print(f"  → 配置库文件...")
            result = subprocess.run(
                [sys.executable, "setLibArch.py", arch],
                capture_output=True,
                text=True,
                check=True
            )
            print(f"  ✓ 配置完成")

            # 2. 切换到 src/python 目录
            os.chdir(python_dir)

            # 3. 为每个 Python 版本构建 wheel
            for py_ver in PYTHON_VERSIONS:
                print(f"  → 构建 {py_ver} wheel 包...")
                env = os.environ.copy()
                env["MUSICLIB_ARCH"] = arch
                env["PYTHON_VERSION"] = py_ver

                try:
                    result = subprocess.run(
                        [sys.executable, "setup.py", "bdist_wheel"],
                        capture_output=True,
                        text=True,
                        env=env,
                        check=True
                    )
                    print(f"  ✓ {py_ver} 构建成功")
                    success_count += 1
                except subprocess.CalledProcessError as e:
                    print(f"  ✗ {py_ver} 构建失败")
                    failed_builds.append(f"{arch}-{py_ver}")

            # 4. 返回项目根目录准备下一次循环
            os.chdir(project_root)

        except subprocess.CalledProcessError as e:
            print(f"  ✗ 构建失败: {arch}")
            print(f"  stderr: {e.stderr}")
            os.chdir(project_root)
            continue
        except Exception as e:
            print(f"  ✗ 错误: {e}")
            os.chdir(project_root)
            continue

    print("-" * 50)
    print(f"构建完成！成功: {success_count}/{total_builds}")

    if failed_builds:
        print(f"\n失败的构建: {', '.join(failed_builds)}")

    print(f"\nwheel 包位置: {os.path.join(python_dir, 'dist')}")

    # 切换回原始目录
    os.chdir(original_dir)


if __name__ == "__main__":
    main()
