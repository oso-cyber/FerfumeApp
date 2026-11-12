package com.example.ferfume.ui.notifications

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.ferfume.*
import com.example.ferfume.databinding.FragmentNotificationsBinding
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso
import java.text.SimpleDateFormat
import java.util.*

class NotificationsFragment : Fragment() {

    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!

    private val db = FirebaseFirestore.getInstance()
    private val currentUser = FirebaseAuth.getInstance().currentUser

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        val root: View = binding.root

        displayUserInfo()
        setupClickListeners()
        loadFavoriteProducts()
        loadUserOrders()

        return root
    }

    // -------------------- Display Logged-in User Info --------------------
    private fun displayUserInfo() {
        currentUser?.let { user ->
            val userId = user.uid
            val userEmail = user.email ?: "No email available"
            val userNameFromAuth = user.displayName ?: ""

            db.collection("users").document(userId).get()
                .addOnSuccessListener { doc ->
                    val username = doc.getString("username")

                    val displayName = when {
                        !username.isNullOrBlank() -> username
                        !userNameFromAuth.isBlank() -> userNameFromAuth
                        else -> userEmail.substringBefore("@")
                    }

                    binding.userName.text = displayName
                    binding.userHandle.text = userEmail
                }
                .addOnFailureListener {
                    val fallbackName = if (userNameFromAuth.isNotBlank()) userNameFromAuth
                    else userEmail.substringBefore("@")

                    binding.userName.text = fallbackName
                    binding.userHandle.text = userEmail
                }
        } ?: run {
            binding.userName.text = "Guest"
            binding.userHandle.text = "Not logged in"
        }
    }

    // -------------------- Click Listeners --------------------
    private fun setupClickListeners() {
        binding.faq.setOnClickListener {
            startActivity(Intent(requireContext(), Faq::class.java))
        }

        binding.contacti.setOnClickListener {
            startActivity(Intent(requireContext(), Contact::class.java))
        }

        binding.Privacy.setOnClickListener {
            startActivity(Intent(requireContext(), PrivacyPolicy::class.java))
        }

        binding.Tos.setOnClickListener {
            startActivity(Intent(requireContext(), TosPolicy::class.java))
        }

        // Sign out button
        binding.editProfileButton.setOnClickListener {
            FirebaseAuth.getInstance().signOut()
            val intent = Intent(requireContext(), MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }

        // Full logout & delete account button
        binding.logoutButton.setOnClickListener {
            currentUser?.let { user ->
                db.collection("users").document(user.uid).delete()
                    .addOnSuccessListener {
                        user.delete().addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                val intent = Intent(requireContext(), MainActivity::class.java)
                                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                                startActivity(intent)
                            }
                        }
                    }
            }
        }
    }

    // -------------------- Load User Favorites --------------------
    private fun loadFavoriteProducts() {
        currentUser?.let { user ->
            val favoritesRef = db.collection("users").document(user.uid).collection("favorites")

            favoritesRef.get()
                .addOnSuccessListener { snapshot ->
                    val favoriteList = snapshot.documents.map { doc ->
                        val priceValue = doc.get("price")
                        val priceDouble = when (priceValue) {
                            is Double -> priceValue
                            is Long -> priceValue.toDouble()
                            is String -> priceValue.toDoubleOrNull() ?: 0.0
                            else -> 0.0
                        }

                        Product(
                            id = doc.getString("id") ?: "",
                            name = doc.getString("name") ?: "",
                            brand = doc.getString("brand") ?: "",
                            price = priceDouble,
                            imageUrl = doc.getString("imageUrl") ?: "",
                            description = doc.getString("description") ?: ""
                        )
                    }

                    binding.tvNoFavorites.visibility = if (favoriteList.isEmpty()) View.VISIBLE else View.GONE
                    binding.albumsRecyclerView.visibility = if (favoriteList.isEmpty()) View.GONE else View.VISIBLE

                    binding.albumsRecyclerView.apply {
                        layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
                        setHasFixedSize(true)
                        adapter = FavoriteAdapter(favoriteList) {
                            startActivity(Intent(requireContext(), FavoritesActivity::class.java))
                        }
                    }
                }
                .addOnFailureListener {
                    binding.tvNoFavorites.text = "Failed to load favorites."
                    binding.tvNoFavorites.visibility = View.VISIBLE
                    binding.albumsRecyclerView.visibility = View.GONE
                }
        }
    }

    // -------------------- Load User Orders --------------------
    private fun loadUserOrders() {
        currentUser?.let { user ->
            val ordersRef = db.collection("users").document(user.uid).collection("orders")

            ordersRef.get()
                .addOnSuccessListener { snapshot ->
                    val ordersList = mutableListOf<OrderDisplayItem>()

                    if (snapshot.isEmpty) {
                        binding.tvNoOrders.visibility = View.VISIBLE
                        binding.journeysRecyclerView.visibility = View.GONE
                        return@addOnSuccessListener
                    }

                    for (doc in snapshot.documents) {
                        val details = doc.get("details") as? Map<String, Any> ?: emptyMap()
                        val firstItem = details.entries.firstOrNull()

                        val order = OrderDisplayItem(
                            name = firstItem?.key ?: "Unknown Item",
                            details = firstItem?.value.toString(),
                            status = doc.getString("status") ?: "Pending"
                        )
                        ordersList.add(order)
                    }

                    binding.tvNoOrders.visibility = View.GONE
                    binding.journeysRecyclerView.visibility = View.VISIBLE

                    binding.journeysRecyclerView.apply {
                        layoutManager = LinearLayoutManager(requireContext())
                        adapter = OrderAdapter(ordersList) {
                            startActivity(Intent(requireContext(), Orders::class.java))
                        }
                    }
                }
                .addOnFailureListener {
                    binding.tvNoOrders.text = "Failed to load orders."
                    binding.tvNoOrders.visibility = View.VISIBLE
                    binding.journeysRecyclerView.visibility = View.GONE
                }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

// -------------------- Adapters & Models --------------------
class FavoriteAdapter(
    private val favoriteList: List<Product>,
    private val onItemClick: (Product) -> Unit
) : RecyclerView.Adapter<FavoriteAdapter.FavoriteViewHolder>() {

    class FavoriteViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameTextView: TextView = itemView.findViewById(R.id.textViewProductName)
        val brandTextView: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val priceTextView: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val imageView: ImageView = itemView.findViewById(R.id.productImage)
        val heartIcon: ImageView = itemView.findViewById(R.id.heartIcon)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FavoriteViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return FavoriteViewHolder(view)
    }

    override fun onBindViewHolder(holder: FavoriteViewHolder, position: Int) {
        val product = favoriteList[position]
        holder.nameTextView.text = product.name
        holder.brandTextView.text = product.brand
        holder.priceTextView.text = "R${product.price}"

        if (product.imageUrl.isNotBlank()) {
            Picasso.get().load(product.imageUrl)
                .placeholder(R.drawable.img_45)
                .error(R.drawable.img_45)
                .fit()
                .centerCrop()
                .into(holder.imageView)
        } else {
            holder.imageView.setImageResource(R.drawable.img_45)
        }

        holder.heartIcon.setImageResource(R.drawable.ic_heart_filled)
        holder.itemView.setOnClickListener { onItemClick(product) }
    }

    override fun getItemCount() = favoriteList.size
}

class OrderAdapter(
    private val orders: List<OrderDisplayItem>,
    private val onClick: (OrderDisplayItem) -> Unit
) : RecyclerView.Adapter<OrderAdapter.OrderViewHolder>() {

    class OrderViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvOrderId: TextView = itemView.findViewById(R.id.tvOrderId)
        val tvOrderStatus: TextView = itemView.findViewById(R.id.tvOrderStatus)
        val tvOrderType: TextView = itemView.findViewById(R.id.tvOrderType)
        val tvOrderDate: TextView = itemView.findViewById(R.id.tvOrderDate)
        val tvOrderPrice: TextView = itemView.findViewById(R.id.tvOrderPrice)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_order, parent, false)
        return OrderViewHolder(view)
    }

    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        val order = orders[position]
        holder.tvOrderId.text = "Order #${position + 1}"
        holder.tvOrderStatus.text = "Status: ${order.status.replaceFirstChar { it.uppercase() }}"
        holder.tvOrderType.text =
            "Type: ${if (order.details.contains("custom", true)) "Custom Order" else "Normal Order"}"
        holder.tvOrderDate.text = "Date: ${SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())}"
        holder.tvOrderPrice.text = "Total: R${(100..999).random()}.99"
        holder.itemView.setOnClickListener { onClick(order) }
    }

    override fun getItemCount() = orders.size
}

// -------------------- Data Models --------------------
data class Product(
    val id: String = "",
    val name: String = "",
    val brand: String = "",
    val price: Double = 0.0,
    val imageUrl: String = "",
    val description: String = ""
)

data class OrderDisplayItem(
    val name: String,
    val details: String,
    val status: String
)
