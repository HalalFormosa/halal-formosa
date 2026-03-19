import { ref } from 'vue'
import { GoogleGenAI } from '@google/genai'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default function useAISummary() {
    const overallNote = ref<string>('') // summary text (HTML after parsing)
    const loadingSummary = ref(false)
    const errorSummary = ref<string | null>(null)

    const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY
    })

    async function renderMarkdown(text: string): Promise<string> {
        const raw = await marked.parseInline(text)
        return DOMPurify.sanitize(raw)
    }


    async function generateSummary(ingredientsText: string, highlights: any[] = [], systemStatus: string = '') {
        if (!ingredientsText) return

        loadingSummary.value = true
        errorSummary.value = null
        overallNote.value = ''

        try {
            const input = ingredientsText
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1500)

            const highlightInfo = highlights.length
                ? highlights.map(h => `${h.keyword}: ${colorMeaning(extractIonColor(h.color))}`).join(', ')
                : 'None'

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: `You are providing official but friendly explanations on behalf of Halal Formosa. 
Do NOT include greetings, OCR results, introductions, or disclaimers. Go straight to the ingredient analysis.

Ingredients (OCR result):
${input}

Trusted ingredient status from the Halal Formosa database:
${highlightInfo}

Strict instructions:
1. ONLY explain ingredients flagged in the database (*Muslim-friendly*, *Haram*, *Syubhah*). 
2. For *Muslim-friendly* items, group them into one efficient sentence (e.g., "**Sugar and Water** are *Muslim-friendly* because they are plant-based or natural").
3. For **Haram** or **Syubhah** items, you MUST provide a detailed "Why." Do not use generic summaries. Instead, use specific reasoning like scientific origins (e.g., "extracted from animal fat") or scriptural references (e.g., "Pork is *Haram* per Quranic verse Al-Baqarah 2:173").
4. If the database provides a specific verse or a chemical source, it is MANDATORY to include it.
5. Total explanation must be descriptive but concise, between 4 to 8 sentences.
Overall system status:
${systemStatus}
6. Always end exactly with:
"Based on our Halal Formosa ingredients database, this product is ${systemStatus}."
7. Use Markdown (**bold** names, *italic* statuses).`,
                config: { thinkingConfig: { thinkingBudget: 0 } } // Set budget > 0 if you want the model to 'reason' internally first
            })

            const text =
                response.text ||
                response.candidates?.[0]?.content?.parts?.[0]?.text ||
                ''

            if (!text) {
                throw new Error('Empty AI response')
            }

            overallNote.value = await renderMarkdown(text)
        } catch (err: any) {
            errorSummary.value = err.message || 'Failed to generate summary.'
        } finally {
            loadingSummary.value = false
        }
    }


    return {
        overallNote,
        loadingSummary,
        errorSummary,
        generateSummary
    }
}
