package nl.devrijehond.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import nl.devrijehond.app.ui.addspot.AddSpotScreen
import nl.devrijehond.app.ui.auth.SignInScreen
import nl.devrijehond.app.ui.map.MapScreen
import nl.devrijehond.app.ui.nearby.NearbyScreen
import nl.devrijehond.app.ui.profile.AboutScreen
import nl.devrijehond.app.ui.profile.DogEditScreen
import nl.devrijehond.app.ui.profile.EditProfileScreen
import nl.devrijehond.app.ui.profile.ModeratorApplyScreen
import nl.devrijehond.app.ui.profile.MySpotsScreen
import nl.devrijehond.app.ui.profile.ProfileScreen
import nl.devrijehond.app.ui.spotdetail.SpotDetailScreen
import nl.devrijehond.app.ui.spotedit.SpotEditScreen
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.wensen.WensenScreen

/** The five bottom tabs, matching the iOS RootView order. */
enum class Tab(val route: String, val label: String, val icon: ImageVector) {
    Map("map", "Kaart", Icons.Filled.Map),
    Nearby("nearby", "Nabij", Icons.Filled.Place),
    Add("add", "Toevoegen", Icons.Filled.AddCircle),
    Wishes("wishes", "Wensen", Icons.Filled.Lightbulb),
    Profile("profile", "Profiel", Icons.Filled.Person),
}

private val tabRoutes = Tab.entries.map { it.route }.toSet()

@Composable
fun AppShell() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val onTab = currentDestination?.route in tabRoutes

    // Shared refresh signal: bumped after a create/edit so Kaart + Nabij refetch.
    var refreshKey by remember { mutableIntStateOf(0) }

    fun openSpot(slug: String) = navController.navigate("spot/$slug")
    fun goSignIn() = navController.navigate("signin")

    Scaffold(
        containerColor = Brand.Sand,
        bottomBar = {
            AnimatedVisibility(visible = onTab) {
                NavigationBar(containerColor = Brand.Cream) {
                    Tab.entries.forEach { tab ->
                        val selected =
                            currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = {
                                Text(tab.label, style = MaterialTheme.typography.labelSmall)
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Brand.Moss,
                                selectedTextColor = Brand.MossDark,
                                indicatorColor = Brand.MossSoft,
                                unselectedIconColor = Brand.Ink2,
                                unselectedTextColor = Brand.Ink2,
                            ),
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Tab.Map.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            // Tabs
            composable(Tab.Map.route) {
                MapScreen(onSelectSpot = ::openSpot, refreshKey = refreshKey)
            }
            composable(Tab.Nearby.route) {
                NearbyScreen(onSelectSpot = ::openSpot, refreshKey = refreshKey)
            }
            composable(Tab.Add.route) {
                AddSpotScreen(
                    onCreated = { slug ->
                        refreshKey++
                        navController.navigate("spot/$slug")
                    },
                    onRequireSignIn = ::goSignIn,
                    onCancel = {
                        navController.navigate(Tab.Map.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(Tab.Wishes.route) {
                WensenScreen(onRequireSignIn = ::goSignIn)
            }
            composable(Tab.Profile.route) {
                ProfileScreen(
                    onRequireSignIn = ::goSignIn,
                    onEditProfile = { navController.navigate("editprofile") },
                    onAddDog = { navController.navigate("dog") },
                    onEditDog = { dogId -> navController.navigate("dog?dogId=$dogId") },
                    onMySpots = { navController.navigate("myspots") },
                    onModeratorApply = { navController.navigate("moderatorapply") },
                    onAbout = { navController.navigate("about") },
                )
            }

            // Pushed routes
            composable(
                route = "spot/{slug}",
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) { entry ->
                val slug = entry.arguments?.getString("slug").orEmpty()
                SpotDetailScreen(
                    slug = slug,
                    onChanged = { refreshKey++ },
                    onEdit = { s -> navController.navigate("spot/$s/edit") },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = "spot/{slug}/edit",
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) { entry ->
                val slug = entry.arguments?.getString("slug").orEmpty()
                SpotEditScreen(
                    slug = slug,
                    onSaved = {
                        refreshKey++
                        navController.popBackStack()
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable("signin") {
                SignInScreen(
                    onSignedIn = { navController.popBackStack() },
                    onClose = { navController.popBackStack() },
                )
            }
            composable("editprofile") {
                EditProfileScreen(onDone = { navController.popBackStack() })
            }
            composable(
                route = "dog?dogId={dogId}",
                arguments = listOf(
                    navArgument("dogId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                DogEditScreen(
                    dogId = entry.arguments?.getString("dogId"),
                    onDone = { navController.popBackStack() },
                )
            }
            composable("myspots") { MySpotsScreen() }
            composable("moderatorapply") { ModeratorApplyScreen() }
            composable("about") { AboutScreen() }
        }
    }
}
