import SwiftUI
import MapKit

// MARK: - Annotations

final class SpotAnnotation: NSObject, MKAnnotation {
    let spot: SpotSummary
    let coordinate: CLLocationCoordinate2D
    var title: String? { spot.name }
    /// Stable identity: the spot's server-assigned id.
    var spotId: String { spot.id }
    init?(_ spot: SpotSummary) {
        guard let c = spot.coordinate else { return nil }
        self.spot = spot
        self.coordinate = c
    }
}

final class ClusterCountAnnotation: NSObject, MKAnnotation {
    let count: Int
    let coordinate: CLLocationCoordinate2D
    /// Stable key combining position + count; clusters at the same position
    /// with the same count are considered identical across fetches.
    let clusterKey: String
    init(_ cluster: MapCluster) {
        self.count = cluster.count
        self.coordinate = cluster.coordinate
        self.clusterKey = "\(cluster.coordinate.latitude)_\(cluster.coordinate.longitude)_\(cluster.count)"
    }
}

// MARK: - Map screen

struct MapScreen: View {
    @EnvironmentObject private var session: Session
    @StateObject private var loc = LocationManager()
    @State private var categories: [Category] = []
    @State private var selected: SpotSummary?
    @State private var showSearch = false
    @State private var selectedCategoryId: String? = nil
    @State private var isSatellite = false
    @State private var recenterTrigger: CLLocationCoordinate2D?
    @State private var jumpToCoordinate: CLLocationCoordinate2D?

    private var categoriesById: [String: Category] {
        Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
    }

    // Spots held in MapKitView coordinator; we expose a binding so chip
    // filtering can be applied client-side without a new fetch.
    @State private var allFetchedSpots: [SpotSummary] = []

    var body: some View {
        ZStack(alignment: .bottom) {
            MapKitView(
                categoriesById: categoriesById,
                userCoordinate: loc.coordinate,
                selectedCategoryId: selectedCategoryId,
                isSatellite: isSatellite,
                recenterTrigger: recenterTrigger,
                jumpToCoordinate: jumpToCoordinate,
                onSelectSpot: { selected = $0 },
                onFetchedSpots: { allFetchedSpots = $0 }
            )
            .ignoresSafeArea()

            // Bottom legend
            legend
        }
        // Floating controls layered above the map
        .overlay(alignment: .top) {
            VStack(spacing: DVH.s2) {
                searchPill
                if !categories.isEmpty {
                    categoryChips
                }
            }
            .padding(.top, DVH.s2)
        }
        .overlay(alignment: .bottomTrailing) {
            mapControls
                .padding(.trailing, DVH.s4)
                .padding(.bottom, 70) // clear the legend
        }
        .task {
            loc.request()
            if categories.isEmpty { categories = (try? await APIClient.categories()) ?? [] }
        }
        // "Bekijk op kaart" from a list/detail: center on the requested spot.
        .onReceive(session.$mapFocus) { spot in
            guard let spot, let lat = spot.lat, let lng = spot.lng else { return }
            jumpToCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            DispatchQueue.main.async { session.mapFocus = nil }
        }
        .sheet(item: $selected) { spot in
            SpotDetailView(spot: spot, category: categoriesById[spot.categoryId])
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showSearch) {
            SearchView(
                onSelectPlace: { hit in
                    jumpToCoordinate = CLLocationCoordinate2D(latitude: hit.lat, longitude: hit.lng)
                },
                onSelectSpot: { spot in
                    selected = spot
                },
                knownSpots: allFetchedSpots,
                categoriesById: categoriesById
            )
            .presentationDetents([.large])
        }
    }

    // MARK: Floating search pill

