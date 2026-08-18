// Moody — app native SwiftUI
// Design « moodboard pastel » : fond gris perle, cartes blanches, pastels,
// CTA noirs, jauges bleues. Les données de l'ancienne app (WebView) sont
// migrées automatiquement au premier lancement.

import SwiftUI
import Charts
import AVFoundation
import UserNotifications
import SQLite3
import CoreImage.CIFilterBuiltins

// MARK: - Palette

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255)
    }
    static let cream = Color(hex: 0xF2F3F6)
    static let inkC = Color(hex: 0x141519)
    static let inkSoft = Color(hex: 0x5D6169)
    static let inkMute = Color(hex: 0x989CA6)
    static let mint = Color(hex: 0xDAF4C4)
    static let peachC = Color(hex: 0xFFD9E7)
    static let lilacC = Color(hex: 0xC9D8FF)
    static let butterC = Color(hex: 0xFFEEC2)
    static let brand = Color(hex: 0x55BE3C)
    static let brand700 = Color(hex: 0x357C27)
    static let brand800 = Color(hex: 0x2C6222)
    static let accentBlue = Color(hex: 0x477BFF)
    static let accentDeep = Color(hex: 0x2F5FE0)
    static let accentSoft = Color(hex: 0xDFE8FF)
    static let rose = Color(hex: 0xD4487E)
}

// MARK: - Modèles (mêmes clés JSON que la version web → zéro perte)

struct Slot: Codable, Hashable {
    var time: String
    var days: [Int]           // 0 = dimanche … 6 = samedi (convention JS conservée)
}

struct Workout: Codable, Hashable, Identifiable {
    var id: String = UUID().uuidString.lowercased()
    var sport: String
    var start: String         // "18:00"
    var end: String           // "19:15"
    var minutes: Int { max(0, Dates.minutes(of: end) - Dates.minutes(of: start)) }
}

struct MoodEntry: Codable, Identifiable {
    var id: String
    var datetime: String      // ISO 8601
    var date: String          // yyyy-MM-dd
    var mood: Double
    var energy: Double?
    var appetite: Double?
    var sleep: Double?
    var sport: Double?
    var note: String?
    var symptoms: [String]?
    var symptomIntensity: Double?
    var symptomNote: String?
    var symptomAdvice: String?
    // v2 — suivi complet
    var bedTime: String?      // coucher (la veille)
    var wakeTime: String?     // lever
    var napMinutes: Double?   // sieste
    var workouts: [Workout]?  // séances détaillées
    var sexualActivity: Bool?
    var menstruation: Double? // 0 non · 1 léger · 2 moyen · 3 abondant
    var spending: Double?     // dépenses du jour (€)
}

struct MedHighlights: Codable, Hashable {
    var molecule: String?
    var classe: String?
    var risques: [String]?
    var effets: [String]?
    var conseils: [String]?
}

struct SideEffect: Codable, Hashable {
    var date: String
    var text: String
}

struct Medication: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var dose: String?
    var slots: [Slot]
    var barcode: String?
    var highlights: MedHighlights?
    var sideEffects: [SideEffect]?
}

struct Settings: Codable {
    var moodSlots: [Slot] = [Slot(time: "09:00", days: Array(0...6)), Slot(time: "20:00", days: Array(0...6))]
    var loudAlarm: Bool = false
    var scanToDismiss: Bool? = nil
    var snoozeMinutes: Double = 10
    var notifications: Bool = false
    var modules: [String] = []
    var name: String?
    var mantra: String?
    var weather: Bool?
    var country: String?
    var pinEnabled: Bool?
    var pinHash: String?
    var pinSalt: String?
    var faceId: Bool?
    var faceCredId: String?
    var dashOrder: [String]?
    var hiddenCards: [String]?
    var onboarded: Bool?
    // v2 — profil santé
    var antecedents: String?
    var knownConditions: String?
}

// MARK: - Dates utilitaires

enum Dates {
    static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    static func dayKey(_ d: Date = Date()) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }
    static func jsWeekday(_ d: Date = Date()) -> Int {
        Calendar.current.component(.weekday, from: d) - 1   // 1…7 → 0…6
    }
    static func minutes(of time: String) -> Int {
        let p = time.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? p[0] * 60 + p[1] : 0
    }
    static func hhmm(_ d: Date) -> String {
        let c = Calendar.current
        return String(format: "%02d:%02d", c.component(.hour, from: d), c.component(.minute, from: d))
    }
    static func date(fromHHMM t: String) -> Date {
        let p = t.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: p.first ?? 0, minute: p.count > 1 ? p[1] : 0, second: 0, of: Date()) ?? Date()
    }
    /// Durée de sommeil (h) entre coucher la veille et lever.
    static func sleepHours(bed: String, wake: String) -> Double {
        let b = minutes(of: bed), w = minutes(of: wake)
        let mins = b <= w ? w - b : (1440 - b) + w
        return (Double(mins) / 60 * 2).rounded() / 2
    }
}

// MARK: - Store

final class Store: ObservableObject {
    @Published var entries: [MoodEntry] = []
    @Published var meds: [Medication] = []
    @Published var settings = Settings()
    @Published var intake: [String: Double] = [:]   // "date|medId|time" → ms

    private let ud = UserDefaults.standard
    private let enc: JSONEncoder = { let e = JSONEncoder(); return e }()
    private let dec = JSONDecoder()

    init() {
        migrateFromWebViewIfNeeded()
        load()
    }

    // — persistance : mêmes clés que le web (moody_*) pour rester compatible —
    private func load() {
        entries = decode("moody_mood") ?? []
        meds = decode("moody_meds") ?? []
        settings = decode("moody_settings") ?? Settings()
        intake = decode("moody_intake") ?? [:]
        entries.sort { $0.datetime < $1.datetime }
    }
    private func decode<T: Decodable>(_ key: String) -> T? {
        guard let s = ud.string(forKey: key), let d = s.data(using: .utf8) else { return nil }
        return try? dec.decode(T.self, from: d)
    }
    private func save<T: Encodable>(_ v: T, _ key: String) {
        if let d = try? enc.encode(v), let s = String(data: d, encoding: .utf8) { ud.set(s, forKey: key) }
    }
    func persist() {
        save(entries, "moody_mood"); save(meds, "moody_meds")
        save(settings, "moody_settings"); save(intake, "moody_intake")
    }

