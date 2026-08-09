// MoodyWidget.swift — iOS home-screen widgets for Moody (3 focused widgets).
// Reads the summary the app writes into the shared App Group and renders it.
// After creating the Widget Extension in Xcode, REPLACE the generated
// `MoodyWidget.swift` with this file. The @main lives in MoodyWidgetBundle.swift.
// The App Group below must match the one enabled on BOTH the app and this target.

import WidgetKit
import SwiftUI

// MARK: - Shared config
let APP_GROUP = "group.tech.stariax.moodyapp"
let WIDGET_KEY = "moody_widget"

// MARK: - Data model (matches lib/widget.ts WidgetData)
struct MoodyData: Codable {
    var mood: Double?
    var moodLabel: String
    var moodStreak: Int
    var medStatus: String     // none | done | overdue | next
    var medPrimary: String
    var medSecondary: String
    var medTaken: Int
    var medTotal: Int
    var adherence: Int        // 0..100, or -1 if no data
    var tip: String
    var tipEvening: Bool
}

func loadMoodyData() -> MoodyData {
    let fallback = MoodyData(mood: nil, moodLabel: "Pas encore noté", moodStreak: 0,
                             medStatus: "none", medPrimary: "Aucun médicament", medSecondary: "",
                             medTaken: 0, medTotal: 0, adherence: -1,
                             tip: "Prends un instant pour toi.", tipEvening: false)
    guard let ud = UserDefaults(suiteName: APP_GROUP),
          let raw = ud.string(forKey: WIDGET_KEY),
          let data = raw.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(MoodyData.self, from: data)
    else { return fallback }
    return decoded
}

// MARK: - Timeline
struct MoodyEntry: TimelineEntry { let date: Date; let data: MoodyData }

struct MoodyProvider: TimelineProvider {
    func placeholder(in c: Context) -> MoodyEntry { MoodyEntry(date: Date(), data: loadMoodyData()) }
    func getSnapshot(in c: Context, completion: @escaping (MoodyEntry) -> Void) {
        completion(MoodyEntry(date: Date(), data: loadMoodyData()))
    }
    func getTimeline(in c: Context, completion: @escaping (Timeline<MoodyEntry>) -> Void) {
        let e = MoodyEntry(date: Date(), data: loadMoodyData())
        let next = Calendar.current.date(byAdding: .minute, value: 20, to: Date()) ?? Date().addingTimeInterval(1200)
        completion(Timeline(entries: [e], policy: .after(next)))
    }
}

// MARK: - Style
extension Color {
    init(hx: String) {
        let s = Scanner(string: hx); var v: UInt64 = 0; s.scanHexInt64(&v)
        self.init(.sRGB, red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255, opacity: 1)
    }
}
let mGreen = Color(hx: "1aad55"), mInk = Color(hx: "16211b"), mCream = Color(hx: "eef2ec")
let mOrange = Color(hx: "c8622f"), mRed = Color(hx: "d0492c")

func medColor(_ s: String) -> Color {
    switch s { case "overdue": return mRed; case "done": return mGreen; case "none": return mInk.opacity(0.45); default: return mOrange }
}

extension View {
    // iOS 17+ needs containerBackground; older versions use a plain background.
    @ViewBuilder func mBg(_ c: Color) -> some View {
        if #available(iOS 17.0, *) { self.containerBackground(c, for: .widget) } else { self.background(c) }
    }
}

struct MProgress: View {
    let taken: Int; let total: Int
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(mInk.opacity(0.08))
                Capsule().fill(mGreen).frame(width: total > 0 ? g.size.width * CGFloat(taken) / CGFloat(total) : 0)
            }
        }.frame(height: 6)
    }
}

func header(_ icon: String, _ title: String, _ color: Color) -> some View {
    HStack(spacing: 5) {
        Image(systemName: icon).font(.system(size: 12))
        Text(title).font(.system(size: 12, weight: .bold))
    }.foregroundColor(color)
}

