// Moody — app native SwiftUI
// Design « moodboard pastel » : fond gris perle, cartes blanches, pastels,
// CTA noirs, jauges bleues. Les données de l'ancienne app (WebView) sont
// migrées automatiquement au premier lancement.

import SwiftUI
import Speech
import AVFoundation
import SQLite3
import CoreLocation
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

/// Journal du jour : hygiène, hydratation, rapports — un enregistrement par date.
struct DayLog: Codable {
    var showerAM: Bool?
    var showerPM: Bool?
    var teethAM: Bool?
    var teethPM: Bool?
    var waterGlasses: Double?
    var sexCount: Double?
}

/// Produits suivis (mêmes clés que le module addictions du web).
struct Addiction: Codable, Identifiable, Hashable {
    var id: String
    var name: String          // "Monster", "Café", "Cigarette"…
    var createdAt: String
    var goal: Double?
    var unit: String?         // "canette", "tasse"…
}
struct AddictionEvent: Codable { var id: String; var at: String }

/// Profil santé — même format que la clé web `moody_medical`.
struct MedicalProfile: Codable {
    var fullName: String?
    var birthDate: String?    // "yyyy-MM-dd"
    var sex: String?          // "F", "M", autre
    var height: String?       // cm
    var weight: String?       // kg
    var bloodType: String?
    var conditionsList: [String]?
    var allergies: String?

    var age: Int? {
        guard let b = birthDate, let d = Dates.day.date(from: b) else { return nil }
        return Calendar.current.dateComponents([.year], from: d, to: Date()).year
    }
    var bmi: Double? {
        guard let h = Double(height ?? ""), let w = Double(weight ?? ""), h > 0 else { return nil }
        return w / pow(h / 100, 2)
    }
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
    static let day: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
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
    @Published var medical = MedicalProfile()             // moody_medical
    @Published var dayLogs: [String: DayLog] = [:]        // moody_daylog
    @Published var addictions: [Addiction] = []           // moody_addictions
    @Published var addictionLog: [AddictionEvent] = []    // moody_addiction_log

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
        medical = decode("moody_medical") ?? MedicalProfile()
        dayLogs = decode("moody_daylog") ?? [:]
        addictions = decode("moody_addictions") ?? []
        addictionLog = decode("moody_addiction_log") ?? []
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
        save(medical, "moody_medical")
        save(dayLogs, "moody_daylog"); save(addictions, "moody_addictions")
        save(addictionLog, "moody_addiction_log")
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
    func deleteEntry(_ id: String) { entries.removeAll { $0.id == id }; persist() }
    func entries(on day: String) -> [MoodEntry] {
        entries.filter { $0.date == day }.sorted { $0.datetime < $1.datetime }
    }
    /// Moyenne d'humeur d'un jour donné.
    func dayAverage(_ day: String) -> Double? {
        let sel = entries.filter { $0.date == day }.map(\.mood)
        return sel.isEmpty ? nil : sel.reduce(0, +) / Double(sel.count)
    }
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

    // — intelligence du jour : ce qui est déjà rempli ne se redemande pas —
    var todayLog: DayLog { dayLogs[Dates.dayKey()] ?? DayLog() }
    func updateTodayLog(_ mutate: (inout DayLog) -> Void) {
        var l = todayLog; mutate(&l); dayLogs[Dates.dayKey()] = l; persist()
    }
    /// Sommeil déjà consigné aujourd'hui ? (heures + éventuelle valeur)
    var sleepLoggedToday: Double? { todayEntries.compactMap(\.sleep).last }
    /// Corrige la nuit déjà enregistrée (en cas d'erreur de saisie).
    func updateTodaySleep(_ hours: Double, bed: String?, wake: String?) {
        let day = Dates.dayKey()
        if let i = entries.lastIndex(where: { $0.date == day && $0.sleep != nil }) {
            entries[i].sleep = hours; entries[i].bedTime = bed; entries[i].wakeTime = wake; persist()
        }
    }
    /// Journal d'effets secondaires d'un médicament.
    func addSideEffect(medId: String, text: String) {
        guard let i = meds.firstIndex(where: { $0.id == medId }) else { return }
        var list = meds[i].sideEffects ?? []
        list.append(SideEffect(date: Dates.dayKey(), text: text))
        meds[i].sideEffects = list; persist()
    }
    func removeSideEffect(medId: String, at index: Int) {
        guard let i = meds.firstIndex(where: { $0.id == medId }),
              var list = meds[i].sideEffects, list.indices.contains(index) else { return }
        list.remove(at: index); meds[i].sideEffects = list.isEmpty ? nil : list; persist()
    }
    var menstruLoggedToday: Bool { todayEntries.contains { $0.menstruation != nil } }
    var napLoggedToday: Double { todayEntries.compactMap(\.napMinutes).reduce(0, +) }

    // — consommations (produits personnalisés) —
    func consumptionToday(_ addictionId: String) -> Int {
        let day = Dates.dayKey()
        return addictionLog.filter { $0.id == addictionId && $0.at.hasPrefix(day) }.count
    }
    func consumption(_ addictionId: String, days: Int) -> Int {
        guard let cut = Calendar.current.date(byAdding: .day, value: -days, to: Date()) else { return 0 }
        let key = Dates.dayKey(cut)
        return addictionLog.filter { $0.id == addictionId && String($0.at.prefix(10)) >= key }.count
    }
    func addConsumption(_ addictionId: String) {
        addictionLog.append(AddictionEvent(id: addictionId, at: Dates.iso.string(from: Date()))); persist()
    }
    func removeConsumption(_ addictionId: String) {
        let day = Dates.dayKey()
        if let i = addictionLog.lastIndex(where: { $0.id == addictionId && $0.at.hasPrefix(day) }) {
            addictionLog.remove(at: i); persist()
        }
    }
    func saveAddiction(name: String, unit: String?) {
        addictions.append(Addiction(id: UUID().uuidString.lowercased(), name: name,
                                    createdAt: Dates.iso.string(from: Date()), goal: nil, unit: unit))
        persist()
    }
    func deleteAddiction(_ id: String) {
        addictions.removeAll { $0.id == id }
        addictionLog.removeAll { $0.id == id }
        persist()
    }

    // — accueil personnalisable —
    static let allCards: [(key: String, name: String)] = [
        ("mood", "Humeur du jour"), ("bot", "Bilan Moody (assistant)"), ("day", "Ma journée"),
        ("stats", "Statistiques"), ("meds", "Médicaments"), ("chart", "Courbe 14 jours"), ("wellbeing", "Bien-être"),
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
        struct Sheet: Encodable {
            var conditions: String?
            var birthDate: String?; var sex: String?
            var height: String?; var weight: String?; var bloodType: String?; var allergies: String?
        }
        struct Treatment: Encodable { var name: String; var dose: String? }
        struct Symptom: Encodable { var date: String; var symptoms: [String]; var intensity: Double? }
    }

    static func createShare(store: Store, doctorName: String?, ttlHours: Double) async throws -> String {
        guard configured else { throw NSError(domain: "moody", code: 1, userInfo: [NSLocalizedDescriptionKey: "Service non configuré"]) }
        let token = (0..<18).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
        let cutoff = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -90, to: Date())!)
        let payload = Payload(
            patientName: store.medical.fullName ?? store.settings.name,
            sheet: .init(conditions: [store.settings.knownConditions, store.settings.antecedents]
                             .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                         birthDate: store.medical.birthDate, sex: store.medical.sex,
                         height: store.medical.height, weight: store.medical.weight,
                         bloodType: store.medical.bloodType, allergies: store.medical.allergies),
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
    @State private var showDayDetail = false
    @State private var showTrend = false
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
                    case "bot": BotCard()
                    case "day": MyDayCard()
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
        .sheet(isPresented: $showDayDetail) { DayDetailSheet() }
        .sheet(isPresented: $showTrend) { MoodTrendSheet() }
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
                HStack(spacing: 4) {
                    Text("HUMEUR DU JOUR")
                        .font(.system(size: 10, weight: .bold)).kerning(1.2)
                        .foregroundStyle(Color.brand700.opacity(0.6))
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.system(size: 11)).foregroundStyle(Color.brand700.opacity(0.45))
                }
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
        .contentShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .onTapGesture { showDayDetail = true }
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
                    Button { showTrend = true } label: {
                        HStack(spacing: 3) {
                            Text("Détails").font(.system(size: 12, weight: .bold))
                            Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold))
                        }
                        .foregroundStyle(Color.accentDeep)
                        .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(Color.accentSoft))
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
        .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .onTapGesture { showTrend = true }
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

// MARK: - Ma journée (hygiène, hydratation, consommations — adapté à l'heure)

struct MyDayCard: View {
    @EnvironmentObject var store: Store
    @State private var addingProduct = false
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "sun.and.horizon.fill").font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: 0xB07F14))
                        .frame(width: 32, height: 32).background(Circle().fill(Color.butterC))
                    Text("Ma journée").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                    Spacer()
                    Text(hourHint).font(.system(size: 11, weight: .bold)).foregroundStyle(Color.inkMute)
                }
                HygieneChecks()
                WaterRow()
                if !store.addictions.isEmpty || true {
                    Divider()
                    ConsumptionRows(addingProduct: $addingProduct)
                }
            }
        }
        .sheet(isPresented: $addingProduct) { AddProductSheet() }
    }
    private var hourHint: String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "matin" : h < 18 ? "après-midi" : "soir"
    }
}

/// Hygiène : ne pose que les questions du moment, garde visibles les oublis.
struct HygieneChecks: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let h = Calendar.current.component(.hour, from: Date())
        let log = store.todayLog
        VStack(spacing: 8) {
            // le matin (et tant que pas fait) : douche + dents du matin
            if h < 15 || log.showerAM != true {
                check("shower.fill", "Douche (matin)", log.showerAM) { v in store.updateTodayLog { $0.showerAM = v } }
            }
            if h < 15 || log.teethAM != true {
                check("mouth.fill", "Dents (matin)", log.teethAM) { v in store.updateTodayLog { $0.teethAM = v } }
            }
            // le soir : douche + dents du soir
            if h >= 17 {
                check("shower.fill", "Douche (soir)", log.showerPM) { v in store.updateTodayLog { $0.showerPM = v } }
                check("mouth.fill", "Dents (soir)", log.teethPM) { v in store.updateTodayLog { $0.teethPM = v } }
            }
        }
    }
    private func check(_ icon: String, _ label: String, _ value: Bool?, set: @escaping (Bool) -> Void) -> some View {
        HStack {
            Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(Color.accentDeep).frame(width: 22)
            Text(label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkC)
            Spacer()
            HStack(spacing: 6) {
                ForEach([("Oui", true), ("Pas encore", false)], id: \.0) { t, v in
                    let on = value == v
                    Button { set(v) } label: {
                        Text(t).font(.system(size: 11.5, weight: .bold)).fixedSize()
                            .foregroundStyle(on ? .white : Color.inkSoft)
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(Capsule().fill(on ? (v ? Color.brand : Color.inkC) : Color.cream))
                    }
                }
            }
        }
    }
}

/// Hydratation : compteur de verres.
struct WaterRow: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let glasses = Int(store.todayLog.waterGlasses ?? 0)
        HStack {
            Image(systemName: "drop.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.accentBlue).frame(width: 22)
            Text("Eau bue").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkC)
            Spacer()
            stepper(count: glasses, unit: glasses > 1 ? "verres" : "verre",
                    minus: { store.updateTodayLog { $0.waterGlasses = max(0, ($0.waterGlasses ?? 0) - 1) } },
                    plus: { store.updateTodayLog { $0.waterGlasses = ($0.waterGlasses ?? 0) + 1 } })
        }
    }
}

func stepper(count: Int, unit: String, minus: @escaping () -> Void, plus: @escaping () -> Void) -> some View {
    HStack(spacing: 8) {
        Button(action: minus) {
            Image(systemName: "minus").font(.system(size: 11, weight: .heavy)).foregroundStyle(Color.inkSoft)
                .frame(width: 26, height: 26).background(Circle().fill(Color.cream))
        }
        Text("\(count) \(unit)").font(.system(size: 12.5, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
            .frame(minWidth: 64)
        Button(action: plus) {
            Image(systemName: "plus").font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
                .frame(width: 26, height: 26).background(Circle().fill(Color.inkC))
        }
    }
}

/// Consommations : un compteur par produit suivi (« 3 canettes de Monster »).
struct ConsumptionRows: View {
    @EnvironmentObject var store: Store
    @Binding var addingProduct: Bool
    var body: some View {
        VStack(spacing: 8) {
            ForEach(store.addictions) { a in
                let n = store.consumptionToday(a.id)
                HStack {
                    Image(systemName: "takeoutbag.and.cup.and.straw.fill")
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Color.rose).frame(width: 22)
                    Text(a.name).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkC)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Spacer()
                    stepper(count: n, unit: a.unit ?? "",
                            minus: { store.removeConsumption(a.id) },
                            plus: { store.addConsumption(a.id) })
                }
            }
            Button { addingProduct = true } label: {
                Label("Suivre un produit (café, Monster, tabac…)", systemImage: "plus")
                    .font(.system(size: 12.5, weight: .bold)).foregroundStyle(Color.brand700)
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
            }
        }
    }
}

