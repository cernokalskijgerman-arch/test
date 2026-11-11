package com.nothing.glyphstudio

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.theme.GlyphStudioTheme
import com.nothing.glyphstudio.theme.liquidGlass
import com.nothing.glyphstudio.ui.screens.ArcadeScreen
import com.nothing.glyphstudio.ui.screens.DashboardScreen
import com.nothing.glyphstudio.ui.screens.GlyphTestScreen
import com.nothing.glyphstudio.ui.screens.ScreenDestination
import com.nothing.glyphstudio.ui.screens.SequencerScreen
import com.nothing.glyphstudio.ui.screens.UtilitiesScreen
import com.nothing.glyphstudio.ui.screens.VisualizerScreen
import kotlinx.coroutines.launch

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
                    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 6 })
                    val scope = rememberCoroutineScope()

                    val tabTitles = listOf("ТЕСТ", "ХАБ", "СЕКВЕНСОР", "МУЗЫКА", "УТИЛИТЫ", "ИГРЫ")

                    Column(modifier = Modifier.fillMaxSize()) {
                        // Top Swipe Navigation Bar in Ultra Liquid Glass
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp)
                                .liquidGlass(shape = RoundedCornerShape(16.dp), elevation = 4.dp)
                                .padding(vertical = 6.dp, horizontal = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                tabTitles.forEachIndexed { index, title ->
                                    val isSelected = pagerState.currentPage == index
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isSelected) GlyphColors.NeonRed else Color.Transparent)
                                            .clickable {
                                                scope.launch { pagerState.animateScrollToPage(index) }
                                            }
                                            .padding(horizontal = 10.dp, vertical = 6.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = title,
                                            color = if (isSelected) Color.White else GlyphColors.TextMuted,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        // Full Horizontal Pager (Enables Swipe Left / Right Between All Modes!)
                        HorizontalPager(
                            state = pagerState,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                        ) { page ->
                            when (page) {
                                0 -> GlyphTestScreen(
                                    onNavigateFullApp = {
                                        scope.launch { pagerState.animateScrollToPage(1) }
                                    }
                                )
                                1 -> DashboardScreen(
                                    onNavigate = { dest ->
                                        val targetPage = when (dest) {
                                            ScreenDestination.DASHBOARD -> 1
                                            ScreenDestination.SEQUENCER -> 2
                                            ScreenDestination.VISUALIZER -> 3
                                            ScreenDestination.UTILITIES -> 4
                                            ScreenDestination.ARCADE -> 5
                                        }
                                        scope.launch { pagerState.animateScrollToPage(targetPage) }
                                    }
                                )
                                2 -> SequencerScreen(
                                    onBack = { scope.launch { pagerState.animateScrollToPage(0) } }
                                )
                                3 -> VisualizerScreen(
                                    onBack = { scope.launch { pagerState.animateScrollToPage(0) } }
                                )
                                4 -> UtilitiesScreen(
                                    onBack = { scope.launch { pagerState.animateScrollToPage(0) } }
                                )
                                5 -> ArcadeScreen(
                                    onBack = { scope.launch { pagerState.animateScrollToPage(0) } }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    private fun checkAppPermissions() {
        val permissions = mutableListOf(Manifest.permission.RECORD_AUDIO)
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
