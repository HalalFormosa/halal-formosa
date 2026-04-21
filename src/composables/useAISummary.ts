import { ref } from 'vue'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from '@/plugins/supabaseClient'
import { GoogleGenAI } from '@google/genai'

export default function useAISummary() {
    const overallNote = ref<string>('') // summary text (HTML after parsing)
    const loadingSummary = ref(false)
    const errorSummary = ref<string | null>(null)
    const activeModel = ref<string>('')
    const tryingModel = ref<string>('')

    // Initialize Gemini for fallback
    const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

    async function renderMarkdown(text: string): Promise<string> {
        const raw = await marked.parse(text)
        return DOMPurify.sanitize(raw)
    }

    async function generateSummary(ingredientsText: string, highlights: any[] = [], systemStatus: string = '') {
        if (!ingredientsText) return

        loadingSummary.value = true
        errorSummary.value = null
        overallNote.value = ''
        activeModel.value = ''
        tryingModel.value = 'AI Cloud' // Initial feedback

        // 1. Prepare data for both paths
        const input = ingredientsText
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1500)

        const highlightInfo = highlights.length
            ? highlights.map(h => `${h.keyword}: ${colorMeaning(extractIonColor(h.color))}`).join(', ')
            : 'None'

        let accumulatedText = ''

        try {
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-explanation`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    ingredientsText: input,
                    highlightInfo: highlightInfo,
                    systemStatus: systemStatus
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `AI Error: ${response.status}`)
            }

            // Capture which model distance finally answered
            const modelUsed = response.headers.get('X-Model-Used')
            if (modelUsed) {
                activeModel.value = modelUsed
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error("No reader available")

            const decoder = new TextDecoder()
            let buffer = ""

            tryingModel.value = '' // Clear connecting status once data starts

            // Helper to process line-by-line streaming
            const processLine = (line: string) => {
                const trimmed = line.trim()
                if (!trimmed || trimmed === "data: [DONE]") return

                if (trimmed.startsWith("data: ")) {
                    try {
                        const jsonStr = trimmed.replace("data: ", "")
                        const json = JSON.parse(jsonStr)
                        const content = json.choices?.[0]?.delta?.content || ""
                        if (content) {
                            accumulatedText += content
                            return true // signal that we got content
                        }
                    } catch (e) {
                        console.warn("⚠️ [AI] Partial or malformed JSON segment ignored:", trimmed)
                    }
                }
                return false
            }

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                
                // Keep the last segment in buffer if it doesn't end with a newline
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (processLine(line)) {
                        overallNote.value = await renderMarkdown(accumulatedText)
                    }
                }
            }

            // 🏁 Final check: process remaining data in buffer (critical for native/fragmented streams)
            if (buffer.trim()) {
                if (processLine(buffer)) {
                    overallNote.value = await renderMarkdown(accumulatedText)
                }
            }

            if (!accumulatedText) {
                throw new Error('Empty AI response')
            }

        } catch (err: any) {
            console.warn("Primary AI Summary failed, attempting fallback:", err)
            
            try {
                // FALLBACK: Use Gemini directly
                tryingModel.value = 'Gemini Fallback'
                accumulatedText = ''
                
                const prompt = `You are providing official but friendly explanations on behalf of Halal Formosa. 
Do NOT include greetings, OCR results, introductions, or disclaimers. Go straight to the ingredient analysis.

Trusted ingredient status from the Halal Formosa database:
${highlightInfo}

Ingredients (OCR result for context):
${input}

Strict instructions:
1. **Prioritize Risks**: You MUST explain EVERY ingredient from the "Trusted ingredient status" list that is flagged as **Haram** or **Syubhah**. Omitting a high-risk ingredient is a failure.
2. **Mutual Exclusion**: An ingredient MUST only appear in ONE section. If it is Haram or Syubhah, it MUST NOT be mentioned in the Muslim-friendly sentence.
3. **Consolidation**: Group all *Muslim-friendly* items into one short sentence at the very beginning. 
4. **Mandatory Detailed "Why"**: Every **Haram** or **Syubhah** item MUST be a bullet point ("- ") and MUST include a specific reason (e.g., alcohol for Mirin, animal-derived enzymes for Cheese/Whey).
5. If the Overall system status is "${systemStatus}", you MUST identify and explain the specific ingredient(s) responsible for that status.
Overall system status:
${systemStatus}
6. Always end exactly with:
"Based on our Halal Formosa ingredients database, this product is ${systemStatus}."
7. Use Markdown (**bold** names, *italic* statuses, and bullet points for risks).`

                const resultStream = await genAI.models.generateContentStream({
                    model: 'gemini-2.5-flash-lite',
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                })
                activeModel.value = 'Gemini 2.5 Flash (Fallback)'
                tryingModel.value = ''

                for await (const chunk of resultStream) {
                    const chunkText = chunk.text
                    accumulatedText += chunkText
                    overallNote.value = await renderMarkdown(accumulatedText)
                }

                if (!accumulatedText) throw new Error('Empty Gemini response')

            } catch (fallbackErr: any) {
                console.error("AI Summary Error (Both paths failed):", fallbackErr)
                errorSummary.value = fallbackErr.message || 'Failed to generate summary.'
            }
        } finally {
            loadingSummary.value = false
            tryingModel.value = ''
        }
    }


    return {
        overallNote,
        loadingSummary,
        errorSummary,
        activeModel,
        tryingModel,
        generateSummary
    }
}
