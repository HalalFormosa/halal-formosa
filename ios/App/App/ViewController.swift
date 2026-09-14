import Capacitor

// Capacitor's automatic CAPBridgedPlugin discovery isn't picking up
// RecaptchaNativePlugin in Release/Archive builds (it works fine for plugins
// shipped as their own CocoaPod, but not reliably for a plugin's Swift file
// compiled directly into the App target) — surfaced on-device as "RecaptchaNative
// plugin is not implemented on iOS". Registering it explicitly here matches
// what MainActivity.java already does for the Android plugin.
class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecaptchaNativePlugin())
    }
}
