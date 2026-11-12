package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.view.animation.AnimationUtils
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.ferfume.databinding.ActivityFavoritesBinding
import com.example.ferfume.ui.notifications.FavoriteAdapter
import com.example.ferfume.ui.notifications.Product
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class FavoritesActivity : AppCompatActivity() {

    private lateinit var binding: ActivityFavoritesBinding
    private val db = FirebaseFirestore.getInstance()
    private val currentUser = FirebaseAuth.getInstance().currentUser

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFavoritesBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()

        setupToolbar()
        loadFavorites()
    }

    private fun setupRecyclerView() {
        binding.recyclerViewFavorites.layoutManager =
            LinearLayoutManager(this, LinearLayoutManager.VERTICAL, false)
        binding.recyclerViewFavorites.setHasFixedSize(true)
    }



    private fun setupToolbar() {
        binding.topAppBar.setNavigationOnClickListener { finish() }
    }

    private fun loadFavorites() {
        if (currentUser == null) return

        db.collection("users")
            .document(currentUser.uid)
            .collection("favorites")
            .get()
            .addOnSuccessListener { snapshot ->
                val favorites = snapshot.documents.map { doc ->
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

                val adapter = FavoriteAdapter(favorites) { product ->
                    val intent = Intent(this, ItemViewActivity::class.java).apply {
                        putExtra("productId", product.id)
                        putExtra("product_name", product.name)
                        putExtra("product_brand", product.brand)
                        putExtra("product_price", product.price)
                        putExtra("product_description", product.description)
                        putExtra("product_image_url", product.imageUrl)
                    }
                    startActivity(intent)
                }

                binding.recyclerViewFavorites.adapter = adapter
            }
            .addOnFailureListener { e ->
                e.printStackTrace()
            }
    }
}
