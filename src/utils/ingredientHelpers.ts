/** Convert ion-color name to hex code */
export function ionToHex(ion?: string): string {
    const c = (ion || '').match(/(danger|warning|primary|success|medium|dark)/i)?.[1]?.toLowerCase()
    switch (c) {
        case 'danger': return '#eb445a'
        case 'warning': return '#ffc409'
        case 'primary': return '#3880ff'
        case 'success': return '#2dd36f'
        case 'medium': return '#92949c'
        case 'dark': return '#222428'
        default: return '#333'
    }
}

/** Extract only the Ion color name from a full string (e.g. "ion-color-danger") */
export function extractIonColor(colorClass: string): string {
    return colorClass.split('-').pop() ?? ''
}

/** Meaning of each Ion color in ingredient highlighting */
export function colorMeaning(color: string): string {
    switch (color) {
        case 'danger': return 'Haram'
        case 'warning': return 'Syubhah'
        case 'success': return 'Halal'
        case 'primary': return 'Muslim-friendly'
        default: return 'Unknown'
    }
}

export function statusToChipClass(status: string): string {
    switch (status) {
        case 'Halal': return 'chip-success'
        case 'Muslim-friendly': return 'chip-primary'
        case 'Syubhah': return 'chip-warning'
        case 'Haram': return 'chip-danger'
        default: return 'chip-medium'
    }
}