package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.ferfume.databinding.FragmentSecondBinding
import com.example.ferfume.databinding.ItemCategoryBinding
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso

class SecondFragment : Fragment() {

    private var _binding: FragmentSecondBinding? = null
    private val binding get() = _binding!!

    private lateinit var categoryAdapter: CategoryAdapter
    private lateinit var itemAdapter: ItemAdapter
    private lateinit var suggestionAdapter: ArrayAdapter<String>

    private val categories = mutableListOf<Category>()
    private val items = mutableListOf<Product>()
    private val suggestions = mutableListOf<String>()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSecondBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupBackButton()
        setupCategoriesRecycler()
        setupProductsRecycler()
        setupSearchSuggestions()
        setupSearchListener()

        fetchCategories()
        fetchAllProducts() // initially load all products
    }

    // -------------------- Setup UI --------------------
    private fun setupBackButton() {
        binding.btnBack.setOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }
    }

    private fun setupCategoriesRecycler() {
        binding.categoriesRecyclerView.apply {
            layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
            categoryAdapter = CategoryAdapter(categories) { selectedCategory ->
                binding.textView8.text = selectedCategory
                fetchProductsByCategory(selectedCategory)
            }
            adapter = categoryAdapter
        }
    }

    private fun setupProductsRecycler() {
        binding.productRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            itemAdapter = ItemAdapter(items) { product ->
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
        suggestionAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, suggestions)
        binding.searchSuggestionsList.adapter = suggestionAdapter

        binding.searchSuggestionsList.setOnItemClickListener { _, _, position, _ ->
            val selected = suggestions[position]
            binding.searchBar.setText(selected)
            binding.searchSuggestionsList.visibility = View.GONE
            searchProducts(selected)
        }
    }

    private fun setupSearchListener() {
        binding.searchBar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s.toString().trim()
                if (query.isEmpty()) {
                    fetchAllProducts()
                } else showSuggestions(query)
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    // -------------------- Firestore --------------------
    private fun fetchCategories() {
        FirebaseFirestore.getInstance().collection("categoriesM")
            .get().addOnSuccessListener { result ->
                categories.clear()
                for (doc in result) categories.add(doc.toObject(Category::class.java))
                categoryAdapter.notifyDataSetChanged()
            }
    }

    private fun fetchAllProducts() {
        FirebaseFirestore.getInstance().collection("products")
            .get().addOnSuccessListener { result ->
                items.clear()
                for (doc in result) {
                    val product = Product(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        price = doc.getDouble("price") ?: 0.0,
                        scent = doc.getString("scent") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: ""
                    )
                    items.add(product)
                }
                itemAdapter.notifyDataSetChanged()
            }
    }

    private fun fetchProductsByCategory(category: String) {
        FirebaseFirestore.getInstance().collection("products")
            .whereEqualTo("category", category)
            .get().addOnSuccessListener { result ->
                items.clear()
                for (doc in result) {
                    val product = Product(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        brand = doc.getString("brand") ?: "",
                        price = doc.getDouble("price") ?: 0.0,
                        scent = doc.getString("scent") ?: "",
                        imageUrl = doc.getString("imageUrl") ?: ""
                    )
                    items.add(product)
                }
                itemAdapter.notifyDataSetChanged()
            }
    }

    // -------------------- Search --------------------
    private fun showSuggestions(query: String) {
        val lowerQuery = query.lowercase()
        suggestions.clear()

        for (product in items) {
            if (product.name.lowercase().contains(lowerQuery) || product.brand.lowercase().contains(lowerQuery)) {
                suggestions.add(product.name)
            }
        }

        val limited = suggestions.take(2)
        suggestions.clear()
        suggestions.addAll(limited)

        binding.searchSuggestionsList.visibility = if (suggestions.isNotEmpty()) View.VISIBLE else View.GONE
        suggestionAdapter.notifyDataSetChanged()
    }

    private fun searchProducts(query: String) {
        val lowerQuery = query.lowercase()
        val filtered = items.filter { it.name.lowercase().contains(lowerQuery) || it.brand.lowercase().contains(lowerQuery) }
        items.clear()
        items.addAll(filtered)
        itemAdapter.notifyDataSetChanged()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

// -------------------- Data Models --------------------
data class Category(val id: String = "", val name: String = "", val imageUrl: String = "")
data class Product(val id: String = "", val name: String = "", val brand: String = "", val price: Double = 0.0, val scent: String = "", val imageUrl: String = "")

// -------------------- CategoryAdapter --------------------
class CategoryAdapter(
    private val categories: List<Category>,
    private val onCategorySelected: (String) -> Unit
) : RecyclerView.Adapter<CategoryAdapter.CategoryViewHolder>() {

    inner class CategoryViewHolder(private val binding: ItemCategoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(category: Category) {
            binding.textView.text = category.name
            if (category.imageUrl.isNotEmpty()) Picasso.get().load(category.imageUrl).into(binding.imageView)
            binding.root.setOnClickListener { onCategorySelected(category.name) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        CategoryViewHolder(ItemCategoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: CategoryViewHolder, position: Int) {
        holder.bind(categories[position])
    }

    override fun getItemCount() = categories.size
}

// -------------------- ItemAdapter --------------------
class ItemAdapter(
    private val items: List<Product>,
    private val onClick: (Product) -> Unit
) : RecyclerView.Adapter<ItemAdapter.ItemViewHolder>() {

    class ItemViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameText: TextView = itemView.findViewById(R.id.textViewProductName)
        val brandText: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val priceText: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val imageView: ImageView = itemView.findViewById(R.id.productImage)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ItemViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return ItemViewHolder(view)
    }

    override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
        val product = items[position]
        holder.nameText.text = product.name
        holder.brandText.text = product.brand
        holder.priceText.text = "R ${product.price}"
        if (product.imageUrl.isNotEmpty()) Picasso.get().load(product.imageUrl).into(holder.imageView)
        else holder.imageView.setImageResource(R.drawable.img_45)
        holder.itemView.setOnClickListener { onClick(product) }
    }

    override fun getItemCount(): Int = items.size
}
