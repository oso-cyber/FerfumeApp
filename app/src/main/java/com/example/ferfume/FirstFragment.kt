package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import android.widget.ArrayAdapter
import android.widget.ImageView
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.ferfume.databinding.FragmentFirstBinding
import com.example.ferfume.databinding.ItemCategoryBinding
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso

class FirstFragment : Fragment() {

    private var _binding: FragmentFirstBinding? = null
    private val binding get() = _binding!!

    private val categories = mutableListOf<Category11>()
    private lateinit var categoryAdapter: CategoryAdapter11

    private val items = mutableListOf<Product11>()
    private lateinit var itemAdapter: ItemAdapter11

    private val suggestions = mutableListOf<String>()
    private lateinit var suggestionsAdapter: ArrayAdapter<String>

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFirstBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val fadeInAnimation = AnimationUtils.loadAnimation(context, R.anim.fade_in)
        binding.searchCard.startAnimation(fadeInAnimation)
        binding.textView8.startAnimation(fadeInAnimation)
        binding.textView8.text = "All"

        setupCategoriesRecycler()
        setupProductsRecycler()
        setupSearchSuggestions()
        setupSearchListener()

        binding.btnBack.setOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }

        fetchCategories()
        fetchAllProducts()
    }

    private fun setupCategoriesRecycler() {
        binding.categoriesRecyclerView.apply {
            layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
            categoryAdapter = CategoryAdapter11(categories) { selectedCategory ->
                binding.textView8.text = selectedCategory
                fetchProductsByCategory(selectedCategory)
            }
            adapter = categoryAdapter
        }
    }

    private fun setupProductsRecycler() {
        binding.productRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            itemAdapter = ItemAdapter11(items) { product ->
                val intent = Intent(activity, ItemViewActivity::class.java).apply {
                    putExtra("productId", product.id)
                    putExtra("name", product.name)
                    putExtra("brand", product.brand)
                    putExtra("price", product.price)
                    putExtra("scent", product.scent)
                    putExtra("imageUrl", product.imageUrl)
                }
                startActivity(intent)
            }
            adapter = itemAdapter
        }
    }

    private fun setupSearchSuggestions() {
        suggestionsAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, suggestions)
        binding.searchSuggestionsList.adapter = suggestionsAdapter
        binding.searchSuggestionsList.setOnItemClickListener { _, _, position, _ ->
            val selected = suggestions[position]
            binding.searchBar.setText(selected)
            binding.searchSuggestionsList.visibility = ListView.GONE
            searchProducts(selected)
        }
    }

    private fun setupSearchListener() {
        binding.searchBar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s.toString().trim()
                if (query.isNotEmpty()) searchSuggestions(query)
                else {
                    binding.searchSuggestionsList.visibility = ListView.GONE
                    fetchAllProducts()
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    // ------------------- Categories -------------------
    private fun fetchCategories() {
        FirebaseFirestore.getInstance().collection("categoriesM")
            .get()
            .addOnSuccessListener { result ->
                categories.clear()
                for (doc in result) categories.add(doc.toObject(Category11::class.java))
                categoryAdapter.notifyDataSetChanged()
            }
            .addOnFailureListener {
                Toast.makeText(requireContext(), "Failed to load categories", Toast.LENGTH_SHORT).show()
            }
    }

    // ------------------- Products -------------------
    private fun fetchAllProducts() {
        FirebaseFirestore.getInstance().collection("products")
            .get()
            .addOnSuccessListener { result ->
                items.clear()
                for (doc in result) {
                    items.add(Product11(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        price = doc.getDouble("price") ?: 0.0,
                        scent = doc.getString("scent") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: ""
                    ))
                }
                itemAdapter.notifyDataSetChanged()
            }
    }

    private fun fetchProductsByCategory(category: String) {
        FirebaseFirestore.getInstance().collection("products")
            .whereEqualTo("category", category)
            .get()
            .addOnSuccessListener { result ->
                items.clear()
                for (doc in result) {
                    items.add(Product11(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        price = doc.getDouble("price") ?: 0.0,
                        scent = doc.getString("scent") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: ""
                    ))
                }
                itemAdapter.notifyDataSetChanged()
            }
    }

    // ------------------- Search -------------------
    private fun searchSuggestions(query: String) {
        FirebaseFirestore.getInstance().collection("products")
            .get()
            .addOnSuccessListener { result ->
                suggestions.clear()
                for (doc in result) {
                    val name = doc.getString("name") ?: ""
                    val brand = doc.getString("brand") ?: ""
                    if (name.contains(query, ignoreCase = true)) suggestions.add(name)
                    if (brand.contains(query, ignoreCase = true) && !suggestions.contains(brand)) suggestions.add(brand)
                }
                binding.searchSuggestionsList.visibility =
                    if (suggestions.isNotEmpty()) ListView.VISIBLE else ListView.GONE
                suggestionsAdapter.notifyDataSetChanged()
            }
    }

    private fun searchProducts(query: String) {
        FirebaseFirestore.getInstance().collection("products")
            .get()
            .addOnSuccessListener { result ->
                items.clear()
                for (doc in result) {
                    val name = doc.getString("name") ?: ""
                    val brand = doc.getString("brand") ?: ""
                    if (name.contains(query, ignoreCase = true) || brand.contains(query, ignoreCase = true)) {
                        items.add(Product11(
                            id = doc.id,
                            name = name,
                            brand = brand,
                            price = doc.getDouble("price") ?: 0.0,
                            scent = doc.getString("scent") ?: "",
                            imageUrl = doc.getString("imageUrl") ?: ""
                        ))
                    }
                }
                itemAdapter.notifyDataSetChanged()
            }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

// ------------------- Data Models -------------------
data class Category11(val id: String = "", val name: String = "", val imageUrl: String = "")
data class Product11(val id: String = "", val name: String = "", val brand: String = "", val price: Double = 0.0, val scent: String = "", val imageUrl: String = "")

// ------------------- Adapters -------------------
class CategoryAdapter11(
    private val categories: List<Category11>,
    private val onCategorySelected: (String) -> Unit
) : RecyclerView.Adapter<CategoryAdapter11.CategoryViewHolder>() {

    inner class CategoryViewHolder(private val binding: ItemCategoryBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(category: Category11) {
            binding.textView.text = category.name
            if (category.imageUrl.isNotEmpty()) Picasso.get().load(category.imageUrl).into(binding.imageView)
            binding.root.setOnClickListener { onCategorySelected(category.name) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        CategoryViewHolder(ItemCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: CategoryViewHolder, position: Int) {
        holder.bind(categories[position])
        val fadeInAnim = AnimationUtils.loadAnimation(holder.itemView.context, R.anim.fade_in)
        holder.itemView.startAnimation(fadeInAnim)
    }

    override fun getItemCount() = categories.size
}

class ItemAdapter11(
    private val items: List<Product11>,
    private val onClick: (Product11) -> Unit
) : RecyclerView.Adapter<ItemAdapter11.ItemViewHolder>() {

    class ItemViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameText: TextView = itemView.findViewById(R.id.textViewProductName)
        val brandText: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val priceText: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val imageView: ImageView = itemView.findViewById(R.id.productImage)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ItemViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false))

    override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
        val product = items[position]
        holder.nameText.text = product.name
        holder.brandText.text = product.brand
        holder.priceText.text = "R ${product.price}"
        if (product.imageUrl.isNotEmpty()) Picasso.get().load(product.imageUrl).into(holder.imageView)
        else holder.imageView.setImageResource(R.drawable.img_45)
        holder.itemView.setOnClickListener { onClick(product) }
    }

    override fun getItemCount() = items.size
}
