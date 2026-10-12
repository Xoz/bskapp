import SwiftUI
import UniformTypeIdentifiers
import AppKit

struct NativeTrainingEditor: View {
    @ObservedObject var session: NativeEditorSession
    @State private var selected: String?
    @State private var bankOpen = false
    @State private var removed: (NativeBlock, Int)?
    @State private var notice: String?
    private var index: Int? { session.plan.blocks.firstIndex { $0.id == selected } }
    var body: some View {
        HSplitView {
            VStack(alignment: .leading, spacing: 16) {
                Text("PASSPLANERING").font(.system(size: 10, weight: .semibold)).tracking(2)
                TextField("Passets namn", text: $session.plan.title).textFieldStyle(.roundedBorder)
                NativeDateField(title: "Träningsdatum", value: $session.plan.date, optional: true)
                Text("\(session.plan.blocks.count) \(session.plan.blocks.count == 1 ? "övning" : "övningar") · \(session.plan.blocks.reduce(0) { $0 + $1.minutes }) minuter").font(.system(size: 12)).foregroundStyle(Studio.muted)
                Divider()
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(Array(session.plan.blocks.enumerated()), id: \.element.id) { offset, block in
                            Button { selected = block.id } label: {
                                HStack { Text("\(offset + 1)").foregroundStyle(Studio.muted); Text(block.diagram.title).lineLimit(2); Spacer(); Text("\(block.minutes) min").foregroundStyle(Studio.muted) }
                                    .font(.system(size: 12)).padding(12).background(selected == block.id ? Studio.line : Studio.line.opacity(0.2), in: RoundedRectangle(cornerRadius: 8))
                            }.buttonStyle(.plain).draggable(block.id)
                            .dropDestination(for:String.self){items,_ in
                                guard let id=items.first,let from=session.plan.blocks.firstIndex(where:{$0.id==id}),let to=session.plan.blocks.firstIndex(where:{$0.id==block.id}),from != to else{return false}
                                let moved=session.plan.blocks.remove(at:from);session.plan.blocks.insert(moved,at:to);selected=moved.id;return true
                            }
                        }
                    }
                }
                HStack {
                    Button { add(NativeDiagram()) } label: { Label("Tom övning", systemImage: "plus") }.disabled(session.plan.blocks.count >= 30)
                    Button("Övningsbank") { bankOpen = true }.disabled(session.plan.blocks.count >= 30)
                }
                HStack {
                    Button { move(-1) } label: { Image(systemName: "arrow.up") }.disabled(index == nil || index == 0).help("Flytta övningen uppåt")
                    Button { move(1) } label: { Image(systemName: "arrow.down") }.disabled(index == nil || index == session.plan.blocks.count - 1).help("Flytta övningen nedåt")
                    Button("Duplicera") { if let index { var b = session.plan.blocks[index]; b.id = UUID().uuidString; session.plan.blocks.insert(b, at: index + 1); selected = b.id } }.disabled(index == nil || session.plan.blocks.count >= 30)
                    Button { if let index { removed = (session.plan.blocks[index], index); session.plan.blocks.remove(at: index); selected = session.plan.blocks.first?.id } } label: { Image(systemName: "trash") }.disabled(index == nil).help("Ta bort övningen från utkastet")
                }
                if let removed {
                    Button("Ångra borttagning av övning") { session.plan.blocks.insert(removed.0, at: min(removed.1, session.plan.blocks.count)); selected = removed.0.id; self.removed = nil }.disabled(session.plan.blocks.count >= 30)
                }
                Divider()
                HStack { Button("Importera JSON") { importPlan() }; Button("Exportera JSON") { exportPlan() } }
                if let notice { Text(notice).font(.system(size: 11)).foregroundStyle(Studio.muted) }
                Text("Ändringarna sparas först när du väljer Spara.").font(.system(size: 11)).foregroundStyle(Studio.muted)
            }.padding(22).frame(minWidth: 270, idealWidth: 280, maxWidth: 320)
            ScrollView {
                if let index {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            TextField("Övningens namn", text: $session.plan.blocks[index].diagram.title).font(.system(size: 25, design: .serif)).textFieldStyle(.plain).padding(10).background(Studio.line.opacity(0.2), in: RoundedRectangle(cornerRadius: 8))
                            Stepper("\(session.plan.blocks[index].minutes) min", value: $session.plan.blocks[index].minutes, in: 1...180).frame(width: 135)
                        }
                        NativeDiagramEditor(diagram: $session.plan.blocks[index].diagram).id(session.plan.blocks[index].id)
                        NativeNoteField(title: "Instruktioner", text: $session.plan.blocks[index].diagram.notes, limit: 1200)
                    }.padding(24)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "sportscourt").font(.system(size: 40)).foregroundStyle(Studio.muted)
                        Text("Bygg passet runt ett tydligt fokus.").font(.system(size: 26, design: .serif))
                        Text("Välj en övning ur banken eller börja med en tom plan.").foregroundStyle(Studio.muted)
                        Button("Öppna övningsbanken") { bankOpen = true }
                    }.frame(maxWidth: .infinity).padding(60)
                }
            }.frame(minWidth: 400)
        }.sheet(isPresented: $bankOpen) {
            NativeBankPicker(bank: session.bank) { item in add(item.model, minutes: Int(item.time.prefix(while: { $0.isNumber })) ?? 10); bankOpen = false }
        }.onAppear { selected = session.plan.blocks.first?.id }
    }
    private func add(_ diagram: NativeDiagram, minutes: Int = 10) {
        guard session.plan.blocks.count < 30 else { return }
        let block = NativeBlock(minutes: minutes, diagram: diagram); session.plan.blocks.append(block); selected = block.id
    }
    private func move(_ delta: Int) {
        guard let index, session.plan.blocks.indices.contains(index + delta) else { return }
        session.plan.blocks.swapAt(index, index + delta)
    }
    private func importPlan() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= 1_000_000 else { throw NativeAPIError(message: "Filen är för stor.") }
            let document = try JSONDecoder().decode(NativePlan.self, from: data)
            guard document.valid else { throw NativeAPIError(message: "Filen innehåller ett ogiltigt träningspass.") }
            session.plan = document; selected = document.blocks.first?.id; notice = "Importerat som utkast. Välj Spara för att behålla passet."
        } catch { notice = error.localizedDescription }
    }
    private func exportPlan() {
        let panel = NSSavePanel(); panel.allowedContentTypes = [.json]; panel.nameFieldStringValue = "träningspass.json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; try encoder.encode(session.plan).write(to: url, options: .atomic); notice = "Passet har exporterats." }
        catch { notice = error.localizedDescription }
    }
}
struct NativeBankPicker: View {
    let bank: [NativeBank]
    let choose: (NativeBank) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Text("Övningsbanken").font(.system(size: 28, design: .serif)); Spacer(); Button("Stäng") { dismiss() } }
            TextField("Sök namn, område eller fokus", text: $search).textFieldStyle(.roundedBorder)
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(bank.filter { search.isEmpty || ($0.model.title + " " + $0.category + " " + $0.focus).localizedCaseInsensitiveContains(search) }) { item in
                        HStack(alignment: .top, spacing: 18) {
                            NativePitch(diagram: item.model, selected: nil).frame(width: 215, height: 150)
                            VStack(alignment: .leading, spacing: 8) {
                                Text(item.model.title).font(.system(size: 20, design: .serif))
                                Text("\(item.players) spelare · \(item.area) · \(item.time)").font(.system(size: 12)).foregroundStyle(Studio.muted)
                                Text(item.focus).font(.system(size: 13))
                                Button("Lägg till i passet") { choose(item) }
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }.padding(16).background(Studio.line.opacity(0.2), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }.padding(26).frame(width: 820, height: 650).background(Studio.paper).foregroundStyle(Studio.ink)
    }
}
extension NativePlan {
    var valid: Bool {
        version == 1 && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && title.count <= 100 && date.count <= 10 && (date.isEmpty || NativeDateField.parse(date) != nil) && blocks.count <= 30 && Set(blocks.map(\.id)).count == blocks.count && blocks.allSatisfy {
            !$0.id.isEmpty && $0.id.count <= 80 && $0.id.range(of: "^[a-zA-Z0-9-]+$", options: .regularExpression) != nil && (1...180).contains($0.minutes) && $0.diagram.valid
        }
    }
}
extension NativeDiagram {
    var valid: Bool {
        version == 1 && title.count <= 70 && notes.count <= 1200 && objects.count <= 500 && Set(objects.map(\.id)).count == objects.count && objects.allSatisfy { object in
            let numbers = [object.x, object.y, object.size] + (object.arrow ? [object.x2 ?? .nan, object.y2 ?? .nan, object.cx ?? .nan, object.cy ?? .nan] : [])
            return !object.id.isEmpty && object.id.count <= 80 && object.id.range(of: "^[a-zA-Z0-9]+$", options: .regularExpression) != nil && NativeDiagramEditor.types.contains(object.type) && object.label.count <= 40 && object.color.range(of: "^#[a-fA-F0-9]{6}$", options: .regularExpression) != nil && (0.5...2).contains(object.size) && numbers.allSatisfy { $0.isFinite && abs($0) <= 5000 }
        }
    }
}
