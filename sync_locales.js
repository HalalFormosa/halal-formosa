// sync_locales.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const localesDir = path.join(process.cwd(), 'src', 'locales');
const enPath = path.join(localesDir, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
function setMissingKeys(targetObj, sourceObj) {
    let changed = false;
    for (const k in sourceObj) {
        const srcVal = sourceObj[k];
        if (!(k in targetObj)) {
            // add missing key with empty string or same structure
            targetObj[k] = typeof srcVal === 'object' && srcVal !== null ? {} : srcVal;
            changed = true;
        }
        if (typeof srcVal === 'object' && srcVal !== null) {
            if (typeof targetObj[k] !== 'object' || targetObj[k] === null) {
                targetObj[k] = {};
                changed = true;
            }
            const childChanged = setMissingKeys(targetObj[k], srcVal);
            if (childChanged) changed = true;
        }
    }
    return changed;
}
const locales = ['id.json', 'ms.json', 'zh.json'];
locales.forEach(file => {
    const filePath = path.join(localesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const changed = setMissingKeys(data, enData);
    if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`${file} updated`);
    } else {
        console.log(`${file} already in sync`);
    }
});