    private var searchPill: some View {
        Button {
            showSearch = true
        } label: {
            HStack(spacing: DVH.s2) {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.moss)
                Text("Zoek een plek, gebied of adres")
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink2)
                Spacer()
            }
            .padding(.horizontal, DVH.s4)
            .frame(height: 46)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().strokeBorder(Brand.ink.opacity(0.08)))
            .shadow(color: Brand.ink.opacity(0.08), radius: 8, y: 2)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, DVH.s4)
    }

    // MARK: Category chip row

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DVH.s2) {
                DVHChip(
                    label: "Alles",
                    selected: selectedCategoryId == nil,
                    tint: Brand.moss
                ) {
                    selectedCategoryId = nil
                }

                ForEach(categories) { cat in
                    DVHChip(
                        label: cat.label,
                        icon: cat.icon,
                        selected: selectedCategoryId == cat.id,
                        tint: Brand.categoryColor(cat.slug)
                    ) {
                        // Tapping the active chip again clears it ("Alles")
                        selectedCategoryId = selectedCategoryId == cat.id ? nil : cat.id
                    }
                }
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s1)
        }
    }

    // MARK: Bottom-right map controls

    private var mapControls: some View {
        VStack(spacing: DVH.s2) {
            // Satellite toggle
            MapControlButton(icon: isSatellite ? "map.fill" : "globe") {
                isSatellite.toggle()
            }

            // Locate me
            MapControlButton(icon: "location.fill") {
                if let c = loc.coordinate {
                    recenterTrigger = c
                } else {
                    loc.request()
                }
            }
        }
    }

    // MARK: Legend

    private var legend: some View {
        HStack(spacing: 14) {
            legendLabel(color: Brand.moss, text: "Geverifieerd")
            legendLabel(color: .white, text: "Niet geverifieerd", dashed: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.bottom, 6)
    }

    private func legendLabel(color: Color, text: String, dashed: Bool = false) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .overlay(Circle().strokeBorder(dashed ? Brand.terra : .clear, lineWidth: 1.5))
                .frame(width: 12, height: 12)
            Text(text).font(.caption).foregroundStyle(Brand.ink2)
        }
    }
}

// MARK: - Floating map control button

