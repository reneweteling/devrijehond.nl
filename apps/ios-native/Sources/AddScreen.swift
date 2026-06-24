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

    private enum Sheet: Identifiable {
        case form, signIn
        var id: Int { hashValue }
    }

    @State private var isRegion = true
    @State private var vertices: [CLLocationCoordinate2D] = []
    @State private var poi: CLLocationCoordinate2D?
    @State private var activeSheet: Sheet?
    @State private var createdName: String?
    @State private var pendingCreatedName: String?
    @State private var resumeAddAfterSignIn = false

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
                AddMapView(isRegion: isRegion, vertices: $vertices, poi: $poi)
                    .ignoresSafeArea(edges: .bottom)

                controls
            }
            .navigationTitle("Toevoegen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("", selection: $isRegion) {
                        Text("Gebied").tag(true)
                        Text("Plek").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                    .onChange(of: isRegion) { _, _ in vertices = []; poi = nil }
                }
            }
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

    private var controls: some View {
        VStack(spacing: 10) {
            Text(hint).font(.footnote).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))

            if isRegion && !vertices.isEmpty {
                HStack(spacing: 10) {
                    Button { if !vertices.isEmpty { vertices.removeLast() } } label: {
                        Label("Wis laatste", systemImage: "arrow.uturn.backward")
                    }.buttonStyle(.bordered)
                    Button(role: .destructive) { vertices = [] } label: {
                        Label("Wis alles", systemImage: "trash")
                    }.buttonStyle(.bordered)
                }
                .font(.subheadline)
            }

            Button {
                if session.isAuthenticated {
                    activeSheet = .form
                } else {
                    resumeAddAfterSignIn = true
                    activeSheet = .signIn
                }
            } label: {
                Text(canFinish ? "Klaar (\(isRegion ? vertices.count : 1))" : "Klaar")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.moss)
            .disabled(!canFinish)
        }
        .padding(16)
    }

    private var hint: String {
        if isRegion {
            return "Tik op de kaart om punten te zetten. Sleep een punt om het te verplaatsen (min. 3)."
        }
        return poi == nil ? "Tik op de kaart om de plek neer te zetten." : "Sleep de pin om de plek precies te zetten."
    }
}

struct AddMapView: UIViewRepresentable {
    let isRegion: Bool
    @Binding var vertices: [CLLocationCoordinate2D]
    @Binding var poi: CLLocationCoordinate2D?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.pointOfInterestFilter = .excludingAll
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
    }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var parent: AddMapView
        private weak var mapView: MKMapView?
        private var polygonOverlay: MKPolygon?

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
