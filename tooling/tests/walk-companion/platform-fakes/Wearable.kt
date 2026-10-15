@file:Suppress("UNUSED_PARAMETER")
package com.google.android.gms.wearable

import android.content.Context
import android.os.Handler
import android.os.Looper

/** Controllable Task boundary. Registered listeners always run through main. */
class Task<T> {
    private val success = mutableListOf<(T) -> Unit>()
    private val failure = mutableListOf<(Exception) -> Unit>()
    private var completed = false
    fun addOnSuccessListener(body: (T) -> Unit): Task<T> { check(!completed); success.add(body); return this }
    fun addOnFailureListener(body: (Exception) -> Unit): Task<T> { check(!completed); failure.add(body); return this }
    fun succeed(value: T) { check(!completed); completed = true; success.forEach { callback -> Handler(Looper.getMainLooper()).post { callback(value) } } }
    fun fail() { check(!completed); completed = true; failure.forEach { callback -> Handler(Looper.getMainLooper()).post { callback(IllegalStateException("Controlled transport failure")) } } }
}
data class Node(val id: String)
data class CapabilityInfo(val nodes: Set<Node>)
data class MessageEvent(val sourceNodeId: String, val path: String, val data: ByteArray)
class CapabilityClient {
    interface OnCapabilityChangedListener { fun onCapabilityChanged(info: CapabilityInfo) }
    val listeners = mutableSetOf<OnCapabilityChangedListener>()
    data class Lookup(val capability: String, val task: Task<CapabilityInfo>)
    val lookups = mutableListOf<Lookup>()
    fun getCapability(name: String, filter: Int): Task<CapabilityInfo> = Task<CapabilityInfo>().also { lookups.add(Lookup(name, it)) }
    fun addListener(listener: OnCapabilityChangedListener, name: String) { listeners.add(listener) }
    fun removeListener(listener: OnCapabilityChangedListener, name: String) { listeners.remove(listener) }
    fun changed(vararg nodes: String) { listeners.toList().forEach { it.onCapabilityChanged(info(*nodes)) } }
    companion object { const val FILTER_REACHABLE = 1; fun info(vararg nodes: String) = CapabilityInfo(nodes.map(::Node).toSet()) }
}
class MessageClient {
    interface OnMessageReceivedListener { fun onMessageReceived(event: MessageEvent) }
    data class Sent(val node: String, val path: String, val data: ByteArray, val task: Task<Int>) {
        val text get() = data.toString(Charsets.UTF_8)
    }
    val sent = mutableListOf<Sent>()
    val listeners = mutableSetOf<OnMessageReceivedListener>()
    fun sendMessage(node: String, path: String, data: ByteArray): Task<Int> = Task<Int>().also { sent.add(Sent(node, path, data.copyOf(), it)) }
    fun addListener(listener: OnMessageReceivedListener) { listeners.add(listener) }
    fun removeListener(listener: OnMessageReceivedListener) { listeners.remove(listener) }
    fun receive(node: String, path: String, text: String) {
        val event = MessageEvent(node, path, text.toByteArray(Charsets.UTF_8))
        listeners.toList().forEach { it.onMessageReceived(event) }
    }
}
object Wearable {
    class Endpoint(val messages: MessageClient = MessageClient(), val capabilities: CapabilityClient = CapabilityClient())
    private val endpoints = mutableMapOf<Context, Endpoint>()
    fun endpoint(context: Context) = endpoints.getOrPut(context) { Endpoint() }
    fun getMessageClient(context: Context) = endpoint(context).messages
    fun getCapabilityClient(context: Context) = endpoint(context).capabilities
    fun reset() { endpoints.clear() }
}
