package com.pixelquest.wear

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.pixelquest.shared.Invariants
import com.pixelquest.shared.PlayerState
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/** Pendant Wear de WearSyncBridge. */
class WearSync(ctx: Context) {

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
                    Invariants.autoFix(state)
                    listener?.invoke(state)
                }
            }
        }
    }

    init { dataClient.addListener(dcListener) }

    fun onState(cb: (PlayerState) -> Unit) { listener = cb }

    suspend fun publish(state: PlayerState) {
        val req = PutDataMapRequest.create(PATH).apply {
            dataMap.putString(KEY, json.encodeToString(state))
            dataMap.putLong("ts", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        suspendCoroutine<Unit> { cont ->
            dataClient.putDataItem(req)
                .addOnSuccessListener { cont.resume(Unit) }
                .addOnFailureListener { cont.resume(Unit) }
        }
    }
}
