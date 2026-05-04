package com.pixelquest.shared

/**
 * Invariants & auto-fix : le « debugger auto-correctif ».
 *
 * Le principe :
 *   - On encode des contraintes (ex : level >= 1, xp >= 0, inventaire <= cap)
 *     comme des paires (check, fix).
 *   - À chaque mutation et à chaque chargement, on évalue les checks.
 *   - Tout invariant violé est réparé automatiquement par sa fonction de
 *     correction. Les corrections sont volontairement conservatrices :
 *     elles ramènent l'état dans le domaine valide sans détruire la
 *     progression légitime.
 */
object Invariants {

    data class Invariant(
        val id: String,
        val check: (PlayerState) -> Boolean,
        val fix: (PlayerState) -> Unit,
    )

    private val INVARIANTS: List<Invariant> = listOf(
        Invariant(
            "xp_non_negative",
            check = { it.xp >= 0 },
            fix = { if (it.xp < 0) it.xp = 0 },
        ),
        Invariant(
            "level_min_1",
            check = { it.level >= 1 },
            fix = { if (it.level < 1) it.level = 1 },
        ),
        Invariant(
            "level_max_999",
            check = { it.level <= 999 },
            fix = { if (it.level > 999) it.level = 999 },
        ),
        Invariant(
            "coins_non_negative",
            check = { it.coins >= 0 },
            fix = { if (it.coins < 0) it.coins = 0 },
        ),
        Invariant(
            "totalSteps_le_lifetime",
            check = { it.totalSteps <= it.lifetimeSteps + 1 },
            fix = { if (it.totalSteps > it.lifetimeSteps) it.lifetimeSteps = it.totalSteps },
        ),
        Invariant(
            "dailySteps_non_negative",
            check = { it.dailySteps >= 0 },
            fix = { if (it.dailySteps < 0) it.dailySteps = 0 },
        ),
        Invariant(
            "inventory_under_hard_cap",
            check = { GameEngine.inventoryWeight(it) <= Config.INVENTORY_HARD_CAP },
            fix = {
                while (GameEngine.inventoryWeight(it) > Config.INVENTORY_HARD_CAP && it.inventory.isNotEmpty()) {
                    val last = it.inventory.last()
                    last.qty -= 1
                    if (last.qty <= 0) it.inventory.removeAt(it.inventory.lastIndex)
                }
            },
        ),
        Invariant(
            "raid_hp_non_negative",
            check = { it.raid.hp >= 0 },
            fix = { if (it.raid.hp < 0) it.raid.hp = 0 },
        ),
        Invariant(
            "pos_in_bounds",
            check = { it.pos.x in 0..8 && it.pos.y in 0..8 },
            fix = {
                it.pos.x = ((it.pos.x % 9) + 9) % 9
                it.pos.y = ((it.pos.y % 9) + 9) % 9
            },
        ),
        Invariant(
            "xp_below_threshold",
            check = { it.xp < GameEngine.xpForLevel(it.level) * 1.5 },
            fix = {
                while (it.xp >= GameEngine.xpForLevel(it.level)) {
                    it.xp -= GameEngine.xpForLevel(it.level)
                    it.level += 1
                }
            },
        ),
        Invariant(
            "character_class_known",
            check = { s ->
                val c = s.character ?: return@Invariant true
                Catalog.classes.any { it.id == c.classId }
            },
            fix = { s ->
                val c = s.character
                if (c != null && Catalog.classes.none { it.id == c.classId }) c.classId = "guerrier"
            },
        ),
        Invariant(
            "weather_known",
            check = { s -> Catalog.weathers.any { it.id == s.weatherId } },
            fix = { s -> if (Catalog.weathers.none { it.id == s.weatherId }) s.weatherId = "soleil" },
        ),
        Invariant(
            "inventory_qty_positive",
            check = { it.inventory.all { e -> e.qty > 0 } },
            fix = { it.inventory.removeAll { e -> e.qty <= 0 } },
        ),
        Invariant(
            "no_duplicate_quests",
            check = { it.activeQuests.distinctBy { q -> q.id }.size == it.activeQuests.size },
            fix = {
                val seen = mutableSetOf<String>()
                val cleaned = it.activeQuests.filter { q -> seen.add(q.id) }
                it.activeQuests.clear()
                it.activeQuests.addAll(cleaned)
            },
        ),
        Invariant(
            "achievements_unique",
            check = { it.achievements.distinct().size == it.achievements.size },
            fix = {
                val unique = it.achievements.distinct()
                it.achievements.clear()
                it.achievements.addAll(unique)
            },
        ),
    )

    data class CheckReport(val id: String, val ok: Boolean, val error: String? = null)

    fun runAll(state: PlayerState): List<CheckReport> = INVARIANTS.map { inv ->
        runCatching { inv.check(state) }
            .map { ok -> CheckReport(inv.id, ok) }
            .getOrElse { e -> CheckReport(inv.id, false, e.message) }
    }

    /** Répare automatiquement tous les invariants en échec. Multiples passes. */
    fun autoFix(state: PlayerState): List<String> {
        val fixed = mutableListOf<String>()
        repeat(4) {
            var changed = false
            for (inv in INVARIANTS) {
                runCatching {
                    if (!inv.check(state)) {
                        inv.fix(state)
                        changed = true
                        if (inv.check(state)) fixed.add(inv.id)
                    }
                }.onFailure { e -> fixed.add("${inv.id} (exception: ${e.message})") }
            }
            if (!changed) return@repeat
        }
        return fixed
    }
}
