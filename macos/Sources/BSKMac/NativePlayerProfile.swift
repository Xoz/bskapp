import SwiftUI

struct NativePlayerProfile:View{
    @ObservedObject var browser:BrowserModel
    let data:WorkdayProfile
    @State private var tab="development"
    var body:some View{
        ScrollView{
            VStack(alignment:.leading,spacing:24){
                HStack(alignment:.top){
                    VStack(alignment:.leading,spacing:8){Text(data.profile.teamNames.joined(separator:" · ").uppercased()).font(.caption).tracking(2).foregroundStyle(Studio.muted);Text(data.profile.name).font(.system(size:34,design:.serif));Text(data.profile.position).foregroundStyle(Studio.muted)}
                    Spacer()
                    if data.canEdit{VStack(alignment:.trailing,spacing:10){Button("Gör avstämning"){browser.open("/spelare/\(data.profile.id)/utveckling/avstamning")};Button("Förbered spelarsamtal"){browser.open("/spelare/\(data.profile.id)?samtal=forbered")}}} 
                }
                HStack(spacing:24){metric("Klara färdigheter",data.development.doneCount);metric("På väg",data.development.activeCount);metric("Träningar",data.profile.stats.trainingCount);metric("Deltog i matcher",data.profile.stats.matchCount)}
                if let next=data.conversations.first, next.follow_up_on != nil{Label("Senaste samtalets uppföljning: \(next.follow_up_on!)",systemImage:"calendar").font(.callout).padding(16).frame(maxWidth:.infinity,alignment:.leading).background(Studio.gold.opacity(0.15),in:RoundedRectangle(cornerRadius:12))}
                Picker("Profilområde",selection:$tab){Text("Utveckling").tag("development");Text("Samtal").tag("conversations");Text("Historik").tag("history")}.pickerStyle(.segmented)
                if tab=="development"{development}
                if tab=="conversations"{conversations}
                if tab=="history"{history}
            }.padding(28).frame(maxWidth:1000,alignment:.leading).frame(maxWidth:.infinity)
        }
    }
    private func metric(_ title:String,_ count:Int)->some View{VStack(alignment:.leading,spacing:6){Text(String(count)).font(.system(size:27,design:.serif));Text(title).font(.caption).foregroundStyle(Studio.muted)}.frame(maxWidth:.infinity,alignment:.leading)}
    private var development:some View{
        VStack(alignment:.leading,spacing:18){
            let focus=data.development.categories.flatMap(\.skills).filter(\.isFocus)
            Text("Nästa steg").font(.system(size:24,design:.serif))
            if focus.isEmpty{Text("Inget fokus valt ännu. Börja med en avstämning.").foregroundStyle(Studio.muted)}
            ForEach(focus){skill in VStack(alignment:.leading,spacing:8){Label(skill.title,systemImage:"scope").font(.headline);Text(skill.criterion);Text(skill.advice).foregroundStyle(Studio.muted)}.editorPanel()}
            ForEach(data.development.categories){category in
                DisclosureGroup(category.name){VStack(alignment:.leading,spacing:14){ForEach(category.skills){skill in HStack(alignment:.top){VStack(alignment:.leading,spacing:5){Text(skill.title).font(.headline);Text(skill.criterion).font(.callout).foregroundStyle(Studio.muted)};Spacer();Text(status(skill.status)).font(.caption).padding(6).background(Studio.line,in:Capsule())}}}.padding(.top,14)}.editorPanel()
            }
        }
    }
    private var conversations:some View{
        VStack(alignment:.leading,spacing:18){
            if data.conversations.isEmpty{ContentUnavailableView("Inga registrerade samtal",systemImage:"bubble.left.and.bubble.right",description:Text("Förbered ett samtal utifrån spelarens utvecklingsbild."))}
            ForEach(data.conversations){c in VStack(alignment:.leading,spacing:12){Text(c.conversation_date).font(.system(size:23,design:.serif));Text(c.coach_name).font(.caption).foregroundStyle(Studio.muted);paragraph("Samtal",c.coach_summary);paragraph("Spelarens ord",c.player_perspective);paragraph("Överenskommelse",c.agreed_actions);if let date=c.follow_up_on{Label("Följ upp \(date)",systemImage:"calendar")}}.editorPanel()}
        }.textSelection(.enabled)
    }
    private var history:some View{
        VStack(alignment:.leading,spacing:20){
            Text("Avstämningar").font(.system(size:24,design:.serif))
            if data.checkpoints.isEmpty{Text("Inga avstämningar registrerade.").foregroundStyle(Studio.muted)}
            ForEach(data.checkpoints){c in DisclosureGroup("\(c.date) · \(c.changed_count) ändrade färdigheter"){VStack(alignment:.leading,spacing:12){Text(c.coach_name).font(.caption);paragraph("Styrkor",c.strengths);paragraph("Fokus",c.focus_note);paragraph("Spelarens upplevelse",c.wellbeing_note)}.padding(.top,12)}.editorPanel()}
            Text("Matchhistorik").font(.system(size:24,design:.serif))
            if data.profile.matchHistory.isEmpty{Text("Inget matchdeltagande registrerat.").foregroundStyle(Studio.muted)}
            ForEach(data.profile.matchHistory){m in Button{browser.open("/matcher/\(m.id)") }label:{HStack{VStack(alignment:.leading,spacing:5){Text(m.opponent);Text("\(m.date) · \(m.sourceTeam)").font(.caption).foregroundStyle(Studio.muted)};Spacer();Image(systemName:"arrow.up.right")}}.buttonStyle(.plain).editorPanel()}
        }
    }
    @ViewBuilder private func paragraph(_ title:String,_ text:String)->some View{if !text.isEmpty{VStack(alignment:.leading,spacing:5){Text(title).font(.caption).foregroundStyle(Studio.muted);Text(text).font(.callout)}}}
    private func status(_ s:String)->String{["done":"Klar","almost":"Nästan klar","training":"Tränar på","not_started":"Ej påbörjad"][s] ?? s}
}
