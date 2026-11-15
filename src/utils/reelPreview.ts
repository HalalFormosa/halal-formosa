/**
 * Whether a reel preview should hit its limit now.
 *
 * Setting `video.currentTime` fires another `timeupdate`, so a handler that reacts to timeupdate by snapping the
 * playhead must ignore reels that are already limited. Without that guard the snap re-triggers itself forever
 * (on 2026-10-04 one session logged 11,366 reels_preview_limit_reached events in one minute).
 */
export function shouldTriggerPreviewLimit(alreadyLimited: boolean, currentTime: number, limitSeconds: number): boolean {
    return !alreadyLimited && currentTime >= limitSeconds
}
