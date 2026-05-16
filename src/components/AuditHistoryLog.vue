<template>
  <div class="audit-history-container ion-margin-top ion-margin-bottom">
    <ion-accordion-group>
      <ion-accordion value="history">
        <ion-item slot="header" color="light">
          <ion-icon :icon="timeOutline" slot="start" color="medium"></ion-icon>
          <ion-label>
            <h3>{{ $t('common.history', 'History') }}</h3>
            <p>
              {{ $t('common.added', 'Added') }} {{ fromNowToTaipei(createdAt) }}
              <span v-if="filteredLogs.length > 0"> &bull; {{ $t('common.lastEdited', 'Last edited') }} {{ fromNowToTaipei(filteredLogs[0].created_at) }}</span>
            </p>
          </ion-label>
        </ion-item>
        <div class="ion-padding" slot="content">
          <div class="timeline" v-if="filteredLogs.length > 0">
            <div v-for="(log, index) in filteredLogs" :key="log.id" class="timeline-item">
              <div class="timeline-icon">
                <ion-avatar class="small-avatar">
                  <img :src="getAvatar(log)" alt="avatar" @error="handleImageError" />
                </ion-avatar>
              </div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <strong>{{ getDisplayName(log) }}</strong>
                  <span class="timeline-date">{{ fromNowToTaipei(log.created_at) }}</span>
                </div>
                <div class="timeline-body">
                  <p class="ion-no-margin text-sm timeline-desc">
                    {{ getActionDescription(log) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ion-text-center">
            <p class="text-gray-500 text-sm">{{ $t('common.noEditHistory', 'No recent edits') }}</p>
          </div>
        </div>
      </ion-accordion>
    </ion-accordion-group>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonIcon, IonAvatar } from '@ionic/vue'
import { timeOutline } from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const props = defineProps<{
  entityType: string
  entityId: string | number
  createdAt: string
}>()

const logs = ref<any[]>([])

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (log.action === 'INSERT') return true

    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
      if (log.old_data.approved === false && log.new_data.approved === true) return true

      const oldKeys = Object.keys(log.old_data)
      for (const key of oldKeys) {
        if (['updated_at', 'created_at', 'updated_by', 'search_vector', 'view_count', 'sale_count', 'approved', 'approved_by', 'approved_at'].includes(key)) continue
        if (JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])) {
          return true
        }
      }
      return false
    }

    return true
  })
})

const fetchLogs = async () => {
  if (!props.entityId) return

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      created_at,
      old_data,
      new_data,
      user_profiles (
        display_name,
        avatar_url
      )
    `)
    .eq('entity_type', props.entityType)
    .eq('entity_id', String(props.entityId))
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching audit logs:', error)
  } else {
    logs.value = data || []
  }
}

onMounted(() => {
  fetchLogs()
})

watch(() => props.entityId, () => {
  fetchLogs()
})

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

function getDisplayName(log: any) {
  if (log.user_profiles && log.user_profiles.display_name) {
    return log.user_profiles.display_name
  }
  return 'Contributor'
}

function getAvatar(log: any) {
  if (log.user_profiles && log.user_profiles.avatar_url) {
    return log.user_profiles.avatar_url
  }
  return 'https://ui-avatars.com/api/?name=Contributor&background=random'
}

function handleImageError(e: Event) {
  const target = e.target as HTMLImageElement
  target.src = 'https://ui-avatars.com/api/?name=Contributor&background=random'
}

function getActionDescription(log: any) {
  if (log.action === 'INSERT') {
    return `Added this ${props.entityType}`
  }

  // Very basic diffing logic for UPDATE
  if (log.action === 'UPDATE' && log.old_data && log.new_data) {
    if (log.old_data.approved === false && log.new_data.approved === true) {
      return `Approved this ${props.entityType}`
    }

    const changes: string[] = []
    const oldKeys = Object.keys(log.old_data)
    
    for (const key of oldKeys) {
      // Ignore common timestamps/metadata
      if (['updated_at', 'created_at', 'updated_by', 'search_vector', 'view_count', 'sale_count', 'approved', 'approved_by', 'approved_at'].includes(key)) continue
      
      const oldVal = log.old_data[key]
      const newVal = log.new_data[key]

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        // Format the key for display
        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        changes.push(displayKey)
      }
    }

    if (changes.length > 0) {
      if (changes.length <= 3) {
        return `Updated ${changes.join(', ')}`
      } else {
        return `Updated ${changes.slice(0, 3).join(', ')} and ${changes.length - 3} other fields`
      }
    }
    return `Updated ${props.entityType} details`
  }

  return 'Edited record'
}
</script>

<style scoped>
.audit-history-container {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.timeline {
  position: relative;
  padding: 10px 0;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 2px;
  background: var(--card-border, #e0e0e0);
}

.timeline-item {
  position: relative;
  display: flex;
  margin-bottom: 20px;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-icon {
  position: relative;
  z-index: 1;
  margin-right: 16px;
  padding-top: 4px;
}

.small-avatar {
  width: 32px;
  height: 32px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.timeline-content {
  flex: 1;
  background: var(--card-bg, #ffffff);
  padding: 12px;
  border-radius: 8px;
  box-shadow: var(--card-shadow, 0 1px 2px rgba(0,0,0,0.05));
  border: 1px solid var(--card-border, rgba(0,0,0,0.05));
  color: var(--ion-text-color, #000000);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-header strong {
  color: var(--ion-text-color, #000000);
}

.timeline-date {
  font-size: 12px;
  color: var(--ion-color-medium, #888888);
}

.timeline-desc {
  color: var(--ion-text-color, #555555);
  opacity: 0.85;
}
</style>
