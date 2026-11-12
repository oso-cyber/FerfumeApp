package com.example.ferfume

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

class AdminOrders : AppCompatActivity() {

    private lateinit var spinnerOrderType: Spinner
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: AdminOrdersAdapter
    private val ordersList = mutableListOf<OrderItem>()

    private val db = FirebaseFirestore.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_orders)

        spinnerOrderType = findViewById(R.id.spinnerOrderType)
        recyclerView = findViewById(R.id.recyclerViewOrders)
        recyclerView.layoutManager = LinearLayoutManager(this)
        adapter = AdminOrdersAdapter(ordersList) { order, action ->
            updateOrderStatus(order, action)
        }
        recyclerView.adapter = adapter

        val orderTypes = listOf("Normal Orders", "Custom Orders")
        spinnerOrderType.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, orderTypes)

        spinnerOrderType.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>?, view: View?, position: Int, id: Long
            ) {
                val type = orderTypes[position]
                fetchOrders(type)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun fetchOrders(type: String) {
        val collectionPath = if (type == "Custom Orders") "custom_orders" else "orders"
        db.collectionGroup(collectionPath)
            .get()
            .addOnSuccessListener { result ->
                ordersList.clear()
                for (doc in result) {
                    val order = doc.toObject(OrderItem::class.java)
                    order.docId = doc.id
                    order.userId = doc.reference.parent.parent?.id ?: ""
                    order.isCustom = type == "Custom Orders"
                    ordersList.add(order)
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Failed to load orders: ${e.message}", Toast.LENGTH_LONG)
                    .show()
            }
    }

    private fun updateOrderStatus(order: OrderItem, newStatus: String) {
        val collectionPath = if (order.isCustom) "custom_orders" else "orders"
        db.collection(collectionPath)
            .document(order.docId)
            .update("status", newStatus)
            .addOnSuccessListener {
                order.status = newStatus
                adapter.notifyDataSetChanged()
                Toast.makeText(this, "Order ${newStatus.capitalize()}", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Failed to update status: ${e.message}", Toast.LENGTH_LONG).show()
            }
    }

}

// ---------------- Data Model ----------------
data class OrderItem(
    var docId: String = "",
    var userId: String = "",
    var isCustom: Boolean = false,
    var details: Map<String, Any> = emptyMap(),
    var status: String = "pending",
    var timestamp: Long = 0L
)

// ---------------- Adapter ----------------
class AdminOrdersAdapter(
    private val orders: List<OrderItem>,
    private val onActionClick: (OrderItem, String) -> Unit
) : RecyclerView.Adapter<AdminOrdersAdapter.OrderViewHolder>() {

    inner class OrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val orderIdText: TextView = itemView.findViewById(R.id.textOrderId)
        val detailsText: TextView = itemView.findViewById(R.id.textOrderDetails)
        val statusText: TextView = itemView.findViewById(R.id.textOrderStatus)
        val timestampText: TextView = itemView.findViewById(R.id.textOrderTimestamp)
        val approveButton: Button = itemView.findViewById(R.id.btnApprove)
        val rejectButton: Button = itemView.findViewById(R.id.btnReject)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_admin_order, parent, false)
        return OrderViewHolder(view)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        val order = orders[position]

        holder.orderIdText.text = "Order ID: ${order.docId}"
        holder.detailsText.text =
            if (order.details.isNotEmpty())
                order.details.entries.joinToString("\n") { "${it.key}: ${it.value}" }
            else
                "No details available"

        holder.statusText.text = "Status: ${order.status.capitalize()}"

        val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault())
        holder.timestampText.text = "Ordered: ${sdf.format(Date(order.timestamp))}"

        holder.approveButton.setOnClickListener { onActionClick(order, "approved") }
        holder.rejectButton.setOnClickListener { onActionClick(order, "rejected") }
    }

    override fun getItemCount(): Int = orders.size
}
