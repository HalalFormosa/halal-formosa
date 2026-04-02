import json
import os

def update_locale(file_path, admin_keys, merchant_keys):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Add admin section
    data['admin'] = admin_keys
    
    # Update merchant section
    if 'merchant' not in data:
        data['merchant'] = {}
    
    # Merge merchant register keys
    if 'register' not in data['merchant']:
        data['merchant']['register'] = merchant_keys['register']
    else:
        # Deep merge hints
        for key, val in merchant_keys['register']['hints'].items():
            data['merchant']['register']['hints'][key] = val
        # Ensure other register keys are present
        for key, val in merchant_keys['register'].items():
            if key != 'hints':
                data['merchant']['register'][key] = val

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully updated {file_path}")

# English Keys
en_admin = {
    "merchant": {
      "title": "Merchant Applications",
      "approve": "Approve",
      "reject": "Reject",
      "noPending": "No pending applications at this time.",
      "confirmApprove": "Are you sure you want to approve this application? This will create the merchant's store automatically.",
      "rejectionReasonTitle": "Reason for Rejection",
      "rejectionReasonPlaceholder": "Explain why the application is being rejected...",
      "status": {
        "pending": "Pending Verification",
        "approved": "Approved",
        "rejected": "Rejected"
      }
    }
}

en_merchant = {
    "register": {
      "title": "Become a Partner",
      "subtitle": "Join the Halal Formosa community as a merchant",
      "steps": {
        "storeInfo": "Store Information",
        "address": "Location",
        "description": "About Your Store",
        "contact": "Phone Verification",
        "business": "Business UBN",
        "review": "Final Review"
      },
      "placeholders": {
        "storeNameEn": "Store Name (English)",
        "storeNameZh": "商店名稱 (中文)",
        "address": "Store Address / City",
        "description": "Describe your products and services...",
        "phone": "Contact Phone Number",
        "ubn": "Unified Business Number (8-digits)"
      },
      "hints": {
        "address": "📍 Providing just the city is OK for now.",
        "description": "💡 Please mention what you sell (e.g. Fried Chicken, Indonesian Grocery) to help us with Halal verification.",
        "phone": "📞 Our team will give you a quick call to verify your identity. No sensitive ID documents required!",
        "phone_warning": "Must be a valid number for our team to verify your identity.",
        "contact_note": "After submission, our team will reach you via Call, WhatsApp, or LINE for final identity verification. Halal business should be Easy and Trusted!",
        "human_verify": "Human Verification",
        "ubn": "Do you have a Unified Business Number (UBN)?",
        "review": "Please review your information before submitting.",
        "review_note": "By submitting, you agree that Halal Formosa will contact you via phone for identity verification."
      },
      "success": "Application submitted successfully! Our team will contact you soon."
    }
}

# Chinese Keys
zh_admin = {
    "merchant": {
      "title": "申請管理",
      "approve": "核准",
      "reject": "駁回",
      "noPending": "目前沒有待處理的申請。",
      "confirmApprove": "您確定要核准此申請嗎？這將自動為該商家同步創建商店資訊。",
      "rejectionReasonTitle": "駁回原因",
      "rejectionReasonPlaceholder": "請說明駁回原因...",
      "status": {
        "pending": "等待驗證中",
        "approved": "已核准",
        "rejected": "已駁回"
      }
    }
}

zh_merchant = {
    "register": {
      "title": "成為合作夥伴",
      "subtitle": "加入 Halal Formosa 社群，開啟您的清真商機",
      "steps": {
        "storeInfo": "商店資訊",
        "address": "商店位置",
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
        "phone_warning": "必須提供有效的電話號碼，以便我們的團隊進行身分驗證。",
        "contact_note": "提交後，我們的團隊將透過電話、WhatsApp 或 LINE 與您聯繫進行最終身分驗證。經營清真商機應該是簡單且值得信賴的！",
        "human_verify": "人工驗證",
        "ubn": "您是否有統一編號 (UBN)？",
        "review": "請在提交前檢查您的資訊。",
        "review_note": "提交即代表您同意 Halal Formosa 透過電話與您聯繫以進行身分驗證。"
      },
      "success": "申請已成功提交！我們的團隊將很快與您聯繫。"
    }
}

update_locale('c:/Users/User/halal-project/src/locales/en.json', en_admin, en_merchant)
update_locale('c:/Users/User/halal-project/src/locales/zh.json', zh_admin, zh_merchant)
