package com.example.ferfume

import android.os.Bundle
import android.widget.*
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class custom_cake_page : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_custom_cake_page)

        // Adjust for system bars
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        val backButton = findViewById<ImageButton>(R.id.btnBack)
        backButton.setOnClickListener {
            finish() // Closes current activity
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }


        // Initialize Firebase
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()

        // UI references
        val spinnerCakeSize = findViewById<Spinner>(R.id.spinnerCakeSize)
        val spinnerFlavor = findViewById<Spinner>(R.id.spinnerFlavor)
        val spinnerTheme = findViewById<Spinner>(R.id.spinnerTheme)
        val shapeGroup = findViewById<RadioGroup>(R.id.shapeGroup)
        val deliveryGroup = findViewById<RadioGroup>(R.id.deliveryGroup)
        val editTextSpecialRequests = findViewById<EditText>(R.id.editTextSpecialRequests)
        val btnPlaceOrder = findViewById<Button>(R.id.btnPlaceOrder)

        // Spinner setup
        val sizes = listOf(
            "6-inch (Small)", "8-inch (Medium)", "10-inch (Large)", "12-inch (Extra Large)",
            "2-tier Classic", "3-tier Celebration", "Mini Cupcake Set (12)",
            "Sheet Cake (Rectangle)", "Heart-Shaped Special", "Tall Layer Cake"
        )
        spinnerCakeSize.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, sizes)

        val flavors = listOf(
            "Chocolate Fudge",
            "Vanilla Bean",
            "Red Velvet",
            "Lemon Zest",
            "Carrot Cake",
            "Cookies & Cream",
            "Strawberry Shortcake",
            "Mocha Espresso",
            "Salted Caramel",
            "Raspberry Swirl"
        )
        spinnerFlavor.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, flavors)

        val themes = listOf(
            "Classic Elegance", "Luxury Gold", "Romantic Rose", "Minimalist White", "Kids Birthday",
            "Butterfly Garden", "Modern Marble", "Chocolate Heaven", "Boho Chic", "Galaxy Glow"
        )
        spinnerTheme.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, themes)

        // Save order
        btnPlaceOrder.setOnClickListener {
            val user = auth.currentUser
            if (user == null) {
                Toast.makeText(this, "You must be logged in to place an order.", Toast.LENGTH_SHORT)
                    .show()
                return@setOnClickListener
            }

            val uid = user.uid
            val size = spinnerCakeSize.selectedItem.toString()
            val flavor = spinnerFlavor.selectedItem.toString()
            val theme = spinnerTheme.selectedItem.toString()
            val shapeId = shapeGroup.checkedRadioButtonId
            val deliveryId = deliveryGroup.checkedRadioButtonId
            val specialRequest = editTextSpecialRequests.text.toString().trim()

            val shape = if (shapeId != -1)
                findViewById<RadioButton>(shapeId).text.toString()
            else
                "Not selected"

            val delivery = if (deliveryId != -1)
                findViewById<RadioButton>(deliveryId).text.toString()
            else
                "Not selected"

            val orderData = hashMapOf(
                "userId" to uid, // save the user ID too
                "size" to size,
                "flavor" to flavor,
                "shape" to shape,
                "theme" to theme,
                "delivery" to delivery,
                "specialRequest" to if (specialRequest.isNotEmpty()) specialRequest else "None",
                "status" to "pending", // pending by default
                "timestamp" to System.currentTimeMillis()
            )

            // Save to user-specific collection
            db.collection("users")
                .document(uid)
                .collection("custom_orders")
                .add(orderData)
                .addOnSuccessListener {
                    // Also save to global custom_orders collection
                    db.collection("custom_orders")
                        .add(orderData)
                        .addOnSuccessListener {
                            Toast.makeText(this, "🎂 Order placed successfully!", Toast.LENGTH_LONG)
                                .show()
                            editTextSpecialRequests.text.clear()
                            shapeGroup.clearCheck()
                            deliveryGroup.clearCheck()
                            spinnerCakeSize.setSelection(0)
                            spinnerFlavor.setSelection(0)
                            spinnerTheme.setSelection(0)
                        }
                        .addOnFailureListener { e ->
                            Toast.makeText(
                                this,
                                "Error saving global order: ${e.message}",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                }
                .addOnFailureListener { e ->
                    Toast.makeText(this, "Error saving user order: ${e.message}", Toast.LENGTH_LONG)
                        .show()
                }
        }
    }
}