    // — migration : lit le localStorage de l'ancienne WebView (SQLite WebKit) —
    private func migrateFromWebViewIfNeeded() {
        guard !ud.bool(forKey: "moody_native_migrated") else { return }
        let lib = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
        let root = lib.appendingPathComponent("WebKit", isDirectory: true)
        guard let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
            ud.set(true, forKey: "moody_native_migrated"); return
        }
        var found = 0
        for case let url as URL in files where url.lastPathComponent == "localstorage.sqlite3" {
            var db: OpaquePointer?
            guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else { continue }
            defer { sqlite3_close(db) }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, "SELECT key, value FROM ItemTable", -1, &stmt, nil) == SQLITE_OK else { continue }
            defer { sqlite3_finalize(stmt) }
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let kC = sqlite3_column_text(stmt, 0) else { continue }
                let key = String(cString: kC)
                guard key.hasPrefix("moody_") || key.hasPrefix("mindscope_") else { continue }
                if let blob = sqlite3_column_blob(stmt, 1) {
                    let n = Int(sqlite3_column_bytes(stmt, 1))
                    let data = Data(bytes: blob, count: n)
                    // WebKit stocke les valeurs en UTF-16 little-endian
                    let value = String(data: data, encoding: .utf16LittleEndian) ?? String(data: data, encoding: .utf8) ?? ""
                    if !value.isEmpty {
                        let target = key.replacingOccurrences(of: "mindscope_", with: "moody_")
                        if ud.string(forKey: target) == nil { ud.set(value, forKey: target); found += 1 }
                    }
                }
            }
        }
        ud.set(true, forKey: "moody_native_migrated")
        ud.set(found, forKey: "moody_native_migrated_count")
    }

    // — humeur —
    func addEntry(_ e: MoodEntry) { entries.append(e); persist() }
    var todayEntries: [MoodEntry] { entries.filter { $0.date == Dates.dayKey() } }
    var todayAvg: Double? {
        let t = todayEntries; guard !t.isEmpty else { return nil }
        return t.map(\.mood).reduce(0, +) / Double(t.count)
    }
    func average(days: Int) -> Double? {
        guard let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) else { return nil }
        let key = Dates.dayKey(cutoff)
        let sel = entries.filter { $0.date >= key }
        guard !sel.isEmpty else { return nil }
        return sel.map(\.mood).reduce(0, +) / Double(sel.count)
    }
    var streak: Int {
        var n = 0; var d = Date()
        let has = Set(entries.map(\.date))
        if !has.contains(Dates.dayKey(d)) { d = Calendar.current.date(byAdding: .day, value: -1, to: d)! }
        while has.contains(Dates.dayKey(d)) {
            n += 1
            d = Calendar.current.date(byAdding: .day, value: -1, to: d)!
        }
        return n
    }
    func dailySeries(_ days: Int) -> [(date: Date, value: Double?)] {
        var byDay: [String: [Double]] = [:]
        for e in entries { byDay[e.date, default: []].append(e.mood) }
        var out: [(Date, Double?)] = []
        for i in stride(from: days - 1, through: 0, by: -1) {
            let d = Calendar.current.date(byAdding: .day, value: -i, to: Date())!
            let vals = byDay[Dates.dayKey(d)]
            out.append((d, vals.map { $0.reduce(0, +) / Double($0.count) }))
        }
        return out
    }
    static func moodLabel(_ v: Double) -> String {
        switch v {
        case ..<2.5: return "Très difficile"
        case ..<4.5: return "Difficile"
        case ..<6.5: return "Moyen"
        case ..<8.5: return "Plutôt bien"
        default: return "Excellent"
        }
    }

    // — médicaments —
    struct Dose: Identifiable {
        var id: String { medId + time }
        let medId: String, name: String, dose: String?, time: String
        var taken: Bool
    }
    var todayDoses: [Dose] {
        let wd = Dates.jsWeekday(); let day = Dates.dayKey()
        return meds.flatMap { m in
            m.slots.filter { $0.days.isEmpty || $0.days.contains(wd) }.map { s in
                Dose(medId: m.id, name: m.name, dose: m.dose, time: s.time,
                     taken: intake["\(day)|\(m.id)|\(s.time)"] != nil)
            }
        }.sorted { $0.time < $1.time }
    }
    func dosesFor(dayKey: String, jsWeekday: Int) -> [Dose] {
        meds.flatMap { m in
            m.slots.filter { $0.days.isEmpty || $0.days.contains(jsWeekday) }.map { s in
                Dose(medId: m.id, name: m.name, dose: m.dose, time: s.time,
                     taken: intake["\(dayKey)|\(m.id)|\(s.time)"] != nil)
            }
        }
    }
    func setTaken(_ d: Dose, _ on: Bool) {
        let key = "\(Dates.dayKey())|\(d.medId)|\(d.time)"
        if on { intake[key] = Date().timeIntervalSince1970 * 1000 } else { intake.removeValue(forKey: key) }
        persist()
    }
    var overdue: Dose? {
        let nowMin = Calendar.current.component(.hour, from: Date()) * 60 + Calendar.current.component(.minute, from: Date())
        return todayDoses.first { !$0.taken && Dates.minutes(of: $0.time) < nowMin }
    }
    var nextDose: Dose? {
        let nowMin = Calendar.current.component(.hour, from: Date()) * 60 + Calendar.current.component(.minute, from: Date())
        return todayDoses.first { !$0.taken && Dates.minutes(of: $0.time) >= nowMin }
    }

    func saveMed(_ m: Medication) {
        if let i = meds.firstIndex(where: { $0.id == m.id }) { meds[i] = m } else { meds.append(m) }
        persist(); Notifier.reschedule(store: self)
    }
    func deleteMed(_ id: String) {
        meds.removeAll { $0.id == id }; persist(); Notifier.reschedule(store: self)
    }
    func saveSettings() { persist(); Notifier.reschedule(store: self) }

    // — accueil personnalisable —
    static let allCards: [(key: String, name: String)] = [
        ("mood", "Humeur du jour"), ("stats", "Statistiques"), ("meds", "Médicaments"),
        ("chart", "Courbe 14 jours"), ("wellbeing", "Bien-être"),
    ]
    var cardOrder: [String] {
        let saved = settings.dashOrder ?? []
        let all = Self.allCards.map(\.key)
        return saved.filter { all.contains($0) } + all.filter { !saved.contains($0) }
    }
    var hiddenCards: [String] { settings.hiddenCards ?? [] }
    func moveCard(from: IndexSet, to: Int) {
        var o = cardOrder; o.move(fromOffsets: from, toOffset: to)
        settings.dashOrder = o; saveSettings()
    }
    func toggleCardHidden(_ key: String) {
        var h = hiddenCards
        if h.contains(key) { h.removeAll { $0 == key } } else { h.append(key) }
        settings.hiddenCards = h; saveSettings()
    }
}

// MARK: - Partage médecin (Supabase, même backend que le web)

enum DoctorShare {
    static let supabaseURL = "https://ygqxjqedctcjqlejreso.supabase.co"
    static var anonKey: String { (Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String) ?? "" }
    static var configured: Bool { !anonKey.isEmpty }
    static let siteOrigin = "https://mindscope.vercel.app"

    struct Payload: Encodable {
        var patientName: String?
        var sheet: Sheet
        var treatments: [Treatment]
        var symptoms: [Symptom]
        var generatedAt: String
        struct Sheet: Encodable { var conditions: String? }
        struct Treatment: Encodable { var name: String; var dose: String? }
        struct Symptom: Encodable { var date: String; var symptoms: [String]; var intensity: Double? }
    }

    static func createShare(store: Store, doctorName: String?, ttlHours: Double) async throws -> String {
        guard configured else { throw NSError(domain: "moody", code: 1, userInfo: [NSLocalizedDescriptionKey: "Service non configuré"]) }
        let token = (0..<18).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
        let cutoff = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -90, to: Date())!)
        let payload = Payload(
            patientName: store.settings.name,
            sheet: .init(conditions: [store.settings.knownConditions, store.settings.antecedents]
                .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")),
            treatments: store.meds.map { .init(name: $0.name, dose: $0.dose) },
            symptoms: store.entries.filter { $0.date >= cutoff && ($0.symptoms?.isEmpty == false) }
                .map { .init(date: $0.date, symptoms: $0.symptoms ?? [], intensity: $0.symptomIntensity) },
            generatedAt: Dates.iso.string(from: Date()))

        struct Row: Encodable {
            var token: String; var expires_at: String; var doctor_name: String?
            var guest_allowed: Bool; var payload: Payload; var pdf_urls: [String]
        }
        let row = Row(token: token,
                      expires_at: Dates.iso.string(from: Date().addingTimeInterval(ttlHours * 3600)),
                      doctor_name: doctorName, guest_allowed: doctorName == nil,
                      payload: payload, pdf_urls: [])
        var req = URLRequest(url: URL(string: "\(supabaseURL)/rest/v1/shares")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(row)
        let (_, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "moody", code: 2, userInfo: [NSLocalizedDescriptionKey: "Envoi impossible — réessaie."])
        }
        return "\(siteOrigin)/consult/?t=\(token)"
    }

    static func qrImage(for text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let out = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)) else { return nil }
        return CIContext().createCGImage(out, from: out.extent).map { UIImage(cgImage: $0) }
    }
}

// MARK: - Notifications natives

