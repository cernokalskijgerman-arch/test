package com.nothing.glyphstudio

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.theme.GlyphStudioTheme
import com.nothing.glyphstudio.ui.screens.ArcadeScreen
import com.nothing.glyphstudio.ui.screens.DashboardScreen
import com.nothing.glyphstudio.ui.screens.GlyphTestScreen
import com.nothing.glyphstudio.ui.screens.ScreenDestination
import com.nothing.glyphstudio.ui.screens.SequencerScreen
import com.nothing.glyphstudio.ui.screens.UtilitiesScreen
import com.nothing.glyphstudio.ui.screens.VisualizerScreen

/**
 * Main Activity for Nothing Glyph Studio.
 * Integrates the full Liquid Glass Hub (Dashboard, Sequencer, Visualizer, Utilities, Arcade)
 * with the dedicated Glyph Test Bench for direct physical Nothing hardware validation.
 */
class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        checkAppPermissions()

        setContent {
            GlyphStudioTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = GlyphColors.AmoledBlack
                ) {
                    var currentScreen by remember { mutableStateOf(ScreenDestination.DASHBOARD) }
                    var showTestBench by remember { mutableStateOf(false) }

                    if (showTestBench) {
                        BackHandler {
                            showTestBench = false
                        }
                        GlyphTestScreen(
                            onNavigateFullApp = { showTestBench = false }
                        )
                    } else {
                        Crossfade(targetState = currentScreen, label = "ScreenTransition") { screen ->
                            when (screen) {
                                ScreenDestination.DASHBOARD -> {
                                    DashboardScreen(
                                        onNavigate = { dest -> currentScreen = dest },
                                        onNavigateTest = { showTestBench = true }
                                    )
                                }
                                ScreenDestination.SEQUENCER -> {
                                    BackHandler { currentScreen = ScreenDestination.DASHBOARD }
                                    SequencerScreen(
                                        onBack = { currentScreen = ScreenDestination.DASHBOARD }
                                    )
                                }
                                ScreenDestination.VISUALIZER -> {
                                    BackHandler { currentScreen = ScreenDestination.DASHBOARD }
                                    VisualizerScreen(
                                        onBack = { currentScreen = ScreenDestination.DASHBOARD }
                                    )
                                }
                                ScreenDestination.UTILITIES -> {
                                    BackHandler { currentScreen = ScreenDestination.DASHBOARD }
                                    UtilitiesScreen(
                                        onBack = { currentScreen = ScreenDestination.DASHBOARD }
                                    )
                                }
                                ScreenDestination.ARCADE -> {
                                    BackHandler { currentScreen = ScreenDestination.DASHBOARD }
                                    ArcadeScreen(
                                        onBack = { currentScreen = ScreenDestination.DASHBOARD }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun checkAppPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            requestPermissionLauncher.launch(needed.toTypedArray())
        }
    }
}
