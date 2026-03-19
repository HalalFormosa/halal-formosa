// src/services/SessionService.ts
import { v4 as uuidv4 } from 'uuid'

class SessionService {
    private static sessionId: string | null = null

    static getSessionId(): string {
        if (!this.sessionId) {
            this.sessionId = uuidv4()
        }
        return this.sessionId
    }

    static resetSession() {
        this.sessionId = uuidv4()
    }
}

export default SessionService