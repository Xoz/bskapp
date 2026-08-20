import SwiftUI

@main
struct BSKApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .tint(Color("AccentColor"))
        }
    }
}
