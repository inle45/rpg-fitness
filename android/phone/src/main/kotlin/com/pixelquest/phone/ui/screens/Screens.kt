package com.pixelquest.phone.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pixelquest.phone.ui.GameViewModel
import com.pixelquest.shared.Catalog
import com.pixelquest.shared.GameEngine
import com.pixelquest.shared.PlayerState

@Composable
fun HudCard(state: PlayerState) {
    val need = GameEngine.xpForLevel(state.level)
    Surface(color = Color(0xFF0A0618), shape = RoundedCornerShape(8.dp)) {
        Column(Modifier.padding(8.dp)) {
            Text("${state.character?.name ?: "Aventurier"} · niveau ${state.level}",
                color = Color(0xFFFFE04A), fontWeight = FontWeight.Bold)
            LinearProgressIndicator(
                progress = (state.xp.toFloat() / need.toFloat()).coerceIn(0f, 1f),
                color = Color(0xFF6CD0FF),
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("XP ${state.xp}/$need", color = Color.White)
                Text("🪙 ${state.coins}", color = Color(0xFFFFD34A))
                Text("Pas du jour ${state.dailySteps}", color = Color(0xFFB9AEE0))
            }
            val w = Catalog.weathers.firstOrNull { it.id == state.weatherId }
            Text("Météo : ${w?.name ?: "?"}", color = Color(0xFFB9AEE0))
        }
    }
}

@Composable
fun MapScreen(state: PlayerState, vm: GameViewModel) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(8.dp)) {
            Text("Carte du monde (9x9)", style = MaterialTheme.typography.titleMedium)
            // Affichage simplifié sur 3 lignes : ligne du joueur centrée
            for (y in 0 until 9) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    for (x in 0 until 9) {
                        val isPlayer = (state.pos.x == x && state.pos.y == y)
                        val color = if (isPlayer) Color(0xFFFFE04A) else
                            tileColorAt(x, y)
                        Box(Modifier.size(20.dp).background(color)
                            .border(1.dp, Color(0xFF000000)),
                            contentAlignment = Alignment.Center) {
                            if (isPlayer) Text("●", color = Color.Black, fontSize = 12.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Text("Position : (${state.pos.x}, ${state.pos.y})", color = Color(0xFFB9AEE0))
            Spacer(Modifier.height(8.dp))
            Button(onClick = { vm.ingestSteps(50) }) { Text("Simuler 50 pas") }
        }
    }
}

private fun tileColorAt(x: Int, y: Int): Color {
    val h = Math.abs(("world-v1:$x:$y").hashCode())
    val m = h % 100
    return when {
        m < 8 -> Color(0xFF3498DB)
        m < 22 -> Color(0xFF1F4A17)
        m < 30 -> Color(0xFFE6C98A)
        m < 36 -> Color(0xFF7F8C8D)
        m < 40 -> Color(0xFFECF0F1)
        else -> Color(0xFF3A6F2A)
    }
}

@Composable
fun QuestsScreen(state: PlayerState, vm: GameViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Quêtes actives", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        state.activeQuests.forEach { q ->
            val tpl = Catalog.questTemplates.firstOrNull { it.id == q.id } ?: return@forEach
            Card {
                Column(Modifier.padding(8.dp)) {
                    Text(tpl.name, fontWeight = FontWeight.Bold)
                    LinearProgressIndicator(
                        progress = (q.progress.toFloat() / tpl.goal).coerceIn(0f, 1f),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    )
                    Text("${q.progress} / ${tpl.goal} · récompense ${tpl.rewardXp} XP, ${tpl.rewardCoin}🪙",
                        color = Color(0xFFB9AEE0))
                    if (q.progress >= tpl.goal) {
                        Button(onClick = { vm.turnInQuest(q.id) }) { Text("Rendre") }
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Text("Disponibles", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        Catalog.questTemplates.filter {
            state.activeQuests.none { q -> q.id == it.id } && !state.completedQuests.contains(it.id)
        }.forEach { tpl ->
            Card {
                Column(Modifier.padding(8.dp)) {
                    Text(tpl.name, fontWeight = FontWeight.Bold)
                    Text("Objectif ${tpl.goal} · ${tpl.rewardXp} XP, ${tpl.rewardCoin}🪙",
                        color = Color(0xFFB9AEE0))
                    Button(onClick = { vm.acceptQuest(tpl.id) }) { Text("Accepter") }
                }
            }
        }
    }
}

@Composable
fun ShopScreen(state: PlayerState, vm: GameViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Boutique", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        LazyVerticalGrid(columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.heightIn(min = 200.dp, max = 600.dp)
        ) {
            items(Catalog.shopItems) { item ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(6.dp)) {
                        Text(item.name, fontWeight = FontWeight.Bold)
                        Text(item.description, color = Color(0xFFB9AEE0), fontSize = 11.sp)
                        Text("${item.price} 🪙", color = Color(0xFFFFD34A))
                        Button(onClick = { vm.buy(item.id) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Acheter")
                        }
                    }
                }
            }
        }
        Text("Inventaire (${GameEngine.inventoryWeight(state)}/${com.pixelquest.shared.Config.INVENTORY_HARD_CAP})",
            style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        if (GameEngine.isEncumbered(state)) {
            Text("⚠ Encombrement : 110 pas pour 100 XP.", color = Color(0xFFFF5D6C))
        }
        state.inventory.forEach { it ->
            val def = Catalog.shopItems.firstOrNull { d -> d.id == it.id }
            Card {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${def?.name ?: it.id} x${it.qty}", modifier = Modifier.weight(1f))
                    Button(onClick = { vm.sell(it.id) }) { Text("Vendre") }
                }
            }
        }
    }
}

@Composable
fun BestiaryScreen(state: PlayerState, vm: GameViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Bestiaire", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        Catalog.monsters.forEach { m ->
            val seen = (state.bestiary[m.id] ?: 0) > 0
            Card {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(if (seen) m.name else "???", fontWeight = FontWeight.Bold)
                        Text("PV ${m.hp} · XP ${m.xp} · Tier ${m.tier}", color = Color(0xFFB9AEE0))
                        Text("Vaincus : ${state.bestiary[m.id] ?: 0}", color = Color(0xFFB9AEE0))
                    }
                    Button(onClick = { vm.fight(m.id) }) { Text("Combattre") }
                }
            }
        }
    }
}