enum Notifier {
    static func requestPermission(_ done: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
            DispatchQueue.main.async { done(ok) }
        }
    }
    /// Replanifie tout : une notification répétitive par créneau.
    static func reschedule(store: Store) {
        let c = UNUserNotificationCenter.current()
        c.removeAllPendingNotificationRequests()
        guard store.settings.notifications else { return }
        var count = 0
        func schedule(id: String, title: String, body: String, time: String, days: [Int], sound: UNNotificationSound) {
            let p = time.split(separator: ":").compactMap { Int($0) }
            guard p.count == 2 else { return }
            let everyDay = days.isEmpty || days.count == 7
            let targets: [Int?] = everyDay ? [nil] : days.map { Optional($0 + 1) }   // JS 0…6 → Calendar 1…7
            for wd in targets {
                guard count < 60 else { return }                                     // limite iOS : 64 en attente
                var dc = DateComponents(); dc.hour = p[0]; dc.minute = p[1]; dc.weekday = wd
                let content = UNMutableNotificationContent()
                content.title = title; content.body = body; content.sound = sound
                let req = UNNotificationRequest(identifier: "\(id)-\(wd ?? 9)",
                                                content: content,
                                                trigger: UNCalendarNotificationTrigger(dateMatching: dc, repeats: true))
                c.add(req); count += 1
            }
        }
        let medSound: UNNotificationSound = store.settings.loudAlarm
            ? UNNotificationSound(named: UNNotificationSoundName("alarm.wav"))
            : .default
        for m in store.meds {
            for s in m.slots {
                schedule(id: "med-\(m.id)-\(s.time)", title: "Médicament — \(m.name)",
                         body: m.dose.map { "\(s.time) · \($0)" } ?? "C'est l'heure de ta prise (\(s.time)).",
                         time: s.time, days: s.days, sound: medSound)
            }
        }
        for s in store.settings.moodSlots {
            schedule(id: "mood-\(s.time)", title: "Comment te sens-tu ?",
                     body: "Prends 30 secondes pour noter ton humeur.",
                     time: s.time, days: s.days, sound: .default)
        }
    }
}

// MARK: - Alarme sonore (app ouverte)

final class AlarmPlayer: ObservableObject {
    private var player: AVAudioPlayer?
    @Published var ringing = false
    func start() {
        guard !ringing else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback)   // sonne même en silencieux
        try? AVAudioSession.sharedInstance().setActive(true)
        if let url = Bundle.main.url(forResource: "alarm", withExtension: "wav") {
            player = try? AVAudioPlayer(contentsOf: url)
            player?.numberOfLoops = -1
            player?.play()
        }
        ringing = true
    }
    func stop() {
        player?.stop(); player = nil; ringing = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

// MARK: - App

@main
struct MoodyApp: App {
    @StateObject private var store = Store()
    @StateObject private var alarm = AlarmPlayer()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(alarm)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var alarm: AlarmPlayer
    @State private var tab = 0
    @State private var alarmDose: Store.Dose?
    @State private var snoozedUntil: [String: Date] = [:]
    private let tick = Timer.publish(every: 20, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.cream.ignoresSafeArea()
            Group {
                if tab == 0 { DashboardView(onLogMood: { tab = 1 }) } else { MoodEntryView(done: { tab = 0 }) }
            }
            BottomBar(tab: $tab)
        }
        .onReceive(tick) { _ in checkAlarm() }
        .fullScreenCover(item: $alarmDose) { dose in
            AlarmOverlay(dose: dose,
                         take: { store.setTaken(dose, true); alarm.stop(); alarmDose = nil },
                         snooze: {
                             snoozedUntil[dose.id] = Date().addingTimeInterval(store.settings.snoozeMinutes * 60)
                             alarm.stop(); alarmDose = nil
                         })
        }
    }
    private func checkAlarm() {
        guard store.settings.loudAlarm, alarmDose == nil else { return }
        if let d = store.overdue, snoozedUntil[d.id].map({ $0 < Date() }) ?? true {
            alarmDose = d
            alarm.start()
        }
    }
}

// MARK: - Barre de navigation

struct BottomBar: View {
    @Binding var tab: Int
    var body: some View {
        HStack(spacing: 6) {
            navBtn(icon: "house.fill", active: tab == 0) { tab = 0 }
            Button { tab = 1 } label: {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 50, height: 50)
                    .background(Circle().fill(Color.brand))
                    .shadow(color: .brand.opacity(0.4), radius: 10, y: 5)
            }
            navBtn(icon: "face.smiling.inverse", active: tab == 1) { tab = 1 }
        }
        .padding(6)
        .background(Capsule().fill(.white.opacity(0.85)).background(.ultraThinMaterial, in: Capsule()))
        .overlay(Capsule().stroke(.white.opacity(0.7), lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 16, y: 8)
        .padding(.bottom, 8)
    }
    private func navBtn(icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(active ? .white : Color.inkMute)
                .frame(width: 46, height: 46)
                .background(Circle().fill(active ? Color.inkC : .clear))
        }
    }
}

// MARK: - Composants du design system

struct Card<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.black.opacity(0.045), lineWidth: 1))
            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
}

