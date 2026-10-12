import SwiftUI

struct NativeMatchWorkspace:View{
    @ObservedObject var browser:BrowserModel
    @ObservedObject var session:WorkdaySession
    let data:WorkdayMatch
    @State private var search=""
    private let ratingLabels=["Hade stora svårigheter","Klarade delar, behövde mycket stöd","Klarade nivån","Klarade nivån med god marginal","Var klart över nivån"]
    var body:some View{
        ScrollView{
            VStack(alignment:.leading,spacing:24){
                VStack(alignment:.leading,spacing:8){Text("\(data.match.date) · \(data.match.start_time ?? "") · \(data.match.location)").font(.caption).foregroundStyle(Studio.muted);Text("\(data.match.home_away=="home" ? "Hemma":"Borta") mot \(data.match.opponent)").font(.system(size:32,design:.serif));Text("\(data.candidates.filter(\.selected).count) uttagna · \(data.roster.filter{$0.callup_status=="accepted"}.count) tackat ja").font(.callout).foregroundStyle(Studio.muted)}
                HStack{tab("Laguppställning","selection");tab("Matchplan","plan");tab("Trupp","squad");tab("Utvärdering","evaluation")}.buttonStyle(.bordered)
                if session.tab=="selection"{selection}
                else if session.tab=="squad"{squad}
                else if session.tab=="evaluation"{evaluation}
                else{plan}
            }.padding(28).frame(maxWidth:1100,alignment:.leading).frame(maxWidth:.infinity)
        }.disabled(session.busy || session.uncertain)
    }
    private func tab(_ title:String,_ key:String)->some View{Button{session.changeTab(key)}label:{Text(title).fontWeight(session.tab==key ? .semibold:.regular)}.tint(session.tab==key ? Studio.forest:Studio.muted)}
    private var selection:some View{
        VStack(alignment:.leading,spacing:16){
            Text("Välj laguppställning").font(.system(size:24,design:.serif))
            Text("Uttagning är ett tränarval. Ja-svar och faktisk närvaro ändras inte. Sparandet skickar inga kallelser.").font(.callout).foregroundStyle(Studio.muted)
            TextField("Sök spelare",text:$search).textFieldStyle(.roundedBorder)
            Text("\(session.selected.count) uttagna").font(.headline)
            ForEach(data.candidates.filter{search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)}){p in
                HStack{
                    Toggle(p.name,isOn:Binding(get:{session.selected.contains(p.id)},set:{if $0{session.selected.insert(p.id)}else{session.selected.remove(p.id)}}))
                    Spacer();Text(reply(p.reply)).font(.caption).foregroundStyle(Studio.muted)
                    TextField("Position",text:Binding(get:{session.positions[p.id] ?? p.position},set:{session.positions[p.id]=$0})).textFieldStyle(.roundedBorder).frame(width:150)
                }.padding(12).background(Studio.line.opacity(0.25),in:RoundedRectangle(cornerRadius:8))
            }
            Toggle("Jag har granskat belastning och gör ett aktivt tränarval om servern varnar.",isOn:$session.acknowledged).font(.callout)
            if !data.canSelect{Text("Laguppställningen är låst för denna match.").foregroundStyle(Studio.muted)}
        }.disabled(!data.canSelect || session.queued)
    }
    private var squad:some View{
        VStack(alignment:.leading,spacing:18){Text("Trupp · tackat ja").font(.system(size:24,design:.serif));let accepted=data.roster.filter{$0.callup_status=="accepted"};if accepted.isEmpty{ContentUnavailableView("Inga ja-svar ännu",systemImage:"person.2",description:Text("Truppen fylls när spelarna tackar ja. Uttagning räknas separat."))};ForEach(accepted){p in HStack{Text(p.name);Spacer();Button("Spelarprofil"){browser.open("/spelare/\(p.id)")}}.editorPanel()}}
    }
    private var plan:some View{
        VStack(alignment:.leading,spacing:18){
            if let plan=session.plan{
                Picker("Formation",selection:Binding(get:{plan.formation},set:{id in guard let f=data.formations.first(where:{$0.id==id})else{return};var p=plan;p.formation=id;p.spots=f.slots.enumerated().map{i,s in .init(playerId:plan.spots.indices.contains(i) ? plan.spots[i].playerId:nil,x:s.x,y:s.y)};session.plan=p})){ForEach(data.formations){Text($0.label).tag($0.id)}}.frame(maxWidth:250)
                NativeMatchPitch(session:session,data:data).frame(height:420)
                Text("Placera spelarna som tackat ja. Dra en plats på planen för att flytta den.").font(.caption).foregroundStyle(Studio.muted)
                ForEach(plan.spots.indices,id:\.self){index in
                    Picker("Plats \(index+1)",selection:Binding(get:{session.plan?.spots[index].playerId ?? 0},set:{id in guard var plan=session.plan else{return};for i in plan.spots.indices where plan.spots[i].playerId==id{plan.spots[i].playerId=nil};plan.spots[index].playerId=id==0 ? nil:id;session.plan=plan})){
                        Text("Tom plats").tag(0)
                        ForEach(data.roster.filter{$0.callup_status=="accepted"}){Text($0.name).tag($0.id)}
                    }
                }
                ForEach(data.ideaFields){field in NativeNoteField(title:field.label,text:Binding(get:{session.plan?.ideas[field.key] ?? ""},set:{session.plan?.ideas[field.key]=$0}),limit:2000)}
            }
        }.disabled(!data.canPlan || session.queued)
    }
    private var evaluation:some View{
        VStack(alignment:.leading,spacing:18){
            if let evaluation=data.evaluation{
                Text("Ta med lärdomarna vidare").font(.system(size:24,design:.serif))
                HStack{Text("Slutresultat");TextField("Vårt",text:$session.ourScore).frame(width:65);Text("–");TextField("Motståndarens",text:$session.opponentScore).frame(width:65)}.textFieldStyle(.roundedBorder).disabled(evaluation.match.hasLiveData)
                if evaluation.match.hasLiveData{Text("Resultatet kommer från Matchcenter.").font(.caption).foregroundStyle(Studio.muted)}
                NativeNoteField(title:"Tränarens reflektion",text:$session.coachComment,limit:4000)
                if evaluation.players.isEmpty{ContentUnavailableView("Inga registrerade deltagare",systemImage:"person.2",description:Text("Bedömningar avser faktiskt deltagande."))}
                ForEach(evaluation.players){p in VStack(alignment:.leading,spacing:12){Text(p.name).font(.system(size:21,design:.serif));Picker("Matchbedömning",selection:Binding(get:{session.ratings[p.id] ?? 0},set:{session.ratings[p.id]=$0==0 ? nil:$0;if $0 != 0{session.skipped.remove(p.id)}})){Text("Ingen sifferbedömning").tag(0);ForEach(1...5,id:\.self){Text("\($0) · \(ratingLabels[$0-1])").tag($0)}};Toggle("Avstår bedömning",isOn:Binding(get:{session.skipped.contains(p.id)},set:{if $0{session.skipped.insert(p.id);session.ratings[p.id]=nil}else{session.skipped.remove(p.id)}})).toggleStyle(.checkbox);NativeNoteField(title:"Kommentar",text:Binding(get:{session.comments[p.id] ?? ""},set:{session.comments[p.id]=$0}),limit:1000)}.editorPanel()}
            }else{ContentUnavailableView("Utvärderingen är inte öppen",systemImage:"clock",description:Text("Öppnas när matchen är klar och du har rätt behörighet."))}
        }.disabled(!data.canEvaluate || session.queued)
    }
    private func reply(_ value:String)->String{["accepted":"Tackat ja","declined":"Tackat nej","pending":"Inväntar svar"][value] ?? "Inte kallad"}
}
struct NativeMatchPitch:View{
    @ObservedObject var session:WorkdaySession
    let data:WorkdayMatch
    var body:some View{
        GeometryReader{g in
            ZStack{
                RoundedRectangle(cornerRadius:16).fill(Studio.forest)
                Rectangle().stroke(.white.opacity(0.5),lineWidth:1).padding(18)
                Circle().stroke(.white.opacity(0.3),lineWidth:1).frame(width:90,height:90)
                if let plan=session.plan{ForEach(plan.spots.indices,id:\.self){index in let spot=plan.spots[index];VStack(spacing:4){Text(String(index+1)).font(.headline).frame(width:34,height:34).background(Studio.gold,in:Circle()).foregroundStyle(Studio.forest);Text(data.roster.first(where:{$0.id==spot.playerId})?.name ?? "Tom plats").font(.caption).foregroundStyle(.white).lineLimit(1)}.frame(width:130).position(x:spot.x*g.size.width,y:spot.y*g.size.height).gesture(DragGesture(coordinateSpace:.named("matchPitch")).onChanged{v in guard data.canPlan,!session.locked else{return};session.plan?.spots[index].x=min(0.92,max(0.08,v.location.x/g.size.width));session.plan?.spots[index].y=min(0.92,max(0.08,v.location.y/g.size.height))}).accessibilityElement(children:.ignore).accessibilityLabel("Plats \(index+1): \(data.roster.first(where:{$0.id==spot.playerId})?.name ?? "Tom plats")")}}
            }.coordinateSpace(name:"matchPitch")
        }
    }
}
