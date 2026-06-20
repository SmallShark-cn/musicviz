from typing import Optional

from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import base64


class RSASignature:

    @staticmethod
    def _format_key(key_string: str, key_type: str) -> str:
        """
        格式化密钥字符串为PEM格式
        :param key_string: 原始密钥字符串
        :param key_type: 'PRIVATE' 或 'PUBLIC'
        :return: PEM格式的密钥字符串
        """
        # 移除所有空白字符
        key_string = ''.join(key_string.split())

        # 添加头尾和换行
        formatted_key = f"-----BEGIN {key_type} KEY-----\n"
        for i in range(0, len(key_string), 64):
            formatted_key += key_string[i:i + 64] + '\n'
        formatted_key += f"-----END {key_type} KEY-----"

        return formatted_key

    @staticmethod
    def rsa_sign(content: str, private_key: str) -> Optional[str]:
        """
        使用RSA私钥对内容进行签名
        :param content: 要签名的内容
        :param private_key: 原始X509格式的RSA私钥 (无头尾和换行)
        :return: Base64编码的签名
        """
        try:
            # 格式化私钥
            formatted_private_key = RSASignature._format_key(private_key, "PRIVATE")

            # 将私钥字符串转换为RSA key对象
            key = RSA.import_key(formatted_private_key)

            # 创建SHA256哈希对象
            hash_obj = SHA256.new(content.encode('utf-8'))

            # 使用私钥进行签名
            signature = pkcs1_15.new(key).sign(hash_obj)

            # 将签名转换为Base64编码
            return base64.b64encode(signature).decode('utf-8')
        except Exception as e:
            print(f"签名过程中出现错误: {str(e)}")
            return None

    @staticmethod
    def rsa_sign_check(content: str, sign: str, public_key: str) -> bool:
        """
        使用RSA公钥验证签名
        :param content: 原始内容
        :param sign: Base64编码的签名
        :param public_key: 原始X509格式的RSA公钥 (无头尾和换行)
        :return: 验证结果 (True/False)
        """
        try:
            # 格式化公钥
            formatted_public_key = RSASignature._format_key(public_key, "PUBLIC")

            # 将公钥字符串转换为RSA key对象
            key = RSA.import_key(formatted_public_key)

            # 创建SHA256哈希对象
            hash_obj = SHA256.new(content.encode('utf-8'))

            # 将Base64编码的签名解码
            signature = base64.b64decode(sign)

            # 验证签名
            pkcs1_15.new(key).verify(hash_obj, signature)
            return True
        except (ValueError, TypeError):
            return False
        except Exception as e:
            print(f"验证过程中出现错误: {str(e)}")
            return False


    @staticmethod
    def format_parameters(params: dict) -> str:
        """
        格式化参数为待签名字符串

        :param params: 包含所有参数的字典
        :return: 格式化后的待签名字符串
        """
        # 步骤1：过滤和排序参数
        filtered_params = {}
        for key, value in params.items():
            # 剔除 sign 字段、值为空的参数、字节类型参数
            if key != 'sign' and value != '' and not isinstance(value, bytes):
                filtered_params[key] = value

        # 按照键的ASCII码值排序
        sorted_params = sorted(filtered_params.items(), key=lambda x: x[0])

        # 步骤2：组合参数
        param_pairs = []
        for key, value in sorted_params:
            # 将布尔类型转换为小写字符串
            if isinstance(value, bool):
                value = str(value).lower()
            # 将其他类型转换为字符串
            else:
                value = str(value)
            param_pairs.append(f"{key}={value}")

        # 用&连接所有参数对
        return "&".join(param_pairs)
