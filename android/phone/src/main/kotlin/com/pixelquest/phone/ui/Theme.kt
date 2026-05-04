package com.pixelquest.phone.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PixelDark = darkColorScheme(
    primary = Color(0xFFFFE04A),
    secondary = Color(0xFFD36CB0),
    tertiary = Color(0xFF6CD0FF),
    background = Color(0xFF0E0820),
    surface = Color(0xFF1A1030),
    onPrimary = Color(0xFF1A1030),
    onSecondary = Color(0xFF1A1030),
    onBackground = Color(0xFFF5F1FF),
    onSurface = Color(0xFFF5F1FF),
)

@Composable
fun PixelQuestTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = PixelDark, content = content)
}