struct AddProductSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var unit = ""
    var body: some View {
        NavigationStack {
            Form {
                TextField("Produit (ex : Monster, Café, Cigarette…)", text: $name)
                TextField("Unité (ex : canette, tasse…)", text: $unit)
                if !store.addictions.isEmpty {
                    Section("Produits suivis") {
                        ForEach(store.addictions) { a in
                            HStack {
                                Text(a.name)
                                Spacer()
                                Button(role: .destructive) { store.deleteAddiction(a.id) } label: { Image(systemName: "trash") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Suivre un produit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Fermer") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ajouter") {
                        store.saveAddiction(name: name.trimmingCharacters(in: .whitespaces),
                                            unit: unit.isEmpty ? nil : unit.trimmingCharacters(in: .whitespaces))
                        name = ""; unit = ""
                    }
                    .fontWeight(.bold)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Base de données médicaments ANSM (15 857 spécialités, embarquée)

struct DrugInfo {
    var name: String
    var form: String
    var route: String
    var marketed: Bool
    var surveillance: Bool
    var substances: String?
    var generGroup: String?
    var conditions: String?
}

enum DrugDB {
    private static var db: OpaquePointer? = {
        guard let path = Bundle.main.path(forResource: "bdpm", ofType: "sqlite") else { return nil }
        var d: OpaquePointer?
        return sqlite3_open_v2(path, &d, SQLITE_OPEN_READONLY, nil) == SQLITE_OK ? d : nil
    }()

    /// Recherche par nom (insensible aux accents/majuscules), commercialisés d'abord.
    static func search(_ query: String, limit: Int = 5) -> [DrugInfo] {
        guard let db else { return [] }
        let q = query.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "fr"))
            .uppercased().trimmingCharacters(in: .whitespaces)
        guard q.count >= 3 else { return [] }
        var stmt: OpaquePointer?
        let sql = """
            SELECT name, form, route, marketed, surv, substances, gener, conditions FROM meds
            WHERE nname LIKE ? ORDER BY marketed DESC, LENGTH(name) LIMIT ?
            """
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(stmt) }
        sqlite3_bind_text(stmt, 1, "%\(q)%", -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
        sqlite3_bind_int(stmt, 2, Int32(limit))
        var out: [DrugInfo] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            func col(_ i: Int32) -> String? { sqlite3_column_text(stmt, i).map { String(cString: $0) } }
            out.append(DrugInfo(name: col(0) ?? "", form: col(1) ?? "", route: col(2) ?? "",
                                marketed: sqlite3_column_int(stmt, 3) == 1,
                                surveillance: sqlite3_column_int(stmt, 4) == 1,
                                substances: col(5), generGroup: col(6), conditions: col(7)))
        }
        return out
    }

    static func describe(_ d: DrugInfo) -> String {
        var parts: [String] = []
        parts.append("\(d.name) — \(d.form), voie \(d.route.lowercased()).")
        if let s = d.substances { parts.append("Principe(s) actif(s) : \(s).") }
        if let g = d.generGroup { parts.append("Famille : \(g).") }
        if let c = d.conditions { parts.append("Délivrance : \(c.lowercased()).") }
        if d.surveillance { parts.append("⚠️ Sous surveillance renforcée ANSM.") }
        if !d.marketed { parts.append("(N'est plus commercialisé.)") }
        parts.append("Je ne remplace ni ta notice ni ton médecin — en cas de doute, demande à ton pharmacien.")
        return parts.joined(separator: " ")
    }
}

// MARK: - Météo locale (Open-Meteo, sans clé)

@MainActor
final class WeatherService: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = WeatherService()
    private let manager = CLLocationManager()
    private var cache: (at: Date, text: String)?
    private var pending: [(String) -> Void] = []

    func current(_ done: @escaping (String) -> Void) {
        if let c = cache, Date().timeIntervalSince(c.at) < 1800 { done(c.text); return }
        pending.append(done)
        manager.delegate = self
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            flush("Je n'ai pas accès à ta position — autorise la localisation dans Réglages pour la météo.")
        default: manager.requestLocation()
        }
    }
    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        Task { @MainActor in
            if m.authorizationStatus == .authorizedWhenInUse || m.authorizationStatus == .authorizedAlways { m.requestLocation() }
            else if m.authorizationStatus == .denied { flush("Sans accès à ta position, pas de météo — tu peux l'autoriser dans Réglages.") }
        }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let l = locs.first else { return }
        Task { @MainActor in await fetch(lat: l.coordinate.latitude, lon: l.coordinate.longitude) }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in flush("Impossible de te localiser pour la météo, réessaie dehors ou plus tard.") }
    }

    private func fetch(lat: Double, lon: Double) async {
        do {
            let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lon)&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1")!
            let (data, _) = try await URLSession.shared.data(from: url)
            struct R: Decodable {
                struct C: Decodable { let temperature_2m: Double; let weather_code: Int; let wind_speed_10m: Double }
                struct D: Decodable { let temperature_2m_max: [Double]; let temperature_2m_min: [Double]; let precipitation_probability_max: [Int] }
                let current: C; let daily: D
            }
            let r = try JSONDecoder().decode(R.self, from: data)
            let desc = Self.codeText(r.current.weather_code)
            let rain = r.daily.precipitation_probability_max.first ?? 0
            var t = String(format: "Il fait %.0f °C, %@. Aujourd'hui : %.0f à %.0f °C", r.current.temperature_2m, desc,
                           r.daily.temperature_2m_min.first ?? 0, r.daily.temperature_2m_max.first ?? 0)
            t += rain >= 50 ? ", \(rain) % de risque de pluie — pense au parapluie ☔️." : rain >= 25 ? ", \(rain) % de risque de pluie." : ", temps plutôt sec."
            if r.current.weather_code <= 1 && r.current.temperature_2m >= 15 { t += " Idéal pour une marche — ton humeur adore ça !" }
            cache = (Date(), t); flush(t)
        } catch { flush("La météo ne répond pas pour le moment.") }
    }
    private func flush(_ text: String) { pending.forEach { $0(text) }; pending = [] }

    static func codeText(_ c: Int) -> String {
        switch c {
        case 0: return "grand ciel bleu"
        case 1: return "plutôt dégagé"
        case 2: return "partiellement nuageux"
        case 3: return "couvert"
        case 45, 48: return "brouillard"
        case 51...57: return "bruine"
        case 61...67, 80...82: return "pluie"
        case 71...77, 85, 86: return "neige"
        case 95...99: return "orage"
        default: return "temps changeant"
        }
    }
}

// MARK: - Orientation médicale (spécialistes + signaux d'urgence)

enum Triage {
    /// Signaux d'alerte → urgences immédiates.
    static let redFlags: [(keys: [String], reply: String)] = [
        (["douleur poitrine", "douleur thoracique", "oppression poitrine", "bras gauche engourdi"],
         "⚠️ Une douleur dans la poitrine peut être une urgence cardiaque. Appelle le 15 (SAMU) ou le 112 MAINTENANT, surtout si elle irradie vers le bras ou la mâchoire."),
        (["difficulté à respirer", "je n'arrive plus à respirer", "étouffe"],
         "⚠️ Difficulté à respirer = urgence. Appelle le 15 ou le 112 sans attendre."),
        (["visage paralysé", "bras paralysé", "trouble de la parole", "bouche déviée"],
         "⚠️ Ces signes évoquent un AVC : chaque minute compte. Appelle le 15 ou le 112 immédiatement."),
        (["envie de mourir", "suicidaire", "me faire du mal", "plus envie de vivre", "en finir"],
         "Ce que tu ressens est sérieux et tu n'as pas à le porter seul·e. 💚 Appelle le 3114 (numéro national de prévention du suicide, gratuit, 24 h/24) ou le 15. Parle-en aussi à ton médecin — et à un proche ce soir si tu peux."),
    ]

    static let specialists: [(keys: [String], who: String, why: String)] = [
        (["déprime", "dépression", "anxiété", "angoisse", "panique", "moral", "burn out", "burnout", "stress chronique"],
         "un psychiatre ou un psychologue", "c'est leur spécialité, et ton médecin traitant peut t'orienter (le psychiatre est remboursé)"),
        (["coeur", "palpitation", "tachycardie", "essoufflement effort", "tension"],
         "un cardiologue", "il vérifiera ton cœur et ta tension (ECG, Holter si besoin)"),
        (["peau", "bouton", "eczéma", "acné", "psoriasis", "grain de beauté", "démangeaison"],
         "un dermatologue", "photographie la zone en attendant, ça aide au diagnostic"),
        (["estomac", "ventre", "digestion", "reflux", "ballonnement", "constipation", "diarrhée", "intestin"],
         "un gastro-entérologue", "note ce que tu manges et tes symptômes quelques jours avant le rendez-vous"),
        (["dos", "lombaire", "articulation", "genou", "épaule", "arthrose", "tendinite"],
         "un rhumatologue (ou un kiné sur prescription)", "en attendant, évite le repos strict : bouger doucement aide souvent plus"),
        (["migraine", "mal de tête", "céphalée", "vertige", "fourmillement", "mémoire"],
         "un neurologue", "tiens un journal de tes crises (fréquence, durée, déclencheurs)"),
        (["thyroïde", "diabète", "hormone", "poids inexpliqué", "fatigue chronique"],
         "un endocrinologue", "une prise de sang prescrite par ton médecin traitant est souvent la première étape"),
        (["règles", "menstruation douloureuse", "cycle", "contraception", "gynéco", "endométriose"],
         "un·e gynécologue ou une sage-femme", "note tes cycles dans Moody, ça fera un historique précieux en consultation"),
        (["urine", "vessie", "cystite", "rein", "prostate"],
         "un urologue (ou ton médecin pour une cystite simple)", "bois beaucoup d'eau en attendant"),
        (["yeux", "vision", "vue trouble", "ophtalmo"],
         "un ophtalmologiste", "les délais sont longs : prends rendez-vous dès maintenant"),
        (["oreille", "audition", "gorge", "sinus", "acouphène", "nez bouché chronique"],
         "un ORL", "un médecin généraliste peut traiter les cas simples d'abord"),
        (["poumon", "toux chronique", "asthme", "bronchite répétée"],
         "un pneumologue", "si tu fumes, c'est LE moment d'en parler aussi"),
        (["dent", "gencive", "mâchoire"],
         "un dentiste", "n'attends pas que ça s'aggrave, les soins précoces coûtent moins cher"),
        (["sommeil", "insomnie chronique", "apnée", "ronflement"],
         "un médecin du sommeil (via ton médecin traitant)", "tes données de sommeil Moody seront très utiles en consultation"),
        (["allergie", "rhume des foins", "urticaire"],
         "un allergologue", "note quand et où les symptômes apparaissent"),
    ]

    static func answer(_ q: String) -> String? {
        for f in redFlags where f.keys.contains(where: { q.contains($0) }) { return f.reply }
        guard q.contains("spécialiste") || q.contains("specialiste") || q.contains("quel médecin") || q.contains("quel medecin")
                || q.contains("qui consulter") || q.contains("orienter") || q.contains("consulter pour") else {
            for f in redFlags where f.keys.contains(where: { q.contains($0) }) { return f.reply }
            return nil
        }
        for s in specialists where s.keys.contains(where: { q.contains($0) }) {
            return "Pour ça, je t'oriente vers \(s.who) — \(s.why). Le bon réflexe : passe d'abord par ton médecin traitant pour être bien remboursé·e et orienté·e."
        }
        return "Décris-moi ce qui te gêne (par ex. « qui consulter pour mes migraines ? ») et je t'oriente vers le bon spécialiste. Et dans le doute, ton médecin traitant reste la meilleure porte d'entrée."
    }
}

// MARK: - Banque de conseils bien-être

enum TipBank {
    static let sommeil = [
        "Couche-toi et lève-toi à heures régulières, même le week-end — ton horloge interne adore la routine.",
        "Éteins les écrans 30 à 60 min avant de dormir : la lumière bleue retarde la mélatonine.",
        "Chambre idéale : 18-19 °C, noir complet, silence (ou bruit blanc).",
        "Évite la caféine après 14 h — elle reste 6 h dans ton corps.",
        "Si tu ne dors pas au bout de 20 min, lève-toi et lis dans une autre pièce, lumière douce.",
        "La sieste parfaite : 15-20 min avant 15 h. Plus longue, elle vole ta nuit.",
        "Un bain ou une douche chaude 1 h avant le lit aide le corps à basculer en mode sommeil.",
        "L'alcool endort mais fragmente la nuit : il sabote le sommeil profond.",
    ]
    static let stress = [
        "Respiration 4-7-8 : inspire 4 s, retiens 7 s, expire 8 s. Trois cycles suffisent à calmer le système nerveux.",
        "5 minutes de cohérence cardiaque (5 s inspiration / 5 s expiration) trois fois par jour, ça change tout.",
        "Écris ce qui te tracasse sur papier avant de dormir : ton cerveau arrête de le ruminer.",
        "La règle des 5-4-3-2-1 en crise d'angoisse : nomme 5 choses que tu vois, 4 que tu touches, 3 que tu entends, 2 que tu sens, 1 que tu goûtes.",
        "Marche 10 minutes dehors sans téléphone. C'est le plus vieux anxiolytique du monde.",
        "Réduis les infos anxiogènes : un point d'actualité par jour suffit largement.",
        "Dire non à une sollicitation, c'est dire oui à ton équilibre.",
    ]
    static let alimentation = [
        "Un petit-déjeuner protéiné (œufs, yaourt, fromage blanc) stabilise l'humeur et l'énergie jusqu'au midi.",
        "Vise 3 couleurs de légumes par jour — la variété nourrit ton microbiote, allié de ton moral.",
        "Les oméga-3 (sardines, maquereau, noix) sont associés à une meilleure santé mentale.",
        "Bois avant d'avoir soif : la déshydratation légère fatigue et irrite.",
        "Le sucre rapide console 10 minutes et fatigue 2 heures. Une poignée d'amandes tient mieux.",
        "Mange en pleine conscience une fois par jour : sans écran, en mâchant vraiment.",
    ]
    static let activite = [
        "20 minutes de marche rapide = effet mesurable sur l'humeur pendant 2 h.",
        "L'exercice du matin cale ton horloge interne et améliore la nuit suivante.",
        "Monte les escaliers aujourd'hui. Chaque marche compte, littéralement.",
        "Étire-toi 5 minutes au réveil : dos, nuque, épaules. Ton corps portera mieux ta journée.",
        "Le sport le plus efficace est celui que tu referas demain. Choisis celui qui te plaît.",
    ]
    static let moral = [
        "Note chaque soir 3 choses positives de ta journée, même minuscules. En 3 semaines, le cerveau change de filtre.",
        "Appelle quelqu'un que tu aimes aujourd'hui. Le lien social est le meilleur prédicteur du bien-être.",
        "Fais une chose qui te fait plaisir PAR JOUR, sans la mériter. C'est de la maintenance, pas du luxe.",
        "Compare-toi à toi d'hier, jamais aux autres d'aujourd'hui.",
        "Range 10 minutes : un espace clair apaise vraiment le mental.",
        "La lumière du jour dans les 30 min après le réveil booste l'humeur toute la journée.",
    ]
    static func random(_ category: [String]) -> String {
        category[Int(Date().timeIntervalSince1970 / 60) % category.count]
    }
}

// Généré automatiquement depuis le lexique entraîné (216 phrases de test, 100 %).
enum Intent: String, CaseIterable {
    case crisisSuicide, crisisPanic, crisisViolence, crisisMedical, emoSad, emoAnxious, emoAngry, emoLonely, emoTired, emoGuilt, emoJoy, emoHeartbreak, emoGrief, actWater, actConso, actHygiene, actMoodLog, actMedTaken, actSideEffect, actOpenReport, actOpenSettings, actStartBilan, actAddProduct, qMoodAvg, qSleep, qMeds, qConsoStats, qWater, qWeather, qDate, qDrug, qSpecialist, qAdvice, sGreeting, sThanks, sBye, sHowAreYou, sWho
}

