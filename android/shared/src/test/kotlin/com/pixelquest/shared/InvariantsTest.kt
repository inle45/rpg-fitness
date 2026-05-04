package com.pixelquest.shared

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class InvariantsTest {

    @Test fun `default state passes all invariants`() {
        val s = PlayerState()
        val reports = Invariants.runAll(s)
        val bad = reports.filter { !it.ok }
        assertTrue(bad.isEmpty(), "broken: ${bad.map { it.id }}")
    }

    @Test fun `auto-fix repairs negative xp`() {
        val s = PlayerState()
        s.xp = -100
        val fixed = Invariants.autoFix(s)
        assertTrue("xp_non_negative" in fixed)
        assertEquals(0, s.xp)
    }

    @Test fun `auto-fix repairs out-of-bounds position`() {
        val s = PlayerState()
        s.pos.x = 999; s.pos.y = -7
        Invariants.autoFix(s)
        assertTrue(s.pos.x in 0..8)
        assertTrue(s.pos.y in 0..8)
    }

    @Test fun `auto-fix levels up if xp overflowed`() {
        val s = PlayerState()
        s.xp = 10_000
        s.level = 1
        Invariants.autoFix(s)
        assertTrue(s.level > 1)
        assertTrue(s.xp < GameEngine.xpForLevel(s.level))
    }

    @Test fun `auto-fix removes duplicate quests`() {
        val s = PlayerState()
        s.activeQuests.add(QuestProgress("q_walk_500", 100))
        s.activeQuests.add(QuestProgress("q_walk_500", 200))
        Invariants.autoFix(s)
        assertEquals(1, s.activeQuests.size)
    }

    @Test fun `auto-fix removes zero qty inventory`() {
        val s = PlayerState()
        s.inventory.add(InventoryEntry("piece", 0))
        Invariants.autoFix(s)
        assertTrue(s.inventory.none { it.id == "piece" })
    }

    @Test fun `auto-fix repairs unknown weather`() {
        val s = PlayerState()
        s.weatherId = "tornado_de_chats"
        Invariants.autoFix(s)
        assertEquals("soleil", s.weatherId)
    }
}
