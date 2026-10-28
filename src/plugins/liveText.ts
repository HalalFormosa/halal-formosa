import { registerPlugin, type PermissionState, type PluginListenerHandle } from '@capacitor/core'
import type { HighlightBox } from '@/types/Ingredient'

/** One recognised word (Latin) or word-ish segment (CJK), in upright-image pixels. */
export interface LiveTextElement {
    text: string
    box: HighlightBox
}

export interface LiveTextLine {
    text: string
    box: HighlightBox
    elements: LiveTextElement[]
}

export interface LiveTextBlock {
    lines: LiveTextLine[]
}

/**
 * One analysed camera frame. `width`/`height` are the dimensions of the upright
 * analysis image that every box is expressed in. The frame itself never leaves the
 * native side: only this text and these boxes cross the bridge.
 */
export interface LiveTextFrame {
    width: number
    height: number
    blocks: LiveTextBlock[]
}

export interface LiveTextPlugin {
    checkPermissions(): Promise<{ camera: PermissionState }>
    requestPermissions(): Promise<{ camera: PermissionState }>
    /** Starts the native camera preview (behind the webview) and on-device text recognition. */
    start(): Promise<void>
    stop(): Promise<void>
    setTorch(options: { enabled: boolean }): Promise<void>
    /**
     * Takes one still photo of what the camera is pointed at. Only called when the user chooses to
     * contribute a product; returns an upright JPEG as base64.
     */
    takePhoto(): Promise<{ base64: string; width: number; height: number }>
    addListener(
        eventName: 'textFrame',
        listener: (frame: LiveTextFrame) => void,
    ): Promise<PluginListenerHandle>
}

export const LiveText = registerPlugin<LiveTextPlugin>('LiveText')
