package com.pixelquest.phone.data

import android.content.Context
import com.pixelquest.shared.Invariants
import com.pixelquest.shared.PlayerState
import com.pixelquest.shared.StateRepository
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Persistance simple via SharedPreferences pour la phase prototype.
 * Pour la prod : migrer vers DataStore + Proto si nécessaire.
 */
class AndroidStateRepository(private val ctx: Context) : StateRepository {

    private val prefs = ctx.getSharedPreferences("pixelquest", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = true }
    private val listeners = mutableListOf<(PlayerState) -> Unit>()

    override fun load(): PlayerState {
        val raw = prefs.getString("state", null) ?: return PlayerState()
        return try {
            val state = json.decodeFromString<PlayerState>(raw)
            Invariants.autoFix(state)
            state
        } catch (_: Exception) {
            PlayerState()
        }
    }

    override fun save(state: PlayerState) {
        Invariants.autoFix(state)
        prefs.edit().putString("state", json.encodeToString(state)).apply()
    }

    override fun observe(callback: (PlayerState) -> Unit) {
        listeners.add(callback)
    }

    override fun emit(state: PlayerState) {
        listeners.forEach { it(state) }
    }
}
