package com.rcreative.halalformosa

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.recaptcha.Recaptcha
import com.google.android.recaptcha.RecaptchaAction
import com.google.android.recaptcha.RecaptchaClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// Bridges the native reCAPTCHA Enterprise Android SDK to the web layer.
// The web JS SDK (grecaptcha.enterprise) doesn't produce valid tokens from inside
// a Capacitor WebView, since its site key is registered for real web origins only.
@CapacitorPlugin(name = "RecaptchaNative")
class RecaptchaNativePlugin : Plugin() {

    private var client: RecaptchaClient? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    @PluginMethod
    fun execute(call: PluginCall) {
        val siteKey = call.getString("siteKey")
        val actionName = call.getString("action")

        if (siteKey.isNullOrBlank()) {
            call.reject("siteKey is required")
            return
        }
        if (actionName.isNullOrBlank()) {
            call.reject("action is required")
            return
        }

        scope.launch {
            try {
                val recaptchaClient = client ?: Recaptcha.fetchClient(
                    activity.application,
                    siteKey
                ).also { client = it }

                recaptchaClient.execute(RecaptchaAction.custom(actionName))
                    .onSuccess { token ->
                        val result = JSObject()
                        result.put("token", token)
                        call.resolve(result)
                    }
                    .onFailure { exception ->
                        call.reject(exception.message ?: "reCAPTCHA execution failed", Exception(exception))
                    }
            } catch (e: Exception) {
                call.reject(e.message ?: "reCAPTCHA client initialization failed", e)
            }
        }
    }
}
