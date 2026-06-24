import SwiftUI
import MapKit

/// A vertex / POI pin whose coordinate MapKit can mutate while dragging.
final class EditableAnnotation: NSObject, MKAnnotation {
    @objc dynamic var coordinate: CLLocationCoordinate2D
    let index: Int
    init(coordinate: CLLocationCoordinate2D, index: Int) {
        self.coordinate = coordinate
        self.index = index
    }
}

struct AddScreen: View {
    @EnvironmentObject var session: Session
    @StateObject private var loc = LocationManager()

    private enum Sheet: Identifiable {
        case form, signIn, search
        var id: Int { hashValue }
    }

    @State private var isRegion = true
    @State private var vertices: [CLLocationCoordinate2D] = []
    @State private var poi: CLLocationCoordinate2D?
    @State private var activeSheet: Sheet?
    @State private var createdName: String?
    @State private var pendingCreatedName: String?
    @State private var resumeAddAfterSignIn = false

    // Coordinate the map should jump to (search result or first user fix).
    @State private var jumpTo: CLLocationCoordinate2D?

    private var canFinish: Bool { isRegion ? vertices.count >= 3 : poi != nil }

    private var geoPoint: GeoPoint? {
        guard let poi else { return nil }
        return GeoPoint(lat: poi.latitude, lng: poi.longitude)
    }
    private var geoPolygon: [GeoPoint] {
        vertices.map { GeoPoint(lat: $0.latitude, lng: $0.longitude) }
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                AddMapView(
                    isRegion: isRegion,
                    vertices: $vertices,
                    poi: $poi,
                    jumpTo: $jumpTo,
                    userCoordinate: loc.coordinate
                )
                .ignoresSafeArea()

                controls
            }
            // Floating top controls, same layout language as the map: a search
            // box with the Gebied/Plek toggle right beside it.
            .overlay(alignment: .top) {
                HStack(spacing: DVH.s2) {
                    searchPill
                    typeToggle
                }
                .padding(.horizontal, DVH.s4)
                .padding(.top, DVH.s2)
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $activeSheet, onDismiss: handleSheetDismiss) { sheet in
                switch sheet {
                case .form:
                    SpotFormView(
                        isRegion: isRegion, point: geoPoint, polygon: geoPolygon,
                        onCreated: { created in
                            vertices = []; poi = nil
                            pendingCreatedName = created.name
                        })
                case .signIn:
                    SignInView(
                        reason: "Log in om je plek te plaatsen. Anderen kunnen hem daarna bevestigen.",
                        dismissable: true)
                case .search:
                    SearchView(
                        onSelectPlace: { hit in
                            jumpTo = CLLocationCoordinate2D(latitude: hit.lat, longitude: hit.lng)
                        },
                        onSelectSpot: { spot in
                            if let c = spot.coordinate { jumpTo = c }
                        },
                        knownSpots: [],
                        categoriesById: [:]
                    )
                    .presentationDetents([.large])
                }
            }
            .alert("Plek geplaatst", isPresented: Binding(
                get: { createdName != nil }, set: { if !$0 { createdName = nil } })
            ) {
                Button("Top") { createdName = nil }
            } message: {
                Text("\"\(createdName ?? "")\" staat nu op de kaart als nog niet geverifieerd. Bedankt!")
            }
        }
        .task { loc.request() }
    }

    /// Runs after a sheet fully dismisses, so the success alert (or the resumed
    /// form) presents cleanly instead of racing the dismissing sheet.
    private func handleSheetDismiss() {
        if let n = pendingCreatedName {
            pendingCreatedName = nil
            resumeAddAfterSignIn = false
            createdName = n
            return
        }
        if resumeAddAfterSignIn {
            resumeAddAfterSignIn = false
            if session.isAuthenticated && canFinish { activeSheet = .form }
        }
    }

    // MARK: - Floating type toggle

    private var typeToggle: some View {
        HStack(spacing: 0) {
            toggleSegment(label: "Gebied", selected: isRegion) {
                if !isRegion { isRegion = true; vertices = []; poi = nil }
            }
            toggleSegment(label: "Plek", selected: !isRegion) {
                if isRegion { isRegion = false; vertices = []; poi = nil }
            }
        }
        .padding(3)
        .background(Brand.cream, in: Capsule())
        .overlay(Capsule().strokeBorder(Brand.ink.opacity(0.08)))
        .shadow(color: Brand.ink.opacity(0.10), radius: 8, y: 2)
    }

    private func toggleSegment(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.dvhCaption.weight(.semibold))
                .foregroundStyle(selected ? .white : Brand.ink2)
                .frame(width: 58, height: 38)
                .background(selected ? Brand.moss : Color.clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.18), value: selected)
    }

    // MARK: - Floating search pill

    private var searchPill: some View {
        Button { activeSheet = .search } label: {
            HStack(spacing: DVH.s2) {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.moss)
                Text("Zoek locatie")
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink2)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, DVH.s4)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().strokeBorder(Brand.ink.opacity(0.08)))
            .shadow(color: Brand.ink.opacity(0.08), radius: 8, y: 2)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bottom controls card

    private var controls: some View {
        VStack(spacing: DVH.s3) {
            Text(hint)
                .font(.dvhCaption)
                .foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)

            if isRegion && !vertices.isEmpty {
                HStack(spacing: DVH.s2) {
                    Button {
                        if !vertices.isEmpty { vertices.removeLast() }
                    } label: {
                        Label("Ongedaan", systemImage: "arrow.uturn.backward")
                            .font(.dvhCaption.weight(.semibold))
                            .foregroundStyle(Brand.ink2)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(Brand.sand, in: RoundedRectangle(cornerRadius: DVH.rSm))
                    }
                    .buttonStyle(.plain)

                    Button(role: .destructive) {
                        vertices = []
                    } label: {
                        Label("Wis alles", systemImage: "trash")
                            .font(.dvhCaption.weight(.semibold))
                            .foregroundStyle(Brand.terra)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(Brand.terra.opacity(0.10), in: RoundedRectangle(cornerRadius: DVH.rSm))
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                if session.isAuthenticated {
                    activeSheet = .form
                } else {
                    resumeAddAfterSignIn = true
                    activeSheet = .signIn
                }
            } label: {
                HStack(spacing: DVH.s2) {
                    Text(canFinish
                         ? "Klaar — \(isRegion ? "\(vertices.count) punten" : "1 plek")"
                         : "Klaar")
                    if canFinish {
                        Image(systemName: "checkmark")
                            .font(.body.weight(.bold))
                    }
                }
            }
            .buttonStyle(.dvhPrimary)
            .disabled(!canFinish)
        }
        .padding(DVH.s4)
        .dvhCard()
        .padding(.horizontal, DVH.s4)
        .padding(.bottom, DVH.s5)
    }

    private var hint: String {
        if isRegion {
            return vertices.isEmpty
                ? "Tik op de kaart om de omtrek te tekenen. Sleep een punt om te verplaatsen."
                : vertices.count < 3
                    ? "Nog \(3 - vertices.count) punt\(3 - vertices.count == 1 ? "" : "en") nodig voor een geldig gebied."
                    : "Gebied klaar. Voeg meer punten toe of ga verder."
        }
        return poi == nil
            ? "Tik op de kaart om de plek neer te zetten."
            : "Sleep de pin om de plek precies te plaatsen."
    }
}