struct MoodRing: View {
    let value: Double?
    var body: some View {
        ZStack {
            Circle().stroke(Color.brand.opacity(0.16), lineWidth: 7)
            if let v = value {
                Circle().trim(from: 0, to: max(0.04, v / 10))
                    .stroke(Color.brand, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Text(value.map { String(format: "%.1f", $0) } ?? "—")
                .font(.system(size: 19, weight: .bold, design: .rounded))
                .foregroundStyle(Color.inkC)
        }
        .frame(width: 62, height: 62)
    }
}

// MARK: - Accueil

struct DashboardView: View {
    @EnvironmentObject var store: Store
    var onLogMood: () -> Void
    @State private var showSettings = false
    @State private var showBreathe = false
    @State private var showHelp = false
    @State private var showReport = false
    @State private var showEditHome = false

    private var hello: String {
        let h = Calendar.current.component(.hour, from: Date())
        let base = h < 6 ? "Douce nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bel après-midi" : "Bonsoir"
        if let n = store.settings.name, !n.isEmpty { return "\(base), \(n)." }
        return base + "."
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                header
                Text(hello)
                    .font(.system(size: 27, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.inkC)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let m = store.settings.mantra, !m.isEmpty {
                    Text(m).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.brand700)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(store.cardOrder.filter { !store.hiddenCards.contains($0) }, id: \.self) { key in
                    switch key {
                    case "mood": hero
                    case "stats": statsRow
                    case "meds": if !store.meds.isEmpty { MedsCard() }
                    case "chart": chartCard
                    case "wellbeing": wellbeingRow
                    default: EmptyView()
                    }
                }
                Button { showEditHome = true } label: {
                    Label("Personnaliser l'accueil", systemImage: "slider.horizontal.3")
                        .font(.system(size: 12.5, weight: .bold)).foregroundStyle(Color.inkMute)
                        .frame(maxWidth: .infinity, minHeight: 40)
                }
                Spacer(minLength: 90)
            }
            .padding(.horizontal, 18)
        }
        .sheet(isPresented: $showSettings) { SettingsSheet() }
        .sheet(isPresented: $showBreathe) { BreathingView() }
        .sheet(isPresented: $showHelp) { HelpView() }
        .sheet(isPresented: $showReport) { ReportView() }
        .sheet(isPresented: $showEditHome) { EditHomeSheet() }
    }

    private var header: some View {
        HStack {
            // le grand wordmark Moody, comme sur la version web
            Image("Wordmark").resizable().scaledToFit().frame(height: 52)
            Spacer()
            Button { showReport = true } label: {
                Image(systemName: "doc.text")
                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.inkC)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.white))
                    .overlay(Circle().stroke(.black.opacity(0.045), lineWidth: 1))
            }
            Button { showSettings = true } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.inkC)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.white))
                    .overlay(Circle().stroke(.black.opacity(0.045), lineWidth: 1))
            }
        }
        .padding(.top, 6)
    }

    private var hero: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading) {
                Text(Date().formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "fr_FR"))))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.brand800)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(Date().formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "fr_FR"))).capitalized)
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700.opacity(0.8))
                Spacer(minLength: 8)
                Text("HUMEUR DU JOUR")
                    .font(.system(size: 10, weight: .bold)).kerning(1.2)
                    .foregroundStyle(Color.brand700.opacity(0.6))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 10) {
                MoodRing(value: store.todayAvg)
                VStack(alignment: .leading, spacing: 4) {
                    if let avg = store.todayAvg {
                        Text(Store.moodLabel(avg))
                            .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                            .fixedSize()
                        Text("\(store.todayEntries.count) saisie\(store.todayEntries.count > 1 ? "s" : "")")
                            .font(.system(size: 11.5)).foregroundStyle(Color.inkMute).fixedSize()
                    } else {
                        Text("Pas noté")
                            .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                            .fixedSize()
                        Button(action: onLogMood) {
                            Text("Noter").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                                .fixedSize()
                                .padding(.horizontal, 14).padding(.vertical, 7)
                                .background(Capsule().fill(Color.inkC))
                        }
                    }
                }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white))
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(Color.mint))
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            stat(icon: "chart.line.uptrend.xyaxis", tint: .lilacC, fg: .accentDeep,
                 value: store.average(days: 7).map { String(format: "%.1f", $0) } ?? "—", label: "Moy. 7 j")
            stat(icon: "flame.fill", tint: .peachC, fg: .rose,
                 value: "\(store.streak)", label: store.streak > 1 ? "jours de série" : "jour de série")
            stat(icon: "sparkles", tint: .butterC, fg: Color(hex: 0xB07F14),
                 value: "\(store.todayEntries.count)", label: "aujourd'hui")
        }
    }
    private func stat(icon: String, tint: Color, fg: Color, value: String, label: String) -> some View {
        Card(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(fg)
                    .frame(width: 32, height: 32).background(Circle().fill(tint))
                Text(value).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.inkMute)
            }
        }
    }

    private var chartCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ton humeur — 14 jours")
                        .font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                    Spacer()
                    Button { showReport = true } label: {
                        Text("Rapport").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.inkSoft)
                            .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(Color.cream))
                    }
                }
                let series = store.dailySeries(14)
                if series.contains(where: { $0.value != nil }) {
                    Chart {
                        ForEach(Array(series.enumerated()), id: \.offset) { _, pt in
                            if let v = pt.value {
                                AreaMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                    .foregroundStyle(LinearGradient(colors: [.accentBlue.opacity(0.25), .accentBlue.opacity(0)],
                                                                    startPoint: .top, endPoint: .bottom))
                                LineMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                    .foregroundStyle(Color.accentBlue)
                                    .lineStyle(StrokeStyle(lineWidth: 2.4, lineCap: .round))
                                PointMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                    .foregroundStyle(Color.accentBlue)
                                    .symbolSize(28)
                                    .annotation(position: .top, spacing: 3) {
                                        Text(String(format: "%.0f", v))
                                            .font(.system(size: 8.5, weight: .bold)).foregroundStyle(Color.inkMute)
                                    }
                            }
                        }
                        if let avg = store.average(days: 14) {
                            RuleMark(y: .value("Moyenne", avg))
                                .foregroundStyle(Color.brand.opacity(0.5))
                                .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [4, 4]))
                                .annotation(position: .trailing, spacing: 2) {
                                    Text(String(format: "%.1f", avg))
                                        .font(.system(size: 9, weight: .bold)).foregroundStyle(Color.brand700)
                                }
                        }
                    }
                    .chartYScale(domain: 0...10)
                    .chartYAxis {
                        AxisMarks(values: [0, 2, 4, 6, 8, 10]) { _ in
                            AxisGridLine().foregroundStyle(.black.opacity(0.06))
                            AxisValueLabel().font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.inkMute)
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .day, count: 2)) { _ in
                            AxisValueLabel(format: .dateTime.day(), centered: true)
                                .font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.inkMute)
                        }
                    }
                    .frame(height: 150)
                } else {
                    Text("Note ton humeur quelques jours de suite — tes tendances apparaîtront ici.")
                        .font(.system(size: 12.5)).foregroundStyle(Color.inkMute)
                        .frame(maxWidth: .infinity, minHeight: 70)
                }
            }
        }
    }

    private var wellbeingRow: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "wind").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.rose)
                    .frame(width: 38, height: 38).background(Circle().fill(.white))
                Text("On respire\nun moment ?").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Button { showBreathe = true } label: {
                    Text("Respirer").font(.system(size: 12.5, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(Capsule().fill(Color.inkC))
                }
            }
            .padding(15).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.peachC))

            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "hand.raised.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.accentDeep)
                    .frame(width: 38, height: 38).background(Circle().fill(.white))
                Text("Besoin\nd'écoute ?").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Button { showHelp = true } label: {
                    Text("Voir les lignes").font(.system(size: 12.5, weight: .bold)).foregroundStyle(Color.inkC)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(Capsule().fill(.white))
                }
            }
            .padding(15).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.lilacC))
        }
    }
}

// MARK: - Carte médicaments

