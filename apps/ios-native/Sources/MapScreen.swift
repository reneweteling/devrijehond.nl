import SwiftUI
import MapKit

// MARK: - Annotations

final class SpotAnnotation: NSObject, MKAnnotation {
    let spot: SpotSummary
    let coordinate: CLLocationCoordinate2D
    var title: String? { spot.name }
    init?(_ spot: SpotSummary) {
        guard let c = spot.coordinate else { return nil }
        self.spot = spot
        self.coordinate = c
    }
}

final class ClusterCountAnnotation: NSObject, MKAnnotation {
    let count: Int
    let coordinate: CLLocationCoordinate2D
    init(_ cluster: MapCluster) {
        self.count = cluster.count
        self.coordinate = cluster.coordinate
    }
}

// MARK: - Map screen

struct MapScreen: View {
    @StateObject private var loc = LocationManager()
    @State private var categories: [Category] = []
    @State private var selected: SpotSummary?

    private var categoriesById: [String: Category] {
        Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            MapKitView(
                categoriesById: categoriesById,
                userCoordinate: loc.coordinate,
                onSelectSpot: { selected = $0 }
            )
            .ignoresSafeArea()

            legend
        }
        .task {
            loc.request()
            if categories.isEmpty { categories = (try? await APIClient.categories()) ?? [] }
        }
        .sheet(item: $selected) { spot in
            SpotDetailView(spot: spot, category: categoriesById[spot.categoryId])
                .presentationDetents([.medium, .large])
        }
    }

    private var legend: some View {
        HStack(spacing: 14) {
            label(color: Brand.moss, text: "Geverifieerd")
            label(color: .white, text: "Niet geverifieerd", dashed: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.bottom, 6)
    }

    private func label(color: Color, text: String, dashed: Bool = false) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .overlay(Circle().strokeBorder(dashed ? Brand.terra : .clear, lineWidth: 1.5))
                .frame(width: 12, height: 12)
            Text(text).font(.caption).foregroundStyle(Brand.ink2)
        }
    }
}

// MARK: - MKMapView bridge

struct MapKitView: UIViewRepresentable {
    var categoriesById: [String: Category]
    var userCoordinate: CLLocationCoordinate2D?
    var onSelectSpot: (SpotSummary) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onSelectSpot: onSelectSpot) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.pointOfInterestFilter = .excludingAll
        map.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 52.365, longitude: 4.89),
            span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)
        )
        context.coordinator.scheduleFetch(map)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.categoriesById = categoriesById
        // Recentre on the user once, the first time a fix arrives.
        if let c = userCoordinate, !context.coordinator.didCenterOnUser {
            context.coordinator.didCenterOnUser = true
            map.setRegion(
                MKCoordinateRegion(
                    center: c, span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)),
                animated: true)
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        let onSelectSpot: (SpotSummary) -> Void
        var categoriesById: [String: Category] = [:]
        var didCenterOnUser = false
        private var fetchTask: Task<Void, Never>?

        init(onSelectSpot: @escaping (SpotSummary) -> Void) { self.onSelectSpot = onSelectSpot }

        deinit { fetchTask?.cancel() }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            scheduleFetch(mapView)
        }

        func scheduleFetch(_ map: MKMapView) {
            fetchTask?.cancel()
            fetchTask = Task { [weak map] in
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard let map, !Task.isCancelled else { return }
                await fetch(map)
            }
        }

        @MainActor
        private func fetch(_ map: MKMapView) async {
            let r = map.region
            let minLat = r.center.latitude - r.span.latitudeDelta / 2
            let maxLat = r.center.latitude + r.span.latitudeDelta / 2
            let minLng = r.center.longitude - r.span.longitudeDelta / 2
            let maxLng = r.center.longitude + r.span.longitudeDelta / 2
            guard let resp = try? await APIClient.spotsMap(
                minLng: minLng, minLat: minLat, maxLng: maxLng, maxLat: maxLat, cluster: true)
            else { return }
            // A newer pan may have superseded this fetch while it was in flight;
            // don't clobber the map with stale results.
            guard !Task.isCancelled else { return }

            map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })
            map.removeOverlays(map.overlays)

            map.addAnnotations(resp.items.compactMap { SpotAnnotation($0) })
            map.addAnnotations(resp.clusters.map { ClusterCountAnnotation($0) })
            for s in resp.items where s.isRegion {
                if let ring = s.geometry?.outerRing, ring.count >= 3 {
                    map.addOverlay(MKPolygon(coordinates: ring, count: ring.count))
                }
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }

            if let cluster = annotation as? ClusterCountAnnotation {
                let id = "cluster"
                let view = (mapView.dequeueReusableAnnotationView(withIdentifier: id)
                    as? MKMarkerAnnotationView) ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: id)
                view.annotation = annotation
                view.markerTintColor = UIColor(hex: 0x6E7B33)
                view.glyphText = "\(cluster.count)"
                view.displayPriority = .required
                return view
            }

            if let spotAnn = annotation as? SpotAnnotation {
                let id = "spot"
                let view = (mapView.dequeueReusableAnnotationView(withIdentifier: id)
                    as? MKMarkerAnnotationView) ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: id)
                view.annotation = annotation
                let spot = spotAnn.spot
                let cat = categoriesById[spot.categoryId]
                let color = cat.map { Brand.categoryColor($0.slug) } ?? Brand.moss
                view.markerTintColor = spot.isVerified ? UIColor(color) : UIColor(hex: 0xC2762E)
                view.glyphImage = UIImage(systemName: cat?.icon ?? "pawprint.fill")
                view.displayPriority = spot.isVerified ? .defaultHigh : .defaultLow
                return view
            }
            return nil
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let poly = overlay as? MKPolygon {
                let r = MKPolygonRenderer(polygon: poly)
                r.strokeColor = UIColor(hex: 0x4C5622)
                r.lineWidth = 2
                r.fillColor = UIColor(hex: 0x6E7B33).withAlphaComponent(0.22)
                return r
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if let spotAnn = view.annotation as? SpotAnnotation {
                mapView.deselectAnnotation(view.annotation, animated: false)
                onSelectSpot(spotAnn.spot)
            } else if let cluster = view.annotation as? ClusterCountAnnotation {
                mapView.deselectAnnotation(view.annotation, animated: false)
                let span = MKCoordinateSpan(
                    latitudeDelta: max(mapView.region.span.latitudeDelta / 2.5, 0.01),
                    longitudeDelta: max(mapView.region.span.longitudeDelta / 2.5, 0.01))
                mapView.setRegion(MKCoordinateRegion(center: cluster.coordinate, span: span), animated: true)
            }
        }
    }
}