// MARK: - AddMapView

struct AddMapView: UIViewRepresentable {
    let isRegion: Bool
    @Binding var vertices: [CLLocationCoordinate2D]
    @Binding var poi: CLLocationCoordinate2D?
    @Binding var jumpTo: CLLocationCoordinate2D?
    let userCoordinate: CLLocationCoordinate2D?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.pointOfInterestFilter = .excludingAll
        // Fallback: centre of the Netherlands until a location fix arrives.
        map.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 52.365, longitude: 4.89),
            span: MKCoordinateSpan(latitudeDelta: 0.06, longitudeDelta: 0.06))
        let tap = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.sync(map)

        // Centre on the user the first time a fix arrives (mirrors MapKitView).
        if let c = userCoordinate, !context.coordinator.didCenterOnUser {
            context.coordinator.didCenterOnUser = true
            map.setRegion(
                MKCoordinateRegion(
                    center: c,
                    span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)),
                animated: true)
        }

        // Jump to a geocoded / searched location (deduped by lat+lng pair).
        if let c = jumpTo,
           c.latitude != context.coordinator.lastJumpLat
            || c.longitude != context.coordinator.lastJumpLng {
            context.coordinator.lastJumpLat = c.latitude
            context.coordinator.lastJumpLng = c.longitude
            map.setRegion(
                MKCoordinateRegion(
                    center: c,
                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)),
                animated: true)
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var parent: AddMapView
        private weak var mapView: MKMapView?
        private var polygonOverlay: MKPolygon?

        var didCenterOnUser = false
        var lastJumpLat: Double = 0
        var lastJumpLng: Double = 0

        init(_ parent: AddMapView) { self.parent = parent }

        // Rebuild annotations + the polygon overlay from the SwiftUI source of truth.
        func sync(_ map: MKMapView) {
            mapView = map
            map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })
            if let overlay = polygonOverlay { map.removeOverlay(overlay); polygonOverlay = nil }

            if parent.isRegion {
                for (i, c) in parent.vertices.enumerated() {
                    map.addAnnotation(EditableAnnotation(coordinate: c, index: i))
                }
                if parent.vertices.count >= 3 {
                    let poly = MKPolygon(coordinates: parent.vertices, count: parent.vertices.count)
                    map.addOverlay(poly)
                    polygonOverlay = poly
                }
            } else if let p = parent.poi {
                map.addAnnotation(EditableAnnotation(coordinate: p, index: 0))
            }
        }

        @objc func handleTap(_ g: UITapGestureRecognizer) {
            guard let map = mapView else { return }
            let coord = map.convert(g.location(in: map), toCoordinateFrom: map)
            // Synchronous (the gesture fires on the main thread, outside SwiftUI's
            // render pass), so it can't race a delete that recreates annotations.
            if parent.isRegion {
                parent.vertices.append(coord)
            } else {
                parent.poi = coord
            }
        }

        // Don't add a point when the tap lands on a draggable pin (that's a
        // select/drag). Walk the full view chain — annotation views nest.
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            var v = touch.view
            while let cur = v {
                if cur is MKAnnotationView { return false }
                v = cur.superview
            }
            return true
        }

        func mapView(_ map: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }
            let id = "vertex"
            let view = (map.dequeueReusableAnnotationView(withIdentifier: id) as? MKMarkerAnnotationView)
                ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: id)
            view.annotation = annotation
            view.isDraggable = true
            view.markerTintColor = UIColor(hex: 0x6E7B33)
            // Clear both glyph slots first so a reused view can't keep the other
            // mode's glyph (mappin showing on a numbered vertex, or vice-versa).
            view.glyphText = nil
            view.glyphImage = nil
            if let v = annotation as? EditableAnnotation, parent.isRegion {
                view.glyphText = "\(v.index + 1)"
            } else {
                view.glyphImage = UIImage(systemName: "mappin")
            }
            return view
        }

        func mapView(
            _ map: MKMapView, annotationView view: MKAnnotationView,
            didChange newState: MKAnnotationView.DragState, fromOldState oldState: MKAnnotationView.DragState
        ) {
            guard newState == .ending, let ann = view.annotation as? EditableAnnotation else { return }
            let c = ann.coordinate
            // Synchronous write on the main thread — no async hop that could land
            // after a delete renumbered the vertices.
            if parent.isRegion {
                if ann.index < parent.vertices.count { parent.vertices[ann.index] = c }
            } else {
                parent.poi = c
            }
        }

        func mapView(_ map: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let poly = overlay as? MKPolygon {
                let r = MKPolygonRenderer(polygon: poly)
                r.strokeColor = UIColor(hex: 0x4C5622)
                r.lineWidth = 2.5
                r.fillColor = UIColor(hex: 0x6E7B33).withAlphaComponent(0.25)
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}