struct MedsCard: View {
    @EnvironmentObject var store: Store
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                let doses = store.todayDoses
                let taken = doses.filter(\.taken).count
                HStack {
                    Image(systemName: "pills.fill").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.rose)
                        .frame(width: 32, height: 32).background(Circle().fill(Color.peachC))
                    Text("Médicaments du jour").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                    Spacer()
                    Text("\(taken)/\(doses.count)").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.inkSoft)
                        .padding(.horizontal, 10).padding(.vertical, 5).background(Capsule().fill(Color.cream))
                }
                if doses.isEmpty {
                    Text("Aucune prise prévue aujourd'hui.").font(.system(size: 13)).foregroundStyle(Color.inkMute)
                } else {
                    HStack(spacing: 5) {
                        ForEach(doses) { d in
                            Capsule().fill(d.taken ? Color.accentBlue : .black.opacity(0.07)).frame(height: 7)
                        }
                        Text(taken == doses.count ? "terminé" : "\(doses.count - taken) restante\(doses.count - taken > 1 ? "s" : "")")
                            .font(.system(size: 11.5, weight: .bold)).foregroundStyle(Color.inkMute)
                            .fixedSize()
                    }
                    ForEach(doses) { d in
                        HStack(spacing: 12) {
                            Text(d.time).font(.system(size: 12.5, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                                .padding(.horizontal, 10).padding(.vertical, 7).background(Capsule().fill(Color.cream))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(d.name).font(.system(size: 15, weight: .bold)).foregroundStyle(Color.inkC)
                                if let dose = d.dose { Text(dose).font(.system(size: 12)).foregroundStyle(Color.inkMute) }
                            }
                            Spacer()
                            Button { store.setTaken(d, !d.taken) } label: {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(d.taken ? .white : .clear)
                                    .frame(width: 28, height: 28)
                                    .background(Circle().fill(d.taken ? Color.inkC : .clear))
                                    .overlay(Circle().stroke(d.taken ? Color.inkC : .black.opacity(0.15), lineWidth: 2))
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
    }
}

// MARK: - Saisie d'humeur

struct MoodEntryView: View {
    @EnvironmentObject var store: Store
    var done: () -> Void
    @State private var mood: Double?
    @State private var energy: Double?
    @State private var appetite: Double?
    @State private var note = ""
    @State private var saved = false
    // sommeil précis
    @State private var useBedWake = false
    @State private var bed = Dates.date(fromHHMM: "23:00")
    @State private var wake = Dates.date(fromHHMM: "07:30")
    @State private var sleepSimple: Double?
    @State private var nap: Double?
    // sport détaillé
    @State private var workouts: [Workout] = []
    @State private var addingWorkout = false
    // santé intime & dépenses
    @State private var sexual: Bool?
    @State private var menstru: Double?
    @State private var spending = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("NOUVELLE SAISIE").font(.system(size: 11, weight: .bold)).kerning(1.5).foregroundStyle(Color.brand700.opacity(0.7))
                    Text("Ton humeur, maintenant").font(.system(size: 26, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 14)

                preview
                scaleGrid
                energyCard
                appetiteCard
                sleepCard
                sportCard
                intimateCard
                spendingCard
                noteCard
                saveButton
                Spacer(minLength: 90)
            }
            .padding(.horizontal, 18)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $addingWorkout) { WorkoutSheet { workouts.append($0) } }
        .overlay(alignment: .bottom) {
            if saved {
                Label("Humeur enregistrée", systemImage: "checkmark")
                    .font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Capsule().fill(Color.inkC))
                    .padding(.bottom, 110)
                    .transition(.scale.combined(with: .opacity))
            }
        }
    }

    private var faceIcon: String {
        guard let m = mood else { return "face.dashed" }
        switch m {
        case ..<3: return "cloud.rain.fill"
        case ..<5: return "cloud.fill"
        case ..<7: return "cloud.sun.fill"
        case ..<9: return "sun.max.fill"
        default: return "sparkles"
        }
    }

    private var preview: some View {
        HStack(spacing: 14) {
            Image(systemName: faceIcon)
                .font(.system(size: 30, weight: .semibold)).foregroundStyle(Color.accentDeep)
                .frame(width: 68, height: 68)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white))
            VStack(alignment: .leading, spacing: 2) {
                Text("NIVEAU").font(.system(size: 10.5, weight: .bold)).kerning(1.5).foregroundStyle(Color.inkSoft.opacity(0.7))
                Text(mood.map { "\(Int($0))/10" } ?? "—").font(.system(size: 24, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Text(mood.map { Store.moodLabel($0) } ?? "Choisis de 1 à 10").font(.system(size: 13)).foregroundStyle(Color.inkSoft)
            }
            Spacer()
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.lilacC))
    }

    private var scaleGrid: some View {
        Card {
            let cols = Array(repeating: GridItem(.flexible(), spacing: 10), count: 5)
            LazyVGrid(columns: cols, spacing: 10) {
                ForEach(1...10, id: \.self) { n in
                    let on = mood == Double(n)
                    Button {
                        mood = Double(n)
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        Text("\(n)")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundStyle(on ? .white : Color.inkSoft)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Color.inkC : Color.cream))
                            .scaleEffect(on ? 1.05 : 1)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ icon: String, _ title: String, trailing: String? = nil) -> some View {
        HStack {
            Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700)
            Text(title.uppercased()).font(.system(size: 11, weight: .bold)).kerning(1.5).foregroundStyle(Color.inkSoft)
            Spacer()
            if let t = trailing { Text(t).font(.system(size: 13, weight: .bold)).foregroundStyle(Color.inkC) }
        }
    }

    private let energyLabels = ["Épuisé·e", "Fatigué·e", "Correct", "En forme", "Plein d'énergie"]
    private var energyCard: some View {
        Card {
            VStack(spacing: 10) {
                sectionHeader("bolt.fill", "Énergie", trailing: energy.map { energyLabels[max(0, min(4, Int($0) - 1))] } ?? "—")
                Slider(value: Binding(get: { energy ?? 3 }, set: { energy = ($0).rounded() }), in: 1...5, step: 1)
                    .tint(Color.brand)
            }
        }
    }

    private var appetiteCard: some View {
        Card {
            VStack(spacing: 12) {
                sectionHeader("fork.knife", "Appétit")
                HStack(spacing: 10) {
                    ForEach(Array(zip([1.0, 2, 3, 4], ["Rien", "Peu", "Moyen", "Fort"])), id: \.0) { v, label in
                        let on = appetite == v
                        Button { appetite = v } label: {
                            VStack(spacing: 5) {
                                Image(systemName: v == 1 ? "nosign" : "applelogo").font(.system(size: 10 + CGFloat(v) * 3.5))
                                Text(label).font(.system(size: 11, weight: .bold))
                            }
                            .foregroundStyle(on ? .white : Color.inkSoft)
                            .frame(maxWidth: .infinity, minHeight: 68)
                            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Color.inkC : Color.cream))
                        }
                    }
                }
            }
        }
    }

    private var sleepCard: some View {
        Card {
            VStack(spacing: 12) {
                sectionHeader("moon.fill", "Sommeil", trailing: sleepSummary)
                Picker("", selection: $useBedWake) {
                    Text("Durée simple").tag(false)
                    Text("Coucher / lever").tag(true)
                }
                .pickerStyle(.segmented)
                if useBedWake {
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("COUCHER").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                            DatePicker("", selection: $bed, displayedComponents: .hourAndMinute).labelsHidden()
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("LEVER").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                            DatePicker("", selection: $wake, displayedComponents: .hourAndMinute).labelsHidden()
                        }
                        Spacer()
                    }
                } else {
                    Slider(value: Binding(get: { sleepSimple ?? 7 }, set: { sleepSimple = ($0 * 2).rounded() / 2 }), in: 0...12, step: 0.5)
                        .tint(Color.brand)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("SIESTE").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach([0.0, 15, 30, 45, 60, 90], id: \.self) { m in
                                let on = nap == m || (m == 0 && nap == nil)
                                Button { nap = m == 0 ? nil : m } label: {
                                    Text(m == 0 ? "Aucune" : "\(Int(m)) min")
                                        .font(.system(size: 12.5, weight: .bold, design: .rounded)).fixedSize()
                                        .foregroundStyle(on ? .white : Color.inkSoft)
                                        .padding(.horizontal, 13).padding(.vertical, 9)
                                        .background(Capsule().fill(on ? Color.inkC : Color.cream))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    private var sleepSummary: String {
        if useBedWake {
            let h = Dates.sleepHours(bed: Dates.hhmm(bed), wake: Dates.hhmm(wake))
            return String(format: "%.1f h", h)
        }
        if let sv = sleepSimple {
            let h = Int(sv); let m = sv.truncatingRemainder(dividingBy: 1) > 0 ? "30" : "00"
            return "\(h)h\(m)"
        }
        return "—"
    }

    private var sportCard: some View {
        Card {
            VStack(spacing: 12) {
                let total = workouts.reduce(0) { $0 + $1.minutes }
                sectionHeader("figure.run", "Activité physique", trailing: total > 0 ? "\(total) min" : "—")
                ForEach(workouts) { w in
                    HStack(spacing: 10) {
                        Image(systemName: WorkoutSheet.icon(for: w.sport))
                            .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700)
                            .frame(width: 32, height: 32).background(Circle().fill(Color.mint))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(w.sport).font(.system(size: 14, weight: .bold)).foregroundStyle(Color.inkC)
                            Text("\(w.start) → \(w.end) · \(w.minutes) min").font(.system(size: 12)).foregroundStyle(Color.inkMute)
                        }
                        Spacer()
                        Button { workouts.removeAll { $0.id == w.id } } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.inkMute)
                                .frame(width: 26, height: 26).background(Circle().fill(Color.cream))
                        }
                    }
                }
                Button { addingWorkout = true } label: {
                    Label("Ajouter une séance", systemImage: "plus")
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color.cream))
                }
            }
        }
    }

    private var intimateCard: some View {
        Card {
            VStack(spacing: 12) {
                sectionHeader("heart.fill", "Santé intime")
                HStack {
                    Text("Activité sexuelle").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.inkC)
                    Spacer()
                    HStack(spacing: 8) {
                        ForEach([("Oui", true), ("Non", false)], id: \.0) { label, v in
                            let on = sexual == v
                            Button { sexual = on ? nil : v } label: {
                                Text(label).font(.system(size: 12.5, weight: .bold)).fixedSize()
                                    .foregroundStyle(on ? .white : Color.inkSoft)
                                    .padding(.horizontal, 16).padding(.vertical, 8)
                                    .background(Capsule().fill(on ? Color.inkC : Color.cream))
                            }
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("MENSTRUATION").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Array(zip([0.0, 1, 2, 3], ["Non", "Léger", "Moyen", "Abondant"])), id: \.0) { v, label in
                                let on = menstru == v
                                Button { menstru = on ? nil : v } label: {
                                    Text(label).font(.system(size: 12.5, weight: .bold)).fixedSize()
                                        .foregroundStyle(on ? .white : Color.inkSoft)
                                        .padding(.horizontal, 13).padding(.vertical, 9)
                                        .background(Capsule().fill(on ? Color.rose : Color.cream))
                                }
                            }
                        }
                    }
                }
                Text("Ces infos restent sur ton téléphone et enrichissent le rapport médecin.")
                    .font(.system(size: 11)).foregroundStyle(Color.inkMute)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var spendingCard: some View {
        Card {
            VStack(spacing: 10) {
                sectionHeader("eurosign.circle.fill", "Dépenses du jour", trailing: spending.isEmpty ? "—" : "\(spending) €")
                TextField("Montant approximatif (€)", text: $spending)
                    .keyboardType(.decimalPad)
                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                Text("Les variations de dépenses peuvent refléter ton état — utile pour ton suivi.")
                    .font(.system(size: 11)).foregroundStyle(Color.inkMute)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var noteCard: some View {
        TextField("Une note sur ta journée (optionnel)…", text: $note, axis: .vertical)
            .lineLimit(3...5)
            .font(.system(size: 15))
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.black.opacity(0.045), lineWidth: 1))
    }

    private var saveButton: some View {
        Button {
            guard let m = mood else { return }
            let now = Date()
            let totalSport = workouts.reduce(0) { $0 + $1.minutes }
            let sleepH: Double? = useBedWake ? Dates.sleepHours(bed: Dates.hhmm(bed), wake: Dates.hhmm(wake)) : sleepSimple
            let e = MoodEntry(
                id: UUID().uuidString.lowercased(), datetime: Dates.iso.string(from: now), date: Dates.dayKey(now),
                mood: m, energy: energy, appetite: appetite, sleep: sleepH,
                sport: totalSport > 0 ? Double(totalSport) : nil,
                note: note.isEmpty ? nil : note,
                symptoms: nil, symptomIntensity: nil, symptomNote: nil, symptomAdvice: nil,
                bedTime: useBedWake ? Dates.hhmm(bed) : nil,
                wakeTime: useBedWake ? Dates.hhmm(wake) : nil,
                napMinutes: nap,
                workouts: workouts.isEmpty ? nil : workouts,
                sexualActivity: sexual,
                menstruation: menstru,
                spending: Double(spending.replacingOccurrences(of: ",", with: ".")))
            store.addEntry(e)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            mood = nil; energy = nil; appetite = nil; sleepSimple = nil; note = ""
            workouts = []; sexual = nil; menstru = nil; spending = ""; nap = nil
            withAnimation(.spring) { saved = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { withAnimation { saved = false; done() } }
        } label: {
            Label("Enregistrer", systemImage: "square.and.arrow.down")
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(Color.inkC))
                .opacity(mood == nil ? 0.4 : 1)
        }
        .disabled(mood == nil)
    }
}

// MARK: - Ajout de séance

struct WorkoutSheet: View {
    @Environment(\.dismiss) private var dismiss
    var onAdd: (Workout) -> Void
    @State private var sport = "Marche"
    @State private var start = Dates.date(fromHHMM: "18:00")
    @State private var end = Dates.date(fromHHMM: "19:00")
    static let sports = ["Marche", "Course", "Vélo", "Musculation", "Natation", "Yoga", "Foot", "Danse", "Escalade", "Autre"]
    static func icon(for sport: String) -> String {
        switch sport {
        case "Marche": return "figure.walk"
        case "Course": return "figure.run"
        case "Vélo": return "bicycle"
        case "Musculation": return "dumbbell.fill"
        case "Natation": return "figure.pool.swim"
        case "Yoga": return "figure.mind.and.body"
        case "Foot": return "soccerball"
        case "Danse": return "figure.dance"
        case "Escalade": return "figure.climbing"
        default: return "sparkles"
        }
    }
    var body: some View {
        NavigationStack {
            Form {
                Picker("Discipline", selection: $sport) {
                    ForEach(Self.sports, id: \.self) { Label($0, systemImage: Self.icon(for: $0)).tag($0) }
                }
                DatePicker("Début", selection: $start, displayedComponents: .hourAndMinute)
                DatePicker("Fin", selection: $end, displayedComponents: .hourAndMinute)
            }
            .navigationTitle("Séance de sport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Annuler") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ajouter") {
                        onAdd(Workout(sport: sport, start: Dates.hhmm(start), end: Dates.hhmm(end)))
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Personnalisation de l'accueil

struct EditHomeSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(store.cardOrder, id: \.self) { key in
                        let name = Store.allCards.first { $0.key == key }?.name ?? key
                        let hidden = store.hiddenCards.contains(key)
                        HStack {
                            Text(name).font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(hidden ? Color.inkMute : Color.inkC)
                            Spacer()
                            Button { store.toggleCardHidden(key) } label: {
                                Image(systemName: hidden ? "eye.slash" : "eye")
                                    .foregroundStyle(hidden ? Color.inkMute : Color.brand700)
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                    .onMove { store.moveCard(from: $0, to: $1) }
                } header: {
                    Text("Glisse pour réordonner · l'œil pour masquer")
                } footer: {
                    Text("Tout se réactive ici à tout moment.")
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Personnaliser l'accueil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("OK") { dismiss() }.fontWeight(.bold).foregroundStyle(Color.inkC) } }
        }
    }
}

// MARK: - Rapport & partage médecin

struct ReportView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var period = 30
    @State private var qrURL: String?
    @State private var qrBusy = false
    @State private var qrError = ""

    private var cutoff: String {
        Dates.dayKey(Calendar.current.date(byAdding: .day, value: -period, to: Date())!)
    }
    private var sel: [MoodEntry] { store.entries.filter { $0.date >= cutoff } }
    private func avg(_ xs: [Double]) -> Double? { xs.isEmpty ? nil : xs.reduce(0, +) / Double(xs.count) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    Picker("", selection: $period) {
                        Text("7 j").tag(7); Text("30 j").tag(30); Text("90 j").tag(90)
                    }
                    .pickerStyle(.segmented)
                    statCard
                    adherenceCard
                    lifestyleCard
                    shareCard
                }
                .padding(18)
            }
            .background(Color.cream)
            .navigationTitle("Rapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() }.foregroundStyle(Color.inkC) } }
        }
    }

    private var statCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Humeur sur \(period) jours").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                let moods = sel.map(\.mood)
                HStack(spacing: 10) {
                    metric("Moyenne", avg(moods).map { String(format: "%.1f", $0) } ?? "—")
                    metric("Min", moods.min().map { String(format: "%.0f", $0) } ?? "—")
                    metric("Max", moods.max().map { String(format: "%.0f", $0) } ?? "—")
                    metric("Jours", "\(Set(sel.map(\.date)).count)")
                }
            }
        }
    }
    private func metric(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.system(size: 20, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
            Text(label).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Color.inkMute)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.cream))
    }

    private var adherenceCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Traitements").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                let f: DateFormatter = { let x = DateFormatter(); x.dateFormat = "yyyy-MM-dd"; x.locale = Locale(identifier: "en_US_POSIX"); return x }()
                var sched = 0; var taken = 0
                let _ = (0..<period).forEach { i in
                    guard let d = Calendar.current.date(byAdding: .day, value: -i, to: Date()) else { return }
                    let key = f.string(from: d)
                    let wd = Calendar.current.component(.weekday, from: d) - 1
                    for dose in store.dosesFor(dayKey: key, jsWeekday: wd) { sched += 1; if dose.taken { taken += 1 } }
                }
                if sched == 0 {
                    Text("Aucun traitement suivi sur la période.").font(.system(size: 13)).foregroundStyle(Color.inkMute)
                } else {
                    let pct = Int(Double(taken) / Double(sched) * 100)
                    HStack {
                        Text("Observance").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.inkSoft)
                        Spacer()
                        Text("\(pct) %").font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundStyle(pct >= 80 ? Color.brand700 : Color.rose)
                    }
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.black.opacity(0.07))
                            Capsule().fill(pct >= 80 ? Color.brand : Color.rose)
                                .frame(width: g.size.width * Double(pct) / 100)
                        }
                    }
                    .frame(height: 8)
                }
            }
        }
    }

    private var lifestyleCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Hygiène de vie").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                row("moon.fill", "Sommeil moyen", avg(sel.compactMap(\.sleep)).map { String(format: "%.1f h", $0) } ?? "—")
                row("figure.run", "Sport total", "\(Int(sel.compactMap(\.sport).reduce(0, +))) min")
                row("bed.double.fill", "Siestes", "\(Int(sel.compactMap(\.napMinutes).reduce(0, +))) min")
                row("eurosign.circle", "Dépenses", String(format: "%.0f €", sel.compactMap(\.spending).reduce(0, +)))
                row("drop.fill", "Jours menstruation", "\(sel.filter { ($0.menstruation ?? 0) > 0 }.count)")
                row("heart.fill", "Activité sexuelle", "\(sel.filter { $0.sexualActivity == true }.count) jour(s)")
                if let a = store.settings.antecedents, !a.isEmpty {
                    Divider()
                    Text("Antécédents : \(a)").font(.system(size: 12.5)).foregroundStyle(Color.inkSoft)
                }
                if let c = store.settings.knownConditions, !c.isEmpty {
                    Text("Maladies connues : \(c)").font(.system(size: 12.5)).foregroundStyle(Color.inkSoft)
                }
            }
        }
    }
    private func row(_ icon: String, _ label: String, _ value: String) -> some View {
        HStack {
            Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(Color.brand700).frame(width: 22)
            Text(label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkSoft)
            Spacer()
            Text(value).font(.system(size: 13.5, weight: .bold)).foregroundStyle(Color.inkC)
        }
    }

    private var shareCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Partager au médecin").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Text("Génère un lien à usage unique (24 h) : ton médecin scanne le QR et consulte fiche, traitements et symptômes.")
                    .font(.system(size: 12.5)).foregroundStyle(Color.inkMute)
                if let url = qrURL, let img = DoctorShare.qrImage(for: url) {
                    HStack {
                        Spacer()
                        Image(uiImage: img).interpolation(.none).resizable().scaledToFit()
                            .frame(width: 190, height: 190)
                            .padding(10).background(RoundedRectangle(cornerRadius: 16).fill(.white))
                        Spacer()
                    }
                    Text("Usage unique — le lien expire après la première ouverture.")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.brand700)
                        .frame(maxWidth: .infinity, alignment: .center)
                } else {
                    Button {
                        qrBusy = true; qrError = ""
                        Task {
                            do { qrURL = try await DoctorShare.createShare(store: store, doctorName: nil, ttlHours: 24) }
                            catch { qrError = error.localizedDescription }
                            qrBusy = false
                        }
                    } label: {
                        HStack {
                            if qrBusy { ProgressView().tint(.white) }
                            Label("Générer le QR code", systemImage: "qrcode")
                        }
                        .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Capsule().fill(Color.inkC))
                    }
                    .disabled(qrBusy || !DoctorShare.configured)
                    if !DoctorShare.configured {
                        Text("Partage en attente de configuration (clé Supabase) — bientôt réactivé.")
                            .font(.system(size: 11.5)).foregroundStyle(Color.rose)
                    }
                    if !qrError.isEmpty {
                        Text(qrError).font(.system(size: 11.5)).foregroundStyle(Color.rose)
                    }
                }
            }
        }
    }
}

