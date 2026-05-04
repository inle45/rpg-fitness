package com.pixelquest.shared

import kotlin.math.floor
import kotlin.math.pow

/** Résultat d'une tentative d'ingestion de pas. */
data class StepResult(
    val gainedXp: Int,
    val gainedCoins: Int,
    val levelUps: List<Int>,
    val issues: List<String>,
)

data class ValidationResult(
    val ok: Boolean,
    val accepted: Int,
    val issues: List<String>,
)

data class BuyResult(val ok: Boolean, val reason: String? = null, val itemId: String? = null)
data class SellResult(val ok: Boolean, val refund: Int = 0, val reason: String? = null)
data class FightResult(val ok: Boolean, val monsterId: String, val xpGained: Int, val loot: String?)
data class TurnInResult(val ok: Boolean, val rewardXp: Int = 0, val rewardCoin: Int = 0, val reason: String? = null)

/**
 * Moteur de jeu. Toutes les méthodes sont déterministes (modulo
 * l'horloge passée en paramètre). Aucune dépendance Android : ce
 * module est testable sur la JVM.
 */
object GameEngine {

    // ---------------------------------------------------------------------
    // Calculs purs
    // ---------------------------------------------------------------------
    fun xpForLevel(level: Int): Int {
        require(level >= 1)
        return floor(Config.XP_BASE * Config.XP_GROWTH.pow((level - 1).toDouble())).toInt()
    }

    fun totalXpToReach(level: Int): Int {
        var sum = 0
        for (i in 1 until level) sum += xpForLevel(i)
        return sum
    }

    data class LevelInfo(val level: Int, val xpInLevel: Int, val xpForNext: Int)

    fun levelFromTotalXp(totalXp: Int): LevelInfo {
        var lvl = 1
        var cum = 0
        while (cum + xpForLevel(lvl) <= totalXp && lvl < 999) {
            cum += xpForLevel(lvl); lvl++
        }
        return LevelInfo(lvl, totalXp - cum, xpForLevel(lvl))
    }

    fun inventoryWeight(state: PlayerState): Int = state.inventory.sumOf { it.qty }
    fun isEncumbered(state: PlayerState): Boolean = inventoryWeight(state) >= Config.INVENTORY_SOFT_CAP

    // ---------------------------------------------------------------------
    // Anti-triche
    // ---------------------------------------------------------------------
    fun validateSteps(state: PlayerState, n: Int, nowMs: Long): ValidationResult {
        val issues = mutableListOf<String>()
        if (n < 0) return ValidationResult(false, 0, listOf("valeur invalide"))
        if (n > Config.SUSPICIOUS_BURST) issues.add("burst suspect (>${Config.SUSPICIOUS_BURST} pas en un coup)")
        val oneMinuteAgo = nowMs - 60_000
        val recent = state.stepEvents.filter { it.timestampMs >= oneMinuteAgo }.sumOf { it.count }
        if (recent + n > Config.MAX_STEPS_PER_MINUTE) issues.add("cadence > ${Config.MAX_STEPS_PER_MINUTE} pas/min")
        val oneSecAgo = nowMs - 1_000
        val veryRecent = state.stepEvents.filter { it.timestampMs >= oneSecAgo }.sumOf { it.count }
        if (veryRecent + n > Config.MAX_STEPS_PER_SECOND * 5) issues.add("cadence > ${Config.MAX_STEPS_PER_SECOND * 5} pas/s")

        var accepted = n
        if (issues.isNotEmpty()) {
            val allowed = (Config.MAX_STEPS_PER_MINUTE - recent).coerceAtLeast(0)
            accepted = n.coerceAtMost(allowed)
        }
        return ValidationResult(issues.isEmpty(), accepted, issues)
    }

