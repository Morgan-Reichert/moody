// MoodyWidget.swift — iOS home-screen widget for Moody.
// Reads the summary the app writes into the shared App Group and renders it.
// After creating the Widget Extension target in Xcode, REPLACE the generated
// file's contents with this, and make sure the App Group below matches the one
// enabled on BOTH the app target and this widget target.

import WidgetKit
import SwiftUI

// MARK: - Shared config
let APP_GROUP = "group.tech.stariax.moodyapp"
let WIDGET_KEY = "moody_widget"

// MARK: - Data model (matches lib/widget.ts WidgetData)
struct MoodyData: Codable {
    var mood: Double?
    var moodLabel: String
    var medLabel: String
    var medState: String   // "done" | "overdue" | "next" | "none"
    var adherence: Int     // 0..100, or -1 if no data
    var brush: String      // "1/2" or ""
    var water: String      // "0,50 L" or ""
}

func loadMoodyData() -> MoodyData {
    let fallback = MoodyData(mood: nil, moodLabel: "Pas encore noté", medLabel: "Aucun médicament",
                             medState: "none", adherence: -1, brush: "", water: "")
    guard let ud = UserDefaults(suiteName: APP_GROUP),
          let raw = ud.string(forKey: WIDGET_KEY),
          let data = raw.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(MoodyData.self, from: data)
    else { return fallback }
    return decoded
}

// MARK: - Timeline
struct MoodyEntry: TimelineEntry {
    let date: Date
    let data: MoodyData
}

struct MoodyProvider: TimelineProvider {
    func placeholder(in context: Context) -> MoodyEntry { MoodyEntry(date: Date(), data: loadMoodyData()) }
    func getSnapshot(in context: Context, completion: @escaping (MoodyEntry) -> Void) {
        completion(MoodyEntry(date: Date(), data: loadMoodyData()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MoodyEntry>) -> Void) {
        let entry = MoodyEntry(date: Date(), data: loadMoodyData())
        // Fallback refresh in ~30 min (the app also reloads the widget on every data change).
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Colors
extension Color {
    init(hexString: String) {
        let s = Scanner(string: hexString.replacingOccurrences(of: "#", with: ""))
        var rgb: UInt64 = 0; s.scanHexInt64(&rgb)
        self.init(.sRGB,
                  red: Double((rgb >> 16) & 0xFF) / 255,
                  green: Double((rgb >> 8) & 0xFF) / 255,
                  blue: Double(rgb & 0xFF) / 255, opacity: 1)
    }
}
let moodyGreen = Color(hexString: "1aad55")
let moodyInk = Color(hexString: "16211b")
let moodyCream = Color(hexString: "eef2ec")

func medColor(_ s: String) -> Color {
    switch s {
    case "overdue": return Color(hexString: "d0492c")
    case "done": return moodyGreen
    default: return moodyInk.opacity(0.7)
    }
}

// iOS 17+ needs containerBackground; older versions use a plain background.
extension View {
    @ViewBuilder func moodyBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) { self.containerBackground(color, for: .widget) }
        else { self.background(color) }
    }
}

// MARK: - Views
struct SmallView: View {
    let d: MoodyData
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Moody").font(.system(size: 13, weight: .heavy)).foregroundColor(moodyGreen)
            Spacer(minLength: 2)
            Text(d.mood != nil ? String(format: "%.1f", d.mood!) : "—")
                .font(.system(size: 36, weight: .bold)).foregroundColor(moodyInk)
            Text(d.moodLabel).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
            Spacer(minLength: 4)
            HStack(spacing: 4) {
                Image(systemName: "pills.fill").font(.system(size: 11))
                Text(d.medLabel).font(.system(size: 11, weight: .medium)).lineLimit(1)
            }.foregroundColor(medColor(d.medState))
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .moodyBackground(moodyCream)
    }
}

struct MediumView: View {
    let d: MoodyData
    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Moody").font(.system(size: 13, weight: .heavy)).foregroundColor(moodyGreen)
                Spacer()
                Text(d.mood != nil ? String(format: "%.1f", d.mood!) : "—")
                    .font(.system(size: 40, weight: .bold)).foregroundColor(moodyInk)
                Text(d.moodLabel).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 9) {
                row(icon: "pills.fill", text: d.medLabel, color: medColor(d.medState))
                if d.adherence >= 0 { row(icon: "checkmark.seal.fill", text: "Observance \(d.adherence)%", color: moodyInk.opacity(0.8)) }
                if !d.brush.isEmpty { row(icon: "sparkles", text: "Brossage \(d.brush)", color: moodyInk.opacity(0.8)) }
                if !d.water.isEmpty { row(icon: "drop.fill", text: d.water, color: Color(hexString: "3aa7d6")) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .moodyBackground(moodyCream)
    }

    func row(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 12)).frame(width: 16)
            Text(text).font(.system(size: 13, weight: .semibold)).lineLimit(1)
        }.foregroundColor(color)
    }
}

struct MoodyWidgetEntryView: View {
    var entry: MoodyEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .systemSmall: SmallView(d: entry.data)
        default: MediumView(d: entry.data)
        }
    }
}

// MARK: - Widget
// NOTE: pas de @main ici — c'est le fichier généré `MoodyWidgetBundle.swift`
// (créé par Xcode avec l'extension) qui porte @main et référence MoodyWidget().
// Il ne doit y avoir QU'UN SEUL @main dans la cible widget.
struct MoodyWidget: Widget {
    let kind = "MoodyWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MoodyProvider()) { entry in
            MoodyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Moody")
        .description("Ton humeur et tes rappels en un coup d'œil.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
