package com.example.ferfume

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.*

// ---------------- Activity ----------------
class UserOrders : AppCompatActivity() {

    private val db = FirebaseFirestore.getInstance()
    private lateinit var adapter: UserItemAdapter
    private val userItems = mutableListOf<UserItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_orders)

        val recyclerOrders: RecyclerView = findViewById(R.id.recyclerOrders)
        val cardOrders: View = findViewById(R.id.cardOrders)
        val cardCustomOrders: View = findViewById(R.id.cardCustomOrders)
        val cardMessages: View = findViewById(R.id.cardMessages)
        val tvOrdersTitle: TextView = findViewById(R.id.tvOrdersTitle)

        recyclerOrders.layoutManager = LinearLayoutManager(this)
        adapter = UserItemAdapter(userItems)
        recyclerOrders.adapter = adapter

        val userId = intent.getStringExtra("userId") ?: ""

        if (userId.isEmpty()) {
            Toast.makeText(this, "User ID not found", Toast.LENGTH_SHORT).show()
            return
        }

        // Card click listeners
        cardOrders.setOnClickListener {
            tvOrdersTitle.text = "🧾 Orders"
            fetchOrders(userId, isCustom = false)
        }

        cardCustomOrders.setOnClickListener {
            tvOrdersTitle.text = "🎨 Custom Orders"
            fetchOrders(userId, isCustom = true)
        }

        cardMessages.setOnClickListener {
            tvOrdersTitle.text = "✉️ Support Messages"
            fetchMessages(userId)
        }
    }

    // ---------------- Orders ----------------
    private fun fetchOrders(userId: String, isCustom: Boolean) {
        userItems.clear()
        val collectionName = if (isCustom) "custom_orders" else "orders"

        db.collection("users").document(userId)
            .collection(collectionName)
            .get()
            .addOnSuccessListener { snapshot ->
                for (doc in snapshot) {
                    val productsList = mutableListOf<Product12>()
                    val items = doc.get("items") as? List<Map<String, Any>>
                    items?.forEach { map ->
                        val product = Product12(
                            name = map["name"] as? String,
                            brand = map["brand"] as? String,
                            price = map["price"] as? String,
                            quantity = (map["quantity"] as? Long)?.toInt(),
                            scent = map["scent"] as? String,
                            imageUrl = map["imageUrl"] as? String
                        )
                        productsList.add(product)
                    }

                    val timestamp = doc.get("timestamp")
                    val dateStr = if (timestamp is Timestamp) {
                        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                            .format(timestamp.toDate())
                    } else {
                        "Unknown"
                    }

                    val order = UserItem(
                        id = doc.id,
                        type = if (isCustom) "Custom Order" else "Normal Order",
                        date = dateStr,
                        subtotal = (doc.getDouble("subtotal") ?: 0.0),
                        status = doc.getString("status"),
                        items = productsList
                    )
                    userItems.add(order)
                }

                if (userItems.isEmpty()) {
                    Toast.makeText(this, "No orders found", Toast.LENGTH_SHORT).show()
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load orders", Toast.LENGTH_SHORT).show()
            }
    }

    // ---------------- Messages ----------------
    private fun fetchMessages(userId: String) {
        userItems.clear()

        db.collection("support_messages")
            .whereEqualTo("userId", userId)
            .get()
            .addOnSuccessListener { snapshot ->
                for (doc in snapshot) {
                    val timestamp = doc.get("timestamp")
                    val dateStr = if (timestamp is Timestamp) {
                        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                            .format(timestamp.toDate())
                    } else {
                        "Unknown"
                    }

                    val msg = UserItem(
                        id = doc.id,
                        type = "Message",
                        date = dateStr,
                        message = doc.getString("message")
                    )
                    userItems.add(msg)
                }

                if (userItems.isEmpty()) {
                    Toast.makeText(this, "No messages found", Toast.LENGTH_SHORT).show()
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load messages", Toast.LENGTH_SHORT).show()
            }
    }
}

// ---------------- Data Models ----------------
data class Product12(
    val name: String? = null,
    val brand: String? = null,
    val price: String? = null,
    val quantity: Int? = 0,
    val scent: String? = null,
    val imageUrl: String? = null
)

data class UserItem(
    val id: String = "",
    val type: String = "",
    val date: String = "",
    val subtotal: Double? = null,
    val status: String? = null,
    val items: List<Product12> = emptyList(),
    val message: String? = null
)

// ---------------- Adapter ----------------
class UserItemAdapter(private val items: List<UserItem>) :
    RecyclerView.Adapter<UserItemAdapter.UserItemViewHolder>() {

    class UserItemViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvId: TextView = itemView.findViewById(R.id.tvOrderId)
        val tvType: TextView = itemView.findViewById(R.id.tvOrderType)
        val tvDate: TextView = itemView.findViewById(R.id.tvOrderDate)
        val tvStatus: TextView = itemView.findViewById(R.id.tvOrderStatus)
        val tvSubtotal: TextView = itemView.findViewById(R.id.tvOrderSubtotal)
        val tvProducts: TextView = itemView.findViewById(R.id.tvProductsList)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserItemViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_order1, parent, false)
        return UserItemViewHolder(view)
    }

    override fun onBindViewHolder(holder: UserItemViewHolder, position: Int) {
        val item = items[position]
        holder.tvId.text = "🆔 ${item.id}"
        holder.tvType.text = "📦 ${item.type}"
        holder.tvDate.text = "📅 ${item.date}"
        holder.tvStatus.text = item.status?.let { "Status: $it" } ?: ""
        holder.tvSubtotal.text = item.subtotal?.let { "💰 $it" } ?: ""

        holder.tvProducts.text = if (item.type == "Message") {
            "✉️ ${item.message ?: ""}"
        } else {
            item.items.joinToString("\n") {
                "${it.name ?: "Product"} x${it.quantity} - ${it.price ?: "0"} (Scent: ${it.scent ?: "Unknown"})"
            }
        }
    }

    override fun getItemCount(): Int = items.size
}
