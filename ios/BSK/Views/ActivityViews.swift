import SwiftUI

struct ActivityList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.activities, selection: $selection) { activity in
            NavigationLink(value: activity.id) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(activity.title).fontWeight(.semibold)
                    HStack {
                        Text(activity.date)
                        if let time = activity.startTime { Text(time) }
                        if activity.observationCount > 0 {
                            Text("\(activity.observationCount) observationer")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Aktiviteter")
        .refreshable { await model.reload() }
    }
}

struct ActivityDetail: View {
    let activity: ActivitySummary

    var body: some View {
        Form {
            Section("Aktivitet") {
                LabeledContent("Datum", value: activity.date)
                if let time = activity.startTime { LabeledContent("Start", value: time) }
                LabeledContent("Typ", value: activity.type)
                LabeledContent("Observationer", value: String(activity.observationCount))
            }
            if !activity.theme.isEmpty {
                Section("Tema") { Text(activity.theme) }
            }
            Section {
                Text("Registrering av observationer blir nästa vertikal och får offlinekö innan den aktiveras.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle(activity.title)
    }
}

struct TodayList: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        List {
            Section("Nästa steg") {
                ForEach(model.activities.prefix(6)) { activity in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(activity.title).fontWeight(.semibold)
                        Text(activity.date).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Idag")
        .refreshable { await model.reload() }
    }
}

struct TodayDetail: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Hej \(model.user?.name.components(separatedBy: " ").first ?? "tränare")")
                    .font(.largeTitle.bold())
                Text("Fokus, observation och uppföljning på samma plats.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                HStack(spacing: 16) {
                    MetricCard(value: String(model.players.count), label: "spelare", icon: "person.3")
                    MetricCard(value: String(model.activities.count), label: "aktiviteter", icon: "sportscourt")
                }
            }
            .padding(28)
            .frame(maxWidth: 800, alignment: .leading)
        }
        .navigationTitle("Översikt")
    }
}

private struct MetricCard: View {
    let value: String
    let label: String
    let icon: String
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).foregroundStyle(Color.accentColor)
            Text(value).font(.system(size: 34, weight: .bold, design: .rounded))
            Text(label).foregroundStyle(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}
