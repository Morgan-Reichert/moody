// Moody — app native SwiftUI
// Design « moodboard pastel » : fond gris perle, cartes blanches, pastels,
// CTA noirs, jauges bleues. Les données de l'ancienne app (WebView) sont
// migrées automatiquement au premier lancement.

import SwiftUI
import Speech
import AVFoundation
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

    // — questions libres sur les données —

    private func answerQuestion(_ text: String) {
        guard let store else { return }
        let q = text.lowercased()
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
            say("Je suis un assistant local tout simple : je connais tes humeurs, ton sommeil, tes médicaments, ton eau et tes consommations. Essaie « quelle est ma moyenne d'humeur ? », « combien j'ai dormi ? », « mes médicaments » ou « donne-moi un conseil ». Et « bilan » pour démarrer un bilan !")
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
