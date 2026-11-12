package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import com.squareup.picasso.Picasso

data class Category1(
    var id: String = "",
    var name: String = "",
    var imageUrl: String = "",
    var createdAt: Long = 0L
)

class ManageCtegories : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var addCategoryButton: FloatingActionButton
    private lateinit var categoryAdapter4: CategoryAdapter4

    private val firestore = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance()
    private val categories = mutableListOf<Category1>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_manage_ctegories)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        recyclerView = findViewById(R.id.categoryRecyclerView)
        addCategoryButton = findViewById(R.id.addCategoryButton)

        recyclerView.layoutManager = LinearLayoutManager(this)
        categoryAdapter4 = CategoryAdapter4(
            categories,
            onCategoryClick = { category ->
                val intent = Intent(this, ManageProducts::class.java)
                intent.putExtra("categoryName", category.name)
                startActivity(intent)
            },
            onDeleteClick = { category ->
                confirmAndDeleteCategory(category)
            }
        )
        recyclerView.adapter = categoryAdapter4

        // ✅ Go to the new AddCategoryActivity instead of showing dialog
        addCategoryButton.setOnClickListener {
            val intent = Intent(this, AddCategory::class.java)
            startActivity(intent)
        }

        loadCategories()
    }

    private fun loadCategories() {
        firestore.collection("categoriesM")
            .get()
            .addOnSuccessListener { result ->
                categories.clear()
                for (doc in result) {
                    val category = doc.toObject(Category1::class.java).apply { id = doc.id }
                    categories.add(category)
                }
                categoryAdapter4.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to load categories", Toast.LENGTH_SHORT).show()
            }
    }

    private fun confirmAndDeleteCategory(category: Category1) {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Delete Category")
            .setMessage("Are you sure you want to delete '${category.name}'?")
            .setPositiveButton("Delete") { _, _ -> deleteCategory(category) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteCategory(category: Category1) {
        if (category.id.isBlank()) {
            Toast.makeText(this, "Missing category ID", Toast.LENGTH_SHORT).show()
            return
        }

        firestore.collection("categoriesM")
            .document(category.id)
            .delete()
            .addOnSuccessListener {
                Toast.makeText(this, "Category deleted", Toast.LENGTH_SHORT).show()
                loadCategories()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to delete category", Toast.LENGTH_SHORT).show()
            }
    }
}

class CategoryAdapter4(
    private val categories: List<Category1>,
    private val onCategoryClick: (Category1) -> Unit,
    private val onDeleteClick: (Category1) -> Unit
) : RecyclerView.Adapter<CategoryAdapter4.CategoryViewHolder>() {

    inner class CategoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameText: TextView = itemView.findViewById(R.id.categoryNameText)
        val categoryImageView: ImageView = itemView.findViewById(R.id.categoryImageView)
        val deleteButton: ImageView = itemView.findViewById(R.id.deleteCategoryButton)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CategoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_category_card, parent, false)
        return CategoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: CategoryViewHolder, position: Int) {
        val category = categories[position]
        holder.nameText.text = category.name

        if (category.imageUrl.isNotEmpty()) {
            Picasso.get().load(category.imageUrl).fit().centerCrop().into(holder.categoryImageView)
        } else {
            holder.categoryImageView.setImageResource(R.drawable.img_13)
        }

        holder.itemView.setOnClickListener { onCategoryClick(category) }
        holder.deleteButton.setOnClickListener { onDeleteClick(category) }
    }

    override fun getItemCount(): Int = categories.size
}
