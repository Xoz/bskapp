import SwiftUI

struct OfflineStatusBar:View {
    @ObservedObject var browser:BrowserModel
    @ObservedObject var store=OfflineStore.shared
    var body:some View{
        if browser.signedIn {
            HStack(spacing:12){
                Label(store.offline ? "Offline · nedladdat underlag":"Ansluten till lagets databas",systemImage:store.offline ? "wifi.slash":"checkmark.icloud").font(.caption)
                if !store.pending.isEmpty{Text("\(store.pending.count) väntar på synk").font(.caption).fontWeight(.medium)}
                Spacer();Button("Offline och synk"){store.panel=true}.buttonStyle(.plain).font(.caption)
            }.padding(.horizontal,22).padding(.vertical,8).background(store.offline ? Studio.gold.opacity(0.2):Studio.line.opacity(0.2))
        }
    }
}
struct NativeCommandPalette:View {
    @ObservedObject var browser:BrowserModel
    @State private var query=""
    @State private var selected:String?
    @FocusState private var searching:Bool
    struct Item:Identifiable{let title,path,symbol:String;var id:String{path}}
    private var items:[Item]{
        var result=(Destination.workspace+Destination.insights).filter{browser.availablePaths.contains($0.path) || ($0.path=="/utveckling" && browser.availablePaths.contains("/spelare"))}.map{Item(title:$0.title,path:$0.path,symbol:$0.symbol)}
        result += (browser.practice?.players ?? []).map{Item(title:$0.name,path:"/spelare/\($0.id)",symbol:"person")}
        result += (browser.workspace?.matches ?? []).map{Item(title:"\($0.title) · \($0.date)",path:"/matcher/\($0.id)",symbol:"sportscourt")}
        result += (browser.practice?.plans ?? []).map{Item(title:$0.title,path:"/traning/\($0.id)",symbol:"figure.soccer")}
        return result.filter{query.isEmpty || $0.title.localizedCaseInsensitiveContains(query)}
    }
    var body:some View{
        VStack(alignment:.leading,spacing:18){
            HStack{Image(systemName:"magnifyingglass");TextField("Sök spelare, match, träning eller vy",text:$query).textFieldStyle(.plain).focused($searching).onSubmit{openSelected()};Button("Stäng"){browser.commandPalette=false}.keyboardShortcut(.escape,modifiers:[])}.padding(14).background(Studio.line.opacity(0.25),in:RoundedRectangle(cornerRadius:10))
            List(selection:$selected){ForEach(items){item in Label(item.title,systemImage:item.symbol).tag(item.id).padding(.vertical,6).onTapGesture(count:2){open(item)}}}.listStyle(.plain)
            HStack{Text("↑ ↓ välj · Retur öppna · Esc stäng").font(.caption).foregroundStyle(Studio.muted);Spacer();Button("Öppna"){openSelected()}.disabled(items.isEmpty)}
        }.padding(22).frame(width:600,height:440).background(Studio.paper).onAppear{searching=true;selected=items.first?.id}.onChange(of:query){_,_ in selected=items.first?.id}.onKeyPress(.downArrow){move(1);return .handled}.onKeyPress(.upArrow){move(-1);return .handled}.onKeyPress(.return){openSelected();return .handled}
    }
    private func move(_ delta:Int){guard !items.isEmpty else{return};let index=items.firstIndex{$0.id==selected} ?? 0;selected=items[min(items.count-1,max(0,index+delta))].id}
    private func openSelected(){if let item=items.first(where:{$0.id==selected}) ?? items.first{open(item)}}
    private func open(_ item:Item){browser.commandPalette=false;browser.open(item.path)}
}

struct NativeMatchDirectory:View {
    @ObservedObject var browser:BrowserModel
    @State private var query=""
    var body:some View {
        ScrollView{VStack(alignment:.leading,spacing:22){
            Text("På planen. Före och efter.").font(.system(size:32,design:.serif))
            Text("Arbetsveckans matcher. Öppna en match för laguppställning, plan, trupp och utvärdering.").foregroundStyle(Studio.muted)
            TextField("Sök match eller lag",text:$query).textFieldStyle(.roundedBorder)
            let matches=(browser.workspace?.matches ?? []).filter{query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.team.localizedCaseInsensitiveContains(query)}
            if matches.isEmpty{ContentUnavailableView("Inga matcher i arbetsveckan",systemImage:"sportscourt",description:Text("Kommande matcher och de senaste sju dagarna visas här."))}
            ForEach(matches){match in Button{browser.open("/matcher/\(match.id)")}label:{HStack{VStack(alignment:.leading,spacing:8){Text(match.title).font(.system(size:23,design:.serif));Text(match.subtitle).font(.caption).foregroundStyle(Studio.muted)};Spacer();Text(match.stage.title);Image(systemName:"arrow.up.right")}}.buttonStyle(.plain).editorPanel()}
        }.padding(28).frame(maxWidth:1000,alignment:.leading).frame(maxWidth:.infinity)}
    }
}
