package com.example.ferfume.ui.home

import android.net.Uri
import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.core.app.ActivityCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import android.widget.TextView
import android.os.Handler
import android.os.Looper
import androidx.recyclerview.widget.LinearSmoothScroller
import android.util.DisplayMetrics
import android.content.Intent
import android.widget.ImageView
import android.util.Log
import com.example.ferfume.ItemViewActivity
import com.example.ferfume.R
import com.example.ferfume.databinding.FragmentHomeBinding
import com.google.firebase.firestore.FirebaseFirestore
import com.squareup.picasso.Picasso
import android.widget.Toast
import com.example.ferfume.ShoppingPageActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.Priority
import android.location.Geocoder
import java.util.Locale
import com.google.firebase.auth.FirebaseAuth
import android.widget.Button
import com.example.ferfume.Adminpannel
import com.example.ferfume.custom_cake_page


class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val popularList = mutableListOf<Popular>()
    private val db = FirebaseFirestore.getInstance()
    private val productNamesList = mutableListOf<String>()
    private val filteredList = mutableListOf<String>()
    private val productsList = mutableListOf<Product>()
    private lateinit var productsAdapter: ProductAdapter
    private lateinit var popularAdapter: PopularAdapter
    private var scrollHandler: Handler? = null
    private var scrollRunnable: Runnable? = null
    private var scrollPosition = 0
    private var scrollDirection = 1
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var locationRequest: LocationRequest

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        val root: View = binding.root

        binding.btnCustomCakesHi.setOnClickListener {
            val intent = Intent(requireContext(), custom_cake_page::class.java)
            startActivity(intent)
            requireActivity().overridePendingTransition(
                android.R.anim.slide_in_left,
                android.R.anim.slide_out_right
            )
        }

