import SwiftUI

struct ProfileScreen: View {
    @EnvironmentObject var session: Session

    var body: some View {
        NavigationStack {
            Group {
                if session.isAuthenticated {
                    if let me = session.profile {
                        signedIn(me)
                    } else {
                        ProgressView("Profiel laden…")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Brand.sand)
                    }
                } else {
                    SignInView()
                }
            }
            .navigationTitle("Profiel")
        }
        .task {
            if session.isAuthenticated && session.profile == nil { await session.hydrate() }
        }
    }

    private func signedIn(_ me: MeProfile) -> some View {
        List {
            Section {
                HStack(spacing: 14) {
                    avatar(me)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(me.name ?? me.handle ?? "Hondenbaas")
                            .font(.headline).foregroundStyle(Brand.ink)
                        if let h = me.handle {
                            Text("@\(h)").font(.caption).foregroundStyle(.secondary)
                        }
                        if let email = me.email {
                            Text(email).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }

            Section("Reputatie") {
                HStack {
                    Label("\(me.reputation ?? 0) punten", systemImage: "rosette")
                        .foregroundStyle(Brand.mossDark)
                    Spacer()
                    if me.isModerator {
                        Text(me.isAdmin ? "Beheerder" : "Moderator")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Brand.mossSoft, in: Capsule())
                            .foregroundStyle(Brand.mossDark)
                    }
                }
            }

            if let dogs = me.dogs, !dogs.isEmpty {
                Section("Mijn honden") {
                    ForEach(dogs) { dog in
                        HStack(spacing: 12) {
                            dogThumb(dog)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dog.name).font(.body.weight(.medium))
                                if let sub = dogSubtitle(dog) {
                                    Text(sub).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            Section {
                Button("Uitloggen", role: .destructive) { session.signOut() }
            }
        }
        .refreshable { await session.hydrate() }
    }

    @ViewBuilder private func avatar(_ me: MeProfile) -> some View {
        if let img = me.image, let url = URL(string: img) {
            AsyncImage(url: url) { i in i.resizable().scaledToFill() } placeholder: {
                Circle().fill(Brand.mossSoft)
            }
            .frame(width: 52, height: 52).clipShape(Circle())
        } else {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 48)).foregroundStyle(Brand.mossDark)
        }
    }

    @ViewBuilder private func dogThumb(_ dog: Dog) -> some View {
        if let p = dog.photoUrl, let url = URL(string: p) {
            AsyncImage(url: url) { i in i.resizable().scaledToFill() } placeholder: {
                Circle().fill(Brand.mossSoft)
            }
            .frame(width: 38, height: 38).clipShape(Circle())
        } else {
            ZStack {
                Circle().fill(Brand.mossSoft)
                Image(systemName: "pawprint.fill").font(.caption).foregroundStyle(Brand.mossDark)
            }
            .frame(width: 38, height: 38)
        }
    }

    private func dogSubtitle(_ dog: Dog) -> String? {
        var parts: [String] = []
        if let breed = dog.breed, !breed.isEmpty { parts.append(breed) }
        if let year = dog.birthYear { parts.append("sinds \(year)") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