    // ---------------------------------------------------------------------
    // Mutations principales
    // ---------------------------------------------------------------------
    fun ingestSteps(state: PlayerState, rawN: Int, nowMs: Long): StepResult {
        rotateDayIfNeeded(state, nowMs)
        rotateWeekIfNeeded(state, nowMs)
        rotateWeatherIfNeeded(state, nowMs)

        val v = validateSteps(state, rawN, nowMs)
        if (v.issues.isNotEmpty()) {
            state.flags.add(CheatFlag(nowMs, v.issues, rawN, v.accepted))
        }
        val n = v.accepted
        if (n <= 0) return StepResult(0, 0, emptyList(), v.issues)

        val effectiveSteps = if (isEncumbered(state)) (n / Config.ENCUMBRANCE_PENALTY).toInt() else n

        val weather = Catalog.weathers.firstOrNull { it.id == state.weatherId } ?: Catalog.weathers.first()
        var xpMult = weather.xpMultiplier
        var coinMult = weather.coinMultiplier

        val klass = state.character?.let { c -> Catalog.classes.firstOrNull { it.id == c.classId } }
        if (klass?.id == "rodeur") coinMult *= 1.05
        state.pets.forEach { p ->
            if (p.hatched) {
                val def = Catalog.pets.firstOrNull { it.id == p.id }
                if (def?.id == "foxy") xpMult *= 1.02
            }
        }

        if (state.dailySteps >= Config.DAILY_BONUS_THRESHOLD) {
            xpMult *= Config.DAILY_BONUS_MULT
            state.doubledToday = true
        }

        val gainedXp = (effectiveSteps * Config.XP_PER_STEP * xpMult).toInt()
        var gainedCoins = (effectiveSteps * (Config.COIN_PER_100_STEPS / 100.0) * coinMult).toInt()
        if (state.pets.any { it.id == "slimon" && it.hatched }) {
            gainedCoins += effectiveSteps / 100
        }

        state.totalSteps += n
        state.lifetimeSteps += n
        state.dailySteps += n
        if (state.dailySteps > state.dailyStepsBest) state.dailyStepsBest = state.dailySteps
        state.stepEvents.add(StepEvent(nowMs, n))
        if (state.stepEvents.size > 200) {
            val tail = state.stepEvents.takeLast(200)
            state.stepEvents.clear()
            state.stepEvents.addAll(tail)
        }
        state.coins += gainedCoins
        val before = state.level
        addXp(state, gainedXp)
        val ups = if (state.level > before) (before + 1..state.level).toList() else emptyList()

        // Quêtes
        state.activeQuests.forEach { q ->
            val tpl = Catalog.questTemplates.firstOrNull { it.id == q.id } ?: return@forEach
            if (tpl.type == QuestType.WALK) q.progress = (q.progress + n).coerceAtMost(tpl.goal)
        }

        // Raid
        if (state.raid.hp > 0) {
            state.raid.hp = (state.raid.hp - n).coerceAtLeast(0)
            state.raid.stepsContributed += n
            if (state.raid.hp == 0) {
                state.raidsWon += 1
                val boss = Catalog.raidBosses.firstOrNull { it.id == state.raid.bossId }
                boss?.let { addItem(state, it.reward, 1) }
            }
        }

        // Œuf
        state.eggIncubating?.let { egg ->
            egg.steps += n
            val def = Catalog.pets.firstOrNull { it.id == egg.petId }
            if (def != null && egg.steps >= def.hatchSteps) {
                state.pets.add(PetInstance(def.id, true, def.hatchSteps))
                state.activeQuests.forEach { q ->
                    val tpl = Catalog.questTemplates.firstOrNull { it.id == q.id }
                    if (tpl?.type == QuestType.HATCH) q.progress = tpl.goal
                }
                state.eggIncubating = null
            }
        }

        // Carte
        state.worldStepsBuffer += n
        while (state.worldStepsBuffer >= 50) {
            state.worldStepsBuffer -= 50
            stepWorld(state)
        }

        refreshAchievements(state)
        return StepResult(gainedXp, gainedCoins, ups, v.issues)
    }

    fun addXp(state: PlayerState, amount: Int) {
        state.xp += amount
        while (state.xp >= xpForLevel(state.level) && state.level < 999) {
            state.xp -= xpForLevel(state.level)
            state.level += 1
        }
    }

    fun rotateDayIfNeeded(state: PlayerState, nowMs: Long) {
        val today = TimeKeys.dayKey(java.time.Instant.ofEpochMilli(nowMs))
        if (state.dailyKey != today) {
            state.dailyKey = today
            state.dailySteps = 0
            state.doubledToday = false
        }
    }

    fun rotateWeekIfNeeded(state: PlayerState, nowMs: Long) {
        val w = TimeKeys.weekKey(java.time.Instant.ofEpochMilli(nowMs))
        if (state.raid.weekKey != w) {
            val idx = (kotlin.math.abs(hashStr(w)) % Catalog.raidBosses.size)
            val boss = Catalog.raidBosses[idx]
            state.raid = RaidState(boss.id, boss.hp, w, 0)
        }
    }

    fun rotateWeatherIfNeeded(state: PlayerState, nowMs: Long) {
        val today = TimeKeys.dayKey(java.time.Instant.ofEpochMilli(nowMs))
        if (state.weatherDay != today) {
            val seed = hashStr(today + (state.character?.name ?: ""))
            val pick = Catalog.weathers[kotlin.math.abs(seed) % Catalog.weathers.size]
            state.weatherId = pick.id
            state.weatherDay = today
        }
    }

    fun hashStr(s: String): Int {
        var h = 0
        for (c in s) {
            h = (h shl 5) - h + c.code
            h = h and -1 // 32-bit wrap
        }
        return h
    }

    private fun stepWorld(state: PlayerState) {
        val seed = hashStr("${state.totalSteps}:${state.dailyKey}")
        val dirs = arrayOf(intArrayOf(1, 0), intArrayOf(0, 1), intArrayOf(-1, 0), intArrayOf(0, -1))
        val d = dirs[kotlin.math.abs(seed) % 4]
        state.pos.x = ((state.pos.x + d[0]) % 9 + 9) % 9
        state.pos.y = ((state.pos.y + d[1]) % 9 + 9) % 9
    }

