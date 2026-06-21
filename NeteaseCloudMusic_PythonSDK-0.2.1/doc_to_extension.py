
import json
import argparse
import sys

platform = "kugou"  # 默认平台

def parse_args():
    parser = argparse.ArgumentParser(description="生成音乐平台 API 扩展代码")
    parser.add_argument('--platform', choices=['kugou', 'ncm'], default='kugou', help='选择平台 kugou 或 ncm，默认 kugou')
    parser.add_argument('--lang', choices=['python', 'dart', 'both'], default='both', help='选择生成语言 python/dart/both，默认 both')
    return parser.parse_args()

def path_to_func_name(path):
    # 去掉斜杠，分割单词
    parts = path.strip("/").split("/")
    func_name = "_".join(parts)
    return func_name


python_all_code = ""
dart_all_code = ""

def gender_python_code(api):
    global python_all_code
    doc_lines = api["doc"].split("\n")
    cleaned_lines = []
    
    envType = "KugouProcessEnv" if platform == "kugou" else "NcmProcessEnv"
    
    for line in doc_lines:
        if not line.strip():
            continue
        # 去除 markdown 语法
        line = line.replace("**", "").replace("`", "").strip()
        # 去除行首冒号
        if line.startswith(":"):
            line = line[1:]
        # 加8个空格
        cleaned_lines.append("        " + line)
    docstring = "\n".join(cleaned_lines)

    code = f"""    def {path_to_func_name(api["path"])}(self, {', '.join(api["required"]) if api["required"] else ''}{', ' if api["required"] else ''}{', '.join([f'{p}=None' for p in api["optional"]]) if api["optional"] else ''}{', ' if api["optional"] else ''}cookie = {{}}, env: {envType} = None) -> Response:
        \'\'\'
{docstring}
        \'\'\'
        return self.request("{api['path']}", cookie, env{', ' if api["required"]+api["optional"] else ''}{', '.join([f'{p}={p}' for p in api["required"]+api["optional"]]) if api["required"]+api["optional"] else ''})
"""
    python_all_code += code

def gender_dart_code(api):
    global dart_all_code
    
    envType = "KugouProcessEnv" if platform == "kugou" else "NcmProcessEnv"
    
    doc_lines = api["doc"].split("\n")
    cleaned_lines = []
    for line in doc_lines:
        # 去除 markdown 语法
        line = line.replace("**", "").replace("`", "").strip()
        # 去除行首冒号
        if line.startswith(":"):
            line = line[1:]
        # 加2个空格
        cleaned_lines.append("  ///" + line)
    docstring = "\n".join(cleaned_lines)


# {', '.join([f'{p}={p}' for p in api["required"]+api["optional"]]) if api["required"]+api["optional"] else ''}

    code = f"""{docstring}
  MusicResponse {path_to_func_name(api["path"])}({', '.join([f'String {p}' for p in api["required"]]) if api["required"] else ''}{', ' if api["required"] else ''}{{{', '.join([f'String? {p}' for p in api["optional"]]) if api["optional"] else ''}{', ' if api["optional"] else ''}Map<String, String> cookie = const {{}}, {envType}? env}}){{
    return request("{api['path']}", cookie:cookie, env:env{', query: {' if api["required"]+api["optional"] else ''}{', '.join([f"'{p}':{p}" for p in api["required"]+api["optional"]]) if api["required"]+api["optional"] else ''}{'}' if api["required"]+api["optional"] else ''});
    }}
"""
    dart_all_code += code


def main():
    global platform
    
    args = parse_args()
    
    platform = args.platform
    
    if args.platform == 'kugou':
        json_file = 'kugou_fun.json'
        py_out = 'kuGouMusicApiExtension.py'
        dart_out = 'kuGouMusicApiExtension.dart'
    else:
        json_file = 'ncm_funs.json'
        py_out = 'ncmMusicApiExtension.py'
        dart_out = 'ncmMusicApiExtension.dart'

    try:
        with open(json_file, "r", encoding="utf-8") as f:
            apis = json.load(f)
    except Exception as e:
        print(f"读取 {json_file} 失败: {e}")
        sys.exit(1)

    global python_all_code, dart_all_code
    python_all_code = ""
    dart_all_code = ""

    for api in apis:
        if args.lang in ('python', 'both'):
            gender_python_code(api)
        if args.lang in ('dart', 'both'):
            gender_dart_code(api)

    if args.lang in ('python', 'both'):
        with open(py_out, "w", encoding="utf-8") as f:
            f.write("class Extension:\n")
            f.write(python_all_code)
        print(f"已生成 {py_out}")
    if args.lang in ('dart', 'both'):
        with open(dart_out, "w", encoding="utf-8") as f:
            f.write("class Extension {\n")
            f.write(dart_all_code)
            f.write("}\n")
        print(f"已生成 {dart_out}")

if __name__ == "__main__":
    main()
