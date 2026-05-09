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
                const statusText = response.statusText || 'Unknown Error'
                throw new Error(`Edge Function Error [${response.status} ${statusText}]: ${errorData.error || 'No detailed message provided'}`)
            }

            // Capture which model distance finally answered
            const modelUsed = response.headers.get('X-Model-Used')
            if (modelUsed) {
                activeModel.value = modelUsed
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error("No stream reader available from Edge Function")

            const decoder = new TextDecoder()
            let buffer = ""

            tryingModel.value = '' 

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
                            return true
                        }
                    } catch (e) {
                        console.warn("⚠️ [AI] Partial segment ignored:", trimmed)
                    }
                }
                return false
            }

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (processLine(line)) {
                        overallNote.value = await renderMarkdown(accumulatedText)
                    }
                }
            }

            if (buffer.trim() && processLine(buffer)) {
                overallNote.value = await renderMarkdown(accumulatedText)
            }

            if (!accumulatedText) {
                throw new Error('Empty AI response from Edge Function')
            }

        } catch (err: any) {
            console.warn("🚀 Edge Function failed, checking for local fallback:", err.message)
            
            // Check if we have a local API key for fallback
            const localApiKey = import.meta.env.VITE_GEMINI_API_KEY
            if (!localApiKey || localApiKey === 'YOUR_GEMINI_API_KEY') {
                errorSummary.value = `<b>AI Error:</b> ${err.message}<br/><small>Local fallback unavailable: API Key missing.</small>`
                return
            }

            try {
                tryingModel.value = 'Gemini 3.1 Flash Lite (Local Fallback)'
                accumulatedText = ''
                
                const prompt = `You are providing official explanations for Halal Formosa. 
Your goal is to explain WHY specific ingredients are flagged as Haram or Syubhah based ONLY on the data provided below.

1. **Trusted ingredient status (EXCLUSIVELY use this for status)**:
${highlightInfo}

2. **Ingredients (OCR result for context ONLY)**:
${input}

STRICT INSTRUCTIONS:
- **NO HALLUCINATIONS**: Only explain ingredients that appear in the "Trusted ingredient status" list above. 
- **STRICT DATA ADHERENCE**: If an ingredient is NOT in the "Trusted ingredient status" list, do NOT mention it, even if you see it in the OCR text.
- **STATUS AUTHORITY**: Do NOT use your own knowledge to determine if an ingredient is Halal or Haram. Use ONLY the status provided in the list. For example, if "Sugar" is in the OCR but NOT in the Trusted list, do NOT explain it.
- **Structure**:
  1. **Summary Sentence**: Start with one sentence listing all "Muslim-friendly" ingredients found in the Trusted list.
  2. **Risk Analysis**: For every ingredient labeled as **Haram** or **Syubhah** in the Trusted list, create a bullet point ("- ") explaining the specific risk (e.g., animal origin, alcohol content).
  3. **Conclusion**: Always end with: "Based on our Halal Formosa ingredients database, this product is ${systemStatus}."

Use Markdown (**bold** names, *italic* statuses).`

                const resultStream = await genAI.models.generateContentStream({
                    model: 'gemini-3.1-flash-lite',
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                })
                
                activeModel.value = 'Gemini 3.1 Flash Lite (Local Fallback)'
                tryingModel.value = ''

                for await (const chunk of resultStream) {
                    const chunkText = chunk.text
                    accumulatedText += chunkText
                    overallNote.value = await renderMarkdown(accumulatedText)
                }

                if (!accumulatedText) throw new Error('Empty Gemini response from local fallback')

            } catch (fallbackErr: any) {
                console.error("AI Summary Error (Both paths failed):", fallbackErr)
                errorSummary.value = `<b>Critical AI Failure:</b><br/>1. ${err.message}<br/>2. ${fallbackErr.message || 'Local fallback failed'}`
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
