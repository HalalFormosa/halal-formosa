<template>
  <div class="audit-history-container ion-margin-top ion-margin-bottom">
    <div class="collapsible-header" @click="showHistory = !showHistory">
      <div class="header-text-group">
        <h3 class="font-bold text-lg ion-no-margin">{{ $t('common.history', 'History') }}</h3>
        <p class="history-subtitle ion-no-margin">
          {{ $t('common.added', 'Added') }} {{ fromNowToTaipei(createdAt) }}
          <span v-if="filteredLogs.length > 0"> &bull; {{ $t('common.lastEdited', 'Last edited') }} {{ fromNowToTaipei(filteredLogs[0].created_at) }}</span>
        </p>
      </div>
      <ion-icon :icon="showHistory ? chevronUp : chevronDown" class="collapsible-chevron" />
    </div>

    <div v-show="showHistory" class="collapsible-content">
      <div class="timeline-wrapper">
        <div class="timeline" v-if="filteredLogs.length > 0">
          <div v-for="(log, index) in filteredLogs" :key="log.id" class="timeline-item">
            <div class="timeline-icon">
              <ion-avatar class="small-avatar">
                <img :src="getAvatar(log)" alt="avatar" @error="handleImageError" />
              </ion-avatar>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <div class="name-wrapper">
                  <strong>{{ getDisplayName(log) }}</strong>
                  <span v-if="isAdminUser(log)" class="admin-pill">{{ $t('common.admin', 'Admin') }}</span>
                </div>
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
        <div v-else class="ion-text-center timeline-empty">
          <p class="text-gray-500 text-sm">{{ $t('common.noEditHistory', 'No recent edits') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { IonIcon, IonAvatar } from '@ionic/vue'
import { timeOutline, chevronDown, chevronUp } from 'ionicons/icons'
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
  entityId?: string | number
  createdAt?: string
}>()

const logs = ref<any[]>([])
const showHistory = ref(false)

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
        avatar_url,
        public_profile,
        user_roles (
          role
        )
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

defineExpose({ fetchLogs })

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

function getDisplayName(log: any) {
  if (log.user_profiles && log.user_profiles.public_profile && log.user_profiles.display_name) {
    return log.user_profiles.display_name
  }
  return 'Anonymous Contributor'
}

function getAvatar(log: any) {
  if (log.user_profiles && log.user_profiles.public_profile && log.user_profiles.avatar_url) {
    return log.user_profiles.avatar_url
  }
  return 'https://ui-avatars.com/api/?name=Contributor&background=random'
}

function isAdminUser(log: any) {
  if (!log.user_profiles || !log.user_profiles.user_roles) return false
  const roles = log.user_profiles.user_roles
  if (Array.isArray(roles)) {
    return roles.some((r: any) => r?.role === 'admin')
  }
  return roles?.role === 'admin'
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
  /* Clean borderless container */
}
.collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  margin-top: 16px;
  margin-bottom: 8px;
  cursor: pointer;
}
.header-text-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-subtitle {
  font-size: 0.82rem;
  color: var(--ion-color-medium, #888888);
  font-weight: 500;
  text-align: left;
}
.collapsible-chevron {
  font-size: 1.4rem;
  color: var(--ion-color-carrot);
}
.collapsible-content {
  animation: slideDown 0.25s ease-out;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
.timeline-wrapper {
  padding: 12px 0;
}
.timeline-empty {
  padding: 16px 0;
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

.name-wrapper {
  display: flex;
  align-items: center;
}

.admin-pill {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--ion-color-carrot, #ff9800);
  color: white;
  padding: 2px 6px;
  border-radius: 12px;
  margin-left: 6px;
  box-shadow: 0 1px 3px rgba(255, 152, 0, 0.4);
}
</style>