// MARK: - Views
struct MedsView: View {
    let d: MoodyData
    var medium: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: medium ? 8 : 6) {
            HStack {
                header("pills.fill", "Médicaments", mOrange)
                if medium && d.adherence >= 0 { Spacer(); Text("\(d.adherence)%").font(.system(size: 12, weight: .bold)).foregroundColor(mGreen) }
            }
            Spacer(minLength: 2)
            HStack(spacing: 8) {
                Circle().fill(medColor(d.medStatus)).frame(width: 9, height: 9)
                VStack(alignment: .leading, spacing: 1) {
                    Text(d.medPrimary).font(.system(size: medium ? 19 : 16, weight: .bold)).foregroundColor(mInk).lineLimit(1).minimumScaleFactor(0.8)
                    if !d.medSecondary.isEmpty {
                        Text(d.medSecondary).font(.system(size: 12, weight: .semibold)).foregroundColor(medColor(d.medStatus)).lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 4)
            if d.medTotal > 0 {
                MProgress(taken: d.medTaken, total: d.medTotal)
                Text("\(d.medTaken)/\(d.medTotal) aujourd'hui").font(.system(size: 11, weight: .semibold)).foregroundColor(mInk.opacity(0.6))
            }
        }
        .padding(medium ? 16 : 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .mBg(mCream)
    }
}

struct MoodView: View {
    let d: MoodyData
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            header("face.smiling", "Humeur", mGreen)
            Spacer(minLength: 2)
            Text(d.mood != nil ? String(format: "%.1f", d.mood!) : "—").font(.system(size: 38, weight: .bold)).foregroundColor(mInk)
            Text(d.moodLabel).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
            Spacer(minLength: 4)
            if d.moodStreak > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill").font(.system(size: 11)).foregroundColor(mOrange)
                    Text("\(d.moodStreak) j de suite").font(.system(size: 11, weight: .semibold)).foregroundColor(mInk.opacity(0.6))
                }
            } else {
                Text("Note ton humeur").font(.system(size: 11, weight: .bold)).foregroundColor(mGreen)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .mBg(mCream)
    }
}

struct TodayView: View {
    let d: MoodyData
    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("MOODY").font(.system(size: 12, weight: .heavy)).foregroundColor(mGreen)
                Spacer(minLength: 2)
                Text(d.mood != nil ? String(format: "%.1f", d.mood!) : "—").font(.system(size: 42, weight: .bold)).foregroundColor(mInk)
                Text(d.moodLabel).font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
                if d.moodStreak > 0 {
                    HStack(spacing: 3) { Image(systemName: "flame.fill").font(.system(size: 10)); Text("\(d.moodStreak) j").font(.system(size: 11, weight: .semibold)) }.foregroundColor(mOrange)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            VStack(alignment: .leading, spacing: 5) {
                header("pills.fill", "Médicaments", mOrange)
                HStack(spacing: 6) {
                    Circle().fill(medColor(d.medStatus)).frame(width: 8, height: 8)
                    Text(d.medPrimary).font(.system(size: 15, weight: .bold)).foregroundColor(mInk).lineLimit(1).minimumScaleFactor(0.8)
                }
                if !d.medSecondary.isEmpty {
                    Text(d.medSecondary).font(.system(size: 11, weight: .semibold)).foregroundColor(medColor(d.medStatus)).lineLimit(1)
                }
                if d.medTotal > 0 {
                    MProgress(taken: d.medTaken, total: d.medTotal)
                    Text("\(d.medTaken)/\(d.medTotal) aujourd'hui").font(.system(size: 10, weight: .semibold)).foregroundColor(mInk.opacity(0.6))
                }
                if d.adherence >= 0 {
                    Text("Observance \(d.adherence)%").font(.system(size: 11, weight: .semibold)).foregroundColor(mGreen)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .mBg(mCream)
    }
}

// MARK: - Widgets (no @main here — see MoodyWidgetBundle.swift)
struct MedsEntryView: View {
    var entry: MoodyEntry
    @Environment(\.widgetFamily) var fam
    var body: some View { MedsView(d: entry.data, medium: fam == .systemMedium) }
}

struct MoodyMedsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyMeds", provider: MoodyProvider()) { e in MedsEntryView(entry: e) }
            .configurationDisplayName("Médicaments")
            .description("Prochaine prise et progression du jour.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct MoodyMoodWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyMood", provider: MoodyProvider()) { e in MoodView(d: e.data) }
            .configurationDisplayName("Humeur")
            .description("Ton humeur du jour et ta série.")
            .supportedFamilies([.systemSmall])
    }
}

