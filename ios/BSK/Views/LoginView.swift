import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            BSKBackdrop()

            VStack(spacing: 30) {
                Spacer()
                ZStack {
                    Circle().fill(BSKTheme.accent.opacity(0.08)).frame(width: 220, height: 220).blur(radius: 18)
                    RoundedRectangle(cornerRadius: 34, style: .continuous)
                        .fill(BSKTheme.hero)
                        .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).stroke(BSKTheme.accent.opacity(0.35)))
                        .shadow(color: BSKTheme.accent.opacity(0.18), radius: 30, y: 12)
                    VStack(spacing: 6) {
                        Text("+90").font(.system(size: 54, weight: .black, design: .rounded)).foregroundStyle(BSKTheme.accent)
                        Text("BSK F2014").font(.system(size: 10, weight: .black)).tracking(2.4).foregroundStyle(BSKTheme.secondary)
                    }
                }
                .frame(width: 174, height: 174)
                VStack(spacing: 10) {
                    Text("Se matchen.\nUtveckla spelaren.")
                        .font(.system(size: 38, weight: .black, design: .rounded))
                        .tracking(-1)
                        .multilineTextAlignment(.center)
                    Text("Ett fokuserat verktyg för beslut före, under och efter match.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
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
                    .padding(.vertical, 16)
                }
                .buttonStyle(.borderedProminent)
                .tint(BSKTheme.accent)
                .foregroundStyle(.black)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .disabled(model.isWorking)
                Text("Säkert med ditt befintliga BSK-konto")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.65))
                    .multilineTextAlignment(.center)
            }
            .padding(28)
            .frame(maxWidth: 520)
            .padding(.vertical, 20)
        }
    }
}
