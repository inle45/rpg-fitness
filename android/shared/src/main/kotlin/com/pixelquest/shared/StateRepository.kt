package com.pixelquest.shared

/**
 * Façade abstraite pour persistance + sync. L'app phone et wear injectent
 * leur propre implémentation (DataStore + Wearable.DataClient sur Android,
 * localStorage + EventTarget en preview JS).
 */
interface StateRepository {
    fun load(): PlayerState
    fun save(state: PlayerState)
    fun observe(callback: (PlayerState) -> Unit)
    fun emit(state: PlayerState)
}
