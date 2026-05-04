package com.pixelquest.shared

/**
 * Constantes de game design.
 *
 * NOTE : Ces valeurs DOIVENT rester synchronisées avec
 * `preview/js/engine.js` (CONFIG). Les tests JVM et navigateur valident
 * indépendamment les mêmes formules.
 */
object Config {
    const val XP_BASE: Int = 100
    const val XP_GROWTH: Double = 1.18
    const val XP_PER_STEP: Double = 1.0
    const val COIN_PER_100_STEPS: Double = 5.0
    const val DAILY_BONUS_THRESHOLD: Int = 8000
    const val DAILY_BONUS_MULT: Double = 2.0
    const val INVENTORY_SOFT_CAP: Int = 25
    const val INVENTORY_HARD_CAP: Int = 40
    const val ENCUMBRANCE_PENALTY: Double = 1.10
    const val MAX_STEPS_PER_MINUTE: Int = 220
    const val MAX_STEPS_PER_SECOND: Int = 5
    const val SUSPICIOUS_BURST: Int = 500
    const val WEEKLY_BOSS_BASE_HP: Int = 75_000
}
