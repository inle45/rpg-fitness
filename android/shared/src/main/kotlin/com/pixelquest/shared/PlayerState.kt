package com.pixelquest.shared

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneOffset
import java.time.temporal.WeekFields
import java.util.Locale

@Serializable
data class CharacterAppearance(
    var name: String = "Aventurier",
    var classId: String = "guerrier",
    var hair: String = "short",
    var hairColor: String = "#8b4513",
    var skin: String = "#f4c79a",
)

@Serializable
data class InventoryEntry(var id: String, var qty: Int)

@Serializable
data class EquippedSlots(
    var weapon: String? = null,
    var armor: String? = null,
)

@Serializable
data class PetInstance(
    var id: String,
    var hatched: Boolean,
    var progress: Int,
)

@Serializable
data class EggIncubation(
    var petId: String,
    var steps: Int,
)

@Serializable
data class QuestProgress(
    var id: String,
    var progress: Int,
)

@Serializable
data class StepEvent(val timestampMs: Long, val count: Int)

@Serializable
data class CheatFlag(
    val timestampMs: Long,
    val issues: List<String>,
    val raw: Int,
    val kept: Int,
)

@Serializable
data class RaidState(
    var bossId: String,
    var hp: Int,
    var weekKey: String,
    var stepsContributed: Int,
)

@Serializable
data class WorldPos(var x: Int = 4, var y: Int = 4)

/**
 * État complet du joueur. Sérialisable. Aucune logique métier ici.
 */
@Serializable
data class PlayerState(
    var version: Int = 1,
    var character: CharacterAppearance? = null,

    var level: Int = 1,
    var xp: Int = 0,
    var totalSteps: Int = 0,
    var lifetimeSteps: Int = 0,
    var coins: Int = 50,

    val stepEvents: MutableList<StepEvent> = mutableListOf(),

    val inventory: MutableList<InventoryEntry> = mutableListOf(),
    var equipped: EquippedSlots = EquippedSlots(),

    val pets: MutableList<PetInstance> = mutableListOf(),
    var eggIncubating: EggIncubation? = null,

    val activeQuests: MutableList<QuestProgress> = mutableListOf(),
    val completedQuests: MutableList<String> = mutableListOf(),

    val bestiary: MutableMap<String, Int> = mutableMapOf(),

    val achievements: MutableList<String> = mutableListOf(),

    var raid: RaidState = RaidState(
        bossId = "dragon_fer",
        hp = Config.WEEKLY_BOSS_BASE_HP,
        weekKey = TimeKeys.weekKey(Instant.now()),
        stepsContributed = 0,
    ),
    var raidsWon: Int = 0,

    var weatherId: String = "soleil",
    var weatherDay: String = TimeKeys.dayKey(Instant.now()),

    var pos: WorldPos = WorldPos(),
    var worldStepsBuffer: Int = 0,

    var dailySteps: Int = 0,
    var dailyStepsBest: Int = 0,
    var dailyKey: String = TimeKeys.dayKey(Instant.now()),
    var doubledToday: Boolean = false,

    val flags: MutableList<CheatFlag> = mutableListOf(),
)

/** Helpers pour clés temporelles déterministes. */
object TimeKeys {
    fun dayKey(t: Instant): String {
        val dt = t.atZone(ZoneOffset.UTC)
        return "${dt.year}-${dt.monthValue}-${dt.dayOfMonth}"
    }
    fun weekKey(t: Instant): String {
        val dt = t.atZone(ZoneOffset.UTC)
        val wf = WeekFields.of(Locale.FRANCE)
        val week = dt.get(wf.weekOfWeekBasedYear())
        return "${dt.year}-W$week"
    }
    fun seasonNow(t: Instant): String {
        val m = t.atZone(ZoneOffset.UTC).monthValue
        return when {
            m == 12 || m <= 2 -> "hiver"
            m <= 5 -> "printemps"
            m <= 8 -> "ete"
            else -> "automne"
        }
    }
}
