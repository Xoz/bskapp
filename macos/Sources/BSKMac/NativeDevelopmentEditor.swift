import SwiftUI

struct NativeDateField: View {
    let title: String
    @Binding var value: String
    var optional = false
    nonisolated static func parse(_ text: String) -> Date? {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Europe/Stockholm"); f.dateFormat = "yyyy-MM-dd"; f.isLenient = false
        guard let date = f.date(from: text), f.string(from: date) == text else { return nil }; return date
    }
    nonisolated static func string(_ date: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "Europe/Stockholm"); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            if optional { Toggle(title, isOn: Binding(get: { !value.isEmpty }, set: { value = $0 ? Self.string(Date()) : "" })).toggleStyle(.checkbox) }
            if !optional || !value.isEmpty {
                DatePicker(optional ? "Datum" : title, selection: Binding(get: { Self.parse(value) ?? Date() }, set: { value = Self.string($0) }), displayedComponents: .date)
            }
        }.font(.system(size: 12))
    }
}
struct NativeNoteField: View {
    let title: String
    @Binding var text: String
    let limit: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text(title).font(.system(size: 13, weight: .medium)); Spacer(); Text("\(text.count)/\(limit)").font(.system(size: 10)).foregroundStyle(text.count > limit ? .red : Studio.muted) }
            TextEditor(text: $text).font(.system(size: 13)).scrollContentBackground(.hidden).padding(10).frame(minHeight: 85)
                .background(Studio.line.opacity(0.2), in: RoundedRectangle(cornerRadius: 8)).overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Studio.line))
                .accessibilityLabel(title)
        }
    }
}
struct NativeDevelopmentEditor: View {
    @ObservedObject var session: NativeEditorSession
    @State private var category: String?
    private let options = [("not_started", "Ej påbörjad"), ("training", "Tränar på"), ("almost", "Nästan klar"), ("done", "Klar")]
    var body: some View {
        if let data = session.development {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(session.route.kind == "checkpoint" ? "SE NULÄGET. VÄLJ NÄSTA STEG." : "LYSSNA. FÖRSTÅ. KOM ÖVERENS.").font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(Studio.muted)
                        Text(data.name).font(.system(size: 32, design: .serif))
                        Text(session.route.kind == "checkpoint" ? "Ändra det du har underlag för och välj högst två fokus. Sparandet skapar en avstämning i historiken." : "Vad känns bra, och vad vill spelaren bli tryggare med?").font(.system(size: 13)).foregroundStyle(Studio.muted)
                    }
                    HStack(spacing: 30) {
                        NativeDateField(title: session.route.kind == "checkpoint" ? "Avstämningsdatum" : "Samtalsdatum", value: $session.date)
                        if session.route.kind == "checkpoint" { TextField("Tränare", text: $session.coach).textFieldStyle(.roundedBorder).frame(maxWidth: 320) }
                        else { Text("Tränare: \(data.coach)").font(.system(size: 12)).foregroundStyle(Studio.muted) }
                    }
                    if session.route.kind == "checkpoint" { checkpoint(data) } else { conversation(data) }
                }.padding(32).frame(maxWidth: 1000, alignment: .leading).frame(maxWidth: .infinity)
            }
        }
    }
    @ViewBuilder private func checkpoint(_ data: NativeDevelopment) -> some View {
        HStack { Text("Utvecklingsträdet").font(.system(size: 24, design: .serif)); Spacer(); Text("\(session.focus.count)/2 fokus").font(.system(size: 12)).foregroundStyle(Studio.muted) }
        Picker("Område", selection: $category) {
            Text("Välj område").tag(String?.none)
            ForEach(data.categories) { Text($0.name).tag(Optional($0.id)) }
        }.pickerStyle(.menu)
        if !session.focus.isEmpty {
            HStack {
                ForEach(data.skills.filter { session.focus.contains($0.id) }) { skill in
                    Button { category = skill.category } label: { Label(skill.title, systemImage: "scope") }.font(.system(size: 11))
                }
            }
        }
        if let category {
            ForEach(data.skills.filter { $0.category == category }) { skill in
                VStack(alignment: .leading, spacing: 13) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("NIVÅ \(skill.level)").font(.system(size: 10, weight: .semibold)).foregroundStyle(Studio.muted)
                            Text(skill.title).font(.system(size: 19, design: .serif))
                            Text(skill.criterion).font(.system(size: 12)).foregroundStyle(Studio.muted)
                        }
                        Spacer()
                        Toggle("Fokus", isOn: Binding(get: { session.focus.contains(skill.id) }, set: { if $0 { if session.focus.count < 2 { session.focus.insert(skill.id) } } else { session.focus.remove(skill.id) } }))
                            .toggleStyle(.checkbox).disabled(!session.focus.contains(skill.id) && session.focus.count >= 2)
                    }
                    Picker("Status för \(skill.title)", selection: Binding(get: { session.statuses[skill.id] ?? "not_started" }, set: { session.statuses[skill.id] = $0 })) {
                        ForEach(options, id: \.0) { Text($0.1).tag($0.0) }
                    }.pickerStyle(.segmented).labelsHidden()
                    DisclosureGroup("Träningsråd") { Text(skill.advice).font(.system(size: 12)).padding(.vertical, 8) }
                }.editorPanel()
            }
        } else { Text("Välj ett område för att läsa kriterier och uppdatera färdigheter.").font(.system(size: 13)).foregroundStyle(Studio.muted) }
        DisclosureGroup("Frivilliga noteringar") {
            VStack(spacing: 20) {
                NativeNoteField(title: "Styrkor just nu", text: $session.strengths, limit: 2000)
                NativeNoteField(title: "Nästa fokus", text: $session.focusNote, limit: 2000)
                NativeNoteField(title: "Mående och spelarens upplevelse", text: $session.wellbeing, limit: 2000)
                Text("Mående hålls åtskilt från färdigheterna i trädet.").font(.system(size: 11)).foregroundStyle(Studio.muted)
            }.padding(.top, 16)
        }.editorPanel()
        Color.clear.frame(height: 0).onAppear { category = data.skills.first { session.focus.contains($0.id) }?.category ?? data.categories.first?.id }
    }
    @ViewBuilder private func conversation(_ data: NativeDevelopment) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Underlag från utvecklingsträdet").font(.system(size: 23, design: .serif))
            Text(data.preparation.summary).font(.system(size: 14)).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
        }.editorPanel()
        VStack(alignment: .leading, spacing: 15) {
            Text("Efter samtalet").font(.system(size: 23, design: .serif))
            Text("Välj det som stämmer. Du behöver inte skriva en sammanfattning.").font(.system(size: 12)).foregroundStyle(Studio.muted)
            Picker("Överenskommelse", selection: $session.outcome) {
                Text("Välj nästa steg").tag("")
                if !data.preparation.focus.isEmpty { Text("Vi fortsätter med valt fokus").tag("continue") }
                Text("Vi kom överens om något annat").tag("custom")
                Text("Ingen ny överenskommelse").tag("none")
            }.pickerStyle(.radioGroup)
            if session.outcome == "custom" { NativeNoteField(title: "Nytt nästa steg", text: $session.agreement, limit: 4000) }
        }.editorPanel()
        DisclosureGroup("Frivilliga noteringar och uppföljning") {
            VStack(spacing: 20) {
                NativeNoteField(title: "Extra notering", text: $session.note, limit: 1000)
                NativeNoteField(title: "Spelarens egna ord", text: $session.perspective, limit: 4000)
                NativeDateField(title: "Välj uppföljningsdatum", value: $session.followup, optional: true)
            }.padding(.top, 16)
        }.editorPanel()
    }
}
extension View {
    func editorPanel() -> some View { padding(22).frame(maxWidth: .infinity, alignment: .leading).background(Studio.line.opacity(0.16), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(Studio.line)) }
}
