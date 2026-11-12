package com.example.ferfume

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import org.json.JSONObject
import java.io.IOException

class Payment : AppCompatActivity() {

    private lateinit var webView: WebView
    private val backendUrl = "https://750b605a62bf.ngrok-free.app/api/paystack/generate-payment-url"

    // Firestore
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_payment)

        webView = findViewById(R.id.webview_payment)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                Log.d("WebView", "Navigating to: $url")

                if (url.startsWith("https://yourapp.com/payment-complete")) {
                    val reference = Uri.parse(url).getQueryParameter("reference")
                    Toast.makeText(this@Payment, "Payment finished: $reference", Toast.LENGTH_SHORT).show()

                    // Save cart to orders and update popular products
                    saveCartToOrders()

                    finish()
                    return true
                }
                return false
            }
        }

        val amount = intent.getIntExtra("amount", 0)
        val email = intent.getStringExtra("email") ?: "fallback@example.com"

        Log.d("Payment", "Received email: $email, amount: $amount")

        generatePaymentUrl(email, amount)
    }

    private fun generatePaymentUrl(email: String, amount: Int) {
        val client = OkHttpClient()

        val json = JSONObject().apply {
            put("email", email)
            put("amount", amount)
        }

        val body = RequestBody.create(
            "application/json; charset=utf-8".toMediaTypeOrNull(),
            json.toString()
        )

        val request = Request.Builder()
            .url(backendUrl)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("Payment", "Request failed: ${e.message}")
                runOnUiThread {
                    Toast.makeText(this@Payment, "Failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val bodyStr = response.body?.string()
                Log.d("Payment", "Response body: $bodyStr")

                if (response.isSuccessful) {
                    try {
                        val url = JSONObject(bodyStr!!).getString("url")
                        Log.d("Payment", "Loading URL: $url")
                        runOnUiThread {
                            webView.loadUrl(url)
                        }
                    } catch (e: Exception) {
                        Log.e("Payment", "Failed to parse URL: ${e.message}")
                        runOnUiThread {
                            Toast.makeText(this@Payment, "Error parsing payment URL", Toast.LENGTH_LONG).show()
                        }
                    }
                } else {
                    Log.e("Payment", "Server error: $bodyStr")
                    runOnUiThread {
                        Toast.makeText(this@Payment, "Server Error", Toast.LENGTH_LONG).show()
                    }
                }
            }
        })
    }

    private fun saveCartToOrders() {
        val userId = auth.currentUser?.uid ?: return

        val userCartRef = db.collection("users").document(userId).collection("cart")
        userCartRef.get()
            .addOnSuccessListener { snapshot ->
                if (snapshot.isEmpty) {
                    Toast.makeText(this, "Cart is empty", Toast.LENGTH_SHORT).show()
                    return@addOnSuccessListener
                }

                // Prepare cart items
                val cartItems = snapshot.documents.map { doc ->
                    val price = when (val value = doc.get("price")) {
                        is Double -> value
                        is Long -> value.toDouble()
                        is String -> value.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    }

                    val quantity = (doc.getLong("quantity") ?: 0L).toInt()

                    hashMapOf(
                        "productId" to (doc.getString("productId") ?: ""),
                        "name" to (doc.getString("name") ?: ""),
                        "brand" to (doc.getString("brand") ?: ""),
                        "price" to price,      // always Double
                        "imageUrl" to (doc.getString("imageUrl") ?: ""),
                        "quantity" to quantity
                    )
                }

                val subtotal = cartItems.sumOf { (it["price"] as Double) * (it["quantity"] as Int) }

                val orderData = hashMapOf(
                    "userId" to userId,
                    "items" to cartItems,
                    "subtotal" to subtotal,
                    "status" to "pending",
                    "createdAt" to System.currentTimeMillis()
                )

                val orderId = db.collection("orders").document().id

                // Save global order
                db.collection("orders").document(orderId)
                    .set(orderData)
                    .addOnSuccessListener { Log.d("Payment", "Saved to global orders") }
                    .addOnFailureListener { e -> Log.e("Payment", "Failed saving global order", e) }

                // Save user-specific order
                db.collection("users").document(userId).collection("orders")
                    .document(orderId)
                    .set(orderData)
                    .addOnSuccessListener {
                        Log.d("Payment", "Saved to user orders")
                        Toast.makeText(this, "Order saved successfully!", Toast.LENGTH_SHORT).show()

                        updatePopularProducts(cartItems)
                        clearCart(userId)
                        startActivity(Intent(this, Main::class.java))
                    }
                    .addOnFailureListener { e ->
                        Toast.makeText(this, "Failed saving user order: ${e.message}", Toast.LENGTH_LONG).show()
                        Log.e("Payment", "Failed saving user order", e)
                    }
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to retrieve cart items", Toast.LENGTH_SHORT).show()
            }
    }

    // -------------------- Update Popular Products --------------------
    private fun updatePopularProducts(cartItems: List<Map<String, Any>>) {
        val popularRef = db.collection("popular")

        for (item in cartItems) {
            val productName = item["name"].toString()
            val productPrice = item["price"]
            val productImageUrl = item["imageUrl"].toString()
            val productId = item["productId"].toString()

            popularRef.document(productId).get()
                .addOnSuccessListener { doc ->
                    if (doc.exists()) {
                        val currentCount = doc.getLong("orderCount") ?: 0
                        popularRef.document(productId).update(
                            "orderCount", currentCount + 1
                        )
                    } else {
                        val popularProduct = hashMapOf(
                            "name" to productName,
                            "price" to productPrice,
                            "imageUrl" to productImageUrl,
                            "productId" to productId,
                            "orderCount" to 1
                        )
                        popularRef.document(productId).set(popularProduct)
                    }
                }
                .addOnFailureListener { e ->
                    Log.e("Payment", "Failed updating popular products", e)
                }
        }
    }

    // -------------------- Clear Cart --------------------
    private fun clearCart(userId: String) {
        val cartRef = db.collection("users").document(userId).collection("cart")
        cartRef.get()
            .addOnSuccessListener { snapshot ->
                for (doc in snapshot.documents) {
                    doc.reference.delete()
                }
                Toast.makeText(this, "Cart cleared", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to clear cart", Toast.LENGTH_SHORT).show()
            }
    }
}