private struct MapControlButton: View {
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Brand.mossDark)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: DVH.rSm))
                .overlay(RoundedRectangle(cornerRadius: DVH.rSm)
                    .strokeBorder(Brand.ink.opacity(0.10)))
                .shadow(color: Brand.ink.opacity(0.10), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - MKMapView bridge

struct MapKitView: UIViewRepresentable {
    var categoriesById: [String: Category]
    var userCoordinate: CLLocationCoordinate2D?
    var selectedCategoryId: String?
    var isSatellite: Bool
    var recenterTrigger: CLLocationCoordinate2D?
    var jumpToCoordinate: CLLocationCoordinate2D?
    var onSelectSpot: (SpotSummary) -> Void
    var onFetchedSpots: ([SpotSummary]) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelectSpot: onSelectSpot, onFetchedSpots: onFetchedSpots)
    }

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
        context.coordinator.onFetchedSpots = onFetchedSpots
        context.coordinator.onSelectSpot = onSelectSpot

        // Map type
        let targetType: MKMapType = isSatellite ? .hybrid : .standard
        if map.mapType != targetType { map.mapType = targetType }

        // Recentre on the user once, the first time a fix arrives.
        if let c = userCoordinate, !context.coordinator.didCenterOnUser {
            context.coordinator.didCenterOnUser = true
            map.setRegion(
                MKCoordinateRegion(
                    center: c, span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)),
                animated: true)
        }

        // Explicit "locate me" tap
        if let c = recenterTrigger, c.latitude != context.coordinator.lastRecenterLatitude
            || c.longitude != context.coordinator.lastRecenterLongitude {
            context.coordinator.lastRecenterLatitude = c.latitude
            context.coordinator.lastRecenterLongitude = c.longitude
            map.setRegion(
                MKCoordinateRegion(
                    center: c, span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)),
                animated: true)
        }

        // Jump to geocoded place
        if let c = jumpToCoordinate, c.latitude != context.coordinator.lastJumpLatitude
            || c.longitude != context.coordinator.lastJumpLongitude {
            context.coordinator.lastJumpLatitude = c.latitude
            context.coordinator.lastJumpLongitude = c.longitude
            map.setRegion(
                MKCoordinateRegion(
                    center: c, span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)),
                animated: true)
        }

        // Category filter: when the selection changes, refetch from the server
        // so clustering reflects only the filtered set, then re-render.
        if selectedCategoryId != context.coordinator.appliedCategoryId {
            context.coordinator.appliedCategoryId = selectedCategoryId
            context.coordinator.scheduleFetch(map)
        }
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, MKMapViewDelegate {
        var onSelectSpot: (SpotSummary) -> Void
        var onFetchedSpots: ([SpotSummary]) -> Void
        var categoriesById: [String: Category] = [:]
        var didCenterOnUser = false
        /// The currently applied single-select category filter (nil = all).
        var appliedCategoryId: String? = nil
        /// All spot items from the last successful fetch.
        private var allItems: [SpotSummary] = []
        private var allClusters: [MapCluster] = []
        private var fetchTask: Task<Void, Never>?

        // Stable annotation/overlay tracking for flicker-free diffs.
        private var liveSpots: [String: SpotAnnotation] = [:]          // keyed by spot.id
        private var liveClusters: [String: ClusterCountAnnotation] = [:] // keyed by clusterKey
        private var livePolygons: [String: MKPolygon] = [:]            // keyed by spot.id

        // Dedup guards for recenter/jump triggers (stored as lat/lng pairs so
        // Equatable isn't needed on CLLocationCoordinate2D).
        var lastRecenterLatitude: Double = 0
        var lastRecenterLongitude: Double = 0
        var lastJumpLatitude: Double = 0
        var lastJumpLongitude: Double = 0

        init(onSelectSpot: @escaping (SpotSummary) -> Void,
             onFetchedSpots: @escaping ([SpotSummary]) -> Void) {
            self.onSelectSpot = onSelectSpot
            self.onFetchedSpots = onFetchedSpots
        }

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
                minLng: minLng, minLat: minLat, maxLng: maxLng, maxLat: maxLat,
                cluster: true, categoryId: appliedCategoryId)
            else { return }
            // A newer pan may have superseded this fetch while it was in flight;
            // don't clobber the map with stale results.
            guard !Task.isCancelled else { return }

            allItems = resp.items
            allClusters = resp.clusters
            onFetchedSpots(allItems)
            // renderFilteredAnnotations is safe to call here: fetch is @MainActor.
            renderFilteredAnnotations(on: map)
        }

        /// Diff-based render: keeps existing annotations/overlays whose identity
        /// is still present in the new result set, adds genuinely new ones, and
        /// removes only the ones that have gone. MKUserLocation is never touched.
        /// Filtering is done server-side, so allItems/allClusters already reflect
        /// the active category. Safe to call from any main-thread context.
        func renderFilteredAnnotations(on map: MKMapView) {
            // --- Spot annotations ---
            var desiredSpots: [String: SpotAnnotation] = [:]
            for spot in allItems {
                if let ann = SpotAnnotation(spot) {
                    desiredSpots[ann.spotId] = ann
                }
            }
            let spotsToRemove = liveSpots.filter { desiredSpots[$0.key] == nil }.map(\.value)
            let spotsToAdd   = desiredSpots.filter { liveSpots[$0.key] == nil }.map(\.value)
            if !spotsToRemove.isEmpty { map.removeAnnotations(spotsToRemove) }
            if !spotsToAdd.isEmpty    { map.addAnnotations(spotsToAdd) }
            // Update live set: keep survivors, add newcomers.
            for ann in spotsToRemove { liveSpots.removeValue(forKey: ann.spotId) }
            for ann in spotsToAdd    { liveSpots[ann.spotId] = ann }

            // --- Cluster annotations ---
            var desiredClusters: [String: ClusterCountAnnotation] = [:]
            for cluster in allClusters {
                let ann = ClusterCountAnnotation(cluster)
                desiredClusters[ann.clusterKey] = ann
            }
            let clustersToRemove = liveClusters.filter { desiredClusters[$0.key] == nil }.map(\.value)
            let clustersToAdd   = desiredClusters.filter { liveClusters[$0.key] == nil }.map(\.value)
            if !clustersToRemove.isEmpty { map.removeAnnotations(clustersToRemove) }
            if !clustersToAdd.isEmpty    { map.addAnnotations(clustersToAdd) }
            for ann in clustersToRemove { liveClusters.removeValue(forKey: ann.clusterKey) }
            for ann in clustersToAdd    { liveClusters[ann.clusterKey] = ann }

            // --- Region polygon overlays ---
            var desiredPolygons: [String: (ring: [CLLocationCoordinate2D], count: Int)] = [:]
            for s in allItems where s.isRegion {
                if let ring = s.geometry?.outerRing, ring.count >= 3 {
                    desiredPolygons[s.id] = (ring, ring.count)
                }
            }
            let polygonsToRemove = livePolygons.filter { desiredPolygons[$0.key] == nil }
            let polygonsToAdd    = desiredPolygons.filter { livePolygons[$0.key] == nil }
            if !polygonsToRemove.isEmpty { map.removeOverlays(polygonsToRemove.map(\.value)) }
            for (spotId, _)  in polygonsToRemove { livePolygons.removeValue(forKey: spotId) }
            for (spotId, p) in polygonsToAdd {
                let poly = MKPolygon(coordinates: p.ring, count: p.count)
                livePolygons[spotId] = poly
                map.addOverlay(poly)
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
