import SwiftUI

struct OfflineStatusBar:View {
    @ObservedObject var browser:BrowserModel
    @ObservedObject var store=OfflineStore.shared
    var body:some View{
        if browser.signedIn {
            HStack(spacing:12){
                Label(store.offline ? "Offline · nedladdat underlag":"Synkat med lagets databas",systemImage:store.offline ? "wifi.slash":"checkmark.icloud").font(.caption)
                if !store.pending.isEmpty{Text("\(store.pending.count) väntar på synk").font(.caption).fontWeight(.medium)}
                Spacer();Button("Offline och synk"){store.panel=true}.buttonStyle(.plain).font(.caption)
            }.padding(.horizontal,22).padding(.vertical,8).background(store.offline ? Studio.accent.opacity(0.2):Studio.line.opacity(0.2))
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
        var result=(Destination.workspace+Destination.insights).filter{canOpen($0,browser)}.map{Item(title:$0.title,path:$0.path,symbol:$0.symbol)}
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
    @State private var selected:Int?
    private var matches:[WorkflowMatch]{(browser.workspace?.matches ?? []).filter{query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.team.localizedCaseInsensitiveContains(query)}}
    var body:some View {
        HSplitView {
            VStack(spacing:0){
                HStack{Text("Matcher").font(.headline);Spacer()}.padding(16)
                TextField("Sök match eller lag",text:$query).textFieldStyle(.roundedBorder).padding(.horizontal,12).padding(.bottom,12)
                List(selection:$selected){ForEach(matches){match in VStack(alignment:.leading,spacing:5){Text(match.title).fontWeight(.medium);Text("\(match.date) · \(match.team)").font(.caption).foregroundStyle(Studio.muted)}.padding(.vertical,5).tag(match.id)}}.listStyle(.inset).scrollContentBackground(.hidden)
                Text("Kommande matcher och senaste sju dagarna").font(.caption).foregroundStyle(Studio.muted).padding(12)
            }.frame(minWidth:240,idealWidth:280,maxWidth:360).background(Studio.surface)
            ScrollView {VStack(alignment:.leading,spacing:18){
                if let match=matches.first(where:{$0.id==selected}){
                    Text(match.title).font(.title2).fontWeight(.semibold)
                    Text(match.subtitle).font(.callout).foregroundStyle(Studio.muted)
                    Divider()
                    LabeledContent("Laguppställning",value:"\(match.selected) uttagna")
                    LabeledContent("Ja-svar",value:"\(match.accepted) spelare")
                    LabeledContent("Matchplan",value:match.planSaved ? "Sparad":"Återstår")
                    HStack{Button("Laguppställning"){browser.open("/matcher/\(match.id)/laguttagning")};Button("Matchplan"){browser.open("/matcher/\(match.id)")};Button("Trupp"){browser.open("/matcher/\(match.id)#trupp")}}
                    Divider();Text(match.reviewStatus).foregroundStyle(Studio.muted);Button("Utvärdering"){browser.open("/matcher/\(match.id)/utvardera")}
                }else{ContentUnavailableView("Välj en match",systemImage:"sportscourt",description:Text("Förbered matchplanen eller följ upp en spelad match. Äldre matcher finns i spelarens historik."))}
            }.padding(24).frame(maxWidth:850,alignment:.leading).frame(maxWidth:.infinity)}.frame(minWidth:360)
        }.onAppear{selected=matches.first?.id}.onChange(of:matches.map(\.id)){_,ids in if !ids.contains(selected ?? -1){selected=ids.first}}
    }
}