// MARK: - Réglages

// MARK: - Réglages

struct SettingsSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var mantra = ""
    @State private var antecedents = ""
    @State private var conditions = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    section("Profil & accueil") {
                        Card {
                            VStack(spacing: 10) {
                                TextField("Ton prénom", text: $name)
                                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                                    .onSubmit { store.settings.name = name.isEmpty ? nil : name; store.saveSettings() }
                                TextField("Ta phrase du moment", text: $mantra)
                                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                                    .onSubmit { store.settings.mantra = mantra.isEmpty ? nil : mantra; store.saveSettings() }
                            }
                        }
                    }
                    section("Profil santé") {
                        Card {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Ces informations enrichissent le rapport et le partage médecin.")
                                    .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                TextField("Antécédents (personnels, familiaux…)", text: $antecedents, axis: .vertical)
                                    .lineLimit(2...4)
                                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                                TextField("Maladies connues (diabète, hypothyroïdie…)", text: $conditions, axis: .vertical)
                                    .lineLimit(2...4)
                                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                            }
                        }
                    }
                    section("Rappels d'humeur") {
                        Card {
                            VStack(spacing: 8) {
                                ForEach(store.settings.moodSlots.indices, id: \.self) { i in
                                    SlotRowView(slot: binding(for: i))
                                }
                                Button {
                                    store.settings.moodSlots.append(Slot(time: "12:00", days: Array(0...6)))
                                    store.saveSettings()
                                } label: {
                                    Label("Ajouter un horaire", systemImage: "plus")
                                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700)
                                        .frame(maxWidth: .infinity, minHeight: 40)
                                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                                }
                            }
                        }
                    }
                    section("Médicaments") { MedsManager() }
                    section("Alarme & notifications") {
                        Card {
                            VStack(spacing: 4) {
                                Toggle(isOn: Binding(get: { store.settings.loudAlarm },
                                                     set: { store.settings.loudAlarm = $0; store.saveSettings() })) {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text("Alarme forte (médicaments)").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.inkC)
                                        Text("Sonnerie en boucle jusqu'à validation, même en silencieux")
                                            .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                    }
                                }
                                .tint(Color.brand)
                                Divider()
                                Toggle(isOn: Binding(get: { store.settings.notifications },
                                                     set: { on in
                                                         if on { Notifier.requestPermission { ok in
                                                             store.settings.notifications = ok; store.saveSettings()
                                                         } } else { store.settings.notifications = false; store.saveSettings() }
                                                     })) {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text("Notifications").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.inkC)
                                        Text("Rappels natifs, même app fermée").font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                    }
                                }
                                .tint(Color.brand)
                            }
                        }
                    }
                }
                .padding(18)
            }
            .background(Color.cream)
            .navigationTitle("Personnaliser")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() }.foregroundStyle(Color.inkC) } }
        }
        .onAppear {
            name = store.settings.name ?? ""; mantra = store.settings.mantra ?? ""
            antecedents = store.settings.antecedents ?? ""; conditions = store.settings.knownConditions ?? ""
        }
        .onDisappear {
            store.settings.name = name.isEmpty ? nil : name
            store.settings.mantra = mantra.isEmpty ? nil : mantra
            store.settings.antecedents = antecedents.isEmpty ? nil : antecedents
            store.settings.knownConditions = conditions.isEmpty ? nil : conditions
            store.saveSettings()
        }
    }
    private func binding(for i: Int) -> Binding<Slot> {
        Binding(get: { store.settings.moodSlots[i] },
                set: { store.settings.moodSlots[i] = $0; store.saveSettings() })
    }
    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
            content()
        }
    }
}