    // ---------------------------------------------------------------------
    // Inventaire / boutique
    // ---------------------------------------------------------------------
    fun addItem(state: PlayerState, id: String, qty: Int = 1): Boolean {
        if (inventoryWeight(state) >= Config.INVENTORY_HARD_CAP) return false
        val ex = state.inventory.firstOrNull { it.id == id }
        if (ex != null) ex.qty += qty
        else state.inventory.add(InventoryEntry(id, qty))
        return true
    }

    fun removeItem(state: PlayerState, id: String, qty: Int = 1): Boolean {
        val ex = state.inventory.firstOrNull { it.id == id } ?: return false
        if (ex.qty < qty) return false
        ex.qty -= qty
        if (ex.qty <= 0) state.inventory.removeAll { it.id == id }
        return true
    }

    fun buy(state: PlayerState, itemId: String): BuyResult {
        val item = Catalog.shopItems.firstOrNull { it.id == itemId }
            ?: return BuyResult(false, "item inconnu")
        if (state.coins < item.price) return BuyResult(false, "pas assez de pièces")
        if (inventoryWeight(state) >= Config.INVENTORY_HARD_CAP) return BuyResult(false, "inventaire plein")
        state.coins -= item.price
        addItem(state, itemId, 1)
        if (item.id == "oeuf_mystere" && state.eggIncubating == null) {
            val idx = kotlin.math.abs(hashStr("$itemId${state.totalSteps}")) % Catalog.pets.size
            state.eggIncubating = EggIncubation(Catalog.pets[idx].id, 0)
        }
        return BuyResult(true, itemId = itemId)
    }

    fun sell(state: PlayerState, itemId: String): SellResult {
        val item = Catalog.shopItems.firstOrNull { it.id == itemId } ?: return SellResult(false, reason = "inconnu")
        if (!removeItem(state, itemId, 1)) return SellResult(false, reason = "aucun en stock")
        val refund = (item.price * 0.4).toInt()
        state.coins += refund
        return SellResult(true, refund)
    }

    // ---------------------------------------------------------------------
    // Quêtes
    // ---------------------------------------------------------------------
    fun acceptQuest(state: PlayerState, questId: String): Boolean {
        if (state.activeQuests.any { it.id == questId }) return false
        if (state.completedQuests.contains(questId)) return false
        if (Catalog.questTemplates.none { it.id == questId }) return false
        state.activeQuests.add(QuestProgress(questId, 0))
        return true
    }

    fun turnInQuest(state: PlayerState, questId: String): TurnInResult {
        val q = state.activeQuests.firstOrNull { it.id == questId } ?: return TurnInResult(false)
        val tpl = Catalog.questTemplates.firstOrNull { it.id == questId } ?: return TurnInResult(false)
        if (q.progress < tpl.goal) return TurnInResult(false, reason = "objectif non atteint")
        state.activeQuests.removeAll { it.id == questId }
        state.completedQuests.add(questId)
        addXp(state, tpl.rewardXp)
        state.coins += tpl.rewardCoin
        return TurnInResult(true, tpl.rewardXp, tpl.rewardCoin)
    }

    // ---------------------------------------------------------------------
    // Combat
    // ---------------------------------------------------------------------
    fun fight(state: PlayerState, monsterId: String): FightResult {
        val m = Catalog.monsters.firstOrNull { it.id == monsterId }
            ?: return FightResult(false, monsterId, 0, null)
        val weapon = state.equipped.weapon?.let { id -> Catalog.shopItems.firstOrNull { it.id == id } }
        val wDmg = when {
            weapon == null -> 2
            "fer" in weapon.id -> 15
            "eclat" in weapon.id -> 12
            else -> 5
        }
        val dmg = state.level * 4 + wDmg
        val win = dmg >= m.hp / 4
        if (win) {
            state.bestiary[m.id] = (state.bestiary[m.id] ?: 0) + 1
            addXp(state, m.xp)
            state.coins += m.xp / 4
            val lootId = m.loot[kotlin.math.abs(hashStr("${state.totalSteps}${m.id}")) % m.loot.size]
            addItem(state, lootId, 1)
            state.activeQuests.forEach { q ->
                val tpl = Catalog.questTemplates.firstOrNull { it.id == q.id }
                if (tpl?.type == QuestType.KILL && tpl.target == m.id) {
                    q.progress = (q.progress + 1).coerceAtMost(tpl.goal)
                }
            }
            refreshAchievements(state)
            return FightResult(true, monsterId, m.xp, lootId)
        }
        return FightResult(false, monsterId, 0, null)
    }

    // ---------------------------------------------------------------------
    // Achievements
    // ---------------------------------------------------------------------
    fun refreshAchievements(state: PlayerState) {
        Catalog.achievements.forEach { a ->
            if (!state.achievements.contains(a.id) && a.condition(state)) {
                state.achievements.add(a.id)
            }
        }
    }
}
