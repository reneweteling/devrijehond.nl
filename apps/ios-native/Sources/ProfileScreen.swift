import SwiftUI

/// Value-based routes for the profile stack. Using one `navigationDestination`
/// instead of many closure-based `NavigationLink`s avoids the SwiftUI bug where
/// sibling links in one tree stop responding.
enum ProfileRoute: Hashable {
    case editProfile
    case dog(Dog)
    case newDog
    case mySpots
    case about
    case moderatorApply
}

struct ProfileScreen: View {
    @EnvironmentObject var session: Session

    @State private var modApplication: ModeratorApplication?
    @State private var modLoaded = false

    var body: some View {
        NavigationStack {
            Group {
                if session.isAuthenticated {
                    if let me = session.profile {
                        profileContent(me)
                    } else {
                        ProgressView("Profiel laden…")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Brand.sand)
                    }
                } else {
                    SignInView()
                }
            }
        }
        .task {
            if session.isAuthenticated && session.profile == nil {
                await session.hydrate()
            }
        }
    }

    // MARK: - Signed-in content

    @ViewBuilder
    private func profileContent(_ me: MeProfile) -> some View {
        ScrollView {
            VStack(spacing: DVH.s5) {
                headerCard(me)
                NavigationLink(value: ProfileRoute.editProfile) {
                    Text("Profiel bewerken")
                }
                .buttonStyle(.dvhSecondary)

                dogsSection(me)
                actionsSection
                moderationSection(me)
                footerSection
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .background(Brand.sand.ignoresSafeArea())
        .navigationTitle("Profiel")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await session.hydrate() }
        .task(id: me.id) { await loadModeratorApplication() }
        .navigationDestination(for: ProfileRoute.self) { route in
            switch route {
            case .editProfile: EditProfileView()
            case .dog(let dog): DogEditView(dog: dog)
            case .newDog: DogEditView(dog: nil)
            case .mySpots: MySpotsView()
            case .about: AboutView()
            case .moderatorApply: ModeratorApplyView()
            }
        }
    }

    // MARK: - Header card

    private func headerCard(_ me: MeProfile) -> some View {
        VStack(spacing: DVH.s4) {
            Avatar(url: me.image, name: me.name ?? me.handle ?? "Hondenbaas", size: 64)

            VStack(spacing: DVH.s1) {
                Text(me.name ?? me.handle ?? "Hondenbaas")
                    .font(.dvhTitle).foregroundStyle(Brand.ink)
                if let h = me.handle {
                    Text("@\(h)").font(.dvhCallout).foregroundStyle(Brand.ink2)
                }
            }

            HStack(spacing: DVH.s2) {
                profilePill(icon: "rosette", text: "\(me.reputation ?? 0) punten")
                if me.isModerator {
                    profilePill(
                        icon: "checkmark.seal.fill",
                        text: me.isAdmin ? "Beheerder" : "Moderator")
                }
            }
        }
        .frame(maxWidth: .infinity)
        .dvhCard(padding: DVH.s5)
    }

    // Uniform profile pill (reputation, role) — same size, font and surface.
    private func profilePill(icon: String, text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.dvhCaption.weight(.semibold))
            .foregroundStyle(Brand.mossDark)
            .padding(.horizontal, DVH.s3)
            .padding(.vertical, DVH.s2)
            .background(Brand.mossSoft, in: Capsule())
    }

    // MARK: - Dogs section

    @ViewBuilder
    private func dogsSection(_ me: MeProfile) -> some View {
        VStack(spacing: DVH.s3) {
            SectionHeader(title: "Mijn honden")

            VStack(spacing: 0) {
                let dogs = me.dogs ?? []
                if dogs.isEmpty {
                    NavigationLink(value: ProfileRoute.newDog) {
                        ProfileDogEmptyRow()
                    }
                    .buttonStyle(.plain)
                } else {
                    ForEach(dogs) { dog in
                        NavigationLink(value: ProfileRoute.dog(dog)) {
                            ProfileDogRow(dog: dog)
                        }
                        .buttonStyle(.plain)

                        Divider().padding(.leading, 52 + DVH.s3 + DVH.s4)
                    }
                    NavigationLink(value: ProfileRoute.newDog) {
                        ProfileActionRow(icon: "plus.circle", label: "Hond toevoegen")
                    }
                    .buttonStyle(.plain)
                }
            }
            .dvhCard(padding: 0)
        }
    }

    // MARK: - Actions section

    private var actionsSection: some View {
        VStack(spacing: 0) {
            NavigationLink(value: ProfileRoute.mySpots) {
                ProfileActionRow(icon: "mappin.and.ellipse", label: "Mijn inzendingen")
            }
            .buttonStyle(.plain)
        }
        .dvhCard(padding: 0)
    }

    // MARK: - Moderation section

    @ViewBuilder
    private func moderationSection(_ me: MeProfile) -> some View {
        VStack(spacing: DVH.s3) {
            SectionHeader(title: "Moderatie")

            VStack(spacing: 0) {
                if me.isModerator {
                    HStack(spacing: DVH.s3) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Brand.moss)
                            .frame(width: 24)
                        Text("Je bent moderator")
                            .font(.dvhBody).foregroundStyle(Brand.ink)
                        Spacer()
                    }
                    .padding(.horizontal, DVH.s4)
                    .padding(.vertical, DVH.s4)
                } else if modLoaded {
                    if let app = modApplication {
                        NavigationLink(value: ProfileRoute.moderatorApply) {
                            ProfileModStatusRow(status: app.status)
                        }
                        .buttonStyle(.plain)
                    } else {
                        NavigationLink(value: ProfileRoute.moderatorApply) {
                            ProfileActionRow(icon: "person.badge.plus", label: "Word moderator")
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    HStack {
                        ProgressView().padding(.horizontal, DVH.s4).padding(.vertical, DVH.s4)
                        Spacer()
                    }
                }
            }
            .dvhCard(padding: 0)
        }
    }

    // MARK: - Footer section

    private var footerSection: some View {
        VStack(spacing: 0) {
            NavigationLink(value: ProfileRoute.about) {
                ProfileActionRow(icon: "info.circle", label: "Over De Vrije Hond")
            }
            .buttonStyle(.plain)

            Divider().padding(.leading, DVH.s4 + 24 + DVH.s3)

            Button(role: .destructive) {
                session.signOut()
            } label: {
                HStack(spacing: DVH.s3) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 16))
                        .foregroundStyle(Brand.rust)
                        .frame(width: 24)
                    Text("Uitloggen")
                        .font(.dvhBody).foregroundStyle(Brand.rust)
                    Spacer()
                }
                .padding(.horizontal, DVH.s4)
                .padding(.vertical, DVH.s4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .dvhCard(padding: 0)
    }

    // MARK: - Data

    private func loadModeratorApplication() async {
        guard let token = session.token, !(session.profile?.isModerator ?? false) else {
            modLoaded = true
            return
        }
        do {
            modApplication = try await APIClient.moderatorApplication(token: token)
        } catch {
            modApplication = nil
        }
        modLoaded = true
    }
}

