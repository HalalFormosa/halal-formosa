import Foundation
import Capacitor
import WidgetKit

// iOS counterpart of WidgetSyncPlugin.java. The web layer passes the widget state
// directly; it's stored in the shared App Group so the widget extension can read it.
@objc(WidgetSyncPlugin)
public class WidgetSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetSyncPlugin"
    public let jsName = "WidgetSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    private static let appGroup = "group.com.rcreative.halalformosa"

    // Accepts any subset of: loggedIn ("1"/"0"), scansRemaining, fajr, dhuhr, asr, maghrib, isha.
    @objc func update(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group \(Self.appGroup) is not available")
            return
        }

        if let v = call.getString("loggedIn") { defaults.set(v, forKey: "widget_logged_in") }
        if let v = call.getString("scansRemaining") { defaults.set(v, forKey: "widget_scans_remaining") }
        for key in ["fajr", "dhuhr", "asr", "maghrib", "isha"] {
            if let v = call.getString(key) { defaults.set(v, forKey: "widget_prayer_\(key)") }
        }

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
