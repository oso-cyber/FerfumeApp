package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView

// -------------------- Data Model --------------------
data class Product1(
    val id: String = "",
    val name: String = "",
    val brand: String = "",
    val description: String = "",
    val imageUrl: String = "",
    val price: Double = 0.0,
    val scent: String = "",
    val orderCount: Int = 0,
    val category: String = "" // Add category field
)

// -------------------- Activity --------------------
class ManageProducts : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: ProductAdapter
    private val productList = mutableListOf<Product1>()
    private val db = FirebaseFirestore.getInstance()

    private lateinit var selectedCategory: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_manage_products)

        // Get selected category from intent
        selectedCategory = intent.getStringExtra("categoryName") ?: ""

        recyclerView = findViewById(R.id.productsRecyclerView)
        val addProductButton: Button = findViewById(R.id.addProductButton)

        recyclerView.layoutManager = LinearLayoutManager(this)
        adapter = ProductAdapter(
            productList,
            onEditClick = { product ->
                // Open EditProduct activity
                val intent = Intent(this, EditProduct::class.java)
                intent.putExtra("productId", product.id) // send the product ID
                startActivity(intent)
            },
            onDeleteClick = { product ->
                deleteProduct(product)
            }
        )
        recyclerView.adapter = adapter

        loadProductsByCategory(selectedCategory)

        addProductButton.setOnClickListener {
            val intent = Intent(this, Add_product::class.java)
            intent.putExtra("categoryName", selectedCategory) // pass category to Add_product
            startActivity(intent)
        }
    }

    private fun loadProductsByCategory(category: String) {
        db.collection("products")
            .whereEqualTo("category", category)
            .get()
            .addOnSuccessListener { result ->
                productList.clear()
                for (doc in result) {
                    val product = Product1(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        description = doc.getString("description") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: "",
                        price = doc.getDouble("price") ?: 0.0,
                        scent = doc.getString("scent") ?: "",
                        orderCount = doc.getLong("orderCount")?.toInt() ?: 0,
                        category = doc.getString("category") ?: ""
                    )
                    productList.add(product)
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load products", Toast.LENGTH_SHORT).show()
            }
    }

    private fun deleteProduct(product: Product1) {
        db.collection("products").document(product.id).delete()
            .addOnSuccessListener {
                productList.remove(product)
                adapter.notifyDataSetChanged()
                Toast.makeText(this, "Deleted ${product.name}", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to delete product", Toast.LENGTH_SHORT).show()
            }
    }
}

// -------------------- Adapter --------------------
class ProductAdapter(
    private val productList: MutableList<Product1>,
    private val onEditClick: (Product1) -> Unit,
    private val onDeleteClick: (Product1) -> Unit
) : RecyclerView.Adapter<ProductAdapter.ProductViewHolder>() {

    inner class ProductViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val productImage: ImageView = view.findViewById(R.id.productImage)
        val productName: TextView = view.findViewById(R.id.productName)
        val productBrand: TextView = view.findViewById(R.id.productBrand)
        val productPrice: TextView = view.findViewById(R.id.productPrice)
        val editButton: Button = view.findViewById(R.id.editButton)
        val deleteButton: Button = view.findViewById(R.id.deleteButton)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_product_card, parent, false)
        return ProductViewHolder(view)
    }

    override fun onBindViewHolder(holder: ProductViewHolder, position: Int) {
        val product = productList[position]

        holder.productName.text = product.name
        holder.productBrand.text = "Brand: ${product.brand}"
        holder.productPrice.text = "R ${product.price}"

        if (product.imageUrl.isNotEmpty()) {
            Picasso.get().load(product.imageUrl).into(holder.productImage)
        }

        holder.editButton.setOnClickListener { onEditClick(product) }
        holder.deleteButton.setOnClickListener { onDeleteClick(product) }
    }

    override fun getItemCount() = productList.size
}
