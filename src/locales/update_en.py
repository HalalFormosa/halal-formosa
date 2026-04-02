import json
import os

filepath = r'c:\Users\User\halal-project\src\locales\en.json'
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['merchant'] = {
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
        "ubn": "Do you have a Unified Business Number (UBN)?"
      },
      "success": "Application submitted successfully! Our team will contact you soon."
    }
}

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated en.json successfully")
