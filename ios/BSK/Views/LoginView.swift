import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.035, green: 0.09, blue: 0.20), Color(red: 0.08, green: 0.20, blue: 0.43)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()
                Image(systemName: "figure.soccer")
                    .font(.system(size: 58, weight: .semibold))
                    .foregroundStyle(Color("AccentColor"))
                    .accessibilityHidden(true)
                VStack(spacing: 8) {
                    Text("BSK F2014")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("Utveckling nära träningen")
                        .font(.title3)
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
                .tint(Color("AccentColor"))
                .foregroundStyle(.black)
                .disabled(model.isWorking)
                Text("Samma konto, spelare och behörigheter som på bsk2014.se.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.65))
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: 520)
        }
    }
}
