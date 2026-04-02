import json
import os

files = [
    (r'c:\Users\User\halal-project\src\locales\en.json', {
        "profile": {
            "merchant": {
                "startSelling": "Start Selling",
                "storeSubtitle": "in Halal Formosa Store",
                "pendingStatus": "Application Under Review",
                "pendingDesc": "We're verifying your store details. Expect a call soon!"
            }
        }
    }),
    (r'c:\Users\User\halal-project\src\locales\zh.json', {
        "profile": {
            "merchant": {
                "startSelling": "開始經營",
                "storeSubtitle": "在 Halal Formosa 商店",
                "pendingStatus": "申請審核中",
                "pendingDesc": "我們正在驗證您的商店詳細資訊。請留意我們的來電！"
            }
        }
    })
]

for filepath, new_data in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Deep merge profile keys
    if "profile" not in data:
        data["profile"] = {}
    if "merchant" not in data["profile"]:
        data["profile"]["merchant"] = new_data["profile"]["merchant"]
    else:
        data["profile"]["merchant"].update(new_data["profile"]["merchant"])
        
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {os.path.basename(filepath)} successfully")
