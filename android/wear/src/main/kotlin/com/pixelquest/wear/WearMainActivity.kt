package com.pixelquest.wear

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import com.pixelquest.shared.Catalog
import com.pixelquest.shared.GameEngine
import com.pixelquest.shared.PlayerState

/**
 * Activité Wear OS – UI minimale, optimisée pour la navigation rotative.
 * Scaling lazy column avec : HUD, quête principale, raid, familier.
 */
class WearMainActivity : ComponentActivity() {
    private lateinit var sync: WearSync
    private val state = mutableStateOf(PlayerState())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sync = WearSync(this)
        sync.onState { s -> state.value = s }
        setContent {
            MaterialTheme {
                Scaffold {
                    val s = state.value
                    val need = GameEngine.xpForLevel(s.level)
                    ScalingLazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        item {
                            Text("Niv. ${s.level}", color = Color(0xFFFFE04A),
                                fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                        item {
                            LinearProgressIndicator(
                                progress = (s.xp.toFloat() / need.toFloat()).coerceIn(0f, 1f),
                                color = Color(0xFF6CD0FF),
                                modifier = Modifier.fillMaxWidth(0.8f).height(6.dp),
                            )
                        }
                        item {
                            Text("Pas ${s.dailySteps}", color = Color.White, fontSize = 14.sp)
                        }
                        item {
                            Text("🪙 ${s.coins}", color = Color(0xFFFFD34A), fontSize = 14.sp)
                        }
                        item { Spacer(Modifier.height(6.dp)) }
                        s.activeQuests.firstOrNull()?.let { q ->
                            val tpl = Catalog.questTemplates.firstOrNull { it.id == q.id }
                            if (tpl != null) {
                                item { Text(tpl.name, color = Color(0xFFFFE04A), fontSize = 12.sp) }
                                item {
                                    LinearProgressIndicator(
                                        progress = (q.progress.toFloat() / tpl.goal).coerceIn(0f, 1f),
                                        color = Color(0xFF2ECC71),
                                        modifier = Modifier.fillMaxWidth(0.8f).height(4.dp),
                                    )
                                }
                                item { Text("${q.progress}/${tpl.goal}", fontSize = 11.sp) }
                            }
                        }
                        item {
                            val boss = Catalog.raidBosses.firstOrNull { it.id == s.raid.bossId }
                            Text("Boss : ${boss?.name ?: "?"}", color = Color(0xFFFF5D6C), fontSize = 11.sp)
                        }
                        item {
                            val boss = Catalog.raidBosses.firstOrNull { it.id == s.raid.bossId }
                            LinearProgressIndicator(
                                progress = if (boss != null) (s.raid.hp.toFloat() / boss.hp).coerceIn(0f, 1f) else 0f,
                                color = Color(0xFFFF5D6C),
                                modifier = Modifier.fillMaxWidth(0.8f).height(4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
