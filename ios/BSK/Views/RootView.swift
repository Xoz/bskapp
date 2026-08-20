import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ProgressView("Startar BSK…")
                    .task { await model.restore() }
            case .signedOut:
                LoginView()
            case .signedIn:
                MainSplitView()
            }
        }
        .alert("Något gick fel", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }
}