// MARK: - Helper row views

struct ProfileDogRow: View {
    let dog: Dog

    var body: some View {
        HStack(spacing: DVH.s3) {
            dogThumb
            VStack(alignment: .leading, spacing: DVH.s1) {
                Text(dog.name)
                    .font(.dvhBody.weight(.medium)).foregroundStyle(Brand.ink)
                if let sub = dogSubtitle { Text(sub).font(.dvhCaption).foregroundStyle(Brand.ink2) }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.4))
        }
        .padding(.horizontal, DVH.s4)
        .padding(.vertical, DVH.s3 + 2)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var dogThumb: some View {
        if let url = dog.photoUrl.flatMap(URL.init) {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(Brand.mossSoft)
            }
            .frame(width: 44, height: 44).clipShape(Circle())
            .overlay(Circle().strokeBorder(Brand.ink.opacity(0.07)))
        } else {
            ZStack {
                Circle().fill(Brand.mossSoft)
                Image(systemName: "pawprint.fill").font(.caption).foregroundStyle(Brand.mossDark)
            }
            .frame(width: 44, height: 44)
        }
    }

    private var dogSubtitle: String? {
        var parts: [String] = []
        if let breed = dog.breed, !breed.isEmpty { parts.append(breed) }
        let age = ageString
        if let age { parts.append(age) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var ageString: String? {
        // Prefer birthDate (YYYY-MM-DD), fall back to birthYear
        let gregorian = Calendar(identifier: .gregorian)
        if let bd = dog.birthDate, let date = DogEditView.isoDayFormatter.date(from: bd) {
            let months = gregorian.dateComponents([.month], from: date, to: Date()).month ?? 0
            if months < 12 { return "\(months) mnd" }
            return "\(months / 12) jr"
        }
        if let year = dog.birthYear {
            let age = gregorian.component(.year, from: Date()) - year
            return "\(age) jr"
        }
        return nil
    }
}

struct ProfileDogEmptyRow: View {
    var body: some View {
        HStack(spacing: DVH.s3) {
            ZStack {
                Circle().fill(Brand.mossSoft)
                Image(systemName: "plus").font(.caption.weight(.semibold)).foregroundStyle(Brand.moss)
            }
            .frame(width: 44, height: 44)
            Text("Voeg je eerste hond toe")
                .font(.dvhBody).foregroundStyle(Brand.ink2)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.4))
        }
        .padding(.horizontal, DVH.s4)
        .padding(.vertical, DVH.s3 + 2)
        .contentShape(Rectangle())
    }
}

struct ProfileActionRow: View {
    let icon: String
    let label: String

    var body: some View {
        HStack(spacing: DVH.s3) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Brand.moss)
                .frame(width: 24)
            Text(label).font(.dvhBody).foregroundStyle(Brand.ink)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.4))
        }
        .padding(.horizontal, DVH.s4)
        .padding(.vertical, DVH.s4)
        .contentShape(Rectangle())
    }
}

struct ProfileModStatusRow: View {
    let status: String

    var body: some View {
        HStack(spacing: DVH.s3) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(color)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("Moderatoraanvraag").font(.dvhBody).foregroundStyle(Brand.ink)
                Text(label).font(.dvhCaption).foregroundStyle(color)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.4))
        }
        .padding(.horizontal, DVH.s4)
        .padding(.vertical, DVH.s4)
        .contentShape(Rectangle())
    }

    private var label: String {
        switch status {
        case "APPROVED": return "Goedgekeurd"
        case "REJECTED": return "Afgewezen"
        default: return "Je aanvraag wordt bekeken"
        }
    }

    private var icon: String {
        switch status {
        case "APPROVED": return "checkmark.seal.fill"
        case "REJECTED": return "xmark.circle.fill"
        default: return "clock.fill"
        }
    }

    private var color: Color {
        switch status {
        case "APPROVED": return Brand.moss
        case "REJECTED": return Brand.rust
        default: return Brand.terra
        }
    }
}
