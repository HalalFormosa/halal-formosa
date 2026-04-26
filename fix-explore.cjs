const fs = require('fs');
let content = fs.readFileSync('src/views/explore/ExploreView.vue', 'utf8');

// 1. Remove address from info window - remove the address block after category badge
content = content.replace(
  /(<!-- Category badge -->[\s\S]*?<\/span>)([\s\S]*?)(\s*<\/div>\s*\`\s*\)\s*}\s*const createPinElement)/,
  '$1$3'
);

// 2. Update bottom card - remove type from metas and move distance into metas
// Find and replace the metas section in the bottom card
const oldMetas = `                    <div class="metas">
                      <span class="meta">{{ place.type }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                    </div>
                    <div v-if="userLocation && (place as any).distance !== undefined" class="distance">
                      <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                    </div>`;

const newMetas = `                    <div class="metas">
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                      <span class="meta-dot">•</span>
                      <span v-if="userLocation && (place as any).distance !== undefined" class="meta">
                        <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                      </span>
                    </div>`;

content = content.replace(oldMetas, newMetas);

fs.writeFileSync('src/views/explore/ExploreView.vue', content);
console.log('Changes applied successfully');