enum BotNLU {
    static let lexicon: [Intent: [(String, Int)]] = [
        .crisisSuicide: [("ne plus etre la", 9), ("plus simple de ne plus", 7), ("me faire mal", 8), ("envie de me faire mal", 9), ("me supprimer", 10), ("idees noires", 8), ("me suis coupe", 9), ("me suis coupee", 9), ("me couper", 7), ("si je disparaissais", 8), ("me pendre", 10), ("plus despoir", 7), ("plus aucun espoir", 8), ("tout arreter definitivement", 7), ("jen peux plus de cette vie", 9), ("plus la force de vivre", 9), ("envie de disparaitre", 8), ("envie de mourir", 10), ("me suicider", 10), ("suicidaire", 10), ("en finir", 8), ("plus envie de vivre", 10), ("me faire du mal", 8), ("me scarifier", 9), ("me tailler", 8), ("disparaitre pour toujours", 8), ("vous seriez mieux sans moi", 9), ("je suis un fardeau", 8), ("a quoi bon continuer", 8), ("a quoi bon vivre", 9), ("mettre fin a mes jours", 10), ("je veux mourir", 10), ("marre de vivre", 8), ("me foutre en lair", 9), ("me jeter", 6), ("plus de raison de vivre", 9), ("tout le monde sen fiche de moi", 5)],
        .crisisPanic: [("respiration coupee", 8), ("coeur a fond", 6), ("je fais une attaque", 8), ("fais une crise la", 7), ("peur de mourir la", 8), ("hyperventile", 9), ("coeur bat a", 6), ("palpitations dangoisse", 9), ("malaise dangoisse", 8), ("tetanisee", 6), ("crise dangoisse", 10), ("crise de panique", 10), ("je panique", 9), ("coeur qui semballe", 7), ("je tremble et jetouffe", 9), ("jarrive plus a respirer tellement je stresse", 9), ("je vais faire un malaise", 7), ("tout tourne", 5), ("je perds le controle", 7), ("jai une attaque de panique", 10), ("je suffoque dangoisse", 9)],
        .crisisViolence: [("pousse contre", 7), ("poussee contre", 8), ("casse des objets", 6), ("jai peur de lui", 8), ("jai peur delle", 8), ("sous emprise", 8), ("crie sur moi", 6), ("controle tout ce que je fais", 7), ("jai peur quand il", 7), ("me frappe", 9), ("me bat ", 8), ("recois des coups", 8), ("il me frappe", 10), ("elle me frappe", 10), ("me tape dessus", 9), ("il me tape", 9), ("elle me tape", 9), ("violent avec moi", 10), ("violence conjugale", 10), ("jai peur de mon mari", 9), ("jai peur de mon copain", 9), ("jai peur de rentrer chez moi", 8), ("il me menace", 9), ("me harcele", 8), ("minsulte tous les jours", 7)],
        .crisisMedical: [("douleur dans le bras gauche", 10), ("bras gauche et la machoire", 10), ("douleur dans le bras", 7), ("la machoire", 5), ("serre dans la poitrine", 10), ("douleur qui serre", 9), ("ne peut plus bouger son bras", 10), ("ne peut plus parler", 8), ("levres bleues", 9), ("douleur et je transpire", 7), ("douleur dans la poitrine", 10), ("perdu connaissance", 9), ("mal a la poitrine", 8), ("douleur poitrine", 10), ("douleur thoracique", 10), ("oppression poitrine", 10), ("bras gauche engourdi", 10), ("narrive plus a respirer", 10), ("jetouffe", 8), ("visage paralyse", 10), ("bouche deviee", 10), ("trouble de la parole soudain", 10), ("perte de connaissance", 9), ("convulsions", 9), ("saigne beaucoup", 8)],
        .emoSad: [(" naze ", 5), ("sans envie", 7), ("morne", 5), ("moral en berne", 8), ("deprime", 7), ("morose", 6), ("pas la joie", 6), ("triste", 5), ("blues", 6), ("noir total", 6), ("envie de rien", 7), ("plus gout a rien", 8), ("trop triste", 8), (" triste ", 6), ("moral est a zero", 9), ("le seum", 6), ("cafard", 7), ("melancolie", 7), ("je suis triste", 8), ("jai le cafard", 8), ("gros coup de blues", 8), ("je deprime", 8), ("moral a zero", 9), ("moral dans les chaussettes", 9), ("envie de pleurer", 8), ("je pleure", 7), ("je me sens mal", 6), ("ca va pas du tout", 6), ("ca va pas fort", 6), ("je vais mal", 7), ("journee pourrie", 6), ("je suis au fond du trou", 9), ("je broie du noir", 8), ("jai le seum", 5), ("pas le moral", 8), ("demoralisee", 8), ("demoralise", 8), ("abattu", 7), ("abattue", 7)],
        .emoAnxious: [("morte de peur", 8), ("mort de peur", 8), ("stress me bouffe", 9), (" le stress ", 5), ("trouille", 7), ("paniquee pour", 6), ("panique pour", 6), ("stress", 4), ("crispee", 6), ("stressee", 6), (" stresse ", 5), ("inquiete", 6), (" inquiet ", 6), ("je suis stresse", 8), ("je suis stressee", 8), ("je stresse", 8), ("angoisse", 7), ("je suis angoissee", 9), ("anxieuse", 8), ("anxieux", 8), ("je rumine", 7), ("je cogite trop", 7), ("boule au ventre", 9), ("je flippe", 7), ("japprehende", 7), ("peur de demain", 6), ("je narrete pas de penser", 6), ("tendu comme un arc", 7), ("nerveuse", 6), ("sous pression", 6)],
        .emoAngry: [("me prend la tete", 7), ("prennent la tete", 6), ("me prend le chou", 7), ("saoulant", 5), ("les nerfs", 7), ("je bous", 7), ("petage de plombs", 8), ("plein le dos", 7), ("ras le bol", 7), ("enerve", 5), ("enervee", 5), ("furax", 7), ("agacee", 6), ("je suis enervee", 8), ("je suis enerve", 8), ("ca menerve", 7), ("je suis furieuse", 9), ("en colere", 8), ("je rage", 7), ("ca me saoule", 6), ("ca me gonfle", 6), ("je suis a cran", 8), ("envie de tout casser", 8), ("hors de moi", 8), ("ca magace", 6), ("insupportable aujourdhui", 5)],
        .emoLonely: [("toute seule", 6), ("tout seul", 6), ("soirees sont longues", 7), ("seule chez moi", 7), ("quelquun pense a moi", 7), ("seule encore", 7), ("seul encore", 7), ("me sens exclue", 8), ("delaissee", 7), ("personne ne mappelle", 8), ("seule ce week end", 8), ("seule encore une fois", 9), ("tellement seule", 9), ("tellement seul", 9), (" seule ce soir", 7), ("isolee", 7), (" isole ", 6), ("je me sens seule", 9), ("je me sens seul", 9), ("personne ne mecoute", 8), ("tout le monde sen fiche", 7), ("personne a qui parler", 9), ("je suis isolee", 8), ("abandonnee", 7), ("personne ne me comprend", 8), ("je nai pas damis", 8), ("solitude", 7)],
        .emoTired: [("epuis", 6), ("quand meme epuisee", 8), ("dors trop et", 5), ("dormir tout le temps", 6), ("tiens plus debout", 9), ("fatiguee", 5), (" fatigue ", 4), ("extenuee", 8), ("harassee", 7), ("videe", 6), ("plus de batterie", 5), ("cerne", 4), ("je suis epuisee", 8), ("je suis epuise", 8), ("creve", 6), ("crevee", 6), ("a bout de forces", 9), ("plus denergie", 7), ("je nen peux plus", 7), ("vide", 4), ("lessivee", 8), ("lessive", 5), ("au bout du rouleau", 9), ("fatiguee de tout", 8), ("burn out", 8), ("surmenee", 8), ("je sature", 7)],
        .emoGuilt: [("toujours moi le probleme", 8), ("je gache tout", 8), ("je merite pas", 7), ("je sers a rien", 8), ("de ma faute", 8), ("men veux", 9), ("je culpabilise", 9), ("cest de ma faute", 8), ("je men veux", 9), ("honte de moi", 9), ("je suis nulle", 8), ("je suis nul", 8), ("bonne a rien", 9), ("bon a rien", 9), ("je rate tout", 8), ("je me deteste", 9), ("je ne vaux rien", 9)],
        .emoJoy: [("grosse peche", 7), ("la peche", 6), ("tout roule", 6), ("nickel aujourdhui", 6), ("rayonnante", 7), ("rayonnant", 7), ("de bonne humeur", 7), ("au top", 6), ("motivee a fond", 7), ("journee parfaite", 8), ("trop bien aujourdhui", 7), ("je suis heureuse", 8), ("je suis heureux", 8), ("super journee", 8), ("trop contente", 8), ("trop content", 8), ("je petille", 7), ("en pleine forme", 8), ("je vais tres bien", 7), ("excellente nouvelle", 7), ("je suis fiere de moi", 9), ("je suis fier de moi", 9), ("ca va super", 7)],
        .emoHeartbreak: [("quon sest quittes", 8), ("on sest quitte", 8), ("sest quittes", 8), ("me remets pas de lui", 8), ("me remets pas delle", 8), ("separes", 6), ("separee", 6), ("mon ex", 5), ("divorce", 6), ("quittes avec", 6), ("plus ensemble", 5), ("rupture", 7), ("il ma quittee", 9), ("elle ma quitte", 9), ("coeur brise", 9), ("chagrin damour", 9), ("je pense encore a mon ex", 8), ("largue", 6), ("larguee", 6), ("separation difficile", 8)],
        .emoGrief: [("la mort de maman", 10), ("la mort de papa", 10), ("anniversaire de la mort", 9), ("la mort de mon", 7), ("la mort de ma", 7), ("nous a quittes", 8), ("nous a quittee", 8), ("funerailles", 7), ("obseques", 7), ("disparu il y a", 5), ("perdu mon", 5), ("perdu ma", 5), ("deuil", 8), ("est decede", 8), ("est decedee", 8), ("est mort", 6), ("est morte", 6), ("jai perdu ma mere", 10), ("jai perdu mon pere", 10), ("perdu un proche", 9), ("enterrement", 7)],
        .actWater: [(" deau ", 5), ("litre deau", 8), ("bouteille deau", 7), ("marquer deux verres", 6), ("marque un verre", 6), ("bue", 3), ("jai bu", 3), (" eau ", 5), ("verres deau", 8), ("verre deau", 8), ("note de leau", 8), ("ajoute de leau", 8), ("hydratation", 5), ("bu de leau", 8)],
        .actConso: [("monster", 7), (" bieres ", 6), ("kro ", 5), ("pinte", 6), ("expresso", 6), ("capsule de cafe", 6), ("deuxieme cafe", 7), ("troisieme clope", 8), ("clope", 6), ("cigarette", 5), ("mon cafe", 5), ("un cafe", 5), ("troisieme cafe", 7), ("redbull", 7), ("energy drink", 7), ("un joint", 8), ("de lalcool", 6), (" biere ", 8), (" vin ", 6), (" the ", 4), ("nicotine", 6), ("jai fume", 8), ("jai pris un cafe", 8), ("note un cafe", 8), ("canette", 6), ("un monster", 7), ("une clope", 8), ("une cigarette", 8), ("un verre dalcool", 8), ("une biere", 7), ("note ma conso", 8)],
        .actHygiene: [("douche du soir", 7), ("douche du matin", 7), (" lave ", 3), ("brossage", 6), ("douche faite", 9), ("dents lavees", 9), ("lave les dents", 8), ("brossage fait", 8), ("douchee ce", 7), ("jai pris ma douche", 9), ("douche prise", 9), ("je me suis douchee", 9), ("je me suis douche", 9), ("dents brossees", 9), ("je me suis brosse les dents", 9), ("brosse les dents", 8)],
        .actMoodLog: [("sur 10", 5), ("mets moi", 4), ("note moi a", 7), ("mets 7", 6), ("mets 6", 6), ("mets 8", 6), ("note mon humeur a", 9), ("mon humeur est a", 8), ("humeur a 7", 8), ("je me sens a 8", 6), ("enregistre mon humeur", 9), ("note 7 sur 10", 7)],
        .actMedTaken: [(" avales ", 6), ("medicaments du soir avales", 10), ("pris mes medocs", 9), ("medocs pris", 9), ("avale mes cachets", 9), ("pris mes cachets", 9), ("cachets pris", 9), ("traitement pris", 9), ("avale mon cachet", 9), ("pris ma dose", 8), ("jai pris mon medicament", 9), ("jai pris mes medicaments", 9), ("medicament pris", 9), ("jai pris mon traitement", 9), ("valide ma prise", 9), ("jai pris mon cachet", 9)],
        .actSideEffect: [("depuis le nouveau traitement", 9), ("tete qui tourne depuis", 9), ("depuis mon nouveau medicament", 9), ("bizarre depuis que je prends", 9), ("vertiges depuis", 8), ("nausees depuis", 8), ("mal depuis que je prends", 8), ("supporte mal mon", 7), ("effet secondaire", 9), ("me donne des nausees", 8), ("me donne mal a la tete", 7), ("me donne des vertiges", 8), ("depuis que je prends", 7), ("mal supporte", 6)],
        .actOpenReport: [("fais voir le rapport", 10), ("voir le rapport", 9), ("affiche le rapport", 10), ("mon rapport", 7), ("le rapport stp", 9), ("rapport pour mon medecin", 9), ("ouvre le rapport", 10), ("montre le rapport", 9), ("voir mon rapport", 9), ("mon bilan du mois", 7), ("rapport medecin", 8), ("genere le rapport", 9)],
        .actOpenSettings: [("alarmes de medicaments", 8), ("regler mes alarmes", 8), ("mes rappels", 6), ("regler les rappels", 8), ("parametrer", 6), ("ouvre les reglages", 10), ("les parametres", 7), ("ajouter un medicament", 8), ("nouveau medicament", 8), ("changer mes rappels", 8), ("modifier mes horaires", 7)],
        .actStartBilan: [("fait le point", 8), ("on fait le point", 9), ("le point moody", 9), ("bilan", 8), ("faire le point", 8), ("on fait mon bilan", 9), ("check in", 6), ("questionnaire", 6)],
        .actAddProduct: [("suivre un produit", 9), ("nouvelle addiction", 8), ("suivre ma conso de", 9), ("track mes cafes", 7)],
        .qMoodAvg: [("sest ameliore", 8), ("mon moral sest", 8), ("ameliore ou pas", 8), ("va mieux ou pas", 7), ("ca donne quoi mon humeur", 10), ("humeur ces derniers jours", 9), ("mon humeur recemment", 8), ("evolution de mon moral", 8), ("moyenne dhumeur", 10), ("ma moyenne", 8), ("mon humeur cette semaine", 8), ("moral ce mois", 7), ("comment evolue mon humeur", 9), ("tendance de mon humeur", 9), ("stats dhumeur", 8)],
        .qSleep: [("manque de sommeil", 9), ("assez dormi en ce moment", 8), ("mes nuits sont comment", 9), ("je dors comment", 8), ("mon temps de sommeil", 8), ("combien jai dormi", 10), ("mon sommeil", 7), ("mes nuits", 7), ("moyenne de sommeil", 9), ("je dors combien", 9), ("bien dormi ces derniers temps", 7)],
        .qMeds: [("medocs du soir", 8), ("medocs du matin", 8), ("quoi prendre ce soir", 7), ("rappelle moi mes medocs", 9), ("mes medicaments", 8), ("mon traitement", 7), ("quelles prises aujourdhui", 8), ("jai pris quoi aujourdhui", 7), ("liste de mes medocs", 9), ("mes medocs", 8)],
        .qConsoStats: [("combien de bieres", 12), ("combien de monster", 12), ("combien de joints", 12), ("jen suis a combien", 9), ("combien jai fume", 10), ("combien jai bu de cafes", 10), ("ma conso de la semaine", 9), ("combien de cigarettes", 12), ("combien de cafes", 12), ("combien de clopes", 12), ("jai fume combien", 11), ("ma conso", 7), ("consommation cette semaine", 8)],
        .qWater: [("combien deau", 9), ("jai bu combien", 8), ("mon hydratation", 8)],
        .qWeather: [("il caille", 9), ("il gele", 9), ("canicule", 8), ("il fait combien dehors", 9), ("quel temps", 8), ("temps dehors", 8), ("fait beau", 7), ("fait froid", 6), ("fait chaud", 6), ("la meteo", 9), ("degres dehors", 8), ("meteo", 9), ("le temps quil fait", 9), ("il pleut", 7), ("il va pleuvoir", 8), ("temperature dehors", 8), ("beau dehors", 7), ("prendre un parapluie", 8)],
        .qDate: [("le combien aujourdhui", 9), ("on est le combien", 9), ("quel jour sommes nous", 9), ("la date du jour", 9), ("quel jour", 9), ("quelle date", 9), ("la date daujourdhui", 9), ("quelle heure", 9), ("on est quel jour", 9), ("il est quelle heure", 9)],
        .qDrug: [(" dangereux", 5), ("sans danger", 6), ("compatible avec", 5), ("interaction", 7), ("cest quoi le", 6), ("cest quoi la", 6), ("a quoi sert", 7), ("effets du", 6), ("effets de la", 6), ("info sur le medicament", 9), ("posologie", 7), ("notice du", 7), ("generique de", 7)],
        .qSpecialist: [("je vais voir qui", 10), ("voir qui pour", 9), ("adresser a qui", 9), ("je vois qui", 8), ("je consulte qui", 9), ("quel doc ", 6), ("aller voir qui", 8), ("quel genre de medecin", 9), ("quel specialiste", 10), ("quel medecin", 9), ("qui consulter", 10), ("vers qui me tourner", 8), ("dois je voir un medecin", 8), ("besoin dun docteur", 7), ("oriente moi", 7)],
        .qAdvice: [("aide moi a", 7), ("moins stresser", 7), ("mieux dormir", 7), ("me detendre", 7), ("un tips", 7), ("tips pour", 7), ("mendormir", 6), ("comment faire pour dormir", 8), ("des conseils", 7), ("recommandes quoi", 7), ("un conseil", 8), ("une astuce", 8), ("aide moi a dormir", 8), ("comment mieux dormir", 8), ("comment gerer mon stress", 8), ("comment aller mieux", 7), ("des idees pour", 5), ("motive moi", 7)],
        .sGreeting: [("bonjour", 8), ("salut", 8), ("coucou", 8), ("bonsoir", 8), ("hello", 7), ("yo moody", 8), ("cc", 4)],
        .sThanks: [("merci", 8), ("tes genial", 7), ("tu maides beaucoup", 8), ("tes top", 7)],
        .sBye: [("au revoir", 8), ("bonne nuit", 8), ("a demain", 8), ("je te laisse", 7), ("a plus", 6), ("bye", 6)],
        .sHowAreYou: [("comment vas tu", 9), ("comment tu vas", 9), ("ca va toi", 8), ("tu vas bien", 8)],
        .sWho: [("qui es tu", 9), ("tes qui", 9), ("tu es quoi", 8), ("que sais tu faire", 9), ("tes capacites", 8), ("comment tu marches", 7), ("tu peux faire quoi", 9)],
    ]

