package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.ferfume.databinding.ActivityItemViewBinding
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso

class ItemViewActivity : AppCompatActivity() {

    private lateinit var binding: ActivityItemViewBinding
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private var quantity = 1
    private var currentImageUrl: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityItemViewBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        val productId = intent.getStringExtra("productId") ?: ""

        if (productId.isNotEmpty()) fetchProductDetails(productId)
        else displayIntentData()

        setupQuantitySelector()

        binding.learnMoreButton.setOnClickListener {
            val name = binding.nameTextView.text.toString()
            val price = binding.priceTextView.text.toString().removePrefix("R").toDoubleOrNull() ?: 0.0
            val scent = binding.scentTextView.text.toString()
            addToCart(name, price, scent, quantity)
        }
    }

    private fun fetchProductDetails(productId: String) {
        db.collection("products").document(productId).get()
            .addOnSuccessListener { doc ->
                if (doc.exists()) {
                    val name = doc.getString("name") ?: "Unknown"
                    val price = when (val p = doc.get("price")) {
                        is Double -> p
                        is Long -> p.toDouble()
                        is String -> p.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    }
                    val scent = doc.getString("scent") ?: "Unknown"
                    val desc = doc.getString("description") ?: "No description available"
                    val imageUrl = doc.getString("imageUrl") ?: ""

                    currentImageUrl = imageUrl

                    binding.nameTextView.text = name
                    binding.priceTextView.text = "R$price"
                    binding.scentTextView.text = scent
                    binding.descriptionTextView.text = desc

                    if (imageUrl.isNotBlank()) {
                        Picasso.get()
                            .load(imageUrl)
                            .placeholder(R.drawable.img_45)
                            .error(R.drawable.img_45)
                            .fit()
                            .centerCrop()
                            .into(binding.productImageView)
                    } else binding.productImageView.setImageResource(R.drawable.img_45)
                }
            }
    }

    private fun displayIntentData() {
        val name = intent.getStringExtra("product_name") ?: "Unknown"
        val price = intent.getDoubleExtra("product_price", 0.0)
        val scent = intent.getStringExtra("product_scent") ?: "Unknown"
        val desc = intent.getStringExtra("product_description") ?: "No description available."
        val imageUrl = intent.getStringExtra("product_image_url")

        binding.nameTextView.text = name
        binding.priceTextView.text = "R$price"
        binding.scentTextView.text = scent
        binding.descriptionTextView.text = desc
        currentImageUrl = imageUrl ?: ""

        if (!imageUrl.isNullOrBlank()) {
            Picasso.get()
                .load(imageUrl)
                .placeholder(R.drawable.img_45)
                .error(R.drawable.img_45)
                .fit()
                .centerCrop()
                .into(binding.productImageView)
        } else binding.productImageView.setImageResource(R.drawable.img_45)
    }

    private fun setupQuantitySelector() {
        binding.minusButton.setOnClickListener {
            if (quantity > 1) quantity--
            binding.quantityTextView.text = quantity.toString()
        }
        binding.plusButton.setOnClickListener {
            quantity++
            binding.quantityTextView.text = quantity.toString()
        }
        binding.quantityTextView.text = quantity.toString()
    }

    private fun addToCart(name: String, price: Double, scent: String, quantity: Int) {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            Toast.makeText(this, "Log in to add items to cart.", Toast.LENGTH_SHORT).show()
            return
        }

        val productId = intent.getStringExtra("productId") ?: ""
        if (productId.isEmpty()) {
            Toast.makeText(this, "Error: Product ID missing", Toast.LENGTH_SHORT).show()
            return
        }

        val product = hashMapOf(
            "productId" to productId,
            "name" to name,
            "price" to price,
            "scent" to scent,
            "quantity" to quantity,
            "imageUrl" to currentImageUrl,
            "timestamp" to System.currentTimeMillis()
        )

        db.collection("users").document(userId).collection("cart").document(productId)
            .set(product)
            .addOnSuccessListener {
                Toast.makeText(this, "$name added to cart", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, Main::class.java))
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Error adding to cart: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }
}
