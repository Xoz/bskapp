import SwiftUI

enum BSKTheme {
    static let background = Color(red: 17 / 255, green: 21 / 255, blue: 27 / 255)
    static let backgroundDeep = Color(red: 11 / 255, green: 14 / 255, blue: 18 / 255)
    static let surface = Color(red: 25 / 255, green: 30 / 255, blue: 37 / 255)
    static let elevated = Color(red: 31 / 255, green: 37 / 255, blue: 45 / 255)
    static let border = Color.white.opacity(0.09)
    static let accent = Color(red: 76 / 255, green: 196 / 255, blue: 125 / 255)
    static let teamYellow = Color(red: 250 / 255, green: 204 / 255, blue: 21 / 255)
    static let secondary = Color(red: 170 / 255, green: 180 / 255, blue: 194 / 255)
    static let muted = Color(red: 124 / 255, green: 135 / 255, blue: 152 / 255)
    static let warning = Color(red: 245 / 255, green: 165 / 255, blue: 36 / 255)
    static let danger = Color(red: 243 / 255, green: 18 / 255, blue: 96 / 255)
    static let hairline = Color.white.opacity(0.075)

    static var canvas: some ShapeStyle {
        background
    }

    static var hero: LinearGradient {
        LinearGradient(
            colors: [Color(red: 24 / 255, green: 42 / 255, blue: 39 / 255), elevated, surface],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct BSKBackdrop: View {
    var body: some View {
        Rectangle().fill(BSKTheme.canvas).ignoresSafeArea()
    }
}

struct BSKPageHeader: View {
    let eyebrow: String
    let title: String
    let message: String
    var trailing: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(eyebrow.uppercased())
                    .font(.system(size: 11, weight: .black))
                    .tracking(2.1)
                    .foregroundStyle(BSKTheme.accent)
                Spacer(minLength: 12)
                if let trailing {
                    Text(trailing)
                        .font(.caption.bold())
                        .foregroundStyle(BSKTheme.accent)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(BSKTheme.accent.opacity(0.12), in: Capsule())
                        .overlay(Capsule().stroke(BSKTheme.accent.opacity(0.24)))
                }
            }
            Text(title)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .tracking(-0.7)
                .fixedSize(horizontal: false, vertical: true)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(BSKTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct BSKStatusChip: View {
    let title: String
    var color: Color = BSKTheme.accent

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .black))
            .tracking(1.1)
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(color.opacity(0.11), in: Capsule())
    }
}

private struct BSKListSurface: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background {
                ZStack(alignment: .topTrailing) {
                    BSKBackdrop()
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
    }
}

private struct BSKUsesStackNavigationKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var bskUsesStackNavigation: Bool {
        get { self[BSKUsesStackNavigationKey.self] }
        set { self[BSKUsesStackNavigationKey.self] = newValue }
    }
}

private struct BSKCompactTabClearance: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    func body(content: Content) -> some View {
        content.padding(.bottom, horizontalSizeClass == .compact ? 88 : 0)
    }
}

extension View {
    func bskListSurface() -> some View { modifier(BSKListSurface()) }
    func bskCardSurface() -> some View { modifier(BSKCardSurface()) }
    func bskCompactTabClearance() -> some View { modifier(BSKCompactTabClearance()) }
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