// Load user name (supports both Google and email sign-ins)
        val currentUser1 = FirebaseAuth.getInstance().currentUser
        currentUser1?.let { user ->
            val uid = user.uid
            val googleName = user.displayName  // This is non-null for Google sign-in users

            if (!googleName.isNullOrEmpty()) {
                // ✅ If logged in via Google, show their Google display name
                binding.userName.text = googleName
            } else {
                // 🔁 Otherwise, fetch from Firestore (email/password users)
                db.collection("users").document(uid).get()
                    .addOnSuccessListener { document ->
                        if (document != null && document.exists()) {
                            val username = document.getString("fullName") ?: "Unknown User"
                            binding.userName.text = username
                        } else {
                            binding.userName.text = "User not found"
                        }
                    }
                    .addOnFailureListener {
                        binding.userName.text = "Failed to fetch user"
                    }
            }
        } ?: run {
            binding.userName.text = "Guest"
        }




        // Initialize location client
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
        locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L)
            .setMinUpdateIntervalMillis(5000L)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    updateLocationUI(location)
                }
            }
        }

        // RecyclerView setup for new products
        binding.NewProducts.layoutManager = LinearLayoutManager(context)
        productsAdapter = ProductAdapter(productsList)
        binding.NewProducts.adapter = productsAdapter

        // RecyclerView setup for popular products
        binding.POPULAR.layoutManager = LinearLayoutManager(context)
        db.collection("popular")
            .get()
            .addOnSuccessListener { result ->
                popularList.clear()
                for (document in result) {
                    val popular = document.toObject(Popular::class.java).copy(id = document.id)
                    popularList.add(popular)

                }
                popularAdapter = PopularAdapter(popularList)
                binding.POPULAR.adapter = popularAdapter
            }
            .addOnFailureListener { exception ->
                Log.e("HomeFragment", "Error fetching popular items: ${exception.message}")
            }

        // Start auto-scroll for new products
        startAutoScroll()

        // Him button → ShoppingPageActivity (SecondFragment)
        binding.himText.setOnClickListener {
            val intent = Intent(requireContext(), ShoppingPageActivity::class.java)
            intent.putExtra("fragment_to_open", 0)
            startActivity(intent)
        }



        // Search functionality
        val searchAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, filteredList)
        binding.listView.adapter = searchAdapter
        db.collection("products")
            .get()
            .addOnSuccessListener { result ->
                productNamesList.clear()
                productsList.clear()
                for (document in result) {
                    val product = document.toObject(Product::class.java).copy(id = document.id)
                    productsList.add(product)
                    productNamesList.add(product.name)
                }
                productsAdapter.notifyDataSetChanged()
            }

        binding.listView.visibility = View.GONE

        binding.searchBar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterProductNames(s.toString())
                searchAdapter.notifyDataSetChanged()
                binding.listView.visibility = if (s.isNullOrEmpty()) View.GONE else View.VISIBLE
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // When user clicks on a product in search results
        binding.listView.setOnItemClickListener { _, _, position, _ ->
            val selectedProduct = productsList.find { it.name == filteredList[position] }
            selectedProduct?.let {
                val intent = Intent(requireContext(), ItemViewActivity::class.java).apply {
                    putExtra("productId", it.id)
                    putExtra("product_name", it.name)
                    putExtra("product_brand", it.brand)
                    putExtra("product_price", it.price)
                    putExtra("product_description", it.description)
                    putExtra("product_image_url", it.imageUrl)
                }
                startActivity(intent)
            }
        }

        return root
    }

    override fun onResume() {
        super.onResume()
        startLocationUpdates()
    }

    override fun onPause() {
        super.onPause()
        stopLocationUpdates()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startLocationUpdates()
                Toast.makeText(context, "Location permission granted!", Toast.LENGTH_SHORT).show()
            } else {
                binding.addressTextView.text = "Location permission denied"
                Toast.makeText(context, "Location permission denied. Cannot show address.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            fusedLocationClient.lastLocation.addOnSuccessListener(requireActivity()) { location ->
                if (location != null) updateLocationUI(location)
            }
        } else {
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 1)
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun updateLocationUI(location: Location) {
        val geocoder = Geocoder(requireContext(), Locale.getDefault())
        try {
            val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
            if (!addresses.isNullOrEmpty()) {
                val address = addresses[0]
                binding.addressTextView.text = address.getAddressLine(0)
            } else {
                binding.addressTextView.text = "Unable to fetch address"
            }
        } catch (e: Exception) {
            binding.addressTextView.text = "Error fetching address"
        }
    }

    private fun startAutoScroll() {
        scrollHandler = Handler(Looper.getMainLooper())
        scrollRunnable = object : Runnable {
            override fun run() {
                val layoutManager = binding.NewProducts.layoutManager as LinearLayoutManager
                val itemCount = productsAdapter.itemCount
                if (itemCount > 0) {
                    scrollPosition += scrollDirection
                    if (scrollPosition >= itemCount - 1 || scrollPosition <= 0) {
                        scrollDirection *= -1
                    }
                    val scroller = object : LinearSmoothScroller(context) {
                        override fun calculateSpeedPerPixel(displayMetrics: DisplayMetrics): Float {
                            return 0.2f
                        }
                    }
                    scroller.targetPosition = scrollPosition
                    layoutManager.startSmoothScroll(scroller)
                }
                scrollHandler?.postDelayed(this, 12000)
            }
        }
        scrollHandler?.postDelayed(scrollRunnable!!, 5000)
    }

    private fun filterProductNames(query: String) {
        filteredList.clear()
        if (query.isNotEmpty()) {
            filteredList.addAll(productNamesList.filter { it.contains(query, ignoreCase = true) })
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        stopLocationUpdates()
        scrollHandler?.removeCallbacks(scrollRunnable!!)
        _binding = null
    }
}

// --- Data Classes ---
data class Product(
    val id: String = "",
    val name: String = "",
    val brand: String = "",
    val price: Double = 0.0,
    val description: String = "",
    val imageUrl: String = ""
)

data class Popular(
    val id: String = "",
    val name: String = "",
    val brand: String = "",
    val price: Double = 0.0,
    val description: String = "",
    val imageUrl: String? = null
)

