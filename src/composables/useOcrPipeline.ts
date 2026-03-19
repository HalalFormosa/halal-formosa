import { Ref, ref, nextTick } from 'vue'
import type { IngredientHighlight } from '@/types/Ingredient'
import { extractIonColor } from '@/utils/ingredientHelpers'

export interface BlacklistPattern {
    pattern: string
}

export interface OcrPipelineOptions {
    allHighlights: Ref<IngredientHighlight[]>
    blacklistPatterns: Ref<RegExp[]>
    incrementDisclaimerCount?: () => void   // <-- make optional
    incrementUsageCount: () => number
    fetchHighlightsWithCache: (force?: boolean) => Promise<{
        highlights: IngredientHighlight[]
        blacklist: { pattern: string }[]
    } | null>
    setError: (msg: string) => void
}

export default function useOcrPipeline({
    allHighlights,
    blacklistPatterns,
    incrementDisclaimerCount,
    incrementUsageCount,
    fetchHighlightsWithCache,
    setError,
}: OcrPipelineOptions) {
    const ingredientHighlights = ref<IngredientHighlight[]>([])
    const ingredientsTextZh = ref('')
    const autoStatus = ref('')
    const productName = ref('')
    const ingredientsText = ref('')
    const showOk = ref(false)
    const detectedLanguage = ref<'chinese' | 'english' | 'mixed' | 'unknown'>('unknown')
    const ocrRawText = ref('')
    const progress = ref(0)
    const progressLabel = ref('Initializing...')

    function normalizeIngredients(text: string): string {
        return text
            // Existing normalizations
            .replace(/起士[\s,]+粉/g, "起士粉")
            .replace(/奶[\s,]+精/g, "奶精")
            .replace(/味[\s,]+醂/g, "味醂")
            .replace(/牛[\s,]+奶/g, "牛奶")
            .replace(/豬[\s,]+油/g, "豬油")
            .replace(/雞[\s,]+精/g, "雞精")

            // 🔧 New typo corrections for OCR errors
            .replace(/起土/g, "起士")   // soil → scholar
            .replace(/土\s*粉/g, "士粉") // fix 起土 粉 → 起士粉
    }

    function normalizeEnglishIngredients(text: string): string {
        return text
            .replace(/\s*[,，]\s*/g, ', ') // normalize commas
            .replace(/\s*[:：]\s*/g, ': ') // normalize colons
            .replace(/\s{2,}/g, ' ')       // remove extra spaces
            .replace(/；/g, ';')
            .replace(/\( /g, '(')
            .replace(/ \)/g, ')')
            .trim();
    }

    async function runOcr(file: File) {
        try {
            if (incrementDisclaimerCount) incrementDisclaimerCount();

            progress.value = 0.05
            progressLabel.value = "Loading ingredient database..."

            // ✅ Load highlights + blacklist
            const data = await fetchHighlightsWithCache();
            if (data) {
                allHighlights.value = data.highlights;
                blacklistPatterns.value = data.blacklist.map(
                    b => new RegExp(b.pattern, 'gi')
                );
            }

            // ✅ OCR
            progress.value = 0.15
            progressLabel.value = "Running OCR..."

            let raw = await extractTextFromImage(file);
            if (!raw || !raw.trim()) {
                return setError('OCR failed to detect any text.');
            }
            console.log('📄 Raw OCR text detected:', raw);
            ocrRawText.value = raw || ''

            progress.value = 0.30
            progressLabel.value = "Detecting language..."

            detectedLanguage.value = detectLanguage(raw);
            console.log('🌐 OCR detected language:', detectedLanguage.value);

            let translated = '';
            let cleanedZh = raw;
            let ingredientsOnlyZh = '';  // ✅ <--- Declare here so it's visible everywhere

            progress.value = 0.40
            progressLabel.value = "Cleaning text..."

            if (detectedLanguage.value === 'english') {
                // ✅ Already English → no need to clean Chinese
                translated = raw;
            } else {
                // ✅ Normalize and clean
                raw = normalizeIngredients(raw);
                cleanedZh = normalizeIngredients(cleanChineseOcrText(raw));

                if (!cleanedZh.trim()) {
                    return setError('OCR detected text but nothing meaningful remained after cleanup.');
                }

                console.log('🀄 Cleaned Chinese OCR:', cleanedZh);

                // 🧹 Extract ingredients-only before translation
                ingredientsOnlyZh = stripToIngredientsOnly(cleanedZh);
                console.log('🀄 Cleaned Chinese OCR (ingredients-only):', ingredientsOnlyZh);

                progress.value = 0.55
                progressLabel.value = "Translating..."

                console.log('🌐 [OcrPipeline] Translating full text (chars):', raw.length);
                const resFull = await translateToEnglish(raw);
                if (!resFull) {
                    return setError('Translation of product information failed.');
                }
                const translatedFull = normalizeEnglishIngredients(resFull);

                console.log('🌐 [OcrPipeline] Translating stripped ingredients (chars):', ingredientsOnlyZh.length);
                const resClean = await translateToEnglish(ingredientsOnlyZh);
                const translatedClean = resClean ? normalizeEnglishIngredients(resClean) : '';

                // Determine final translated ingredients string
                if (translatedClean && translatedClean.length > 5) {
                    translated = translatedClean;
                } else {
                    console.warn('⚠️ [OcrPipeline] Cleaned translation was empty or too short. Extracting from full translation.');
                    translated = translatedFull;
                    // Note: cleanTranslatedIngredients will be called later on this
                }

                // 🟢 Extract product name from full translation
                productName.value = extractProductName(translatedFull) || '';
            }

            progress.value = 0.70
            progressLabel.value = "Extracting ingredients..."

            // ✅ Guard: ensure we actually got a reasonable ingredient list
            const ingKeywords = /(ingredient|成分|成份|配料|原料|內容物|内容物|材料)/i;
            if (!ingKeywords.test(raw) && !ingKeywords.test(translated)) {
                throw new Error('No ingredient keywords detected. Please crop the ingredients section only.');
            }

            // ✅ Save Chinese ingredients ONLY if OCR is Chinese / Mixed
            if (detectedLanguage.value === 'chinese' || detectedLanguage.value === 'mixed') {
                ingredientsTextZh.value =
                    ingredientsOnlyZh || stripToIngredientsOnly(cleanedZh);
                console.log('🀄 Final ingredients-only Chinese:', ingredientsTextZh.value);
            } else {
                // 🔒 English-only OCR → never populate Chinese field
                ingredientsTextZh.value = '';
            }

            console.log('📝 [OcrPipeline] Pre-cleaning translated string:', translated);

            // ✅ Clean translated English
            ingredientsText.value = cleanTranslatedIngredients(translated)
                .replace(/^(ingredients)[:：]?\s*/i, '')
                .trim();

            console.log("🏷 Product Name (EN):", productName.value);
            console.log("🌍 Translated Ingredients:", ingredientsText.value);

            await nextTick();

            progress.value = 0.85
            progressLabel.value = "Matching ingredients..."

            await recheckHighlightsSmart();

            progress.value = 0.95
            progressLabel.value = "Finalizing..."

            const count = incrementUsageCount();
            if (count >= 1) {
                const fresh = await fetchHighlightsWithCache(true);
                if (fresh) {
                    allHighlights.value = fresh.highlights;
                    blacklistPatterns.value = fresh.blacklist.map(
                        row => new RegExp(row.pattern, 'gi')
                    );
                }
            }

            progress.value = 1
            showOk.value = true;
        } catch (e: any) {

            console.error("❌ OCR pipeline error:", e);

            progress.value = 0
            progressLabel.value = "Failed"

            // if the error already has a message, keep it
            const message = e?.message || 'OCR failed.';
            setError(message);

            // rethrow so outer layers (useOcrService / confirmCrop) can react properly
            throw e;
        }
    }


    function stripToIngredientsOnly(text: string): string {
        if (!text) return '';

        // 🧭 Start at the first occurrence of 'Ingredients:' or '成份:'
        const startMatch = text.match(/(成分|成份|配料|原料|材料|內容物|ingredients?)[:：]?/i);
        if (!startMatch) return text;

        let stripped = text.slice(startMatch.index! + startMatch[0].length);

        // ⛔ Stop before non-ingredient sections
        // Improved: Don't stop if the match is too early (likely part of the title or immediately following the keyword)
        const stopRegex = /(過敏原|有效日期|製造日期|保存方法|保存期限|淨重|原產地|進口商|地址|營養標示|營養成分|熱量|nutrition facts|nutrition information|expiration|storage|origin|importer|address)/gi;

        let match;
        let cutIndex = -1;
        while ((match = stopRegex.exec(stripped)) !== null) {
            const hit = match[0];
            // Check if it's a header like "Nutrition Info" (營養標示). 
            // We look at the substring starting at the match.
            const context = stripped.slice(match.index, match.index + 20);
            const isHeader = /(營養標示|營養成分|營養信息|nutrition\s*(information|facts|label)|amount\s*per\s*serving)/i.test(context);

            if (match.index < 40 && isHeader) {
                console.log(`⏩ [OcrPipeline] Ignoring header stop-word: "${hit}" found in context: "${context}"`);
                continue;
            }
            cutIndex = match.index;
            console.log(`🧩 [OcrPipeline] stripToIngredientsOnly found valid stop candidate at ${cutIndex}: ${hit}`);
            break;
        }

        if (cutIndex !== -1) {
            stripped = stripped.slice(0, cutIndex);
        }

        // 🧽 Final cleanup
        return stripped.trim().replace(/^[·•*+,，]+|[·•*+,，]+$/g, '');
    }

    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms)
            promise
                .then((value) => {
                    clearTimeout(timer)
                    resolve(value)
                })
                .catch((err) => {
                    clearTimeout(timer)
                    reject(err)
                })
        })
    }

    async function extractTextFromImage(file: File) {
        try {
            const base64 = await fileToBase64(file)
            const res = await withTimeout(
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ocr`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ imageBase64: base64 })
                }),
                15000
            )
            const json = await res.json()
            if (!res.ok || json.error) {
                setError(`OCR failed: ${json.error || 'Google OCR server error'}`)
                return ''
            }
            return json.text || ''
        } catch (e: any) {
            if (e.message === 'timeout') {
                setError('OCR server is busy, please try again later.')
            } else {
                setError('Failed to connect to OCR server. Please try again later.')
            }
            console.error(e)
            return ''
        }
    }

    function fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = reader.result as string
                resolve(result.split(',')[1])
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    async function translateToEnglish(text: string, attempt = 1): Promise<string | null> {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY as string;
            const res = await withTimeout(
                fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        q: text,
                        source: 'zh',
                        target: 'en',
                        format: 'text'
                    }),
                }),
                10000
            );
            const json = await res.json();
            if (!json?.data?.translations?.[0]?.translatedText) {
                throw new Error(json?.error?.message || 'Empty translation');
            }
            return json.data.translations[0].translatedText;
        } catch {
            if (attempt < 2) {
                console.warn(`Retrying translation (attempt ${attempt + 1})...`);
                return translateToEnglish(text, attempt + 1);
            }
            setError('Translation server failed after retry.');
            return null;
        }
    }

    function cleanChineseOcrText(text: string): string {
        let cleaned = text
            .replace(/\r?\n+/g, ', ')
            .replace(/[。、．]/g, ',')
            .replace(/\s{2,}/g, ' ')
            .replace(/品\s*,?\s*名/gi, '品名')
            .replace(/成\s*,?\s*分/gi, '成分')

        cleaned = cleaned.replace(/(品名[:：][^,，]*)原料[:：]/gi, '$1, Ingredients: ')
        cleaned = cleaned.replace(/(成分|配料|原料|材料|内容物|內容物)[:：]/gi, 'Ingredients: ')
        cleaned = cleaned.replace(/品名[:：]/gi, 'Product name: ')
        cleaned = cleaned.replace(/,\s*,+/g, ', ').replace(/^,|,$/g, '')

        console.log("🧹 Cleaned before blacklist:", cleaned)

        // ✅ Apply blacklist *only* outside ingredients
        const [beforeIng, afterIng] = cleaned.split(/Ingredients:/i)
        const safeAfter = afterIng || ''

        // 🚫 skip blacklist for ingredient section
        // only run it on the part BEFORE "Ingredients:"
        let safeBefore = beforeIng || ''
        for (const pattern of blacklistPatterns.value) {
            const matches = safeBefore.match(pattern)
            if (matches && matches.length) {
                console.warn("🧨 Blacklist pattern triggered:", pattern)
                console.warn("   Removed fragment(s):", matches)
            }

            const newCleaned = safeBefore.replace(pattern, '').trim()

            // Only keep if something remains (avoid erasing entire text accidentally)
            if (newCleaned.length > 5) {
                safeBefore = newCleaned
            }
        }

        cleaned = safeBefore + (afterIng ? 'Ingredients: ' + safeAfter : '')

        console.log("🧹 [OcrPipeline] Cleaned after safe blacklist (chars):", cleaned.length)
        return cleaned.trim()
    }


    function toProperCase(s: string) {
        return s.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.slice(1).toLowerCase())
    }

    function cleanTranslatedIngredients(text: string): string {
        console.log('🧹 [OcrPipeline] cleanTranslatedIngredients INPUT:', text);
        // 1️⃣ Cut everything before "ingredients:"
        const idx = text.toLowerCase().indexOf('ingredients:');
        let extracted = idx !== -1 ? text.substring(idx + 'ingredients:'.length).trim() : text;
        console.log('🧹 [OcrPipeline] After "ingredients:" split:', extracted);

        // 2️⃣ Normalize whitespace & newlines
        extracted = extracted.replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ');

        // 3️⃣ Apply blacklist patterns from DB
        blacklistPatterns.value.forEach((pattern) => {
            const newExtracted = extracted.replace(pattern, '').trim();
            if (newExtracted.length > 5) {
                extracted = newExtracted;
            }
        });
        console.log('🧹 [OcrPipeline] After blacklist patterns:', extracted);

        // 4️⃣ Split and normalize
        let parts = extracted
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

        console.log('🧹 [OcrPipeline] After comma split:', JSON.stringify(parts));

        // 5️⃣ Expand compound ingredients inside ()
        const expanded: string[] = [];
        for (const p of parts) {
            expanded.push(...expandCompoundIngredients(p));
        }
        parts = expanded;
        console.log('🧹 [OcrPipeline] After grouping expansion:', JSON.stringify(parts));

        // 6️⃣ Remove weight-only items like "250ml", "1kg"
        parts = parts.filter((p) => !/^\d+\s*(g|kg|ml|毫升|公克)$/i.test(p));

        console.log('🧹 [OcrPipeline] Parts before guard 7:', JSON.stringify(parts));

        // 7️⃣ Guard: if first item looks like product name (title-case + digits), drop it
        if (parts.length && /^[A-Z][a-z]+.*\d+.*$/i.test(parts[0])) {
            console.log('🧹 [OcrPipeline] Dropping first item (assumed product name):', parts[0]);
            parts.shift();
        }

        // 8️⃣ Remove incomplete junk like "(", ")", ","
        parts = parts.filter((p) => !/^[(),]+$/.test(p));

        // 9️⃣ Join back, ProperCase each, remove trailing junk
        return parts
            .map(toProperCase)
            .join(', ')
            .replace(/[\s,]+$/g, '')   // trim trailing commas/spaces
            .replace(/\(\s*$/g, '');   // trim dangling "("
    }


    function extractProductName(text: string): string {
        const normalized = text
            .replace(/：/g, ':')
            .replace(/\u3000/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const clean = (s: string) =>
            toProperCase(
                s.replace(/[™®©]+/g, '')
                    .replace(/\*+$/g, '')
                    .trim()
            );

        // ✅ First try: regex capture
        const m1 = /(product\s*name|product|name|item|品名|品項)\s*:?(.+?)(?=\s*(ingredients?\s*:|$|[.;\n\r]))/i.exec(normalized);
        if (m1?.[2]) {
            const candidate = clean(m1[2]);
            if (candidate.length > 1) {
                return candidate;
            }
        }

        // ✅ Second try: manual keyword search (fallback)
        const lower = normalized.toLowerCase();
        const nameKeywords = ['product name', 'name:', 'item:', '品名', '品項'];

        for (const keyword of nameKeywords) {
            const idx = lower.indexOf(keyword);
            if (idx !== -1) {
                let remainder = normalized.substring(idx + keyword.length).trim();

                remainder = remainder
                    .split(/ingredients?:/i)[0]
                    .split(/[,(\n]/)[0]
                    .replace(/[:：]/g, '')
                    .trim();

                if (remainder.length > 1) {
                    const candidate = clean(remainder);
                    console.log("🏷 Extracted Product Name (fallback):", candidate);
                    return candidate;
                }
            }
        }

        console.warn("⚠️ Product name could not be extracted from OCR text.");
        return '';
    }


    function detectLanguage(text: string): 'chinese' | 'english' | 'mixed' | 'unknown' {
        if (!text) return 'unknown'
        const hasChinese = /[\u4e00-\u9fff]/.test(text)
        const hasEnglish = /[a-zA-Z]/.test(text)
        if (hasChinese && hasEnglish) return 'mixed'
        if (hasChinese) return 'chinese'
        if (hasEnglish) return 'english'
        return 'unknown'
    }

    async function recheckHighlightsSmart() {
        const found: IngredientHighlight[] = []

        ingredientsTextZh.value = normalizeIngredients(ingredientsTextZh.value);
        ingredientsText.value = normalizeEnglishIngredients(ingredientsText.value);

        if (ingredientsTextZh.value?.trim()) {
            await recheckHighlights(ingredientsTextZh.value)
            found.push(...ingredientHighlights.value)
        }

        if (ingredientsText.value?.trim()) {
            await recheckHighlights(ingredientsText.value)
            found.push(...ingredientHighlights.value)
        }

        // Deduplicate by matchedVariant or keyword
        const unique = new Map(
            found.map(f => [f.keyword, f]) // dedupe by ingredient identity
        )

        ingredientHighlights.value = Array.from(unique.values())

        // Status logic (union)
        const hasHaram = ingredientHighlights.value.some(h => extractIonColor(h.color) === 'danger')
        const hasSyubhah = ingredientHighlights.value.some(h => extractIonColor(h.color) === 'warning')

        const hasIngredients =
            !!ingredientsTextZh.value?.trim() ||
            !!ingredientsText.value?.trim()

        // Prioritize detection
        if (!hasIngredients) {
            autoStatus.value = 'No ingredients detected';
        } else if (hasHaram) {
            autoStatus.value = 'Haram';
        } else if (hasSyubhah) {
            autoStatus.value = 'Syubhah';
        } else {
            autoStatus.value = 'Muslim-friendly'; // ingredients exist but none flagged
        }


    }

    function expandCompoundIngredients(text: string): string[] {
        const compoundPattern = /([\u4e00-\u9fa5A-Za-z]+)\s*\(([^)]+)\)/g;
        const results: string[] = [];

        let match;
        while ((match = compoundPattern.exec(text)) !== null) {
            const subIngredients = match[2].split(/[、,]/).map(s => s.trim());

            // Instead of pushing compoundName (which causes false warning),
            // push only its sub-ingredients
            results.push(...subIngredients);
        }

        return results.length > 0 ? results : [text];
    }

    const checkingIngredients = ref(false)

    async function recheckHighlights(raw: string = ingredientsTextZh.value) {
        const lang = detectedLanguage.value;

        const isEnglish = lang === 'english';
        const isChinese = lang === 'chinese';

        checkingIngredients.value = true
        try {
            const text = raw.trim()
            if (!text || !allHighlights.value.length) {
                ingredientHighlights.value = []
                autoStatus.value = ''
                return
            }

            const parts = raw.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean)

            const highlights = [...allHighlights.value].sort((a, b) => b.keyword.length - a.keyword.length)
            const found: IngredientHighlight[] = []

            for (const part of parts) {
                // 👇 normalize the ingredient part to lowercase, remove commas/spaces
                const normalized =
                    isEnglish
                        ? part.replace(/[^a-z0-9]/gi, "").toLowerCase()
                        : part.replace(/[,\s]/g, ""); // KEEP Chinese characters


                for (const h of highlights) {
                    let variants: string[] = [];

                    if (isEnglish) {
                        variants = h.keyword?.split("|").map(v => v.trim()) ?? [];
                    } else if (isChinese) {
                        variants = h.keyword_zh?.split("|").map(v => v.trim()) ?? [];
                    } else {
                        // mixed → match both EN + ZH
                        variants = [
                            ...(h.keyword?.split("|") ?? []),
                            ...(h.keyword_zh?.split("|") ?? [])
                        ].map(v => v.trim());
                    }

                    for (const variant of variants) {
                        // 👇 normalize the highlight keyword too
                        const normVariant =
                            isEnglish
                                ? variant.replace(/[^a-z0-9]/gi, "").toLowerCase()
                                : variant.replace(/[,\s]/g, "");


                        let isMatch = false;

                        try {
                            if (/[[\]|\\]/.test(variant)) {
                                // treat as regex
                                const regex = new RegExp(variant, "i"); // already case-insensitive
                                isMatch = regex.test(normalized);
                            } else {
                                // plain substring, lowercase match
                                isMatch = normalized.includes(normVariant);
                            }
                        } catch (e) {
                            console.warn("⚠️ Invalid regex in keyword:", variant, e);
                        }

                        if (isMatch) {
                            if ([...found].some(f => f.matchedVariant && f.matchedVariant.includes(normVariant))) {
                                console.log(`⏩ Skipping smaller match: ${variant} (already covered)`);
                                continue;
                            }

                            console.log("✅ Match detected:", variant, "→", h);
                            found.push({ ...h, matchedVariant: variant });
                        }
                    }
                }
            }

            ingredientHighlights.value = found

            // Status logic
            const hasHaram = found.some(h => extractIonColor(h.color) === 'danger')
            const hasSyubhah = found.some(h => extractIonColor(h.color) === 'warning')
            autoStatus.value = hasHaram ? 'Haram' : hasSyubhah ? 'Syubhah' : 'Muslim-friendly'
        } finally {
            checkingIngredients.value = false
        }
    }

    return {
        runOcr,
        recheckHighlights,
        recheckHighlightsSmart,
        ingredientHighlights,
        ingredientsTextZh,
        autoStatus,
        productName,
        ingredientsText,
        showOk,
        checkingIngredients,
        detectedLanguage,
        cleanChineseOcrText,
        ocrRawText,
        progress,
        progressLabel
    }
}
