package com.pixelquest.phone

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pixelquest.phone.ui.GameViewModel
import com.pixelquest.phone.ui.PixelQuestTheme
import com.pixelquest.phone.ui.screens.*

/**
 * Activité unique. La navigation interne est portée par un état Compose.
 * L'UI s'inspire du même look pixel art que la preview web.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PixelQuestTheme {
                val vm: GameViewModel = viewModel()
                PixelQuestApp(vm)
            }
        }
    }
}

@Composable
fun PixelQuestApp(vm: GameViewModel) {
    val tabs = listOf("Carte", "Quêtes", "Boutique", "Bestiaire", "Familiers", "Raid", "Personnage", "Succès")
    var selected by remember { mutableStateOf(0) }
    val state by vm.state.collectAsState()
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("PixelQuest") },
            )
        },
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { idx, title ->
                    NavigationBarItem(
                        selected = selected == idx,
                        onClick = { selected = idx },
                        label = { Text(title) },
                        icon = {},
                    )
                }
            }
        }
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().background(Color(0xFF120824))
                .verticalScroll(rememberScrollState())
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HudCard(state)
            when (selected) {
                0 -> MapScreen(state, vm)
                1 -> QuestsScreen(state, vm)
                2 -> ShopScreen(state, vm)
                3 -> BestiaryScreen(state, vm)
                4 -> PetsScreen(state)
                5 -> RaidScreen(state)
                6 -> CharacterScreen(state, vm)
                7 -> AchievementsScreen(state)
            }
        }
    }
}
