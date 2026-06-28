package nl.devrijehond.app.ui.addspot

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import nl.devrijehond.app.AppGraph

/**
 * Add-spot tab. Two steps: place the geometry (POI point or REGION polygon) on a
 * Google map, then fill the form and submit to POST /api/v1/me/spots. Submitting
 * needs auth; if the user is anonymous we surface the sign-in prompt instead of
 * posting, then the flow resumes once they return signed in.
 *
 * @param onCreated invoked with the new spot's slug after a successful submit.
 * @param onRequireSignIn invoked when an anonymous user tries to continue/submit.
 * @param onCancel invoked when the user backs out of the flow from step 1.
 */
@Composable
fun AddSpotScreen(
    onCreated: (slug: String) -> Unit,
    onRequireSignIn: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: AddSpotViewModel = viewModel()

    // On the form step, the system back returns to the map editor instead of leaving.
    BackHandler(enabled = vm.step == AddSpotViewModel.Step.FORM) { vm.backToGeometry() }

    when (vm.step) {
        AddSpotViewModel.Step.GEOMETRY -> GeometryStep(
            vm = vm,
            onContinue = {
                if (AppGraph.session.isAuthenticated) {
                    vm.goToForm()
                } else {
                    onRequireSignIn()
                }
            },
            onClose = onCancel,
            modifier = modifier.fillMaxSize(),
        )

        AddSpotViewModel.Step.FORM -> FormStep(
            vm = vm,
            onBack = vm::backToGeometry,
            onSubmit = {
                if (!AppGraph.session.isAuthenticated) {
                    onRequireSignIn()
                } else {
                    vm.submit { slug ->
                        vm.reset()
                        onCreated(slug)
                    }
                }
            },
            modifier = modifier.fillMaxSize(),
        )
    }
}
