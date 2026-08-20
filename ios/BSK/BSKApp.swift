import SwiftUI

enum BSKTheme {
    static let background = Color(red: 13 / 255, green: 18 / 255, blue: 24 / 255)
    static let backgroundDeep = Color(red: 7 / 255, green: 12 / 255, blue: 16 / 255)
    static let surface = Color(red: 20 / 255, green: 27 / 255, blue: 34 / 255)
    static let elevated = Color(red: 27 / 255, green: 36 / 255, blue: 45 / 255)
    static let border = Color(red: 39 / 255, green: 50 / 255, blue: 61 / 255)
    static let accent = Color(red: 23 / 255, green: 201 / 255, blue: 100 / 255)
    static let secondary = Color(red: 170 / 255, green: 180 / 255, blue: 194 / 255)
    static let muted = Color(red: 124 / 255, green: 135 / 255, blue: 152 / 255)
    static let warning = Color(red: 245 / 255, green: 165 / 255, blue: 36 / 255)
    static let danger = Color(red: 243 / 255, green: 18 / 255, blue: 96 / 255)

    static var canvas: some ShapeStyle {
        LinearGradient(
            colors: [background, backgroundDeep],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

private struct BSKListSurface: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background {
                ZStack(alignment: .topTrailing) {
                    Rectangle().fill(BSKTheme.canvas)
                    Circle()
                        .fill(BSKTheme.accent.opacity(0.075))
                        .frame(width: 280, height: 280)
                        .blur(radius: 70)
                        .offset(x: 120, y: -120)
                }
                .ignoresSafeArea()
            }
    }
}

private struct BSKCardSurface: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(
                    colors: [BSKTheme.elevated.opacity(0.96), BSKTheme.surface],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 20, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
            .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
    }
}

extension View {
    func bskListSurface() -> some View { modifier(BSKListSurface()) }
    func bskCardSurface() -> some View { modifier(BSKCardSurface()) }
}

@main
struct BSKApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .tint(BSKTheme.accent)
                .preferredColorScheme(.dark)
                .background(BSKTheme.canvas)
        }
    }
}