    static let crisisOrder: [Intent] = [.crisisSuicide, .crisisMedical, .crisisViolence, .crisisPanic]

    static func normalize(_ s: String) -> String {
        var t = s.lowercased().folding(options: .diacriticInsensitive, locale: Locale(identifier: "fr"))
        t = t.replacingOccurrences(of: "\u{2019}", with: "").replacingOccurrences(of: "'", with: "")
        t = String(t.map { $0.isLetter || $0.isNumber ? $0 : " " })
        return " " + t + " "
    }

    static func classify(_ text: String) -> Intent? {
        let t = normalize(text)
        var scores: [Intent: Int] = [:]
        for (intent, pats) in lexicon {
            var sc = 0
            for (p, w) in pats where t.contains(p) { sc += w }
            if sc > 0 { scores[intent] = sc }
        }
        guard !scores.isEmpty else { return nil }
        let crises = crisisOrder.compactMap { c in scores[c].map { (c, $0) } }.filter { $0.1 >= 6 }
        if let top = crises.map(\.1).max() {
            for c in crisisOrder where scores[c] == top { return c }
        }
        let best = scores.max { $0.value < $1.value }!
        return best.value >= 5 ? best.key : nil
    }

    /// Premier nombre 0-max dans le texte (chiffres ou lettres françaises).
    static func number(_ text: String, max: Double = 1000) -> Double? {
        let t = normalize(text)
        if let r = t.range(of: #"\d+([.,]\d+)?"#, options: .regularExpression),
           let v = Double(t[r].replacingOccurrences(of: ",", with: ".")), v <= max { return v }
        let words: [(String, Double)] = [("un ", 1), ("une ", 1), ("deux", 2), ("trois", 3), ("quatre", 4), ("cinq", 5),
                                         ("six", 6), ("sept", 7), ("huit", 8), ("neuf", 9), ("dix ", 10), ("demi", 0.5)]
        for (w, v) in words where t.contains(" " + w) && v <= max { return v }
        return nil
    }
}

// MARK: - Réconfort : trouver les mots justes (validation → normalisation → piste)

enum Comfort {
    // Chaque émotion : plusieurs réponses complètes, jamais de positivité toxique.
    static let bank: [Intent: [String]] = [
        .emoSad: [
            "Je t'entends, et ce que tu ressens compte. La tristesse n'a pas besoin de se justifier — elle est là, c'est tout. Est-ce que tu veux me raconter ce qui pèse le plus, là, maintenant ?",
            "D'accord. Je suis là, on prend une minute ensemble. Tu n'as rien à prouver à personne aujourd'hui. Si tu devais mettre des mots sur ce qui te rend triste, ce serait quoi ?",
            "Ça a l'air lourd aujourd'hui. C'est humain d'avoir des jours comme ça — même si ça ne les rend pas plus faciles. Une toute petite chose qui te fait habituellement du bien : une douche chaude, une chanson, un message à quelqu'un. Laquelle te semble possible là ?",
            "Merci de me le dire — le noter, c'est déjà prendre soin de toi. Les émotions passent comme la météo, même quand elles semblent installées. Tu veux qu'on note ce moment dans ton journal pour en parler à ton médecin ?",
        ],
        .emoAnxious: [
            "Le stress te serre, je le sens dans tes mots. Respire une fois profondément avec moi : inspire 4 secondes… retiens 4… souffle 6. Ce qui t'inquiète, c'est plutôt quelque chose de précis, ou une inquiétude diffuse ?",
            "L'anxiété raconte souvent des histoires plus grandes que la réalité. Tu as le droit de ne pas la croire sur parole. Dis-moi : qu'est-ce qui dépend vraiment de toi dans ce qui t'angoisse ?",
            "OK, on ralentit deux minutes. Pose tes pieds bien à plat, relâche tes épaules. Nomme-moi 3 choses que tu vois autour de toi — ça ramène le cerveau ici et maintenant.",
        ],
        .emoAngry: [
            "Ta colère a le droit d'exister — c'est souvent le signe qu'une limite a été franchie. Qu'est-ce qui l'a déclenchée ?",
            "Je comprends que ça bouillonne. Avant de répondre à qui que ce soit : 10 grandes respirations, ou 5 minutes de marche. La colère est une excellente conseillère mais une très mauvaise messagère.",
            "C'est légitime d'en avoir marre. Si tu écrivais ici tout ce que tu as sur le cœur, sans filtre ? Personne d'autre ne le lira.",
        ],
        .emoLonely: [
            "La solitude fait mal, vraiment. Et le fait que tu m'en parles montre que tu cherches du lien — c'est une force, pas une faiblesse. Y a-t-il UNE personne, même perdue de vue, à qui tu pourrais envoyer un petit message aujourd'hui ?",
            "Je suis là, et pas par politesse. Se sentir seul·e ne veut pas dire être indigne d'amour — ça veut dire que tes besoins de lien ne sont pas nourris en ce moment. Une idée toute simple : un lieu avec de la vie (marché, café, bibliothèque), juste pour être entouré·e. Ça te semble faisable cette semaine ?",
            "Merci de me le confier. Beaucoup de gens ressentent exactement ça sans jamais le dire. Tu comptes, même les jours où personne ne te le rappelle.",
        ],
        .emoTired: [
            "Ton corps et ta tête te demandent une pause — c'est une information, pas un défaut. Qu'est-ce que tu pourrais annuler ou reporter aujourd'hui, sans que le monde s'arrête ?",
            "L'épuisement qui dure, ce n'est pas de la paresse, c'est un signal. Ce soir : mission minimum. Un repas simple, pas d'écran tard, dodo tôt. Le reste attendra, promis.",
            "Je note que tu es à plat. Si ça dure depuis plusieurs semaines malgré le repos, parles-en à ton médecin — la fatigue chronique se soigne. En attendant : quelle est LA chose vraiment obligatoire aujourd'hui ? On oublie le reste.",
        ],
        .emoGuilt: [
            "Stop — tu parles de toi comme tu ne parlerais jamais d'une amie. Qu'est-ce que tu dirais à quelqu'un que tu aimes s'il te disait exactement ça ?",
            "La culpabilité utile dure 5 minutes et pousse à réparer. Après, elle ne sert plus qu'à te faire mal. Tu as fait ce que tu pouvais avec ce que tu savais à ce moment-là.",
            "Rater quelque chose ne fait pas de toi quelqu'un de raté. C'est une expérience, pas une identité. Une chose que tu as bien faite cette semaine — dis-m'en une seule ?",
        ],
        .emoJoy: [
            "Ça fait tellement plaisir à lire ! 🌞 Savoure — et note-le dans ton journal : les bons jours documentés sont un trésor pour les jours gris. Qu'est-ce qui a rendu cette journée belle ?",
            "J'adore ! Garde cette énergie précieusement. Petit secret : raconter sa joie à quelqu'un la multiplie. À qui tu vas l'annoncer ?",
            "Excellente nouvelle ! Profite à fond. Si tu veux, fais ton bilan maintenant — c'est le meilleur moment pour enregistrer un beau 9/10.",
        ],
        .emoHeartbreak: [
            "Une rupture, c'est un deuil — le cœur a besoin de temps, pas de « passe à autre chose ». Sois patient·e avec toi. Tu tiens le coup comment, là, aujourd'hui ?",
            "Ce que tu vis fait vraiment mal, et c'est normal que ça fasse mal : tu avais investi ton cœur. Mange, dors, entoure-toi — le reste viendra. Et évite de regarder son profil, ça rouvre la plaie à chaque fois.",
            "Je suis désolé que tu traverses ça. Les premières semaines sont les pires, puis les vagues s'espacent. Note ton humeur chaque jour ici — tu VERRAS la courbe remonter, preuve à l'appui.",
        ],
        .emoGrief: [
            "Je suis sincèrement désolé pour ta perte. Le deuil n'a ni calendrier ni mode d'emploi — les vagues viennent quand elles viennent. Je suis là si tu veux parler de cette personne, ou de tout autre chose.",
            "Perdre quelqu'un qu'on aime, c'est le plus dur de la vie. Ne laisse personne te dire comment ou combien de temps tu « devrais » être triste. Si le poids devient trop lourd, un psychologue spécialisé en deuil peut vraiment aider — ton médecin traitant peut t'orienter.",
            "Ce que tu ressens est la trace de l'amour qui reste. Prends soin de toi doucement : manger, dormir, respirer. Le reste peut attendre.",
        ],
    ]

    static func reply(for intent: Intent) -> String {
        let variants = bank[intent] ?? []
        guard !variants.isEmpty else { return "Je t'écoute." }
        return variants[Int(Date().timeIntervalSince1970 / 90) % variants.count]
    }
}

// MARK: - Protocoles de crise (jamais improvisés)

enum CrisisProtocol {
    static let suicide = """
    Ce que tu ressens là est très lourd, et je te prends au sérieux. Tu n'as pas à traverser ça seul·e. 💚
    📞 Appelle le 3114 — c'est le numéro national de prévention du suicide : gratuit, 24 h/24, des professionnels qui écoutent vraiment, sans juger.
    Si tu es en danger immédiat, c'est le 15 ou le 112.
    Et si tu peux : dis à UNE personne de confiance, ce soir, ce que tu viens de me dire. Tu comptes plus que tu ne le crois — je reste là, parle-moi.
    """
    static let violence = """
    Ce que tu décris, c'est de la violence, et ce n'est JAMAIS de ta faute. Personne n'a le droit de te faire vivre ça.
    📞 Le 3919 (Violences Femmes Info) : gratuit, anonyme, 24 h/24 — il n'apparaît pas sur les factures téléphoniques.
    En danger immédiat : 17 (police) ou 114 par SMS si tu ne peux pas parler.
    Garde des preuves si tu peux (photos, messages), et parles-en à quelqu'un de confiance. Je suis là.
    """
    static let medical = "⚠️ Ce que tu décris peut être une urgence vitale. Appelle le 15 (SAMU) ou le 112 MAINTENANT — n'attends pas, ne prends pas la voiture toi-même. Chaque minute compte."
    static let panicIntro = "Je suis là, tu n'es pas en danger même si ton corps hurle le contraire — une crise de panique monte, culmine et REDESCEND toujours, en général en moins de 20 minutes. On va la traverser ensemble."
    static let panicSteps = [
        "Pose une main sur ton ventre. Inspire doucement par le nez… 1… 2… 3… 4…",
        "Retiens… 1… 2… 3… 4… 5… 6… 7…",
        "Souffle lentement par la bouche, comme dans une paille… 1… 2… 3… 4… 5… 6… 7… 8…",
        "Encore une fois. Inspire… 4 s… retiens… 7 s… souffle… 8 s. Tu fais ça très bien.",
        "Maintenant, nomme autour de toi : 5 choses que tu VOIS… 4 que tu peux TOUCHER… 3 que tu ENTENDS… 2 que tu SENS… 1 que tu peux GOÛTER.",
        "Comment tu te sens, là ? La vague redescend ? Je reste avec toi le temps qu'il faut. Si les crises se répètent, parles-en à ton médecin : ça se soigne très bien.",
    ]
}

// MARK: - Détail de la journée (depuis la carte « Humeur du jour »)

struct DayDetailSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var offset = 0          // 0 = aujourd'hui, -1 = hier…

