package com.example.ferfume.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.ferfume.Payment
import com.example.ferfume.R
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.squareup.picasso.Picasso

class DashboardFragment : Fragment() {

    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val cartItems = mutableListOf<CartItem>()
    private lateinit var cartItemAdapter: CartItemAdapter
    private lateinit var checkoutButton: Button
    private lateinit var subtotalTextView: TextView

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        val root = inflater.inflate(R.layout.fragment_dashboard, container, false)

        val cartRecyclerView: RecyclerView = root.findViewById(R.id.cartRecyclerView)
        checkoutButton = root.findViewById(R.id.checkoutButton)
        subtotalTextView = root.findViewById(R.id.cartSubtotalValue)

        cartItemAdapter = CartItemAdapter(cartItems) {
            recalculateSubtotal() // callback whenever an item is deleted
        }

        cartRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        cartRecyclerView.adapter = cartItemAdapter

        checkoutButton.setOnClickListener {
            val subtotal = cartItems.sumOf { it.price * it.quantity }
            val email = auth.currentUser?.email ?: "testuser@example.com"
            val amountInCents = (subtotal * 100).toInt()

            val intent = Intent(requireContext(), Payment::class.java).apply {
                putExtra("amount", amountInCents)
                putExtra("email", email)
            }
            startActivity(intent)
        }

        fetchCartItems()
        return root
    }

    private fun fetchCartItems() {
        val userId = auth.currentUser?.uid ?: return
        db.collection("users").document(userId).collection("cart")
            .get(Source.DEFAULT)
            .addOnSuccessListener { result ->
                cartItems.clear()
                for (doc in result) {
                    val price = when (val value = doc.get("price")) {
                        is Double -> value
                        is Long -> value.toDouble()
                        is String -> value.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    }
                    val quantity = (doc.getLong("quantity") ?: 0L).toInt()
                    cartItems.add(
                        CartItem(
                            docId = doc.id,
                            productId = doc.getString("productId") ?: "",
                            name = doc.getString("name") ?: "",
                            brand = doc.getString("brand") ?: "",
                            price = price,
                            scent = doc.getString("scent") ?: "",
                            imageUrl = doc.getString("imageUrl") ?: "",
                            quantity = quantity
                        )
                    )
                }
                cartItemAdapter.notifyDataSetChanged()
                recalculateSubtotal()
            }
    }

    private fun recalculateSubtotal() {
        val subtotal = cartItems.sumOf { it.price * it.quantity }
        subtotalTextView.text = "Subtotal: R${"%.2f".format(subtotal)}"
    }
}

// -------------------- Cart Item --------------------
data class CartItem(
    var docId: String = "",
    val productId: String = "",
    val name: String = "",
    val brand: String = "",
    val price: Double = 0.0,
    val scent: String = "",
    val imageUrl: String = "",
    val quantity: Int = 0
)

// -------------------- Adapter --------------------
class CartItemAdapter(
    private val items: MutableList<CartItem>,
    private val onCartUpdated: () -> Unit  // callback to notify fragment
) : RecyclerView.Adapter<CartItemAdapter.CartItemViewHolder>() {

    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    inner class CartItemViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val productImage: ImageView = itemView.findViewById(R.id.productImage)
        private val productName: TextView = itemView.findViewById(R.id.textViewProductName)
        private val productBrand: TextView = itemView.findViewById(R.id.textViewProductBrand)
        private val productPrice: TextView = itemView.findViewById(R.id.textViewProductPrice)
        private val productScent: TextView = itemView.findViewById(R.id.textViewProductScent)
        private val productQuantity: TextView = itemView.findViewById(R.id.textViewProductQuantity)
        private val deleteButton: ImageButton = itemView.findViewById(R.id.heartButton)

        fun bind(cartItem: CartItem) {
            productName.text = cartItem.name
            productBrand.text = cartItem.brand
            productPrice.text = "R${cartItem.price}"
            productScent.text = cartItem.scent
            productQuantity.text = "Qty: ${cartItem.quantity}"

            if (cartItem.imageUrl.isNotBlank()) {
                Picasso.get()
                    .load(cartItem.imageUrl)
                    .placeholder(R.drawable.img_13)
                    .error(R.drawable.img_13)
                    .fit()
                    .centerCrop()
                    .into(productImage)
            } else {
                productImage.setImageResource(R.drawable.img_13)
            }

            deleteButton.setOnClickListener {
                val userId = auth.currentUser?.uid ?: return@setOnClickListener
                db.collection("users").document(userId).collection("cart")
                    .document(cartItem.docId)
                    .delete()
                    .addOnSuccessListener {
                        val pos = bindingAdapterPosition
                        if (pos != RecyclerView.NO_POSITION) {
                            items.removeAt(pos)
                            notifyItemRemoved(pos)
                            onCartUpdated() // recalc subtotal
                        }
                    }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        CartItemViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_cart, parent, false))

    override fun onBindViewHolder(holder: CartItemViewHolder, position: Int) =
        holder.bind(items[position])

    override fun getItemCount() = items.size
}
