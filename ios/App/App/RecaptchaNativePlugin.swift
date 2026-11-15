import Foundation
import Capacitor
import RecaptchaEnterprise

// Bridges the native reCAPTCHA Enterprise iOS SDK to the web layer.
// Mirrors RecaptchaNativePlugin.kt on Android — the web JS SDK (grecaptcha.enterprise)
// doesn't produce valid tokens from inside a Capacitor WebView, since its site key
// is registered for real web origins only.
@objc(RecaptchaNativePlugin)
public class RecaptchaNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecaptchaNativePlugin"
    public let jsName = "RecaptchaNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "execute", returnType: CAPPluginReturnPromise)
    ]

    private var recaptchaClient: RecaptchaClient?

    @objc func execute(_ call: CAPPluginCall) {
        guard let siteKey = call.getString("siteKey"), !siteKey.isEmpty else {
            call.reject("siteKey is required")
            return
        }
        guard let actionName = call.getString("action"), !actionName.isEmpty else {
            call.reject("action is required")
            return
        }

        Task {
            do {
                let client: RecaptchaClient
                if let existing = recaptchaClient {
                    client = existing
                } else {
                    client = try await Recaptcha.fetchClient(withSiteKey: siteKey)
                    recaptchaClient = client
                }

                let token = try await client.execute(withAction: RecaptchaAction(customAction: actionName))
                call.resolve(["token": token])
            } catch let error as RecaptchaError {
                call.reject(error.errorMessage)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
