package com.pixelquest.phone.sync

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.pixelquest.shared.PlayerState
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * Pont de synchro Phone <-> Wear via la Data Layer API.
 *
 * On stocke l'état de jeu sérialisé (JSON) dans une `DataItem` à un chemin
 * `/pixelquest/state`. Les deux côtés (phone + wear) écoutent cet item ;
 * dès qu'il change, le côté qui n'a pas écrit met à jour son état local.
 *
 * C'est volontairement minimal : pas de conflit complexe, le dernier
 * writer gagne. Le moteur de jeu est déterministe et idempotent à partir
 * du même `lifetimeSteps`, donc divergences sont rares.
 */
class WearSyncBridge(ctx: Context) {

    companion object {
        const val PATH = "/pixelquest/state"
        const val KEY = "state_json"
    }

    private val dataClient: DataClient = Wearable.getDataClient(ctx)
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private var listener: ((PlayerState) -> Unit)? = null

    private val dcListener = DataClient.OnDataChangedListener { events: DataEventBuffer ->
        for (e in events) {
            if (e.type == DataEvent.TYPE_CHANGED && e.dataItem.uri.path == PATH) {
                val map = DataMapItem.fromDataItem(e.dataItem).dataMap
                val raw = map.getString(KEY) ?: continue
                runCatching {
                    val state = json.decodeFromString<PlayerState>(raw)
                    listener?.invoke(state)
                }
            }
        }
    }

    init {
        dataClient.addListener(dcListener)
    }

    fun onRemoteState(cb: (PlayerState) -> Unit) {
        listener = cb
    }

    suspend fun publish(state: PlayerState) {
        val raw = json.encodeToString(state)
        val req = PutDataMapRequest.create(PATH).apply {
            dataMap.putString(KEY, raw)
            dataMap.putLong("ts", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        suspendCoroutine<Unit> { cont ->
            dataClient.putDataItem(req)
                .addOnSuccessListener { cont.resume(Unit) }
                .addOnFailureListener { cont.resume(Unit) }
        }
    }
}
