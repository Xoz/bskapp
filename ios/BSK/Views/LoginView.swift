import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [BSKTheme.background, BSKTheme.elevated, BSKTheme.background],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()
                VStack(spacing: 14) {
                    Text("+90")
                        .font(.system(size: 64, weight: .black, design: .rounded))
                        .foregroundStyle(BSKTheme.accent)
                    Text("BSK F2014")
                        .font(.caption.bold())
                        .tracking(2.2)
                        .foregroundStyle(BSKTheme.muted)
                }
                VStack(spacing: 8) {
                    Text("Utveckling nära träningen")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .multilineTextAlignment(.center)
                    Text("Samma lag. Samma data. Nu native.")
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.72))
                }
                .foregroundStyle(.white)
                Spacer()
                Button {
                    Task { await model.signIn() }
                } label: {
                    HStack {
                        if model.isWorking { ProgressView().tint(.black) }
                        Text(model.isWorking ? "Öppnar Google…" : "Fortsätt med Google")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(BSKTheme.accent)
                .foregroundStyle(.black)
                .disabled(model.isWorking)
                Text("Samma konto, spelare och behörigheter som på bsk2014.se.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.65))
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: 520)
            .padding(.vertical, 20)
        }
    }
}
