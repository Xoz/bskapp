import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var visibleError: String?
    @State private var lastError: String?
    @State private var lastErrorDate = Date.distantPast

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ZStack {
                    BSKBackdrop()
                    VStack(spacing: 18) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(BSKTheme.hero)
                            Text("+90").font(.system(size: 26, weight: .black, design: .rounded)).foregroundStyle(BSKTheme.accent)
                        }
                        .frame(width: 74, height: 74)
                        ProgressView().tint(BSKTheme.accent)
                        Text("FÖRBEREDER MATCHCENTER")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.8)
                            .foregroundStyle(BSKTheme.muted)
                    }
                }
                .task { await model.restore() }
            case .signedOut:
                LoginView()
            case .signedIn:
                MainSplitView()
            }
        }
        .overlay(alignment: .top) {
            if let visibleError {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(BSKTheme.warning)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Kunde inte slutföra allt").font(.subheadline.bold())
                        Text(visibleError).font(.caption).foregroundStyle(BSKTheme.secondary).lineLimit(2)
                    }
                    Spacer(minLength: 4)
                    Button { dismissError() } label: {
                        Image(systemName: "xmark").font(.caption.bold()).foregroundStyle(BSKTheme.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(14)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.warning.opacity(0.28)))
                .shadow(color: .black.opacity(0.3), radius: 20, y: 8)
                .padding(.horizontal, 14)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(100)
            }
        }
        .onChange(of: model.errorMessage) { _, message in
            guard let message, !message.isEmpty else { return }
            model.errorMessage = nil
            let now = Date()
            guard message != lastError || now.timeIntervalSince(lastErrorDate) > 30 else { return }
            lastError = message
            lastErrorDate = now
            withAnimation(.snappy) { visibleError = message }
            Task {
                try? await Task.sleep(for: .seconds(5))
                if visibleError == message { dismissError() }
            }
        }
    }

    private func dismissError() {
        withAnimation(.easeOut(duration: 0.2)) { visibleError = nil }
    }
}