struct MoodyTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyToday", provider: MoodyProvider()) { e in TodayView(d: e.data) }
            .configurationDisplayName("Aujourd'hui")
            .description("Humeur + médicaments en un coup d'œil.")
            .supportedFamilies([.systemMedium])
    }
}

// MARK: - Check-in "Comment vas-tu ?"
struct CheckinView: View {
    let d: MoodyData
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            header("face.smiling", "Moody", mGreen)
            Spacer(minLength: 2)
            if let m = d.mood {
                Text(String(format: "%.1f", m)).font(.system(size: 40, weight: .bold)).foregroundColor(mInk)
                Text(d.moodLabel).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
                Spacer(minLength: 2)
                Text("Toucher pour mettre à jour").font(.system(size: 11, weight: .semibold)).foregroundColor(mGreen)
            } else {
                Text("Comment vas-tu ?").font(.system(size: 21, weight: .bold)).foregroundColor(mInk).lineLimit(2)
                Spacer(minLength: 4)
                Text("Noter mon humeur").font(.system(size: 12, weight: .bold)).foregroundColor(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Capsule().fill(mGreen))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .mBg(mCream)
    }
}

struct MoodyCheckinWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyCheckin", provider: MoodyProvider()) { e in
            CheckinView(d: e.data).widgetURL(URL(string: "moody://mood"))
        }
        .configurationDisplayName("Comment vas-tu ?")
        .description("Note ton humeur en un tap.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Conseil du jour / du soir
struct TipView: View {
    let d: MoodyData
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header(d.tipEvening ? "moon.fill" : "sun.max.fill",
                   d.tipEvening ? "Conseil du soir" : "Conseil du jour",
                   d.tipEvening ? Color(hx: "6b4fb0") : Color(hx: "a9821f"))
            Spacer(minLength: 2)
            Text(d.tip).font(.system(size: 15, weight: .semibold)).foregroundColor(mInk).lineLimit(5).minimumScaleFactor(0.85)
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .mBg(d.tipEvening ? Color(hx: "e7e3f5") : Color(hx: "f6ecc9"))
    }
}

struct MoodyTipWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyTip", provider: MoodyProvider()) { e in TipView(d: e.data) }
            .configurationDisplayName("Conseil")
            .description("Une astuce bien-être chaque jour.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Lock-screen widgets (iOS 16+)
@available(iOS 16.0, *)
struct LockView: View {
    let d: MoodyData
    @Environment(\.widgetFamily) var fam
    var body: some View {
        switch fam {
        case .accessoryInline:
            Text(d.mood != nil ? "Humeur \(String(format: "%.0f", d.mood!))/10" : "Note ton humeur")
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "heart.fill").font(.system(size: 11))
                    Text(d.mood != nil ? String(format: "%.0f", d.mood!) : "—").font(.system(size: 16, weight: .bold))
                }
            }
        default: // accessoryRectangular
            VStack(alignment: .leading, spacing: 2) {
                Text("Moody").font(.system(size: 12, weight: .bold))
                Text(d.mood != nil ? "Humeur \(String(format: "%.1f", d.mood!)) · \(d.moodLabel)" : "Comment vas-tu ?").font(.system(size: 13)).lineLimit(1)
                Text(d.medStatus == "done" ? "Médicaments : tout est pris" : d.medPrimary).font(.system(size: 12)).lineLimit(1)
            }
        }
    }
}

@available(iOS 16.0, *)
struct MoodyLockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoodyLock", provider: MoodyProvider()) { e in
            LockView(d: e.data).widgetURL(URL(string: "moody://mood"))
        }
        .configurationDisplayName("Moody (verrouillé)")
        .description("Humeur & médicaments sur l'écran verrouillé.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
