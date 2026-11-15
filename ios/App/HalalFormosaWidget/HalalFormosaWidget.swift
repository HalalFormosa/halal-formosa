import SwiftUI
import WidgetKit

// Must match the key names written by WidgetSyncPlugin.swift in the app target.
private enum Shared {
    static let appGroup = "group.com.rcreative.halalformosa"
    static let loggedIn = "widget_logged_in"
    static let scansRemaining = "widget_scans_remaining"
    static let prayerKeys = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
    static func prayerKey(_ name: String) -> String { "widget_prayer_\(name)" }
}

private let prayerNames = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
private let accent = Color(light: 0xF97316, dark: 0xFDBA74)

// MARK: - Entry

struct HalalEntry: TimelineEntry {
    let date: Date
    let loggedIn: Bool
    let scansRemaining: String   // "" = unknown, "∞" = unlimited, else a number
    let prayers: [String]        // "HH:mm" x5, empty until the app has synced
    let nextPrayer: Int          // index into prayers; 0 after Isha (tomorrow's Fajr)

    static let placeholder = HalalEntry(
        date: Date(), loggedIn: true, scansRemaining: "3",
        prayers: ["05:12", "12:04", "15:28", "17:51", "19:08"], nextPrayer: 2
    )
}

private func minutes(_ hhmm: String) -> Int? {
    let parts = hhmm.split(separator: ":")
    guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
    return h * 60 + m
}

// MARK: - Provider

struct HalalProvider: TimelineProvider {
    func placeholder(in context: Context) -> HalalEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (HalalEntry) -> Void) {
        completion(context.isPreview ? .placeholder : makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HalalEntry>) -> Void) {
        let now = Date()
        var entries = [makeEntry(at: now)]

        // One entry per remaining prayer today so the highlighted "next prayer" moves on its own.
        let cal = Calendar.current
        let startOfDay = cal.startOfDay(for: now)
        for key in Shared.prayerKeys {
            guard let hhmm = defaults?.string(forKey: Shared.prayerKey(key)),
                  let mins = minutes(hhmm),
                  let at = cal.date(byAdding: .minute, value: mins, to: startOfDay),
                  at > now else { continue }
            entries.append(makeEntry(at: at))
        }

        // Refresh after midnight too; the app will usually push fresh times sooner.
        let nextMidnight = cal.date(byAdding: .day, value: 1, to: startOfDay) ?? now.addingTimeInterval(3600 * 6)
        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }

    private var defaults: UserDefaults? { UserDefaults(suiteName: Shared.appGroup) }

    private func makeEntry(at date: Date) -> HalalEntry {
        let d = defaults
        let prayers = Shared.prayerKeys.map { d?.string(forKey: Shared.prayerKey($0)) ?? "" }
        let valid = prayers.allSatisfy { minutes($0) != nil }

        var next = 0
        if valid {
            let cal = Calendar.current
            let nowMin = cal.component(.hour, from: date) * 60 + cal.component(.minute, from: date)
            next = prayers.firstIndex { (minutes($0) ?? 0) > nowMin } ?? 0
        }

        return HalalEntry(
            date: date,
            loggedIn: d?.string(forKey: Shared.loggedIn) == "1",
            scansRemaining: d?.string(forKey: Shared.scansRemaining) ?? "",
            prayers: valid ? prayers : [],
            nextPrayer: next
        )
    }
}

// MARK: - Views

private struct ActionButton: View {
    let url: String
    let symbol: String
    let title: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 20, weight: .semibold)).foregroundStyle(accent)
                Text(title).font(.system(size: 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}

private struct ActionRow: View {
    var body: some View {
        HStack(spacing: 8) {
            ActionButton(url: "myapp://scan/auto", symbol: "camera.viewfinder", title: "Scan food")
            ActionButton(url: "myapp://scan/barcode", symbol: "barcode.viewfinder", title: "Barcode")
            ActionButton(url: "myapp://explore", symbol: "map", title: "Explore")
        }
    }
}

private struct QuotaText: View {
    let entry: HalalEntry

    var body: some View {
        let (text, color): (String, Color) = {
            if !entry.loggedIn { return ("Log in to start scanning", .secondary) }
            if entry.scansRemaining == "∞" { return ("Unlimited scans", accent) }
            if !entry.scansRemaining.isEmpty { return ("\(entry.scansRemaining) scans left today", accent) }
            return ("Open the app to see your scans", .secondary)
        }()
        Text(text).font(.system(size: 12, weight: .semibold)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.8)
    }
}

private struct PrayerStrip: View {
    let entry: HalalEntry

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<5, id: \.self) { i in
                let isNext = i == entry.nextPrayer
                VStack(spacing: 1) {
                    Text(prayerNames[i]).font(.system(size: 9)).foregroundStyle(isNext ? accent : .secondary)
                    Text(entry.prayers[i]).font(.system(size: 11, weight: .bold)).foregroundStyle(isNext ? accent : .primary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct SmallView: View {
    let entry: HalalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if entry.prayers.isEmpty {
                Text("Halal Formosa").font(.system(size: 13, weight: .bold)).foregroundStyle(accent)
                QuotaText(entry: entry)
            } else {
                Text("Next prayer").font(.system(size: 10)).foregroundStyle(.secondary)
                Text(prayerNames[entry.nextPrayer]).font(.system(size: 15, weight: .bold)).foregroundStyle(accent)
                Text(entry.prayers[entry.nextPrayer]).font(.system(size: 26, weight: .bold))
            }
            Spacer(minLength: 0)
            ActionButton(url: "myapp://scan/auto", symbol: "camera.viewfinder", title: "Scan food")
                .frame(height: 48)
        }
    }
}

private struct MediumView: View {
    let entry: HalalEntry

    var body: some View {
        VStack(spacing: 8) {
            ActionRow()
            QuotaText(entry: entry)
            if !entry.prayers.isEmpty { PrayerStrip(entry: entry) }
        }
    }
}

private struct LargeView: View {
    let entry: HalalEntry

    var body: some View {
        VStack(spacing: 12) {
            Text("Halal Formosa").font(.system(size: 16, weight: .bold)).foregroundStyle(accent)
                .frame(maxWidth: .infinity, alignment: .leading)
            ActionRow()
            QuotaText(entry: entry)
            if !entry.prayers.isEmpty {
                Divider()
                PrayerStrip(entry: entry)
            }
        }
    }
}

struct HalalWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: HalalEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall: SmallView(entry: entry)
            case .systemLarge: LargeView(entry: entry)
            default: MediumView(entry: entry)
            }
        }
        .widgetBackground(Color(light: 0xFFFFFF, dark: 0x1E1E1E))
    }
}

private extension View {
    // containerBackground is iOS 17+; older systems need a plain background plus padding.
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            padding().background(color)
        }
    }
}

// MARK: - Widget

struct HalalFormosaWidget: Widget {
    let kind = "HalalFormosaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HalalProvider()) { entry in
            HalalWidgetView(entry: entry)
        }
        .configurationDisplayName("Halal Formosa")
        .description("Scan food, scan a barcode, explore the map, and see prayer times.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct HalalFormosaWidgetBundle: WidgetBundle {
    var body: some Widget { HalalFormosaWidget() }
}

private extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}