struct SlotRowView: View {
    @Binding var slot: Slot
    private let labels = ["D", "L", "M", "M", "J", "V", "S"]
    var body: some View {
        VStack(spacing: 8) {
            DatePicker("Heure", selection: Binding(
                get: {
                    let p = slot.time.split(separator: ":").compactMap { Int($0) }
                    return Calendar.current.date(bySettingHour: p.first ?? 9, minute: p.count > 1 ? p[1] : 0, second: 0, of: Date()) ?? Date()
                },
                set: {
                    let h = Calendar.current.component(.hour, from: $0)
                    let m = Calendar.current.component(.minute, from: $0)
                    slot.time = String(format: "%02d:%02d", h, m)
                }), displayedComponents: .hourAndMinute)
                .font(.system(size: 14, weight: .semibold))
            HStack(spacing: 5) {
                ForEach(0..<7, id: \.self) { d in
                    let on = slot.days.isEmpty || slot.days.contains(d)
                    Button {
                        var base = slot.days.isEmpty ? Array(0...6) : slot.days
                        if base.contains(d) { base.removeAll { $0 == d } } else { base.append(d) }
                        slot.days = base.count == 7 ? Array(0...6) : base.sorted()
                    } label: {
                        Text(labels[d]).font(.system(size: 12, weight: .bold))
                            .foregroundStyle(on ? .white : Color.inkMute)
                            .frame(width: 30, height: 30)
                            .background(RoundedRectangle(cornerRadius: 9).fill(on ? Color.brand : Color.cream))
                    }
                }
                Spacer()
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.cream.opacity(0.8)))
    }
}

