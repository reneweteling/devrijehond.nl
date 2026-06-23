import SwiftUI

struct ProfileScreen: View {
    @EnvironmentObject var session: Session

    var body: some View {
        NavigationStack {
            Group {
                if let me = session.profile {
                    signedIn(me)
                } else {
                    signedOut
                }
            }
            .navigationTitle("Profiel")
        }
    }

    private var signedOut: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 64)).foregroundStyle(Brand.moss)
            Text("Niet ingelogd").font(.title3.bold()).foregroundStyle(Brand.ink)
            Text("Inloggen (Apple, Google, magic-link) komt in de native app nog. "
                + "Plekken bekijken en de kaart werken zonder account.")
                .font(.subheadline).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center).padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Brand.sand)
    }

    private func signedIn(_ me: MeProfile) -> some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 44)).foregroundStyle(Brand.mossDark)
                    VStack(alignment: .leading) {
                        Text(me.name ?? me.handle ?? "Hondenbaas").font(.headline)
                        if let h = me.handle { Text("@\(h)").font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
            if let dogs = me.dogs, !dogs.isEmpty {
                Section("Mijn honden") {
                    ForEach(dogs) { dog in
                        Text([dog.name, dog.breed].compactMap { $0 }.joined(separator: " · "))
                    }
                }
            }
            Section {
                Button("Uitloggen", role: .destructive) { session.signOut() }
            }
        }
    }
}
