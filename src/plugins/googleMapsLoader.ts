// src/plugins/googleMapsLoader.ts
import { Loader } from '@googlemaps/js-api-loader'

const loader = new Loader({
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    version: 'weekly',
    libraries: ['maps', 'marker', 'places'],
    id: '__googleMapsScriptId', // ensure consistent script id
})

export default loader
