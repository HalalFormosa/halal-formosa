import json
import os

filepath = r'c:\Users\User\halal-project\src\locales\zh.json'
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['merchant'] = {
    "register": {
      "title": "成為合作夥伴",
      "subtitle": "以商家身份加入 Halal Formosa 社群",
      "steps": {
        "storeInfo": "商店資訊",
        "address": "地點",
        "description": "關於您的商店",
        "contact": "電話驗證",
        "business": "統一編號 (UBN)",
        "review": "最終確認"
      },
      "placeholders": {
        "storeNameEn": "商店名稱 (英文)",
        "storeNameZh": "商店名稱 (中文)",
        "address": "商店地址 / 城市",
        "description": "描述您的產品和服務...",
        "phone": "聯繫電話號碼",
        "ubn": "統一編號 (8位數字)"
      },
      "hints": {
        "address": "📍 目前僅提供城市名稱即可。",
        "description": "💡 請提及您所販售的內容（例如：炸雞、印尼雜貨），以協助我們進行清真驗證。",
        "phone": "📞 我們的團隊將撥打電話給您，以驗證您的身份。無需上傳敏感證件！",
        "ubn": "您是否有統一編號 (UBN)？"
      },
      "success": "申請已成功提交！我們的團隊將很快與您聯繫。"
    }
}

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated zh.json successfully")
