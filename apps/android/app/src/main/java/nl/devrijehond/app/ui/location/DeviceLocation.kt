package nl.devrijehond.app.ui.location

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.tasks.CancellationTokenSource
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Thin wrapper over the fused location provider, shared by the Kaart and Nabij
 * tabs. Callers must hold ACCESS_FINE/COARSE_LOCATION before invoking (the
 * composables request it via accompanist); the @SuppressLint reflects that the
 * permission check happens at the call site, not here.
 *
 * It prefers the cached last fix (instant, no GPS spin-up) and only asks for a
 * fresh balanced-power fix when there is none. Both paths are wrapped in
 * suspendCancellableCoroutine so we avoid pulling in kotlinx-coroutines-play-services.
 */
object DeviceLocation {

    @SuppressLint("MissingPermission")
    suspend fun current(context: Context): LatLng? {
        val client = LocationServices.getFusedLocationProviderClient(context.applicationContext)

        val last = suspendCancellableCoroutine<LatLng?> { cont ->
            client.lastLocation
                .addOnSuccessListener { loc -> cont.resume(loc?.let { LatLng(it.latitude, it.longitude) }) }
                .addOnFailureListener { cont.resume(null) }
        }
        if (last != null) return last

        return suspendCancellableCoroutine { cont ->
            val cts = CancellationTokenSource()
            client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token)
                .addOnSuccessListener { loc -> cont.resume(loc?.let { LatLng(it.latitude, it.longitude) }) }
                .addOnFailureListener { cont.resume(null) }
            cont.invokeOnCancellation { cts.cancel() }
        }
    }
}