// --- Image Loader Helper ---
fun loadProductImage(imageView: ImageView, url: String?) {
    if (isValidUrl(url)) {
        Picasso.get()
            .load(url)
            .placeholder(R.drawable.img_45)
            .error(R.drawable.img_45)
            .fit()
            .centerCrop()
            .into(imageView)
    } else {
        imageView.setImageResource(R.drawable.img_45)
    }
}

fun isValidUrl(url: String?): Boolean {
    return try {
        if (url.isNullOrBlank()) return false
        val uri = Uri.parse(url)
        uri.scheme == "http" || uri.scheme == "https"
    } catch (e: Exception) {
        false
    }
}
class ProductAdapter(private val productList: List<Product>) :
    RecyclerView.Adapter<ProductAdapter.ProductViewHolder>() {

    private val favoriteSet = mutableSetOf<String>()
    private val firestore = FirebaseFirestore.getInstance()
    private val currentUser = FirebaseAuth.getInstance().currentUser

    init {
        // Load favorites from Firestore on adapter initialization
        currentUser?.let { user ->
            firestore.collection("users")
                .document(user.uid)
                .collection("favorites")
                .get()
                .addOnSuccessListener { snapshot ->
                    for (doc in snapshot.documents) {
                        doc.getString("id")?.let { favoriteSet.add(it) }
                    }
                    notifyDataSetChanged() // Refresh adapter to show filled hearts
                }
        }
    }

    class ProductViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameTextView: TextView = itemView.findViewById(R.id.textViewProductName)
        val brandTextView: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val priceTextView: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val imageView: ImageView = itemView.findViewById(R.id.productImage)
        val heartIcon: ImageView = itemView.findViewById(R.id.heartIcon)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_product, parent, false)
        return ProductViewHolder(view)
    }

    override fun onBindViewHolder(holder: ProductViewHolder, position: Int) {
        val product = productList[position]

        holder.nameTextView.text = product.name
        holder.brandTextView.text = product.brand
        holder.priceTextView.text = product.price.toString()

        // Load image safely with placeholder
        if (!product.imageUrl.isNullOrBlank()) {
            Picasso.get()
                .load(product.imageUrl)
                .placeholder(R.drawable.img_45) // default placeholder
                .error(R.drawable.img_45)       // fallback if image fails
                .fit()
                .centerCrop()
                .into(holder.imageView)
        } else {
            holder.imageView.setImageResource(R.drawable.img_45)
        }

        // Set heart icon based on favoriteSet
        val isFavorite = favoriteSet.contains(product.id)
        holder.heartIcon.setImageResource(if (isFavorite) R.drawable.ic_heart_filled else R.drawable.vector)

        // Handle heart click
        holder.heartIcon.setOnClickListener {
            if (currentUser == null) {
                Toast.makeText(holder.itemView.context, "Please log in to save favorites", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val nowFavorite = !favoriteSet.contains(product.id)
            val favoritesRef = firestore.collection("users")
                .document(currentUser.uid)
                .collection("favorites")

            if (nowFavorite) {
                val favoriteData = hashMapOf(
                    "id" to product.id,
                    "name" to product.name,
                    "brand" to product.brand,
                    "price" to product.price,
                    "imageUrl" to product.imageUrl,
                    "description" to product.description
                )
                favoritesRef.document(product.id).set(favoriteData)
                    .addOnSuccessListener {
                        favoriteSet.add(product.id)
                        holder.heartIcon.setImageResource(R.drawable.ic_heart_filled)
                        Toast.makeText(holder.itemView.context, "Added to favorites ❤️", Toast.LENGTH_SHORT).show()
                    }
            } else {
                favoritesRef.document(product.id).delete()
                    .addOnSuccessListener {
                        favoriteSet.remove(product.id)
                        holder.heartIcon.setImageResource(R.drawable.vector)
                        Toast.makeText(holder.itemView.context, "Removed from favorites 🤍", Toast.LENGTH_SHORT).show()
                    }
            }

            // Bounce animation
            holder.heartIcon.animate().scaleX(1.2f).scaleY(1.2f).setDuration(120).withEndAction {
                holder.heartIcon.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
            }.start()
        }

        // Item click → open details
        holder.itemView.setOnClickListener {
            val context = holder.itemView.context
            val intent = Intent(context, ItemViewActivity::class.java).apply {
                putExtra("productId", product.id)
                putExtra("product_name", product.name)
                putExtra("product_brand", product.brand)
                putExtra("product_price", product.price)
                putExtra("product_description", product.description)
                putExtra("product_image_url", product.imageUrl)
            }
            context.startActivity(intent)
        }
    }

    override fun getItemCount() = productList.size
}
class PopularAdapter(private val popularList: List<Popular>) :
    RecyclerView.Adapter<PopularAdapter.PopularViewHolder>() {

    private val favoriteSet = mutableSetOf<String>()
    private val firestore = FirebaseFirestore.getInstance()
    private val currentUser = FirebaseAuth.getInstance().currentUser

    init {
        // Load favorites from Firestore
        currentUser?.let { user ->
            firestore.collection("users")
                .document(user.uid)
                .collection("favorites")
                .get()
                .addOnSuccessListener { snapshot ->
                    for (doc in snapshot.documents) {
                        doc.getString("id")?.let { favoriteSet.add(it) }
                    }
                    notifyDataSetChanged()
                }
        }
    }

    class PopularViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val nameTextView: TextView = itemView.findViewById(R.id.textViewProductName)
        val brandTextView: TextView = itemView.findViewById(R.id.textViewProductBrand)
        val priceTextView: TextView = itemView.findViewById(R.id.textViewProductPrice)
        val imageView: ImageView = itemView.findViewById(R.id.productImage)
        val heartIcon: ImageView = itemView.findViewById(R.id.heartIcon)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PopularViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_product, parent, false)
        return PopularViewHolder(view)
    }

    override fun onBindViewHolder(holder: PopularViewHolder, position: Int) {
        val product = popularList[position]

        holder.nameTextView.text = product.name
        holder.brandTextView.text = product.brand
        holder.priceTextView.text = "R %.2f".format(product.price) // format double price

        holder.imageView.setImageResource(R.drawable.img_45)
        product.imageUrl?.let { url ->
            Picasso.get()
                .load(url)
                .placeholder(R.drawable.img_45)
                .error(R.drawable.img_45)
                .fit()
                .centerCrop()
                .into(holder.imageView)
        }

        val isFavorite = favoriteSet.contains(product.id)
        holder.heartIcon.setImageResource(if (isFavorite) R.drawable.ic_heart_filled else R.drawable.vector)

        holder.heartIcon.setOnClickListener {
            if (currentUser == null) {
                Toast.makeText(holder.itemView.context, "Please log in to save favorites", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val favoritesRef = firestore.collection("users")
                .document(currentUser.uid)
                .collection("favorites")

            if (!isFavorite) {
                val favoriteData = hashMapOf(
                    "id" to product.id,
                    "name" to product.name,
                    "brand" to product.brand,
                    "price" to product.price,
                    "imageUrl" to product.imageUrl,
                    "description" to product.description
                )
                favoritesRef.document(product.id).set(favoriteData)
                    .addOnSuccessListener {
                        favoriteSet.add(product.id)
                        holder.heartIcon.setImageResource(R.drawable.ic_heart_filled)
                    }
            } else {
                favoritesRef.document(product.id).delete()
                    .addOnSuccessListener {
                        favoriteSet.remove(product.id)
                        holder.heartIcon.setImageResource(R.drawable.vector)
                    }
            }
        }

        holder.itemView.setOnClickListener {
            val context = holder.itemView.context
            val intent = Intent(context, ItemViewActivity::class.java).apply {
                putExtra("productId", product.id)
                putExtra("product_name", product.name)
                putExtra("product_brand", product.brand)
                putExtra("product_price", product.price)
                putExtra("product_description", product.description)
                putExtra("product_image_url", product.imageUrl)
            }
            context.startActivity(intent)
        }
    }

    override fun getItemCount(): Int = popularList.size
}