    private var dayKey: String { Dates.dayKey(Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date()) }
    private var dayDate: Date { Calendar.current.date(byAdding: .day, value: offset, to: Date()) ?? Date() }
    private var dayEntries: [MoodEntry] { store.entries(on: dayKey) }
    private var log: DayLog { store.dayLogs[dayKey] ?? DayLog() }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    dayPicker
                    heroBlock
                    if dayEntries.isEmpty && store.dayLogs[dayKey] == nil {
                        Card {
                            VStack(spacing: 8) {
                                Image(systemName: "moon.zzz").font(.system(size: 26)).foregroundStyle(Color.inkMute)
                                Text("Rien de noté ce jour-là.")
                                    .font(.system(size: 14, weight: .bold)).foregroundStyle(Color.inkSoft)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 18)
                        }
                    } else {
                        if !dayEntries.isEmpty { timelineBlock }
                        journalBlock
                        if !store.addictions.isEmpty { consoBlock }
                        medsBlock
                        comparisonBlock
                    }
                }
                .padding(18)
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle("Ma journée")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() } } }
        }
    }

    private var dayPicker: some View {
        HStack {
            Button { withAnimation { offset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.inkC)
                    .frame(width: 36, height: 36).background(Circle().fill(.white))
            }
            Spacer()
            VStack(spacing: 1) {
                Text(dayDate.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "fr_FR"))).capitalized)
                    .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Text(offset == 0 ? "Aujourd'hui" : offset == -1 ? "Hier" : "il y a \(-offset) jours")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.inkMute)
            }
            Spacer()
            Button { withAnimation { offset = min(0, offset + 1) } } label: {
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold))
                    .foregroundStyle(offset == 0 ? Color.inkMute.opacity(0.4) : Color.inkC)
                    .frame(width: 36, height: 36).background(Circle().fill(.white))
            }
            .disabled(offset == 0)
        }
    }

    private var heroBlock: some View {
        Card {
            HStack(spacing: 16) {
                MoodRing(value: store.dayAverage(dayKey))
                VStack(alignment: .leading, spacing: 3) {
                    if let avg = store.dayAverage(dayKey) {
                        Text(String(format: "%.1f/10", avg))
                            .font(.system(size: 26, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                        Text(Store.moodLabel(avg)).font(.system(size: 13.5, weight: .bold)).foregroundStyle(Color.brand700)
                        Text("\(dayEntries.count) saisie\(dayEntries.count > 1 ? "s" : "") dans la journée")
                            .font(.system(size: 11.5)).foregroundStyle(Color.inkMute)
                    } else {
                        Text("Pas d'humeur notée").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.inkSoft)
                    }
                }
                Spacer()
            }
        }
    }

    private var timelineBlock: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                blockTitle("clock.fill", "Fil de la journée", Color.accentDeep, Color.accentSoft)
                ForEach(dayEntries) { e in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 8) {
                            Text(String(e.datetime.dropFirst(11).prefix(5)))
                                .font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(Capsule().fill(Color.inkC))
                            Text(String(format: "%.0f/10", e.mood))
                                .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                            Text(Store.moodLabel(e.mood)).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.inkMute)
                            Spacer()
                            Button(role: .destructive) { store.deleteEntry(e.id) } label: {
                                Image(systemName: "trash").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.inkMute)
                            }
                        }
                        let chips = detailChips(e)
                        if !chips.isEmpty {
                            FlowChips(items: chips)
                        }
                        if let n = e.note, !n.isEmpty {
                            Text(n).font(.system(size: 12.5)).foregroundStyle(Color.inkSoft)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Color.cream))
                        }
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.cream.opacity(0.6)))
                }
            }
        }
    }

    private func detailChips(_ e: MoodEntry) -> [(String, String)] {
        var c: [(String, String)] = []
        if let v = e.energy { c.append(("bolt.fill", String(format: "Énergie %.0f/10", v))) }
        if let v = e.appetite { c.append(("fork.knife", String(format: "Appétit %.0f/10", v))) }
        if let v = e.sleep {
            var t = String(format: "Nuit %.1f h", v)
            if let b = e.bedTime, let w = e.wakeTime { t += " (\(b)→\(w))" }
            c.append(("moon.fill", t))
        }
        if let v = e.napMinutes, v > 0 { c.append(("bed.double.fill", "Sieste \(Int(v)) min")) }
        if let ws = e.workouts, !ws.isEmpty {
            for w in ws { c.append(("figure.run", "\(w.sport) \(w.minutes) min")) }
        } else if let v = e.sport, v > 0 { c.append(("figure.run", "Sport \(Int(v)) min")) }
        if let v = e.menstruation { c.append(("drop.fill", ["Pas de règles", "Règles légères", "Règles moyennes", "Règles abondantes"][min(3, Int(v))])) }
        if e.sexualActivity == true { c.append(("heart.fill", "Activité intime")) }
        if let v = e.spending, v > 0 { c.append(("eurosign.circle.fill", String(format: "%.0f €", v))) }
        return c
    }

    private var journalBlock: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                blockTitle("sparkles", "Hygiène & journée", Color(hex: 0xB07F14), Color.butterC)
                grid([
                    ("shower.fill", "Douche matin", boolText(log.showerAM)),
                    ("shower.fill", "Douche soir", boolText(log.showerPM)),
                    ("mouth.fill", "Dents matin", boolText(log.teethAM)),
                    ("mouth.fill", "Dents soir", boolText(log.teethPM)),
                    ("drop.fill", "Eau", log.waterGlasses.map { "\(Int($0)) verre\($0 > 1 ? "s" : "")" } ?? "—"),
                    ("heart.fill", "Rapports", log.sexCount.map { "\(Int($0))" } ?? "—"),
                ])
            }
        }
    }
    private func boolText(_ b: Bool?) -> String { b == true ? "Oui" : b == false ? "Non" : "—" }

    private var consoBlock: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                blockTitle("takeoutbag.and.cup.and.straw.fill", "Consommations", Color.rose, Color.peachC)
                ForEach(store.addictions) { a in
                    let n = store.addictionLog.filter { $0.id == a.id && $0.at.hasPrefix(dayKey) }.count
                    HStack {
                        Text(a.name).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkC)
                        Spacer()
                        Text("\(n) \(a.unit ?? "")")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(n > 0 ? Color.rose : Color.inkMute)
                    }
                    .padding(.vertical, 3)
                }
            }
        }
    }

    private var medsBlock: some View {
        let wd = Calendar.current.component(.weekday, from: dayDate) - 1
        let doses = store.dosesFor(dayKey: dayKey, jsWeekday: wd).sorted { $0.time < $1.time }
        return Group {
            if !doses.isEmpty {
                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        let taken = doses.filter(\.taken).count
                        HStack {
                            blockTitle("pills.fill", "Médicaments", Color.rose, Color.peachC)
                            Spacer()
                            Text("\(taken)/\(doses.count)")
                                .font(.system(size: 12, weight: .heavy, design: .rounded))
                                .foregroundStyle(taken == doses.count ? Color.brand700 : Color.inkMute)
                        }
                        ForEach(doses) { d in
                            HStack(spacing: 8) {
                                Image(systemName: d.taken ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 14)).foregroundStyle(d.taken ? Color.brand : Color.inkMute.opacity(0.5))
                                Text(d.time).font(.system(size: 12, weight: .bold, design: .rounded)).foregroundStyle(Color.inkMute)
                                Text(d.name).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.inkC)
                                    .lineLimit(1).minimumScaleFactor(0.8)
                                Spacer()
                                if let dose = d.dose { Text(dose).font(.system(size: 11.5)).foregroundStyle(Color.inkMute) }
                            }
                        }
                    }
                }
            }
        }
    }

    private var comparisonBlock: some View {
        let avg = store.dayAverage(dayKey)
        let prevKey = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -1, to: dayDate) ?? dayDate)
        let prev = store.dayAverage(prevKey)
        let week = store.average(days: 7)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                blockTitle("chart.line.uptrend.xyaxis", "Comparaison", Color.accentDeep, Color.accentSoft)
                if let avg {
                    if let prev {
                        let d = avg - prev
                        compareRow("Vs la veille", d)
                    }
                    if let week {
                        compareRow("Vs ta moyenne 7 jours", avg - week)
                    }
                } else {
                    Text("Note ton humeur pour voir les comparaisons.")
                        .font(.system(size: 12.5)).foregroundStyle(Color.inkMute)
                }
            }
        }
    }
    private func compareRow(_ label: String, _ delta: Double) -> some View {
        HStack {
            Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.inkSoft)
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: delta > 0.05 ? "arrow.up.right" : delta < -0.05 ? "arrow.down.right" : "equal")
                    .font(.system(size: 10, weight: .heavy))
                Text(String(format: "%+.1f", delta)).font(.system(size: 13, weight: .bold, design: .rounded))
            }
            .foregroundStyle(delta > 0.05 ? Color.brand700 : delta < -0.05 ? Color.rose : Color.inkMute)
        }
    }

    private func blockTitle(_ icon: String, _ text: String, _ fg: Color, _ bg: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(fg)
                .frame(width: 28, height: 28).background(Circle().fill(bg))
            Text(text).font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
        }
    }
    private func grid(_ items: [(String, String, String)]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                HStack(spacing: 6) {
                    Image(systemName: it.0).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.inkMute)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(it.1).font(.system(size: 10.5)).foregroundStyle(Color.inkMute).lineLimit(1)
                        Text(it.2).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                    }
                    Spacer(minLength: 0)
                }
                .padding(9)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
            }
        }
    }
}

/// Petites pastilles qui passent à la ligne.
struct FlowChips: View {
    var items: [(String, String)]
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                    HStack(spacing: 4) {
                        Image(systemName: it.0).font(.system(size: 9, weight: .bold))
                        Text(it.1).font(.system(size: 11, weight: .semibold)).fixedSize()
                    }
                    .foregroundStyle(Color.inkSoft)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(Capsule().fill(.white))
                }
            }
        }
    }
}

// MARK: - Détail des tendances (depuis la carte « Ton humeur — 14 jours »)

struct MoodTrendSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var days = 14

    private var series: [(date: Date, value: Double?)] { store.dailySeries(days) }
    private var values: [Double] { series.compactMap(\.value) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    periodPicker
                    if values.isEmpty {
                        Card {
                            VStack(spacing: 8) {
                                Image(systemName: "chart.xyaxis.line").font(.system(size: 26)).foregroundStyle(Color.inkMute)
                                Text("Pas encore de données sur cette période.")
                                    .font(.system(size: 14, weight: .bold)).foregroundStyle(Color.inkSoft)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 20)
                        }
                    } else {
                        chartBlock
                        kpiBlock
                        extremesBlock
                        distributionBlock
                        weekdayBlock
                        sleepBlock
                        listBlock
                    }
                }
                .padding(18)
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle("Tes tendances")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() } } }
        }
    }

    private var periodPicker: some View {
        Picker("", selection: $days) {
            Text("7 j").tag(7); Text("14 j").tag(14); Text("30 j").tag(30); Text("90 j").tag(90)
        }
        .pickerStyle(.segmented)
    }

    private var chartBlock: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Évolution de ton humeur")
                    .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                Chart {
                    ForEach(Array(series.enumerated()), id: \.offset) { _, pt in
                        if let v = pt.value {
                            AreaMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                .foregroundStyle(LinearGradient(colors: [.accentBlue.opacity(0.25), .accentBlue.opacity(0)],
                                                                startPoint: .top, endPoint: .bottom))
                            LineMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                .foregroundStyle(Color.accentBlue)
                                .lineStyle(StrokeStyle(lineWidth: 2.4, lineCap: .round))
                            if days <= 30 {
                                PointMark(x: .value("Jour", pt.date, unit: .day), y: .value("Humeur", v))
                                    .foregroundStyle(Color.accentBlue).symbolSize(26)
                            }
                        }
                    }
                    if let avg = mean {
                        RuleMark(y: .value("Moyenne", avg))
                            .foregroundStyle(Color.brand.opacity(0.55))
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
                    AxisMarks(values: .stride(by: .day, count: days <= 14 ? 2 : days <= 30 ? 5 : 15)) { _ in
                        AxisValueLabel(format: .dateTime.day().month(.narrow), centered: true)
                            .font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.inkMute)
                    }
                }
                .frame(height: 210)
            }
        }
    }

    private var mean: Double? { values.isEmpty ? nil : values.reduce(0, +) / Double(values.count) }
    private var median: Double? {
        guard !values.isEmpty else { return nil }
        let s = values.sorted()
        return s.count % 2 == 0 ? (s[s.count/2 - 1] + s[s.count/2]) / 2 : s[s.count/2]
    }

    private var kpiBlock: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            kpi("Moyenne", mean.map { String(format: "%.1f", $0) } ?? "—", "chart.bar.fill", Color.accentDeep, Color.accentSoft)
            kpi("Médiane", median.map { String(format: "%.1f", $0) } ?? "—", "equal.circle.fill", Color.brand700, Color.mint)
            kpi("Amplitude", values.isEmpty ? "—" : String(format: "%.0f → %.0f", values.min()!, values.max()!),
                "arrow.up.arrow.down", Color(hex: 0xB07F14), Color.butterC)
            kpi("Jours notés", "\(values.count)/\(days)", "calendar", Color.rose, Color.peachC)
        }
    }
    private func kpi(_ label: String, _ value: String, _ icon: String, _ fg: Color, _ bg: Color) -> some View {
        Card(padding: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(fg)
                    .frame(width: 30, height: 30).background(Circle().fill(bg))
                Text(value).font(.system(size: 19, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.inkMute)
            }
        }
    }

    private var extremesBlock: some View {
        let noted = series.compactMap { pt in pt.value.map { (pt.date, $0) } }
        let best = noted.max { $0.1 < $1.1 }
        let worst = noted.min { $0.1 < $1.1 }
        // évolution vs période précédente
        let prevCut = Calendar.current.date(byAdding: .day, value: -days * 2, to: Date())!
        let curCut = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let prevVals = store.entries.filter { $0.date >= Dates.dayKey(prevCut) && $0.date < Dates.dayKey(curCut) }.map(\.mood)
        let prevAvg = prevVals.isEmpty ? nil : prevVals.reduce(0, +) / Double(prevVals.count)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Points marquants").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                if let best {
                    extremeRow("sun.max.fill", Color.brand700, "Meilleur jour",
                               best.0.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(Locale(identifier: "fr_FR"))),
                               String(format: "%.1f", best.1))
                }
                if let worst {
                    extremeRow("cloud.rain.fill", Color.rose, "Jour le plus dur",
                               worst.0.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(Locale(identifier: "fr_FR"))),
                               String(format: "%.1f", worst.1))
                }
                if let m = mean, let p = prevAvg {
                    let d = m - p
                    HStack {
                        Image(systemName: d > 0.05 ? "arrow.up.right" : d < -0.05 ? "arrow.down.right" : "equal")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(d > 0.05 ? Color.brand700 : d < -0.05 ? Color.rose : Color.inkMute)
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(d > 0.05 ? Color.mint : d < -0.05 ? Color.peachC : Color.cream))
                        Text("Vs les \(days) jours précédents")
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.inkSoft)
                        Spacer()
                        Text(String(format: "%+.1f", d))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(d > 0.05 ? Color.brand700 : d < -0.05 ? Color.rose : Color.inkMute)
                    }
                }
            }
        }
    }
    private func extremeRow(_ icon: String, _ tint: Color, _ label: String, _ date: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(tint)
                .frame(width: 28, height: 28).background(Circle().fill(tint.opacity(0.12)))
            VStack(alignment: .leading, spacing: 0) {
                Text(label).font(.system(size: 11)).foregroundStyle(Color.inkMute)
                Text(date.capitalized).font(.system(size: 13, weight: .bold)).foregroundStyle(Color.inkC)
            }
            Spacer()
            Text(value).font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(tint)
        }
    }

    private var distributionBlock: some View {
        let buckets = [("1-2", 1.0...2.0), ("3-4", 3.0...4.0), ("5-6", 5.0...6.0), ("7-8", 7.0...8.0), ("9-10", 9.0...10.0)]
        let counts = buckets.map { b in values.filter { b.1.contains($0.rounded()) }.count }
        let maxC = max(counts.max() ?? 1, 1)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Répartition de tes journées")
                    .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                HStack(alignment: .bottom, spacing: 10) {
                    ForEach(Array(buckets.enumerated()), id: \.offset) { i, b in
                        VStack(spacing: 5) {
                            Text(counts[i] > 0 ? "\(counts[i])" : "")
                                .font(.system(size: 10, weight: .bold)).foregroundStyle(Color.inkMute)
                            RoundedRectangle(cornerRadius: 7)
                                .fill(bucketColor(i))
                                .frame(height: max(6, CGFloat(counts[i]) / CGFloat(maxC) * 90))
                            Text(b.0).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.inkMute)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 130, alignment: .bottom)
            }
        }
    }
    private func bucketColor(_ i: Int) -> Color {
        [Color.rose, Color(hex: 0xE8845C), Color(hex: 0xE8B23C), Color(hex: 0x7FC24B), Color.brand][min(4, i)]
    }

    private var weekdayBlock: some View {
        let names = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
        var sums = [Double](repeating: 0, count: 7), counts = [Int](repeating: 0, count: 7)
        for pt in series { if let v = pt.value {
            let wd = Calendar.current.component(.weekday, from: pt.date) - 1
            sums[wd] += v; counts[wd] += 1
        } }
        let avgs = (0..<7).map { counts[$0] > 0 ? sums[$0] / Double(counts[$0]) : nil }
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Ton humeur selon le jour")
                    .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                HStack(alignment: .bottom, spacing: 7) {
                    ForEach(1..<8, id: \.self) { idx in
                        let i = idx % 7   // commence lundi
                        VStack(spacing: 5) {
                            Text(avgs[i].map { String(format: "%.1f", $0) } ?? "—")
                                .font(.system(size: 9.5, weight: .bold)).foregroundStyle(Color.inkMute)
                            RoundedRectangle(cornerRadius: 6)
                                .fill(avgs[i] == nil ? Color.cream : Color.accentBlue.opacity(0.75))
                                .frame(height: max(6, CGFloat(avgs[i] ?? 0) / 10 * 80))
                            Text(names[i]).font(.system(size: 10, weight: .bold)).foregroundStyle(Color.inkMute)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 120, alignment: .bottom)
            }
        }
    }

    private var sleepBlock: some View {
        let cut = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -days, to: Date())!)
        let sel = store.entries.filter { $0.date >= cut && $0.sleep != nil }
        let good = sel.filter { ($0.sleep ?? 0) >= 7 }.map(\.mood)
        let short = sel.filter { ($0.sleep ?? 0) < 7 }.map(\.mood)
        return Group {
            if good.count >= 2 && short.count >= 2 {
                let ga = good.reduce(0, +) / Double(good.count)
                let sa = short.reduce(0, +) / Double(short.count)
                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Sommeil et humeur").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                        HStack(spacing: 12) {
                            sleepStat("≥ 7 h", ga, good.count, Color.brand, Color.mint)
                            sleepStat("< 7 h", sa, short.count, Color.rose, Color.peachC)
                        }
                        Text(ga - sa >= 0.5
                             ? String(format: "Tes nuits longues s'accompagnent d'une humeur supérieure de %.1f point. Le sommeil te fait clairement du bien.", ga - sa)
                             : "Pas d'écart marqué entre tes nuits courtes et longues sur cette période.")
                            .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                    }
                }
            }
        }
    }
    private func sleepStat(_ label: String, _ avg: Double, _ n: Int, _ fg: Color, _ bg: Color) -> some View {
        VStack(spacing: 3) {
            Text(label).font(.system(size: 11, weight: .bold)).foregroundStyle(Color.inkMute)
            Text(String(format: "%.1f", avg)).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(fg)
            Text("\(n) jour\(n > 1 ? "s" : "")").font(.system(size: 10)).foregroundStyle(Color.inkMute)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 14).fill(bg))
    }

    private var listBlock: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Jour par jour").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                ForEach(Array(series.reversed().enumerated()), id: \.offset) { _, pt in
                    HStack(spacing: 10) {
                        Text(pt.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(Locale(identifier: "fr_FR"))).capitalized)
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.inkSoft)
                            .frame(width: 92, alignment: .leading)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.cream).frame(height: 8)
                                if let v = pt.value {
                                    Capsule().fill(Color.accentBlue.opacity(0.8))
                                        .frame(width: geo.size.width * CGFloat(v / 10), height: 8)
                                }
                            }
                            .frame(height: 8)
                            .frame(maxHeight: .infinity, alignment: .center)
                        }
                        .frame(height: 16)
                        Text(pt.value.map { String(format: "%.1f", $0) } ?? "—")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(pt.value == nil ? Color.inkMute.opacity(0.5) : Color.inkC)
                            .frame(width: 30, alignment: .trailing)
                    }
                }
            }
        }
    }
}

