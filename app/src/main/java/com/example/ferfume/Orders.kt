package com.example.ferfume

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

class Orders : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var spinnerOrderType: Spinner
    private lateinit var adapter: OrdersAdapter1
    private val ordersList = mutableListOf<OrderItem1>()

    private val db = FirebaseFirestore.getInstance()
    private val currentUser = FirebaseAuth.getInstance().currentUser

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_orders)

        spinnerOrderType = findViewById(R.id.spinnerOrderType)
        recyclerView = findViewById(R.id.recyclerViewOrders)
        recyclerView.layoutManager = LinearLayoutManager(this)
        adapter = OrdersAdapter1(ordersList)
        recyclerView.adapter = adapter

        val orderTypes = listOf("All", "Custom Orders", "Normal Orders")
        val spinnerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, orderTypes)
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerOrderType.adapter = spinnerAdapter

        spinnerOrderType.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>?,
                view: View?,
                position: Int,
                id: Long
            ) {
                loadOrders(orderTypes[position])
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

    }

    private fun loadOrders(filterType: String) {
        val user = currentUser ?: return
        val userId = user.uid
        ordersList.clear()

        db.collection("orders")
            .whereEqualTo("userId", userId)
            .get()
            .addOnSuccessListener { snapshot ->
                for (doc in snapshot.documents) {
                    val type = doc.getString("type") ?: "Normal"
                    val status = doc.getString("status") ?: "Pending"
                    val subtotal = doc.getDouble("subtotal") ?: 0.0
                    val timestamp = doc.getLong("createdAt") ?: System.currentTimeMillis()
                    val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(timestamp))

                    if (filterType == "All" || filterType.contains(type, ignoreCase = true)) {
                        ordersList.add(
                            OrderItem1(
                                id = doc.id,
                                type = type,
                                status = status,
                                date = date,
                                price = subtotal
                            )
                        )
                    }
                }

                if (ordersList.isEmpty()) {
                    Toast.makeText(this, "No orders found for \"$filterType\"", Toast.LENGTH_SHORT).show()
                }

                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load orders", Toast.LENGTH_SHORT).show()
            }
    }

}

// Data Model
data class OrderItem1(
    val id: String,
    val type: String,
    val status: String,
    val date: String,
    val price: Double
)

// Adapter
class OrdersAdapter1(private val orders: List<OrderItem1>) :
    RecyclerView.Adapter<OrdersAdapter1.OrderViewHolder>() {

    class OrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvOrderId: TextView = itemView.findViewById(R.id.tvOrderId)
        val tvOrderStatus: TextView = itemView.findViewById(R.id.tvOrderStatus)
        val tvOrderType: TextView = itemView.findViewById(R.id.tvOrderType)
        val tvOrderDate: TextView = itemView.findViewById(R.id.tvOrderDate)
        val tvOrderPrice: TextView = itemView.findViewById(R.id.tvOrderPrice)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_order, parent, false)
        return OrderViewHolder(view)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        val order = orders[position]

        holder.tvOrderId.text = "Order #${order.id.take(6)}"
        holder.tvOrderType.text = "Type: ${order.type}"
        holder.tvOrderDate.text = "Date: ${order.date}"
        holder.tvOrderPrice.text = "Total: R${String.format("%.2f", order.price)}"
        holder.tvOrderStatus.text = "Status: ${order.status}"

        when (order.status.lowercase(Locale.ROOT)) {
            "approved" -> holder.tvOrderStatus.setTextColor(Color.parseColor("#388E3C"))
            "pending" -> holder.tvOrderStatus.setTextColor(Color.parseColor("#FF9800"))
            "rejected" -> holder.tvOrderStatus.setTextColor(Color.parseColor("#D32F2F"))
            else -> holder.tvOrderStatus.setTextColor(Color.GRAY)
        }
    }

    override fun getItemCount(): Int = orders.size
}
