import SwiftUI
import AppKit
import UniformTypeIdentifiers

extension Color {
    init(trainingHex: String) {
        let number = UInt32(trainingHex.dropFirst(), radix: 16) ?? 0xffd23f
        self.init(red: Double((number >> 16) & 255) / 255, green: Double((number >> 8) & 255) / 255, blue: Double(number & 255) / 255)
    }
}
struct NativePitch: View {
    let diagram: NativeDiagram
    let selected: String?
    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / 1000, y: size.height / 700)
            for band in 0..<10 {
                context.fill(Path(CGRect(x: 0, y: band * 70, width: 1000, height: 70)), with: .color(Color(trainingHex: band % 2 == 0 ? "#17633f" : "#1b6a45")))
            }
            context.stroke(Path(roundedRect: CGRect(x: 30, y: 30, width: 940, height: 640), cornerRadius: 4), with: .color(.white.opacity(0.35)), lineWidth: 2)
            for object in diagram.objects.sorted(by: { $0.arrow && !$1.arrow }) { render(object, in: &context) }
        }.clipShape(RoundedRectangle(cornerRadius: 10)).accessibilityLabel("Ritning: \(diagram.title)")
    }
    private func render(_ o: NativeObject, in context: inout GraphicsContext) {
        let color = Color(trainingHex: o.color)
        if o.arrow {
            let end = CGPoint(x: o.x2 ?? o.x, y: o.y2 ?? o.y), curve = CGPoint(x: o.cx ?? o.x, y: o.cy ?? o.y)
            var p = Path(); p.move(to: CGPoint(x: o.x, y: o.y)); p.addQuadCurve(to: end, control: curve)
            context.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: 4 * o.size, lineCap: .round, dash: o.type == "run" ? [12,10] : o.type == "dribble" ? [2,9] : []))
            let angle = atan2(end.y - curve.y, end.x - curve.x), length = 17 * o.size
            var head = Path(); head.move(to: end)
            head.addLine(to: CGPoint(x: end.x - length * cos(angle - 0.5), y: end.y - length * sin(angle - 0.5)))
            head.addLine(to: CGPoint(x: end.x - length * cos(angle + 0.5), y: end.y - length * sin(angle + 0.5))); head.closeSubpath()
            context.fill(head, with: .color(color))
            if !o.label.isEmpty { context.draw(Text(o.label).font(.system(size: 22, weight: .bold)).foregroundColor(color), at: CGPoint(x: 0.25 * o.x + 0.5 * curve.x + 0.25 * end.x + 18, y: 0.25 * o.y + 0.5 * curve.y + 0.25 * end.y)) }
            if selected == o.id {
                for point in [CGPoint(x: o.x, y: o.y), curve, end] {
                    context.fill(Path(ellipseIn: CGRect(x: point.x - 9, y: point.y - 9, width: 18, height: 18)), with: .color(.cyan))
                }
            }
            return
        }
        var c = context; c.translateBy(x: o.x, y: o.y); c.scaleBy(x: o.size, y: o.size)
        if selected == o.id { c.stroke(Path(ellipseIn: CGRect(x: -44, y: -44, width: 88, height: 88)), with: .color(.cyan), style: StrokeStyle(lineWidth: 2, dash: [4,4])) }
        switch o.type {
        case "player":
            c.fill(Path(ellipseIn: CGRect(x: -10, y: -33, width: 20, height: 20)), with: .color(Color(trainingHex: "#f1c79d")))
            var shirt = Path(); shirt.move(to: CGPoint(x: -12, y: -10)); for p in [CGPoint(x:-24,y:0),CGPoint(x:-17,y:12),CGPoint(x:-11,y:7),CGPoint(x:-11,y:25),CGPoint(x:11,y:25),CGPoint(x:11,y:7),CGPoint(x:17,y:12),CGPoint(x:24,y:0),CGPoint(x:12,y:-10)] { shirt.addLine(to:p) }; shirt.closeSubpath(); c.fill(shirt, with: .color(color))
            var legs = Path(); legs.move(to: CGPoint(x:-9,y:26)); legs.addLine(to:CGPoint(x:-10,y:42)); legs.move(to:CGPoint(x:9,y:26)); legs.addLine(to:CGPoint(x:10,y:42)); c.stroke(legs, with:.color(Color(trainingHex:"#142c27")),lineWidth:9)
            c.draw(Text(o.label).font(.system(size:14,weight:.bold)).foregroundColor(.black),at:CGPoint(x:0,y:10))
        case "ball":
            c.fill(Path(ellipseIn:CGRect(x:-14,y:-14,width:28,height:28)),with:.color(color)); c.stroke(Path(ellipseIn:CGRect(x:-14,y:-14,width:28,height:28)),with:.color(.black),lineWidth:2)
            c.fill(Path(ellipseIn:CGRect(x:-6,y:-6,width:12,height:12)),with:.color(.black))
        case "cone":
            var p=Path();p.move(to:CGPoint(x:0,y:-23));p.addLine(to:CGPoint(x:21,y:10));p.addQuadCurve(to:CGPoint(x:-21,y:10),control:CGPoint(x:0,y:25));p.closeSubpath();c.fill(p,with:.color(color));c.stroke(p,with:.color(.black.opacity(0.4)),lineWidth:2)
        case "goal":
            c.stroke(Path(CGRect(x:-65,y:-25,width:130,height:45)),with:.color(color),lineWidth:5)
            var net=Path();for x in stride(from:-40,through:40,by:25){net.move(to:CGPoint(x:x,y:-25));net.addLine(to:CGPoint(x:x,y:20))};for y in [-10,5]{net.move(to:CGPoint(x:-65,y:y));net.addLine(to:CGPoint(x:65,y:y))};c.stroke(net,with:.color(color),lineWidth:1)
        case "text": c.draw(Text(o.label).font(.system(size:23,weight:.semibold)).foregroundColor(color),at:.zero)
        default: break
        }
    }
}
struct NativeDiagramEditor: View {
    nonisolated static let types = ["player", "ball", "cone", "goal", "pass", "run", "dribble", "text"]
    static let tools = [("select", "Flytta"), ("player", "Spelare"), ("ball", "Boll"), ("cone", "Kon"), ("goal", "Mål"), ("pass", "Passning"), ("run", "Löpning"), ("dribble", "Drivning"), ("text", "Text")]
    @Binding var diagram: NativeDiagram
    @State private var notice: String?
    @State private var tool = "select"
    @State private var selected: String?
    @State private var past: [NativeDiagram] = []
    @State private var future: [NativeDiagram] = []
    @State private var beforeDrag: NativeDiagram?
    @State private var dragID: String?
    @State private var handle = "body"
    private var index: Int? { diagram.objects.firstIndex { $0.id == selected } }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Picker("Ritverktyg", selection: $tool) { ForEach(Self.tools, id: \.0) { Text($0.1).tag($0.0) } }.frame(maxWidth: 200)
                Text(tool == "select" ? "Klicka för att välja. Dra för att flytta." : ["pass","run","dribble"].contains(tool) ? "Dra från start till mål." : "Klicka på planen för att placera.").font(.system(size: 11)).foregroundStyle(Studio.muted)
                Spacer()
                Button("Öppna ritfil") { importDiagram() }
                Button { undo() } label: { Image(systemName: "arrow.uturn.backward") }.disabled(past.isEmpty).help("Ångra ritning")
                Button { redo() } label: { Image(systemName: "arrow.uturn.forward") }.disabled(future.isEmpty).help("Gör om ritning")
            }
            GeometryReader { geometry in
                NativePitch(diagram: diagram, selected: selected).contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0).onChanged { value in drag(value, size: geometry.size) }.onEnded { _ in finish() })
            }.aspectRatio(1000.0/700.0, contentMode: .fit).frame(minHeight: 200)
            if let notice { Text(notice).font(.system(size: 11)).foregroundStyle(Studio.muted) }
            HStack {
                Picker("Objekt", selection: $selected) {
                    Text("Välj ett objekt").tag(String?.none)
                    ForEach(Array(diagram.objects.enumerated()), id: \.element.id) { i, o in Text("\(i + 1). \(Self.tools.first { $0.0 == o.type }?.1 ?? o.type) \(o.label)").tag(Optional(o.id)) }
                }.frame(maxWidth: 260)
                Button("Duplicera objekt") { if let index { var o = diagram.objects[index]; o.id = UUID().uuidString.replacingOccurrences(of:"-",with:""); shift(&o, dx:30,dy:30); var next = diagram; next.objects.append(o); commit(next); selected = o.id } }.disabled(index == nil || diagram.objects.count >= 500)
                Button("Ta bort objekt") { if let selected { var next=diagram;next.objects.removeAll{$0.id==selected};commit(next);self.selected=nil } }.disabled(index == nil)
            }
            if let index {
                let o = diagram.objects[index]
                HStack {
                    TextField("Etikett", text: objectBinding(index, \.label)).textFieldStyle(.roundedBorder).frame(maxWidth: 200)
                    ColorPicker("Färg", selection: Binding(get: { Color(trainingHex: diagram.objects[index].color) }, set: { color in
                        guard let rgb = NSColor(color).usingColorSpace(.sRGB) else { return }
                        var next=diagram;next.objects[index].color=String(format:"#%02x%02x%02x",Int(rgb.redComponent*255),Int(rgb.greenComponent*255),Int(rgb.blueComponent*255));commit(next)
                    }), supportsOpacity: false)
                    Stepper("Storlek \(o.size, specifier: "%.1f")", value: objectBinding(index, \.size), in:0.5...2,step:0.1)
                }.font(.system(size:12))
                HStack {
                    number("X", index, \.x); number("Y", index, \.y)
                    if o.arrow { optionalNumber("Slut X", index, \.x2); optionalNumber("Slut Y", index, \.y2); optionalNumber("Kurva X", index, \.cx); optionalNumber("Kurva Y", index, \.cy) }
                }.font(.system(size:11))
            }
        }
    }
    private func importDiagram() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= 1_000_000 else { throw NativeAPIError(message: "Ritfilen är för stor.") }
            let next = try JSONDecoder().decode(NativeDiagram.self, from: data)
            guard next.valid else { throw NativeAPIError(message: "Ritfilen innehåller ogiltiga objekt.") }
            commit(next); selected = nil; notice = "Ritningen är öppnad i utkastet."
        } catch { notice = error.localizedDescription }
    }
    private func objectBinding<T>(_ index: Int, _ key: WritableKeyPath<NativeObject,T>) -> Binding<T> {
        Binding(get:{diagram.objects[index][keyPath:key]},set:{var next=diagram;next.objects[index][keyPath:key]=$0;commit(next)})
    }
    private func number(_ title:String,_ index:Int,_ key:WritableKeyPath<NativeObject,Double>) -> some View {
        VStack(alignment:.leading){Text(title);TextField(title,value:objectBinding(index,key),format:.number.precision(.fractionLength(0...1))).textFieldStyle(.roundedBorder)}
    }
    private func optionalNumber(_ title:String,_ index:Int,_ key:WritableKeyPath<NativeObject,Double?>) -> some View {
        VStack(alignment:.leading){Text(title);TextField(title,value:Binding(get:{diagram.objects[index][keyPath:key] ?? 0},set:{var next=diagram;next.objects[index][keyPath:key]=$0;commit(next)}),format:.number.precision(.fractionLength(0...1))).textFieldStyle(.roundedBorder)}
    }
    private func commit(_ next:NativeDiagram){guard next != diagram else{return};past.append(diagram);if past.count>100{past.removeFirst()};future=[];diagram=next}
    private func undo(){guard let previous=past.popLast()else{return};future.append(diagram);diagram=previous;selected=nil}
    private func redo(){guard let next=future.popLast()else{return};past.append(diagram);diagram=next;selected=nil}
    private func shift(_ o:inout NativeObject,dx:Double,dy:Double){o.x+=dx;o.y+=dy;if o.arrow{o.x2=(o.x2 ?? o.x)+dx;o.y2=(o.y2 ?? o.y)+dy;o.cx=(o.cx ?? o.x)+dx;o.cy=(o.cy ?? o.y)+dy}}
    private func point(_ p:CGPoint,_ size:CGSize)->CGPoint{CGPoint(x:max(35,min(965,p.x/size.width*1000)),y:max(45,min(650,p.y/size.height*700)))}
    private func distance(_ a:CGPoint,_ b:CGPoint)->Double{hypot(a.x-b.x,a.y-b.y)}
    private func hit(_ p:CGPoint,_ o:NativeObject)->Bool{
        if !o.arrow{return distance(p,CGPoint(x:o.x,y:o.y)) < (o.type=="goal" ? 70 : 42)*o.size}
        return (0...24).contains { step in let t=Double(step)/24, u=1-t;return distance(p,CGPoint(x:u*u*o.x+2*u*t*(o.cx ?? o.x)+t*t*(o.x2 ?? o.x),y:u*u*o.y+2*u*t*(o.cy ?? o.y)+t*t*(o.y2 ?? o.y)))<20 }
    }
    private func drag(_ value:DragGesture.Value,size:CGSize){
        let start=point(value.startLocation,size), end=point(value.location,size)
        if beforeDrag == nil {
            beforeDrag=diagram;handle="body"
            if tool=="select" {
                if let index, diagram.objects[index].arrow {
                    let o=diagram.objects[index]
                    for (name,p) in [("start",CGPoint(x:o.x,y:o.y)),("end",CGPoint(x:o.x2 ?? o.x,y:o.y2 ?? o.y)),("curve",CGPoint(x:o.cx ?? o.x,y:o.cy ?? o.y))] where distance(start,p)<17 { handle=name;dragID=o.id;break }
                }
                if handle=="body"{selected=diagram.objects.reversed().first{hit(start,$0)}?.id;dragID=selected}
            } else if diagram.objects.count<500 {
                var o=NativeObject(type:tool,x:start.x,y:start.y)
                if tool=="cone"{o.color="#f59e0b"};if tool=="ball" || tool=="goal" || o.arrow || tool=="text"{o.color="#ffffff"};if tool=="text"{o.label="Text"}
                if o.arrow{o.x2=start.x;o.y2=start.y;o.cx=start.x;o.cy=start.y}
                diagram.objects.append(o);selected=o.id;dragID=o.id
            }
        }
        guard let dragID,let index=diagram.objects.firstIndex(where:{$0.id==dragID}),let original=beforeDrag else{return}
        if tool != "select" {
            if diagram.objects[index].arrow {diagram.objects[index].x2=end.x;diagram.objects[index].y2=end.y;diagram.objects[index].cx=(start.x+end.x)/2;diagram.objects[index].cy=(start.y+end.y)/2}
        } else if var o=original.objects.first(where:{$0.id==dragID}) {
            switch handle{case "start":o.x=end.x;o.y=end.y;case "end":o.x2=end.x;o.y2=end.y;case "curve":o.cx=end.x;o.cy=end.y;default:shift(&o,dx:end.x-start.x,dy:end.y-start.y)}
            diagram.objects[index]=o
        }
    }
    private func finish(){
        if tool != "select",let index,diagram.objects[index].arrow,let x=diagram.objects[index].x2,let y=diagram.objects[index].y2,hypot(diagram.objects[index].x-x,diagram.objects[index].y-y)<15{diagram.objects.remove(at:index);selected=nil}
        if let beforeDrag,beforeDrag != diagram{past.append(beforeDrag);if past.count>100{past.removeFirst()};future=[]}
        beforeDrag=nil;dragID=nil
    }
}
