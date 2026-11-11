package com.nothing.glyphstudio

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.theme.GlyphStudioTheme
import com.nothing.glyphstudio.ui.screens.GlyphTestScreen

/**
 * Main Activity for the dedicated minimal Nothing Glyph hardware test APK.
 * Directly launches into GlyphTestScreen to verify hardware compatibility,
 * service binding, model detection, and test animations.
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
                    GlyphTestScreen()
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
