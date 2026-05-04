package com.pixelquest.phone.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pixelquest.phone.data.AndroidStateRepository
import com.pixelquest.phone.sync.WearSyncBridge
import com.pixelquest.shared.GameEngine
import com.pixelquest.shared.Invariants
import com.pixelquest.shared.PlayerState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class GameViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = AndroidStateRepository(app)
    private val sync = WearSyncBridge(app)

    private val _state = MutableStateFlow(repo.load())
    val state = _state.asStateFlow()

    init {
        // À chaque changement reçu de la montre, on remplace l'état local.
        sync.onRemoteState { remote ->
            _state.value = remote
            repo.save(remote)
        }
    }

    private fun mutate(block: (PlayerState) -> Unit) {
        val current = _state.value
        block(current)
        Invariants.autoFix(current)
        repo.save(current)
        _state.value = current.copy()
        viewModelScope.launch { sync.publish(current) }
    }

    fun ingestSteps(n: Int) = mutate { GameEngine.ingestSteps(it, n, System.currentTimeMillis()) }
    fun acceptQuest(id: String) = mutate { GameEngine.acceptQuest(it, id) }
    fun turnInQuest(id: String) = mutate { GameEngine.turnInQuest(it, id) }
    fun buy(id: String) = mutate { GameEngine.buy(it, id) }
    fun sell(id: String) = mutate { GameEngine.sell(it, id) }
    fun fight(id: String) = mutate { GameEngine.fight(it, id) }
    fun setCharacter(transform: (PlayerState) -> Unit) = mutate(transform)
}
