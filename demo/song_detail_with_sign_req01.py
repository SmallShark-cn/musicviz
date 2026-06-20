import time
import requests

from urllib.parse import quote

from sign_utils import RSASignature

# 1.RSA Secret
# private_key(Excluding the head and tail)
# private_key = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmaf3ff8S9KeUXEpuU2wMrjgvFMi4D/xkryJbtalnKD7kzpiaJmoOE/TBWZ1vv9dCmzFFcL5nRuLHXUOYyjRFWRxTag+uSbwpzHAvHrFfVa87tLmBSkuB5a05s+5Sy8aB0hPA0THGNdPRcafjHLPGDPv2ZISPSbU9E8oVjPoudtGLYt/09MYsrbF7cI66XOL/ywYlNOUfzWr2YuhHUmpqqOG0piSbQ8RZW/vrtRBEg75kHecu8yVce7udJzpzE+WPjSgRfdlc3xLG7gBlUHpphMeHIrGaief+tLvbjtjAnlaqeHNrNaCpm9o01n37oiVAiM51EC+DeXXYBG/0Cr2nDAgMBAAECggEAJatqd1QhwbwhCncA1tI4xnwx9+Ji/i6ZkQqn93gSeSXUA3gB0zYxvUHe1kAxVIEtSQSJCjgQNqP7RcUfRqQeH4yZkNk50vzlvabEl99QRpRP0+qijS6IN5Ptvce5IkSF0Lpi8UO4lI+73Mt0MAnhZZc1qpsQ08pAnlfTj+KRkhHstlxrIKb5XwriD3v3nqP9m+2kK0CJ4MgXyff3NRADkoEvRlCsYiRQKuEso7B9Qf9KYNW7/0+5wHubCL0Pq3wrd64bbg5Ry2678esriiyCFfNn00dGVhk1tpJwkG4huAGMjLqXy0YXmgU4hwx+L0oMnegmddYD3DuiO3onHGLzYQKBgQDRImXOeWs2CHdii89bBuPyQleWFx4X0u3iTV+5V4yn7Ad1ornbfeFNHDQrprwD1j2FgklHVHrMfKqQwlt+J9+gpxV+7KJVlwjK4Q0eY2jcen9ZN+DVnofhPiNh+8eFaXWLzB2FKVlJAU4bVJotdS2Tjk/88xF+/UHGdmvwxUqHEQKBgQDLtNFEreRKF5Sfo94ZtaWB/H5PnybIOEYxNp1mver1VveXx2s/DuvIn1KXjoGMERnrWFIZ6rgHg/VYnHdozqEoaZ1EKhisKSeXzq2gi3uH++WrFYNazmyKJwxsxQcVEyTAt0O/WzzamJoqDYZgGuowyJycBQqS/Kzs8DxH+PQrkwKBgQCDJoonyNcmJHsR7tGTqSeMBnS86DR0BlAuSg2Mws2vhQJMkEbz0eZXoCdLdJ2V3mXocwMXW3BDCq9AZtJPtBu2uPFvDmDjQfs+l5HNi9P36E4ymitCa8+Uvo4b5XSDQtZ3XALrPjoC4XGlDBJADasOTQH2hExlkdcM6bjZXjBVsQKBgB+vhoWaTtI/jLywLpHtMUtgzPzxkoS+TBzHlAAxNmTnHCgdus7aMU7JiX1Ni1UQK+nxmQOzAOEaY4VfASvqSCMTGoVJzwCofiIc4eEBETv7sKPF+uKbDUMIA+S/WPSsP6FCYGVZecO+zOwRon88cIUaD1ItbpGif/ty+s1vKfvFAoGAESlnVoObyCI3cKs+dihvDlsx9aFyqe44CzZBW8Tzhhi604CdQxnW6hVDYcFIGbQH3r2A8YooccAAQu0CjX3CPQc12DCNqnSpL8srvNd+IJE0ZUObxSC9qEigi0CK5MUDjGoYnuM5BF5BDrVQy+lQDg5VBqIATR68tVh8nfYZ8FI="
private_key = ""
# public_key（Excluding the head and tail）
public_key = ""
# 2.check rsa secret
# new RSASignature class
rsa_signature = RSASignature()
# sign content
content = "Hello, World!"
# sign
# signature = rsa_signature.rsa_sign(content, private_key)
# print(f"sign result: {signature}")
# check sign
# is_valid = rsa_signature.rsa_sign_check(content, signature, public_key)
# print(f"check sign result: {is_valid}")

# 3.params
params = {
    'appId': '',
    # If prompted with '非法timestamp参数'(Illegal timestamp parameter)，Less than 5 minutes
    'timestamp': int(time.time() * 1000),
    # device
    # 'device': '{"deviceType":"openapi","os":"openapi","appVer":"0.1","channel":"openapi","model":"one","deviceId":"one","brand":"openapi","osVer":"8.1.0","clientIp":"192.168.0.1"}',
    'device': '',
    # accessToken(Important:anonymous Access credentials)
    # 'accessToken': '',
    'signType': 'RSA_SHA256'
}


# 4.getAnonymous
# a. Dictionary order sorting and concatenation parameters
params['bizContent']='{"clientId":""}'
content = rsa_signature.format_parameters(params)
# b. sign
sign = rsa_signature.rsa_sign(content, private_key)
# c. Signature field with separate URL encoding
params['sign'] = quote(sign)
url = 'https://openapi.music.163.com/openapi/music/basic/oauth2/login/anonymous?' + "&".join(
    [f"{k}={v}" for k, v in params.items()])
song_detail_res = requests.get(url)
print(song_detail_res.text)