struct MedsManager: View {
    @EnvironmentObject var store: Store
    var body: some View {
        VStack(spacing: 10) {
            ForEach(store.meds) { med in MedEditor(med: med) }
            Button {
                store.saveMed(Medication(id: UUID().uuidString.lowercased(), name: "Nouveau médicament",
                                         dose: nil, slots: [Slot(time: "21:00", days: Array(0...6))],
                                         barcode: nil, highlights: nil, sideEffects: nil))
            } label: {
                Label("Ajouter un médicament", systemImage: "plus")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.brand700)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(RoundedRectangle(cornerRadius: 18).fill(.white))
            }
        }
    }
}

struct MedEditor: View {
    @EnvironmentObject var store: Store
    var med: Medication
    @State private var open = false
    @State private var name = ""
    @State private var dose = ""
    var body: some View {
        Card(padding: 14) {
            VStack(spacing: 10) {
                HStack(spacing: 12) {
                    Image(systemName: "pills.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.rose)
                        .frame(width: 36, height: 36).background(Circle().fill(Color.peachC))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(med.name).font(.system(size: 15, weight: .bold)).foregroundStyle(Color.inkC)
                        Text(med.slots.map(\.time).joined(separator: " · ")).font(.system(size: 12)).foregroundStyle(Color.inkMute)
                    }
                    Spacer()
                    Button { withAnimation { open.toggle() } } label: {
                        Image(systemName: "chevron.down").rotationEffect(.degrees(open ? 180 : 0))
                            .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.inkSoft)
                            .frame(width: 32, height: 32).background(Circle().fill(Color.cream))
                    }
                }
                if open {
                    TextField("Nom", text: $name)
                        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Color.cream))
                        .onSubmit { commit() }
                    TextField("Dose (ex : 50 mg)", text: $dose)
                        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Color.cream))
                        .onSubmit { commit() }
                    ForEach(med.slots.indices, id: \.self) { i in
                        SlotRowView(slot: Binding(
                            get: { store.meds.first(where: { $0.id == med.id })?.slots[safe: i] ?? med.slots[i] },
                            set: { s in
                                var m = store.meds.first(where: { $0.id == med.id }) ?? med
                                if m.slots.indices.contains(i) { m.slots[i] = s; store.saveMed(m) }
                            }))
                    }
                    HStack {
                        Button {
                            var m = med; m.slots.append(Slot(time: "08:00", days: Array(0...6))); store.saveMed(m)
                        } label: {
                            Label("Ajouter une prise", systemImage: "plus").font(.system(size: 12.5, weight: .bold))
                                .foregroundStyle(Color.brand700)
                        }
                        Spacer()
                        Button(role: .destructive) { store.deleteMed(med.id) } label: {
                            Image(systemName: "trash").font(.system(size: 13, weight: .semibold))
                        }
                    }
                    .padding(.top, 2)
                }
            }
        }
        .onAppear { name = med.name; dose = med.dose ?? "" }
        .onChange(of: open) { _ in commit() }
    }
    private func commit() {
        var m = med
        m.name = name.isEmpty ? med.name : name
        m.dose = dose.isEmpty ? nil : dose
        if m.name != med.name || m.dose != med.dose { store.saveMed(m) }
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

// MARK: - Respiration

struct BreathingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var phase = 0            // 0 inspire · 1 tiens · 2 expire
    @State private var scale: CGFloat = 0.55
    private let names = ["Inspire", "Retiens", "Expire"]
    private let durations: [Double] = [4, 4, 6]
    var body: some View {
        ZStack {
            Color.cream.ignoresSafeArea()
            VStack(spacing: 30) {
                Text("Respiration guidée").font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                ZStack {
                    Circle().fill(Color.mint).frame(width: 260, height: 260).scaleEffect(scale)
                    Circle().fill(.white).frame(width: 130, height: 130)
                    Text(names[phase]).font(.system(size: 19, weight: .bold, design: .rounded)).foregroundStyle(Color.brand800)
                }
                .frame(height: 300)
                Text("4 s inspirer · 4 s retenir · 6 s expirer")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.inkMute)
                Button { dismiss() } label: {
                    Text("Terminer").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 28).padding(.vertical, 13)
                        .background(Capsule().fill(Color.inkC))
                }
            }
        }
        .onAppear { advance() }
    }
    private func advance() {
        withAnimation(.easeInOut(duration: durations[phase])) {
            scale = phase == 0 ? 1.0 : phase == 1 ? 1.0 : 0.55
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + durations[phase]) {
            phase = (phase + 1) % 3
            advance()
        }
    }
}

// MARK: - Lignes d'aide

struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    private let lines: [(String, String, String)] = [
        ("3114", "Prévention du suicide — 24h/24, gratuit", "3114"),
        ("SOS Amitié", "Écoute bienveillante — 24h/24", "0972394050"),
        ("SAMU", "Urgence vitale", "15"),
        ("115", "Urgence sociale / hébergement", "115"),
        ("3919", "Violences femmes info", "3919"),
        ("Fil Santé Jeunes", "12-25 ans — 9h à 23h", "0800235236"),
    ]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    Text("Tu n'es pas seul·e. Ces lignes sont gratuites et confidentielles.")
                        .font(.system(size: 13.5)).foregroundStyle(Color.inkSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(lines, id: \.0) { name, desc, tel in
                        Button {
                            if let url = URL(string: "tel://\(tel)") { UIApplication.shared.open(url) }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "phone.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                                    .frame(width: 38, height: 38).background(Circle().fill(Color.brand))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(name).font(.system(size: 15, weight: .bold)).foregroundStyle(Color.inkC)
                                    Text(desc).font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.inkMute)
                            }
                            .padding(14)
                            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white))
                        }
                    }
                }
                .padding(18)
            }
            .background(Color.cream)
            .navigationTitle("Besoin d'aide")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() }.foregroundStyle(Color.inkC) } }
        }
    }
}

// MARK: - Alarme plein écran

struct AlarmOverlay: View {
    let dose: Store.Dose
    var take: () -> Void
    var snooze: () -> Void
    @State private var pulse = false
    var body: some View {
        ZStack {
            Color.inkC.ignoresSafeArea()
            VStack(spacing: 26) {
                Spacer()
                Image(systemName: "pills.fill")
                    .font(.system(size: 44, weight: .bold)).foregroundStyle(Color.inkC)
                    .frame(width: 110, height: 110)
                    .background(Circle().fill(Color.mint))
                    .scaleEffect(pulse ? 1.08 : 1)
                    .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
                VStack(spacing: 6) {
                    Text("C'est l'heure !").font(.system(size: 26, weight: .bold, design: .rounded)).foregroundStyle(.white)
                    Text("\(dose.name)\(dose.dose.map { " · \($0)" } ?? "") — \(dose.time)")
                        .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white.opacity(0.75))
                }
                Spacer()
                Button(action: take) {
                    Label("J'ai pris mon médicament", systemImage: "checkmark")
                        .font(.system(size: 17, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                        .frame(maxWidth: .infinity, minHeight: 58)
                        .background(Capsule().fill(Color.mint))
                }
                Button(action: snooze) {
                    Text("Plus tard").font(.system(size: 15, weight: .bold)).foregroundStyle(.white.opacity(0.7))
                }
                .padding(.bottom, 30)
            }
            .padding(.horizontal, 24)
        }
        .onAppear { pulse = true }
    }
}