@Composable
fun PetsScreen(state: PlayerState) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Familiers", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        state.eggIncubating?.let { egg ->
            val def = Catalog.pets.firstOrNull { it.id == egg.petId }
            Card {
                Column(Modifier.padding(8.dp)) {
                    Text("Œuf en couvée 🥚", fontWeight = FontWeight.Bold)
                    Text("${egg.steps} / ${def?.hatchSteps ?: '?'} pas", color = Color(0xFFB9AEE0))
                    LinearProgressIndicator(
                        progress = if (def != null) egg.steps.toFloat() / def.hatchSteps else 0f,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
        Catalog.pets.forEach { p ->
            val owned = state.pets.any { it.id == p.id && it.hatched }
            Card {
                Row(Modifier.padding(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(p.name + if (owned) " ★" else "", fontWeight = FontWeight.Bold,
                            color = if (owned) Color(0xFFFFE04A) else Color.Gray)
                        Text("éclot à ${p.hatchSteps} pas", color = Color(0xFFB9AEE0))
                        Text(p.trait, color = Color(0xFFB9AEE0))
                    }
                }
            }
        }
    }
}

@Composable
fun RaidScreen(state: PlayerState) {
    val boss = Catalog.raidBosses.firstOrNull { it.id == state.raid.bossId } ?: Catalog.raidBosses.first()
    Card {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("BOSS · ${boss.name}", style = MaterialTheme.typography.titleLarge,
                color = Color(0xFFFFE04A))
            LinearProgressIndicator(
                progress = (state.raid.hp.toFloat() / boss.hp).coerceIn(0f, 1f),
                color = Color(0xFFFF5D6C),
                modifier = Modifier.fillMaxWidth().height(16.dp).padding(vertical = 6.dp),
            )
            Text("${state.raid.hp} / ${boss.hp} PV", color = Color.White)
            Text("Chaque pas = 1 dégât. Tu as jusqu'à dimanche soir.",
                color = Color(0xFFB9AEE0))
            Text("Total infligé : ${state.raid.stepsContributed}", color = Color(0xFFB9AEE0))
            if (state.raid.hp == 0) {
                Text("🏆 BOSS VAINCU ! Récompense : ${boss.reward}",
                    color = Color(0xFFFFE04A))
            }
        }
    }
}

@Composable
fun CharacterScreen(state: PlayerState, vm: GameViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Personnage", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        Catalog.classes.forEach { k ->
            val active = state.character?.classId == k.id
            Card {
                Row(Modifier.padding(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(k.name + if (active) " ✓" else "", fontWeight = FontWeight.Bold)
                        Text(k.description, color = Color(0xFFB9AEE0))
                    }
                    Button(onClick = {
                        vm.setCharacter { it.character?.let { c -> c.classId = k.id } }
                    }) { Text("Choisir") }
                }
            }
        }
        Text("Couleur cheveux", color = Color(0xFFB9AEE0))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Catalog.hairColors.forEach { col ->
                val color = Color(android.graphics.Color.parseColor(col))
                Box(Modifier.size(32.dp).background(color)
                    .border(2.dp,
                        if (state.character?.hairColor == col) Color(0xFFFFE04A) else Color.Black))
            }
        }
    }
}

@Composable
fun AchievementsScreen(state: PlayerState) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Succès", style = MaterialTheme.typography.titleMedium, color = Color(0xFFFFE04A))
        Catalog.achievements.forEach { a ->
            val unlocked = state.achievements.contains(a.id)
            Card(colors = CardDefaults.cardColors(
                containerColor = if (unlocked) Color(0xFF2A1855) else Color(0xFF14082A))
            ) {
                Row(Modifier.padding(8.dp)) {
                    Text(if (unlocked) "★ " else "☆ ", color = if (unlocked) Color(0xFFFFE04A) else Color.Gray)
                    Text(a.name, color = if (unlocked) Color.White else Color.Gray)
                }
            }
        }
    }
}
