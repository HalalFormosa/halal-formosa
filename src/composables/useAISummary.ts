import { ref } from 'vue'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from '@/plugins/supabaseClient'

export default function useAISummary() {
    const overallNote = ref<string>('') // summary text (HTML after parsing)
    const loadingSummary = ref(false)
    const errorSummary = ref<string | null>(null)
    const activeModel = ref<string>('')
    const tryingModel = ref<string>('')

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

        let accumulatedText = ''

        try {
            const input = ingredientsText
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1500)

            const highlightInfo = highlights.length
                ? highlights.map(h => `${h.keyword}: ${colorMeaning(extractIonColor(h.color))}`).join(', ')
                : 'None'

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

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    const trimmedLine = line.trim()
                    if (!trimmedLine || trimmedLine === "data: [DONE]") continue

                    if (trimmedLine.startsWith("data: ")) {
                        try {
                            const json = JSON.parse(trimmedLine.replace("data: ", ""))
                            const content = json.choices?.[0]?.delta?.content || ""
                            if (content) {
                                accumulatedText += content
                                overallNote.value = await renderMarkdown(accumulatedText)
                            }
                        } catch (e) {
                            // Silently ignore partial JSON or keep-alive chunks
                        }
                    }
                }
            }

            if (!accumulatedText) {
                throw new Error('Empty AI response')
            }

        } catch (err: any) {
            console.error("AI Summary Error:", err)
            errorSummary.value = err.message || 'Failed to generate summary.'
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
