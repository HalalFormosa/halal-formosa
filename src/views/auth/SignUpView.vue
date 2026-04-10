<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign Up Now</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="signup">
        <ion-item>
          <ion-input
              label="Email"
              label-placement="floating"
              placeholder="Enter email"
              type="email"
              v-model="email"
              required
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-input
              label="Password"
              label-placement="floating"
              placeholder="Enter password"
              type="password"
              v-model="password"
              required
          >
            <ion-input-password-toggle slot="end" />
          </ion-input>
        </ion-item>

        <ion-button
            type="submit"
            expand="block"
            :disabled="loading"
            class="ion-margin-top"
        >
          {{ loading ? 'Creating account...' : 'Sign Up' }}
        </ion-button>

        <ion-text color="danger" v-if="errorMsg" class="ion-padding">
          {{ errorMsg }}
        </ion-text>
      </form>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonPage,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonInput,
  IonButton,
  IonText,
  IonItem,
  IonInputPasswordToggle
} from '@ionic/vue';
import { defineComponent } from 'vue';

export default defineComponent({
  components: {
    IonPage,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonInput,
    IonButton,
    IonText,
    IonItem,
    IonInputPasswordToggle
  },
});
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient' // adjust path if needed
import { ActivityLogService } from '@/services/ActivityLogService'

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
const router = useRouter()

async function signup() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
    })

    if (error) {
      errorMsg.value = error.message
      console.error('Signup error:', error)
      ActivityLogService.log('auth_signup_failed', { error_message: error.message })
    } else {
      // Success, redirect or notify user
      ActivityLogService.log('auth_signup_success')
      router.push('/login')
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Unexpected error'
    console.error('Unexpected signup error:', err)
    ActivityLogService.log('auth_signup_failed', { error_message: err.message || 'Unexpected' })
  } finally {
    loading.value = false
  }
}
</script>
