package com.pixelquest.shared

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GameEngineTest {

    /** Timestamp "maintenant" stable pour les tests : on l'aligne sur la
     *  dailyKey/weekKey calculée au moment de la création de PlayerState
     *  pour éviter les rotations parasites. */
    private fun now(): Long = System.currentTimeMillis()

    @Test fun `xp curve is strictly increasing`() {
        for (l in 1 until 50) {
            assertTrue(GameEngine.xpForLevel(l + 1) > GameEngine.xpForLevel(l),
                "xpForLevel(${l+1}) should be > xpForLevel($l)")
        }
    }

    @Test fun `levelFromTotalXp round trip`() {
        for (n in 1..30) {
            val total = GameEngine.totalXpToReach(n)
            val r = GameEngine.levelFromTotalXp(total)
            assertEquals(n, r.level, "round trip failed at $n")
        }
    }

    @Test fun `antifraud rejects 5000 step burst`() {
        val s = PlayerState()
        val v = GameEngine.validateSteps(s, 5000, now())
        assertFalse(v.ok)
        assertTrue(v.accepted < 5000)
    }

    @Test fun `antifraud rejects high cadence`() {
        val s = PlayerState()
        val t0 = now()
        for (i in 0 until 5) GameEngine.ingestSteps(s, 80, t0 + i * 1000L)
        assertTrue(s.flags.isNotEmpty(), "should have raised flags")
    }

    @Test fun `normal cadence accepted`() {
        val s = PlayerState()
        val t0 = now()
        for (i in 0 until 5) GameEngine.ingestSteps(s, 10, t0 + i * 60_000L)
        assertEquals(0, s.flags.size, "no flag should be raised")
        assertEquals(50, s.totalSteps)
    }

    @Test fun `daily threshold doubles xp`() {
        val s = PlayerState()
        // On force le dailyKey à la date courante pour éviter rotation
        s.dailyKey = TimeKeys.dayKey(java.time.Instant.now())
        s.dailySteps = Config.DAILY_BONUS_THRESHOLD
        var totalXp = 0
        val t0 = now()
        for (i in 0 until 5) {
            val r = GameEngine.ingestSteps(s, 20, t0 + i * 60_000L)
            totalXp += r.gainedXp
        }
        assertTrue(s.doubledToday)
        assertTrue(totalXp >= 150, "expected >=150 xp, got $totalXp")
    }

    @Test fun `encumbrance applies penalty`() {
        val s = PlayerState()
        repeat(Config.INVENTORY_SOFT_CAP) { GameEngine.addItem(s, "piece", 1) }
        val r = GameEngine.ingestSteps(s, 110, now())
        assertTrue(r.gainedXp <= 110)
    }

    @Test fun `shop buy then sell`() {
        val s = PlayerState().apply { coins = 1000 }
        val before = s.coins
        val buy = GameEngine.buy(s, "epee_bois")
        assertTrue(buy.ok)
        assertEquals(before - 80, s.coins)
        val sell = GameEngine.sell(s, "epee_bois")
        assertTrue(sell.ok)
        assertEquals(32, sell.refund)
    }

    @Test fun `raid takes damage`() {
        val s = PlayerState()
        val before = s.raid.hp
        GameEngine.ingestSteps(s, 100, now())
        assertTrue(s.raid.hp < before)
    }

    @Test fun `quest progress and turn-in`() {
        val s = PlayerState()
        assertTrue(GameEngine.acceptQuest(s, "q_walk_500"))
        val t0 = now()
        for (i in 0 until 5) GameEngine.ingestSteps(s, 100, t0 + i * 60_000L)
        val q = s.activeQuests.first { it.id == "q_walk_500" }
        assertTrue(q.progress >= 500)
        val r = GameEngine.turnInQuest(s, "q_walk_500")
        assertTrue(r.ok)
        assertTrue(s.completedQuests.contains("q_walk_500"))
    }

    @Test fun `achievements trigger`() {
        val s = PlayerState()
        s.totalSteps = 100
        GameEngine.refreshAchievements(s)
        assertTrue(s.achievements.contains("premiers_pas"))
    }

    @Test fun `30-day simulation keeps invariants valid`() {
        val s = PlayerState().apply {
            character = CharacterAppearance(name = "TestHero", classId = "mage")
        }
        GameEngine.acceptQuest(s, "q_walk_500")
        var t = 1_700_000_000_000L
        for (day in 0 until 30) {
            for (chunk in 0 until 60) {
                GameEngine.ingestSteps(s, 80, t)
                t += 60_000
            }
            t += 14L * 60 * 60 * 1000
        }
        val reports = Invariants.runAll(s)
        val bad = reports.filter { !it.ok }
        assertTrue(bad.isEmpty(), "broken invariants: ${bad.map { it.id }}")
        assertTrue(s.level > 10, "expected level >10 after 30 days, got ${s.level}")
    }
}
