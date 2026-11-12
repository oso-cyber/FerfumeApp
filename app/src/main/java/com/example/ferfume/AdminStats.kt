package com.example.ferfume

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query

class AdminStats : AppCompatActivity() {

    private val db = FirebaseFirestore.getInstance()
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: PopularAdapter
    private val productList = mutableListOf<PopularProduct>()
    private lateinit var sortSpinner: Spinner

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_admin_stats)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        recyclerView = findViewById(R.id.recyclerViewPopular)
        sortSpinner = findViewById(R.id.spinnerSort)

        adapter = PopularAdapter(productList)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        setupSpinner()
        fetchPopularProducts(orderDescending = true)
    }

    private fun setupSpinner() {
        val options = arrayOf("Best to Worst", "Worst to Best")
        val spinnerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, options)
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        sortSpinner.adapter = spinnerAdapter

        sortSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>?, view: View?, position: Int, id: Long
            ) {
                fetchPopularProducts(orderDescending = position == 0)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun fetchPopularProducts(orderDescending: Boolean) {
        db.collection("popular")
            .orderBy("orderCount", if (orderDescending) Query.Direction.DESCENDING else Query.Direction.ASCENDING)
            .get()
            .addOnSuccessListener { snapshot ->
                productList.clear()
                for (doc in snapshot) {
                    val product = PopularProduct(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: "",
                        price = doc.getDouble("price") ?: 0.0,

                        orderCount = (doc.getLong("orderCount") ?: 0).toInt()
                    )
                    productList.add(product)
                }
                adapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load popular products", Toast.LENGTH_SHORT).show()
            }
    }
}
// ---------------------- Adapter & Data Class ----------------------
data class PopularProduct(
    val id: String,
    val name: String,
    val brand: String,
    val imageUrl: String,
    val price: Double,      // Changed from String to Double
    val orderCount: Int
)

class PopularAdapter(private val items: List<PopularProduct>) :
    RecyclerView.Adapter<PopularAdapter.PopularViewHolder>() {

    inner class PopularViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val name: TextView = itemView.findViewById(R.id.textViewProductName)
        val brand: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val price: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val orderCount: TextView = itemView.findViewById(R.id.textViewOrderCount)
        val image: ImageView = itemView.findViewById(R.id.productImage)
    }

    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): PopularViewHolder {
        val view = android.view.LayoutInflater.from(parent.context)
            .inflate(R.layout.item_product_admin, parent, false)
        return PopularViewHolder(view)
    }

    override fun onBindViewHolder(holder: PopularViewHolder, position: Int) {
        val product = items[position]
        holder.name.text = product.name
        holder.brand.text = product.brand
        holder.price.text = "R${"%.2f".format(product.price)}"  // formatted as currency
        holder.orderCount.text = "Orders: ${product.orderCount}"

        if (product.imageUrl.isNotBlank()) {
            com.squareup.picasso.Picasso.get()
                .load(product.imageUrl)
                .placeholder(R.drawable.img_1)
                .error(R.drawable.img_11)
                .fit()
                .centerCrop()
                .into(holder.image)
        } else {
            holder.image.setImageResource(R.drawable.img_45)
        }
    }

    override fun getItemCount(): Int = items.size
}