// MARK: - Carte assistant sur l'accueil

struct BotCard: View {
    @State private var showChat = false
    var body: some View {
        Button { showChat = true } label: {
            Card {
                HStack(spacing: 12) {
                    Image(systemName: "waveform.and.mic").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(Circle().fill(Color.brand))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Bilan Moody").font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                        Text("Parle-moi de ta journée — je note tout pour toi")
                            .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.inkMute)
                }
            }
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showChat) { MoodyChatView() }
    }
}

// MARK: - Bilan Moody : chatbot local (saisie conversationnelle, Q&A, voix)

/// Étapes du bilan conversationnel — mêmes données que le formulaire.
enum BotStep { case greeting, mood, energy, appetite, sleep, nap, sport, hygiene, water, conso, note, done, chat }

struct BotMessage: Identifiable, Equatable {
    let id = UUID()
    var fromBot: Bool
    var text: String
}

@MainActor
final class BilanBot: ObservableObject {
    @Published var messages: [BotMessage] = []
    @Published var step: BotStep = .chat
    @Published var listening = false
    @Published var speaking = false
    @Published var voiceOn = true

    // réponses en cours de collecte
    private var mood: Double?
    private var energy: Double?
    private var appetite: Double?
    private var sleepH: Double?
    private var napMin: Double?
    private var sportMin: Double?
    private var note: String?
    private var consoIndex = 0

