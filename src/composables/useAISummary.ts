import { ref } from 'vue'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from '@/plugins/supabaseClient'
import { i18n } from '@/i18n'

// Server codes from generate-ai-explanation -> translated, user-safe messages. Anything else
// (network drop, Gemini outage, old server response) shows the generic "unavailable" text so
// raw provider or billing errors are never shown to users; details stay in the console.
export class AiRequestError extends Error {
    constructor(public status: number, public code?: string, message?: string) {
        super(`AI request failed [${status}${code ? ' ' + code : ''}]: ${message || 'no detail'}`)
    }
}

const AI_ERROR_KEYS: Record<string, string> = {
    UNAUTHORIZED: 'signIn',
    PRO_ONLY: 'proOnly',
    AI_DAILY_LIMIT: 'dailyLimit',
}

export function friendlyAiError(err: unknown): string {
    const code = err instanceof AiRequestError ? err.code : undefined
    const key = (code && AI_ERROR_KEYS[code]) || 'unavailable'
    return i18n.global.t(`scanIngredients.aiErrors.${key}`)
}

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

        // 1. Prepare data for the path
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
                throw new AiRequestError(response.status, errorData.code, errorData.error)
            }

            // Capture which model finally answered
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
            console.error("AI Summary Error:", err)
            errorSummary.value = friendlyAiError(err)
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
