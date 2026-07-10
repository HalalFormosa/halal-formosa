<template>
  <ion-page>
    <AppHeader title="Contributor Applications" :show-back="true" />

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" />
        <p>Loading applications...</p>
      </div>

      <div v-else>
        <!-- Empty State -->
        <div v-if="applications.length === 0" class="empty-state ion-text-center ion-padding">
          <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
          <h3>All caught up!</h3>
          <p style="color: var(--ion-color-medium); max-width: 280px; margin: 0 auto;">
            There are no pending contributor applications at the moment.
          </p>
        </div>

        <!-- Applications List -->
        <div v-else>
          <ion-card 
            v-for="app in applications" 
            :key="app.id" 
            class="app-card animate__animated animate__fadeIn"
            style="border: 1px solid var(--ion-color-light); border-radius: 12px; margin-bottom: 16px; box-shadow: none;"
          >
            <ion-card-header class="ion-no-padding ion-padding-horizontal ion-padding-top">
              <ion-item lines="none" class="ion-no-padding">
                <ion-label>
                  <h2 style="font-weight: 700; font-size: 1.1rem; margin: 0 0 2px 0;">
                    {{ app.display_name || 'Anonymous User' }}
                  </h2>
                  <p style="font-size: 0.85rem; color: var(--ion-color-medium); margin: 0;">
                    {{ app.email }}
                  </p>
                  <p style="font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 4px;">
                    Applied: {{ formatDate(app.created_at) }}
                  </p>
                </ion-label>
              </ion-item>
            </ion-card-header>

            <ion-card-content class="ion-padding-horizontal ion-padding-bottom">
              <div style="background: var(--ion-color-light); border-radius: 8px; padding: 12px; margin-top: 8px; margin-bottom: 16px;">
                <h4 style="font-weight: 600; font-size: 0.85rem; color: var(--ion-color-carrot); margin: 0 0 6px 0; text-transform: uppercase;">
                  Reason to Contribute
                </h4>
                <p style="margin: 0; line-height: 1.5; font-size: 0.9rem; color: var(--ion-color-dark); white-space: pre-wrap;">
                  {{ app.reason }}
                </p>
              </div>

              <div style="display: flex; gap: 12px;">
                <ion-button style="flex: 1;" color="success" @click="handleApprove(app)">
                  Approve
                </ion-button>
                <ion-button style="flex: 1;" fill="outline" color="danger" @click="handleReject(app)">
                  Reject
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Success Toast -->
      <ion-toast
        :is-open="showToast"
        :message="toastMsg"
        :duration="2000"
        color="success"
        @did-dismiss="showToast = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonItem,
  IonLabel,
  IonButton,
  IonToast
} from '@ionic/vue'
import { supabase } from '@/plugins/supabaseClient'
import AppHeader from '@/components/AppHeader.vue'

interface ContributorApplication {
  id: string
  user_id: string
  reason: string
  status: string
  created_at: string
  email?: string
  display_name?: string
}

const applications = ref<ContributorApplication[]>([])
const loading = ref(true)
const showToast = ref(false)
const toastMsg = ref('')

async function fetchApplications() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('contributor_applications')
      .select('id, user_id, reason, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Fetch user profiles for these user_ids in parallel to fetch user metadata safely
    const userIds = (data || []).map(item => item.user_id)
    if (userIds.length > 0) {
      const { data: profiles, error: profError } = await supabase
        .from('user_profiles')
        .select('id, email, display_name')
        .in('id', userIds)

      if (!profError && profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]))
        applications.value = data.map(item => ({
          ...item,
          email: profileMap.get(item.user_id)?.email,
          display_name: profileMap.get(item.user_id)?.display_name
        }))
        return
      }
    }

    applications.value = data || []
  } catch (err) {
    console.error('Failed to fetch applications:', err)
  } finally {
    loading.value = false
  }
}

async function handleApprove(app: ContributorApplication) {
  try {
    // 1. Update application status
    const { error: appError } = await supabase
      .from('contributor_applications')
      .update({ status: 'approved' })
      .eq('id', app.id)

    if (appError) throw appError

    // 2. Upsert user role to contributor
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: app.user_id,
        role: 'contributor',
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (roleError) throw roleError

    toastMsg.value = `Approved ${app.display_name || 'user'} as Contributor!`
    showToast.value = true
    
    // Refresh list
    await fetchApplications()
  } catch (err) {
    console.error('Failed to approve contributor:', err)
  }
}

async function handleReject(app: ContributorApplication) {
  try {
    const { error } = await supabase
      .from('contributor_applications')
      .update({ status: 'rejected' })
      .eq('id', app.id)

    if (error) throw error

    toastMsg.value = `Rejected contributor application.`
    showToast.value = true

    // Refresh list
    await fetchApplications()
  } catch (err) {
    console.error('Failed to reject contributor:', err)
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  fetchApplications()
})
</script>

<style scoped>
.app-card {
  border-left: 4px solid var(--ion-color-carrot) !important;
}
.empty-state {
  margin-top: 100px;
}
</style>