    weak var store: Store?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "fr-FR"))
    private var recTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var player: AVAudioPlayer?
    private let appleVoice = AVSpeechSynthesizer()

    private var firstName: String {
        store?.medical.fullName?.split(separator: " ").first.map(String.init)
            ?? store?.settings.name ?? ""
    }

    // — conversation —

    func welcome() {
        guard messages.isEmpty else { return }
        let hello = firstName.isEmpty ? "Coucou !" : "Coucou \(firstName) !"
        say("\(hello) Je suis Moody. Appuie sur « Bilan Moody » pour faire le point ensemble, ou pose-moi une question sur tes données — humeur, sommeil, médicaments…")
    }

    func startBilan() {
        step = .greeting
        let h = Calendar.current.component(.hour, from: Date())
        let moment = h < 12 ? "ce matin" : h < 18 ? "cet après-midi" : "ce soir"
        say("C'est parti pour ton bilan \(moment) ! Dis-moi d'abord : comment te sens-tu, sur une échelle de 1 à 10 ?")
        step = .mood
    }

    func userSaid(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        messages.append(BotMessage(fromBot: false, text: text))
        process(text)
    }

    private func process(_ text: String) {
        switch step {
        case .mood:
            if let n = Self.number(in: text, max: 10) {
                mood = n
                let react = n >= 8 ? "Génial, ça fait plaisir !" : n >= 5 ? "D'accord, une journée correcte." : "Merci de me le dire — c'est courageux de le noter."
                say("\(react) Et ton énergie, de 1 à 10 ?"); step = .energy
            } else { say("Donne-moi un chiffre entre 1 et 10 pour ton humeur 🙂") }
        case .energy:
            if let n = Self.number(in: text, max: 10) {
                energy = n
                say("Noté. Ton appétit aujourd'hui, toujours de 1 à 10 ?"); step = .appetite
            } else { say("Un chiffre de 1 à 10 pour l'énergie ?") }
        case .appetite:
            appetite = Self.number(in: text, max: 10)
            if let done = store?.sleepLoggedToday {
                say(String(format: "Ta nuit est déjà notée (%.1f h), on ne la refait pas. Tu as fait une sieste ? (« non » ou la durée en minutes)", done))
                step = .nap
            } else {
                say("Et cette nuit, tu as dormi combien d'heures ? (par ex. « 7 » ou « 7 h 30 »)")
                step = .sleep
            }
        case .sleep:
            if let h = Self.hours(in: text) {
                sleepH = h
                let react = h >= 8 ? "Belle nuit !" : h >= 6.5 ? "Ça va." : "C'est court — prends soin de toi."
                say("\(react) Une sieste aujourd'hui ? (« non » ou la durée en minutes)"); step = .nap
            } else { say("Dis-moi la durée, par exemple « 7 heures » ou « 6 h 30 ».") }
        case .nap:
            if Self.isNo(text) { napMin = nil }
            else { napMin = Self.number(in: text, max: 600) }
            say("Du sport ou une activité physique ? (« non » ou la durée en minutes)"); step = .sport
        case .sport:
            if Self.isNo(text) { sportMin = nil }
            else { sportMin = Self.number(in: text, max: 600) }
            let h = Calendar.current.component(.hour, from: Date())
            say(h >= 17 ? "Côté hygiène : douche et brossage de dents du soir, c'est fait ? (oui / non / douche seulement…)"
                        : "Côté hygiène : douche et dents ce matin, c'est fait ? (oui / non / douche seulement…)")
            step = .hygiene
        case .hygiene:
            let h = Calendar.current.component(.hour, from: Date())
            let yes = Self.isYes(text), no = Self.isNo(text)
            let shower = yes || text.lowercased().contains("douche")
            let teeth = yes || text.lowercased().contains("dent")
            if !no {
                store?.updateTodayLog { l in
                    if h >= 17 { if shower { l.showerPM = true }; if teeth { l.teethPM = true } }
                    else { if shower { l.showerAM = true }; if teeth { l.teethAM = true } }
                }
            }
            say("Et tu as bu combien de verres d'eau aujourd'hui, à peu près ?"); step = .water
        case .water:
            if let n = Self.number(in: text, max: 30) { store?.updateTodayLog { $0.waterGlasses = n } }
            askNextConso(react: "Super.")
        case .conso:
            if let store, consoIndex < store.addictions.count {
                let a = store.addictions[consoIndex]
                if let n = Self.number(in: text, max: 200), n > 0 {
                    let already = store.consumptionToday(a.id)
                    if Int(n) > already { for _ in 0..<(Int(n) - already) { store.addConsumption(a.id) } }
                }
                consoIndex += 1
            }
            askNextConso(react: "Ok.")
        case .note:
            if !Self.isNo(text) { note = text }
            finishBilan()
        case .chat, .greeting, .done:
            answerQuestion(text)
        }
    }

    private func askNextConso(react: String) {
        guard let store else { step = .note; say("Un mot sur ta journée ? (ou « non »)"); return }
        while consoIndex < store.addictions.count {
            let a = store.addictions[consoIndex]
            let already = store.consumptionToday(a.id)
            let unit = a.unit ?? "unité(s)"
            say("\(react) Combien de \(unit) de \(a.name) aujourd'hui ? (déjà noté : \(already))")
            step = .conso
            return
        }
        step = .note
        say("\(react) Pour finir : tu veux me raconter quelque chose sur ta journée ? (ou « non »)")
    }

    private func finishBilan() {
        guard let store, let m = mood else { step = .chat; return }
        let now = Date()
        let e = MoodEntry(
            id: UUID().uuidString.lowercased(), datetime: Dates.iso.string(from: now), date: Dates.dayKey(now),
            mood: m, energy: energy, appetite: appetite, sleep: sleepH,
            sport: sportMin, note: note,
            symptoms: nil, symptomIntensity: nil, symptomNote: nil, symptomAdvice: nil,
            bedTime: nil, wakeTime: nil, napMinutes: napMin, workouts: nil,
            sexualActivity: nil, menstruation: nil, spending: nil)
        store.addEntry(e)
        step = .done
        let react = m >= 7 ? "Continue comme ça 💚" : m >= 4 ? "Demain est un autre jour." : "Sois doux·ce avec toi-même, d'accord ?"
        say("C'est enregistré ! Humeur \(Int(m))/10\(sleepH != nil ? String(format: ", nuit de %.1f h", sleepH!) : ""). \(react) Tu peux me poser des questions quand tu veux.")
        mood = nil; energy = nil; appetite = nil; sleepH = nil; napMin = nil; sportMin = nil; note = nil; consoIndex = 0
        step = .chat
    }

    // — cerveau v6 : émotions, crises, actions app —

    var pendingAction: (() -> Void)?
    @Published var openTarget: String?   // "report" | "settings" → la vue présente la feuille

    /// true si l'intention a été traitée ici.
    private func handleIntent(_ intent: Intent, text: String) -> Bool {
        guard let store else { return false }
        switch intent {
        // crises
        case .crisisSuicide: say(CrisisProtocol.suicide); return true
        case .crisisViolence: say(CrisisProtocol.violence); return true
        case .crisisMedical: say(CrisisProtocol.medical); return true
        case .crisisPanic: runPanicProtocol(); return true
        // émotions : réconfort travaillé
        case .emoSad, .emoAnxious, .emoAngry, .emoLonely, .emoTired, .emoGuilt, .emoJoy, .emoHeartbreak, .emoGrief:
            say(Comfort.reply(for: intent))
            lastEmotion = intent
            return true
        // actions sur l'app
        case .actWater:
            let n = BotNLU.number(text, max: 20) ?? 1
            store.updateTodayLog { $0.waterGlasses = ($0.waterGlasses ?? 0) + n }
            let total = Int(store.todayLog.waterGlasses ?? 0)
            say("C'est noté 💧 — ça fait \(total) verre\(total > 1 ? "s" : "") aujourd'hui." + (total >= 6 ? " Belle hydratation !" : ""))
            return true
        case .actConso:
            return logConsumption(text)
        case .actHygiene:
            let t = BotNLU.normalize(text)
            let evening = Calendar.current.component(.hour, from: Date()) >= 17
            let shower = t.contains("douche"), teeth = t.contains("dent") || t.contains("brossage") || t.contains("brosse")
            store.updateTodayLog { l in
                if shower { if evening { l.showerPM = true } else { l.showerAM = true } }
                if teeth { if evening { l.teethPM = true } else { l.teethAM = true } }
            }
            var done: [String] = []
            if shower { done.append("douche") }
            if teeth { done.append("dents") }
            say("Bien joué ✨ — \(done.joined(separator: " et ")) validé\(done.count > 1 ? "s" : "") pour \(evening ? "ce soir" : "ce matin").")
            return true
        case .actMoodLog:
            guard let n = BotNLU.number(text, max: 10), n >= 1 else { say("Dis-moi une note entre 1 et 10 🙂"); return true }
            let e = MoodEntry(id: UUID().uuidString.lowercased(), datetime: Dates.iso.string(from: Date()), date: Dates.dayKey(),
                              mood: n, energy: nil, appetite: nil, sleep: nil, sport: nil, note: nil,
                              symptoms: nil, symptomIntensity: nil, symptomNote: nil, symptomAdvice: nil,
                              bedTime: nil, wakeTime: nil, napMinutes: nil, workouts: nil,
                              sexualActivity: nil, menstruation: nil, spending: nil)
            store.addEntry(e)
            say("Humeur \(Int(n))/10 enregistrée ✅ " + (n >= 7 ? "Belle journée !" : n >= 4 ? "Merci d'avoir noté." : "Merci de me l'avoir dit — je suis là si tu veux parler."))
            return true
        case .actMedTaken:
            let day = Dates.dayKey()
            var count = 0
            for m in store.meds {
                for slot in m.slots where slot.days.contains(Dates.jsWeekday()) {
                    let key = "\(day)|\(m.id)|\(slot.time)"
                    if store.intake[key] == nil, Dates.minutes(of: slot.time) <= Calendar.current.component(.hour, from: Date()) * 60 + Calendar.current.component(.minute, from: Date()) {
                        store.intake[key] = Date().timeIntervalSince1970 * 1000; count += 1
                    }
                }
            }
            store.persist()
            say(count > 0 ? "✅ \(count) prise\(count > 1 ? "s" : "") validée\(count > 1 ? "s" : "") — bravo pour la régularité !"
                          : "Toutes tes prises dues étaient déjà validées 👌")
            return true
        case .actSideEffect:
            if let med = store.meds.first(where: { BotNLU.normalize(text).contains(BotNLU.normalize($0.name).trimmingCharacters(in: .whitespaces)) }) {
                store.addSideEffect(medId: med.id, text: text)
                say("Noté dans la fiche de \(med.name) 📋 — ton médecin le verra dans le rapport. Si c'est gênant ou inquiétant, appelle ton pharmacien ou ton médecin sans attendre.")
            } else if let first = store.meds.first, store.meds.count == 1 {
                store.addSideEffect(medId: first.id, text: text)
                say("Noté dans la fiche de \(first.name) 📋. Si ça t'inquiète, ton pharmacien est joignable sans rendez-vous.")
            } else if store.meds.isEmpty {
                say("Je veux bien le noter, mais tu n'as pas encore de médicament enregistré. Ajoute-le dans Réglages → Médicaments d'abord.")
            } else {
                say("Sur quel médicament ? (\(store.meds.map(\.name).joined(separator: ", ")))")
            }
            return true
        case .actOpenReport:
            say("Voilà ton rapport 👇")
            openTarget = "report"
            return true
        case .actOpenSettings:
            say("J'ouvre les réglages 👇")
            openTarget = "settings"
            return true
        case .actStartBilan:
            startBilan(); return true
        case .actAddProduct:
            return createProductFromText(text)
        // questions : laissées aux gestionnaires spécialisés existants
        case .qDrug, .qSpecialist, .qWeather, .qDate, .qAdvice, .qMoodAvg, .qSleep, .qMeds, .qConsoStats, .qWater:
            return false
        case .sGreeting:
            welcomeBack(); return true
        case .sThanks:
            say(["Avec plaisir 💚", "C'est pour ça que je suis là !", "Toujours là pour toi 🌿"][Int(Date().timeIntervalSince1970) % 3]); return true
        case .sBye:
            let h = Calendar.current.component(.hour, from: Date())
            say(h >= 20 ? "Bonne nuit 🌙 Dors bien — et pense à noter ta nuit demain matin !" : "À bientôt 👋 Je suis là quand tu veux.")
            return true
        case .sHowAreYou:
            say("Moi ça va toujours — c'est toi qui comptes ici 🙂 Et toi, comment tu te sens là, maintenant ?"); return true
        case .sWho:
            say("Je suis Moody, ton compagnon local : je fais ton bilan quotidien en discutant, je connais 15 857 médicaments (base officielle ANSM), je peux t'orienter vers le bon spécialiste, noter ton eau, tes consos, ton hygiène, ton humeur à la volée (« note mon humeur à 7 »), valider tes prises de médicaments, ouvrir ton rapport… Tout reste sur ton téléphone. Essaie !")
            return true
        }
    }

    private var lastEmotion: Intent?

    private func welcomeBack() {
        let h = Calendar.current.component(.hour, from: Date())
        let hello = h < 12 ? "Bonjour" : h < 18 ? "Coucou" : "Bonsoir"
        let name = firstName.isEmpty ? "" : " \(firstName)"
        if let avg = store.flatMap({ st -> Double? in
            let cut = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -7, to: Date())!)
            let sel = st.entries.filter { $0.date >= cut }.map(\.mood)
            return sel.isEmpty ? nil : sel.reduce(0, +) / Double(sel.count)
        }), avg >= 7 {
            say("\(hello)\(name) ! 🌞 Ta semaine est belle (moyenne \(String(format: "%.1f", avg))/10). Qu'est-ce qui te ferait plaisir : un bilan, une question, ou juste discuter ?")
        } else {
            say("\(hello)\(name) 👋 Comment tu te sens, là maintenant ? On peut faire un bilan, ou juste papoter.")
        }
    }

    private func runPanicProtocol() {
        say(CrisisProtocol.panicIntro)
        for (i, step) in CrisisProtocol.panicSteps.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i + 1) * 9.0) { [weak self] in
                guard let self else { return }
                self.messages.append(BotMessage(fromBot: true, text: step))
                if self.voiceOn { /* la voix suit le rythme */ }
            }
        }
    }

    private func logConsumption(_ text: String) -> Bool {
        guard let store else { return false }
        let t = BotNLU.normalize(text)
        let n = BotNLU.number(text, max: 50) ?? 1
        // produit déjà suivi ?
        if let a = store.addictions.first(where: { t.contains(BotNLU.normalize($0.name).trimmingCharacters(in: .whitespaces)) }) {
            for _ in 0..<Int(max(1, n)) { store.addConsumption(a.id) }
            say("Noté : +\(Int(max(1, n))) \(a.name) — total aujourd'hui : \(store.consumptionToday(a.id)).")
            return true
        }
        // produit connu mais pas encore suivi → proposer de le créer
        let known: [(keys: [String], name: String, unit: String)] = [
            (["cafe", "expresso", "capsule"], "Café", "tasse"),
            (["clope", "cigarette", "nicotine"], "Cigarette", "cigarette"),
            (["monster", "redbull", "energy"], "Boisson énergisante", "canette"),
            (["biere", "vin", "alcool", "pinte", "kro"], "Alcool", "verre"),
            (["joint", "cannabis"], "Cannabis", "joint"),
            (["the "], "Thé", "tasse"),
        ]
        if let k = known.first(where: { $0.keys.contains(where: { t.contains($0) }) }) {
            say("Tu ne suis pas encore « \(k.name) ». Je crée le compteur et je note \(Int(max(1, n))) \(k.unit)\(n > 1 ? "s" : "") ? (dis oui)")
            pendingAction = { [weak self] in
                guard let self, let store = self.store else { return }
                store.saveAddiction(name: k.name, unit: k.unit)
                if let a = store.addictions.last { for _ in 0..<Int(max(1, n)) { store.addConsumption(a.id) } }
                self.say("C'est fait ✅ \(k.name) est suivi — \(Int(max(1, n))) \(k.unit)\(n > 1 ? "s" : "") noté\(n > 1 ? "s" : "") aujourd'hui.")
            }
            return true
        }
        return false
    }

    private func createProductFromText(_ text: String) -> Bool {
        // « suivre ma conso de X »
        let t = text.lowercased()
        for marker in ["conso de ", "produit ", "suivre mes ", "suivre ma ", "suivre le ", "suivre la ", "track mes "] {
            if let r = t.range(of: marker) {
                let name = String(t[r.upperBound...]).trimmingCharacters(in: CharacterSet(charactersIn: " ?!.")).capitalized
                if name.count >= 2, name.count <= 30 {
                    store?.saveAddiction(name: name, unit: nil)
                    say("C'est parti — je suis ta consommation de \(name) ✅ Dis-moi « j'ai pris un \(name.lowercased()) » pour compter.")
                    return true
                }
            }
        }
        say("Dis-moi quel produit suivre, par exemple : « suivre ma conso de café ».")
        return true
    }

    // — questions libres sur les données —

    private func answerQuestion(_ text: String) {
        guard let store else { return }
        let q = text.lowercased()

        // action en attente de confirmation (multi-tours)
        if let pending = pendingAction {
            pendingAction = nil
            if Self.isYes(text) { pending(); return }
        }

        // routeur NLU entraîné (216 phrases de test, crises prioritaires)
        if let intent = BotNLU.classify(text), handleIntent(intent, text: text) { return }

        // urgences & orientation spécialiste (filet de sécurité mots-clés)
        if let t = Triage.answer(q) { say(t); return }

        // date, jour, heure
        if q.contains("quel jour") || q.contains("quelle date") || q.contains("la date") || q.contains("quelle heure") || q.contains("l'heure") {
            let f = DateFormatter(); f.locale = Locale(identifier: "fr_FR")
            f.dateFormat = q.contains("heure") ? "HH:mm" : "EEEE d MMMM yyyy"
            let v = f.string(from: Date())
            say(q.contains("heure") ? "Il est \(v)." : "Nous sommes \(v).")
            return
        }

        // météo
        if q.contains("météo") || q.contains("meteo") || q.contains("temps qu'il fait") || q.contains("il pleut") || q.contains("température dehors") || q.contains("beau dehors") {
            say("Je regarde le ciel pour toi…")
            WeatherService.shared.current { [weak self] t in self?.say(t) }
            return
        }

        // médicaments : base ANSM embarquée (15 857 spécialités)
        for trigger in ["c'est quoi le ", "c'est quoi la ", "c'est quoi l'", "info sur ", "infos sur ", "information sur ", "médicament ", "medicament ", "effets du ", "effets de la ", "effets d'", "à quoi sert "] {
            if let r = q.range(of: trigger) {
                let term = String(q[r.upperBound...]).trimmingCharacters(in: CharacterSet(charactersIn: " ?!."))
                if term.count >= 3 {
                    let hits = DrugDB.search(term)
                    if let first = hits.first {
                        say(DrugDB.describe(first))
                        if hits.count > 1 {
                            let others = hits.dropFirst().prefix(3).map { $0.name.components(separatedBy: ",").first ?? $0.name }
                            say("J'ai aussi trouvé : " + others.joined(separator: " · ") + ".")
                        }
                        return
                    }
                }
            }
        }
        // ses propres traitements par leur nom
        if let med = store.meds.first(where: { q.contains($0.name.lowercased()) && $0.name.count >= 3 }) {
            if let hit = DrugDB.search(med.name).first {
                var extra = "C'est dans ton traitement (\(med.slots.map(\.time).joined(separator: ", "))). "
                if let n = med.sideEffects?.count, n > 0 { extra += "Tu as noté \(n) effet(s) secondaire(s) dessus. " }
                say(extra + DrugDB.describe(hit))
                return
            }
        }

        // conseils ciblés par thème
        if q.contains("conseil") || q.contains("astuce") || q.contains("aide-moi") || q.contains("aide moi") {
            let bank: [String]
            if q.contains("sommeil") || q.contains("dormir") { bank = TipBank.sommeil }
            else if q.contains("stress") || q.contains("angoisse") || q.contains("anxiété") { bank = TipBank.stress }
            else if q.contains("manger") || q.contains("alimentation") || q.contains("nutrition") { bank = TipBank.alimentation }
            else if q.contains("sport") || q.contains("bouger") || q.contains("activité") { bank = TipBank.activite }
            else if q.contains("moral") || q.contains("humeur") || q.contains("bonheur") { bank = TipBank.moral }
            else {
                let h = Calendar.current.component(.hour, from: Date())
                bank = h >= 19 ? TipBank.sommeil : [TipBank.moral, TipBank.stress, TipBank.activite, TipBank.alimentation].randomElement()!
            }
            say(TipBank.random(bank))
            return
        }

        func avg(_ days: Int) -> Double? {
            let cut = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -days, to: Date())!)
            let sel = store.entries.filter { $0.date >= cut }.map(\.mood)
            return sel.isEmpty ? nil : sel.reduce(0, +) / Double(sel.count)
        }
        if q.contains("humeur") || q.contains("moyenne") || q.contains("moral") {
            if let a7 = avg(7), let a30 = avg(30) {
                let trend = a7 > a30 + 0.3 ? "et c'est mieux que ton mois — belle dynamique !" : a7 < a30 - 0.3 ? "un peu en dessous de ton mois. Prends soin de toi." : "stable par rapport au mois."
                say(String(format: "Ta moyenne d'humeur : %.1f/10 sur 7 jours, %.1f/10 sur 30 jours — %@", a7, a30, trend))
            } else { say("Je n'ai pas encore assez de saisies pour calculer ta moyenne. Fais ton premier bilan !") }
        } else if q.contains("sommeil") || q.contains("dormi") || q.contains("nuit") {
            let cut = Dates.dayKey(Calendar.current.date(byAdding: .day, value: -7, to: Date())!)
            let nights = store.entries.filter { $0.date >= cut }.compactMap(\.sleep)
            if nights.isEmpty { say("Aucune nuit notée cette semaine. Dis-moi combien tu as dormi dans ton prochain bilan !") }
            else { say(String(format: "Tu as dormi en moyenne %.1f h ces %d dernières nuits notées.%@", nights.reduce(0, +) / Double(nights.count), nights.count, nights.reduce(0, +) / Double(nights.count) < 7 ? " C'est un peu court — vise 7 à 9 h." : " C'est une bonne moyenne !")) }
        } else if q.contains("médicament") || q.contains("medicament") || q.contains("traitement") || q.contains("pris") {
            if store.meds.isEmpty { say("Aucun médicament enregistré. Ajoute-les dans Réglages → Médicaments.") }
            else {
                let day = Dates.dayKey()
                let taken = store.meds.flatMap { m in m.slots.map { s in store.intake["\(day)|\(m.id)|\(s.time)"] != nil } }
                let done = taken.filter { $0 }.count
                say("Aujourd'hui : \(done)/\(taken.count) prises validées. Tes traitements : " + store.meds.map { $0.name + ($0.dose.map { " (\($0))" } ?? "") }.joined(separator: ", ") + ".")
            }
        } else if q.contains("eau") {
            say("Tu as noté \(Int(store.todayLog.waterGlasses ?? 0)) verre(s) d'eau aujourd'hui.")
        } else if let a = store.addictions.first(where: { q.contains($0.name.lowercased()) }) {
            say("\(a.name) : \(store.consumptionToday(a.id)) aujourd'hui, \(store.consumption(a.id, days: 7)) sur 7 jours, \(store.consumption(a.id, days: 30)) sur 30 jours.")
        } else if q.contains("conseil") || q.contains("aide") || q.contains("astuce") {
            let h = Calendar.current.component(.hour, from: Date())
            let tips = h >= 19 ? [
                "Éteins les écrans 30 minutes avant de dormir, ton sommeil te dira merci.",
                "Une tisane, une lumière douce, et note trois choses positives de ta journée.",
                "Ta chambre idéale : fraîche (18-19 °C), sombre et calme.",
            ] : [
                "Un verre d'eau et 5 minutes de lumière du jour dès le réveil, ça change une journée.",
                "Bouge 20 minutes aujourd'hui, même une simple marche — ton humeur suivra.",
                "Fais une vraie pause déjeuner, loin des écrans si tu peux.",
            ]
            say(tips[Int(Date().timeIntervalSince1970) % tips.count])
        } else if q.contains("bilan") {
            startBilan()
        } else if q.contains("merci") {
            say("Avec plaisir \(firstName.isEmpty ? "" : firstName + " ")💚 Je suis là quand tu veux.")
        } else {
            say("Je peux : faire ton bilan (dis « bilan »), analyser tes données (« ma moyenne d'humeur ? », « combien j'ai dormi ? »), te renseigner sur 15 857 médicaments (« c'est quoi le Doliprane ? »), t'orienter vers le bon spécialiste (« qui consulter pour mes migraines ? »), te donner la météo, la date, et des conseils sommeil/stress/alimentation/sport/moral. Essaie !")
        }
    }

    private func say(_ text: String) {
        messages.append(BotMessage(fromBot: true, text: text))
        if voiceOn { speak(text) }
    }

    // — reconnaissance vocale (Apple, EN LOCAL sur l'appareil) —

    func toggleMic(onText: @escaping (String) -> Void) {
        if listening { stopMic(); return }
        SFSpeechRecognizer.requestAuthorization { auth in
            DispatchQueue.main.async {
                guard auth == .authorized else { self.say("Autorise la dictée dans Réglages → Confidentialité pour me parler."); return }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    DispatchQueue.main.async {
                        guard ok else { self.say("Autorise le micro pour me parler de vive voix.") ; return }
                        self.startMic(onText: onText)
                    }
                }
            }
        }
    }

    private func startMic(onText: @escaping (String) -> Void) {
        player?.stop(); appleVoice.stopSpeaking(at: .immediate); speaking = false
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .duckOthers])
        try? session.setActive(true, options: .notifyOthersOnDeactivation)
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer?.supportsOnDeviceRecognition == true { request.requiresOnDeviceRecognition = true }  // 100 % local
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buf, _ in request.append(buf) }
        audioEngine.prepare()
        do { try audioEngine.start() } catch { return }
        listening = true
        var final = ""
        var silenceTimer: Timer?
        recTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let r = result {
                final = r.bestTranscription.formattedString
                onText(final)   // affichage en direct dans le champ
                silenceTimer?.invalidate()
                silenceTimer = Timer.scheduledTimer(withTimeInterval: 1.6, repeats: false) { _ in
                    Task { @MainActor in
                        self.stopMic()
                        if !final.isEmpty { onText(""); self.userSaid(final) }
                    }
                }
            }
            if error != nil { Task { @MainActor in self.stopMic() } }
        }
    }

    func stopMic() {
        audioEngine.stop(); audioEngine.inputNode.removeTap(onBus: 0)
        recTask?.cancel(); recTask = nil
        listening = false
    }

    // — synthèse vocale : ElevenLabs, repli voix Apple locale —

    private static var elevenKey: String { (Bundle.main.object(forInfoDictionaryKey: "ElevenLabsKey") as? String) ?? "" }

    private func speak(_ text: String) {
        speaking = true
        guard !Self.elevenKey.isEmpty else { speakApple(text); return }
        Task {
            do {
                var req = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128")!)
                req.httpMethod = "POST"
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.setValue(Self.elevenKey, forHTTPHeaderField: "xi-api-key")
                req.httpBody = try JSONSerialization.data(withJSONObject: [
                    "text": text, "model_id": "eleven_multilingual_v2",
                    "voice_settings": ["stability": 0.5, "similarity_boost": 0.75],
                ])
                let (data, resp) = try await URLSession.shared.data(for: req)
                guard (resp as? HTTPURLResponse)?.statusCode == 200 else { speakApple(text); return }
                let session = AVAudioSession.sharedInstance()
                try? session.setCategory(.playback, options: [])
                try? session.setActive(true)
                player = try AVAudioPlayer(data: data)
                player?.play()
                speaking = false
            } catch { speakApple(text) }
        }
    }

    private func speakApple(_ text: String) {
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "fr-FR")
        u.rate = 0.5
        appleVoice.speak(u)
        speaking = false
    }

    func stopSpeaking() { player?.stop(); appleVoice.stopSpeaking(at: .immediate); speaking = false }

    // — parsing français —

    static func number(in text: String, max: Double) -> Double? {
        let t = text.lowercased()
        let words: [String: Double] = ["zéro": 0, "zero": 0, "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
                                       "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10, "onze": 11, "douze": 12,
                                       "quinze": 15, "vingt": 20, "trente": 30, "quarante": 40, "cinquante": 50,
                                       "soixante": 60, "quatre-vingt-dix": 90, "cent": 100]
        if let m = t.range(of: #"\d+([.,]\d+)?"#, options: .regularExpression) {
            let v = Double(t[m].replacingOccurrences(of: ",", with: ".")) ?? 0
            return v >= 0 && v <= max ? v : nil
        }
        for (w, v) in words where t.split(separator: " ").map(String.init).contains(w) {
            if v <= max { return v }
        }
        return nil
    }
    static func hours(in text: String) -> Double? {
        let t = text.lowercased().replacingOccurrences(of: ",", with: ".")
        if let m = t.range(of: #"(\d{1,2})\s*h(?:eures?)?\s*(\d{1,2})?"#, options: .regularExpression) {
            let parts = t[m].components(separatedBy: CharacterSet.decimalDigits.inverted).filter { !$0.isEmpty }
            let h = Double(parts.first ?? "0") ?? 0
            let mn = parts.count > 1 ? (Double(parts[1]) ?? 0) : 0
            return h + mn / 60
        }
        if let n = number(in: t, max: 24) { return n }
        return nil
    }
    static func isYes(_ t: String) -> Bool {
        let l = t.lowercased()
        return l.contains("oui") || l.contains("ouais") || l.contains("yes") || l.contains("fait") || l.contains("bien sûr") || l.contains("évidemment")
    }
    static func isNo(_ t: String) -> Bool {
        let l = t.lowercased().trimmingCharacters(in: .whitespaces)
        return l == "non" || l.hasPrefix("non ") || l.contains("pas encore") || l.contains("aucun") || l.contains("rien") || l == "no" || l == "nan"
    }
}

// — l'écran de chat —

struct MoodyChatView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @StateObject private var bot = BilanBot()
    @State private var input = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 10) {
                            ForEach(bot.messages) { m in
                                HStack {
                                    if !m.fromBot { Spacer(minLength: 40) }
                                    Text(m.text)
                                        .font(.system(size: 14.5))
                                        .foregroundStyle(m.fromBot ? Color.inkC : .white)
                                        .padding(.horizontal, 14).padding(.vertical, 10)
                                        .background(
                                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                                .fill(m.fromBot ? Color.white : Color.inkC))
                                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .stroke(.black.opacity(m.fromBot ? 0.05 : 0), lineWidth: 1))
                                    if m.fromBot { Spacer(minLength: 40) }
                                }
                                .id(m.id)
                            }
                        }
                        .padding(16)
                    }
                    .onChange(of: bot.messages) { msgs in
                        if let last = msgs.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }

                // bouton bilan
                if bot.step == .chat || bot.step == .done {
                    Button { bot.startBilan() } label: {
                        Label("Bilan Moody", systemImage: "sparkles")
                            .font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(Capsule().fill(Color.brand))
                    }
                    .padding(.horizontal, 16).padding(.bottom, 8)
                }

                // barre de saisie
                HStack(spacing: 10) {
                    Button { bot.toggleMic { live in input = live } } label: {
                        Image(systemName: bot.listening ? "waveform" : "mic.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(bot.listening ? .white : Color.inkC)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(bot.listening ? Color.rose : Color.cream))
                            .animation(.easeInOut(duration: 0.3), value: bot.listening)
                    }
                    TextField(bot.listening ? "Je t'écoute…" : "Écris ou parle-moi…", text: $input, axis: .vertical)
                        .lineLimit(1...3)
                        .focused($focused)
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(Capsule().fill(Color.cream))
                        .onSubmit { send() }
                    Button { send() } label: {
                        Image(systemName: "arrow.up").font(.system(size: 15, weight: .heavy)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(input.isEmpty ? Color.inkMute : Color.inkC))
                    }
                    .disabled(input.isEmpty)
                }
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 10)
                .background(Color.cream)
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle("Moody")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { bot.voiceOn.toggle(); if !bot.voiceOn { bot.stopSpeaking() } } label: {
                        Image(systemName: bot.voiceOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                            .foregroundStyle(bot.voiceOn ? Color.brand700 : Color.inkMute)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { bot.stopMic(); bot.stopSpeaking(); dismiss() } }
            }
        }
        .onAppear { bot.store = store; bot.welcome() }
        .onDisappear { bot.stopMic(); bot.stopSpeaking() }
        .sheet(isPresented: Binding(get: { bot.openTarget == "report" }, set: { if !$0 { bot.openTarget = nil } })) { ReportView() }
        .sheet(isPresented: Binding(get: { bot.openTarget == "settings" }, set: { if !$0 { bot.openTarget = nil } })) { SettingsSheet() }
    }

    private func send() {
        let t = input; input = ""
        bot.userSaid(t)
    }
}

// MARK: - Fiche médicament : infos utiles + journal d'effets secondaires

struct MedInfoSheet: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    var medId: String
    @State private var newEffect = ""

    private var med: Medication? { store.meds.first { $0.id == medId } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let med {
                    VStack(alignment: .leading, spacing: 16) {
                        // identité
                        HStack(spacing: 12) {
                            Image(systemName: "pills.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(Color.rose)
                                .frame(width: 46, height: 46).background(Circle().fill(Color.peachC))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(med.name).font(.system(size: 19, weight: .bold, design: .rounded)).foregroundStyle(Color.inkC)
                                if let d = med.dose { Text(d).font(.system(size: 13)).foregroundStyle(Color.inkMute) }
                            }
                            Spacer()
                        }

                        // infos utiles connues (issues du scan / de la base)
                        if let h = med.highlights {
                            Card {
                                VStack(alignment: .leading, spacing: 8) {
                                    if let m = h.molecule { infoRow("atom", "Molécule", m) }
                                    if let c = h.classe { infoRow("square.grid.2x2", "Classe", c) }
                                    if let r = h.risques, !r.isEmpty { infoList("exclamationmark.triangle.fill", "À savoir", r, Color(hex: 0xB07F14)) }
                                    if let e = h.effets, !e.isEmpty { infoList("bolt.heart", "Effets possibles", e, Color.rose) }
                                    if let c = h.conseils, !c.isEmpty { infoList("lightbulb.fill", "Conseils", c, Color.brand700) }
                                }
                            }
                        }

                        // notice officielle
                        Card {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Notice officielle").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.inkC)
                                Text("Consulte la fiche complète (indications, contre-indications, effets indésirables) sur la Base de données publique des médicaments.")
                                    .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                Link(destination: URL(string: "https://base-donnees-publique.medicaments.gouv.fr/index.php?page=1&affliste=0&affNumero=0&isAlphabet=0&inClauseSubst=0&nomSubstances=&typeRecherche=0&choixRecherche=medicament&txtCaracteres=\(med.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? med.name)")!) {
                                    Label("Ouvrir la notice", systemImage: "doc.text.magnifyingglass")
                                        .font(.system(size: 13.5, weight: .bold)).foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                        .background(Capsule().fill(Color.inkC))
                                }
                            }
                        }

                        // journal d'effets secondaires
                        Card {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Mes effets secondaires").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.inkC)
                                Text("Note ce que tu ressens avec ce médicament — visible dans le rapport médecin.")
                                    .font(.system(size: 12)).foregroundStyle(Color.inkMute)
                                HStack(spacing: 8) {
                                    TextField("Ex : nausées le matin…", text: $newEffect)
                                        .padding(11).background(RoundedRectangle(cornerRadius: 11).fill(Color.cream))
                                    Button {
                                        let t = newEffect.trimmingCharacters(in: .whitespaces)
                                        guard !t.isEmpty else { return }
                                        store.addSideEffect(medId: medId, text: t); newEffect = ""
                                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    } label: {
                                        Image(systemName: "plus").font(.system(size: 14, weight: .heavy)).foregroundStyle(.white)
                                            .frame(width: 40, height: 40).background(Circle().fill(Color.inkC))
                                    }
                                }
                                let effects = (med.sideEffects ?? []).enumerated().reversed()
                                ForEach(Array(effects), id: \.offset) { i, ef in
                                    HStack(alignment: .top, spacing: 8) {
                                        Text(String(ef.date.suffix(5))).font(.system(size: 11, weight: .bold)).foregroundStyle(Color.inkMute)
                                            .frame(width: 56, alignment: .leading)
                                        Text(ef.text).font(.system(size: 13)).foregroundStyle(Color.inkC)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                        Button { store.removeSideEffect(medId: medId, at: i) } label: {
                                            Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.inkMute)
                                        }
                                    }
                                    .padding(10)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
                                }
                            }
                        }
                    }
                    .padding(18)
                }
            }
            .background(Color.cream.ignoresSafeArea())
            .navigationTitle("Médicament")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Fermer") { dismiss() } } }
        }
    }

    private func infoRow(_ icon: String, _ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(Color.accentDeep).frame(width: 20)
            Text(label).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Color.inkSoft)
            Text(value).font(.system(size: 12.5)).foregroundStyle(Color.inkC)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    private func infoList(_ icon: String, _ label: String, _ items: [String], _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Color.inkC)
            }
            ForEach(items, id: \.self) { it in
                Text("• " + it).font(.system(size: 12.5)).foregroundStyle(Color.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
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
    @State private var addingProduct = false
    @State private var editNight = false
    @State private var napCustom = ""
    private var hour: Int { Calendar.current.component(.hour, from: Date()) }

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
                // le matin, la nuit passée d'abord ; le soir, l'hygiène du soir remonte
                if hour < 14 {
                    sleepCard
                    Card { VStack(spacing: 10) { sectionHeader("sparkles", "Hygiène & journée"); HygieneChecks(); WaterRow() } }
                    energyCard
                    appetiteCard
                } else {
                    energyCard
                    appetiteCard
                    Card { VStack(spacing: 10) { sectionHeader("sparkles", "Hygiène & journée"); HygieneChecks(); WaterRow() } }
                    sleepCard
                }
                sportCard
                intimateCard
                Card { VStack(spacing: 10) { sectionHeader("takeoutbag.and.cup.and.straw.fill", "Consommations"); ConsumptionRows(addingProduct: $addingProduct) } }
                spendingCard
                noteCard
                saveButton
                Spacer(minLength: 90)
            }
            .padding(.horizontal, 18)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $addingWorkout) { WorkoutSheet { workouts.append($0) } }
        .sheet(isPresented: $addingProduct) { AddProductSheet() }
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
                if let done = store.sleepLoggedToday, !editNight {
                    // déjà consigné : on ne redemande pas — mais on peut corriger
                    HStack {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.brand)
                        Text(String(format: "Nuit déjà notée · %.1f h", done))
                            .font(.system(size: 13.5, weight: .bold)).foregroundStyle(Color.inkSoft)
                        Spacer()
                        Button {
                            sleepSimple = done; useBedWake = false; editNight = true
                        } label: {
                            Text("Corriger").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.accentDeep)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(Capsule().fill(Color.accentSoft))
                        }
                    }
                } else {
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
                if editNight {
                    Button {
                        let h = useBedWake ? Dates.sleepHours(bed: Dates.hhmm(bed), wake: Dates.hhmm(wake)) : (sleepSimple ?? 7)
                        store.updateTodaySleep(h, bed: useBedWake ? Dates.hhmm(bed) : nil,
                                               wake: useBedWake ? Dates.hhmm(wake) : nil)
                        withAnimation { editNight = false }
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    } label: {
                        Text("Valider la correction").font(.system(size: 13.5, weight: .bold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(Capsule().fill(Color.inkC))
                    }
                }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("SIESTE").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach([0.0, 15, 30, 45, 60, 90], id: \.self) { m in
                                let on = nap == m || (m == 0 && nap == nil)
                                Button { nap = m == 0 ? nil : m; napCustom = "" } label: {
                                    Text(m == 0 ? "Aucune" : "\(Int(m)) min")
                                        .font(.system(size: 12.5, weight: .bold, design: .rounded)).fixedSize()
                                        .foregroundStyle(on ? .white : Color.inkSoft)
                                        .padding(.horizontal, 13).padding(.vertical, 9)
                                        .background(Capsule().fill(on ? Color.inkC : Color.cream))
                                }
                            }
                            // durée exacte à la main
                            HStack(spacing: 5) {
                                TextField("autre", text: $napCustom)
                                    .keyboardType(.numberPad).frame(width: 52)
                                    .multilineTextAlignment(.center)
                                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                                    .onChange(of: napCustom) { v in
                                        if let m = Double(v), m > 0 { nap = m }
                                    }
                                Text("min").font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Color.inkMute)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(napCustom.isEmpty ? Color.cream : Color.accentSoft))
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
                    Text("Rapports aujourd'hui").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.inkC)
                    Spacer()
                    stepper(count: Int(store.todayLog.sexCount ?? 0), unit: "",
                            minus: { store.updateTodayLog { $0.sexCount = max(0, ($0.sexCount ?? 0) - 1) } },
                            plus: { store.updateTodayLog { $0.sexCount = ($0.sexCount ?? 0) + 1 } })
                }
                if store.menstruLoggedToday {
                    HStack {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.brand)
                        Text("Menstruation déjà notée aujourd'hui").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Color.inkSoft)
                        Spacer()
                    }
                } else {
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
                sexualActivity: (store.todayLog.sexCount ?? 0) > 0 ? true : sexual,
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
                row("heart.fill", "Rapports", "\(Int(store.dayLogs.filter { $0.key >= cutoff }.compactMap { $0.value.sexCount }.reduce(0, +)))")
                let logs = store.dayLogs.filter { $0.key >= cutoff }.map(\.value)
                if !logs.isEmpty {
                    row("shower.fill", "Douches", "\(logs.filter { $0.showerAM == true || $0.showerPM == true }.count)/\(logs.count) j")
                    row("mouth.fill", "Dents (matin+soir)", "\(logs.filter { $0.teethAM == true && $0.teethPM == true }.count)/\(logs.count) j")
                    row("drop.fill", "Eau moyenne", String(format: "%.1f verres/j", logs.compactMap(\.waterGlasses).reduce(0, +) / Double(max(1, logs.count))))
                }
                ForEach(store.addictions) { a in
                    row("takeoutbag.and.cup.and.straw.fill", a.name, "\(store.consumption(a.id, days: period)) \(a.unit ?? "")")
                }
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
                                HStack(spacing: 10) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("NAISSANCE").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                                        DatePicker("", selection: Binding(
                                            get: { Dates.day.date(from: store.medical.birthDate ?? "") ?? Date(timeIntervalSince1970: 631_152_000) },
                                            set: { store.medical.birthDate = Dates.day.string(from: $0); store.persist() }),
                                            displayedComponents: .date).labelsHidden()
                                    }
                                    Spacer()
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("SEXE").font(.system(size: 9.5, weight: .bold)).kerning(1).foregroundStyle(Color.inkMute)
                                        Picker("", selection: Binding(get: { store.medical.sex ?? "" },
                                                                      set: { store.medical.sex = $0.isEmpty ? nil : $0; store.persist() })) {
                                            Text("—").tag(""); Text("Femme").tag("F"); Text("Homme").tag("M"); Text("Autre").tag("X")
                                        }
                                        .pickerStyle(.menu).tint(Color.inkC)
                                    }
                                }
                                HStack(spacing: 10) {
                                    profileField("Taille (cm)", get: { store.medical.height }, set: { store.medical.height = $0 })
                                    profileField("Poids (kg)", get: { store.medical.weight }, set: { store.medical.weight = $0 })
                                    profileField("Groupe", get: { store.medical.bloodType }, set: { store.medical.bloodType = $0 }, numeric: false)
                                }
                                if let bmi = store.medical.bmi {
                                    Text(String(format: "IMC : %.1f", bmi))
                                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Color.inkSoft)
                                }
                                TextField("Allergies (pénicilline…)", text: Binding(
                                    get: { store.medical.allergies ?? "" },
                                    set: { store.medical.allergies = $0.isEmpty ? nil : $0; store.persist() }))
                                    .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
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
    private func profileField(_ label: String, get: @escaping () -> String?, set: @escaping (String?) -> Void, numeric: Bool = true) -> some View {
        TextField(label, text: Binding(get: { get() ?? "" }, set: { set($0.isEmpty ? nil : $0); store.persist() }))
            .keyboardType(numeric ? .decimalPad : .default)
            .multilineTextAlignment(.center)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.cream))
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
    @State private var showInfo = false
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
                    Button { showInfo = true } label: {
                        HStack {
                            Image(systemName: "info.circle.fill")
                            Text("Infos & effets secondaires")
                            Spacer()
                            if let n = med.sideEffects?.count, n > 0 {
                                Text("\(n)").font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Capsule().fill(Color.rose))
                            }
                            Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold))
                        }
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.accentDeep)
                        .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color.accentSoft))
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
        .sheet(isPresented: $showInfo) { MedInfoSheet(medId: med.id) }
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
