package com.example.ferfume

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.squareup.picasso.Picasso
import java.util.*

class EditProduct : AppCompatActivity() {

    private lateinit var productImage: ImageView
    private lateinit var selectImageButton: Button
    private lateinit var saveProductButton: Button
    private lateinit var nameEditText: EditText
    private lateinit var brandEditText: EditText
    private lateinit var priceEditText: EditText
    private lateinit var descriptionEditText: EditText
    private lateinit var progressBar: ProgressBar

    private var imageUri: Uri? = null
    private var currentImageUrl: String = ""
    private var productId: String = ""
    private lateinit var selectedCategory: String

    private val storageRef = FirebaseStorage.getInstance("gs://ferfume-4457f.firebasestorage.app").reference
    private val db = FirebaseFirestore.getInstance()

    companion object {
        private const val PICK_IMAGE_REQUEST = 1001
        const val EXTRA_PRODUCT_ID = "productId"
        const val EXTRA_CATEGORY_NAME = "categoryName"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_product)

        productImage = findViewById(R.id.productImage)
        selectImageButton = findViewById(R.id.selectImageButton)
        saveProductButton = findViewById(R.id.saveProductButton)
        nameEditText = findViewById(R.id.productName)
        brandEditText = findViewById(R.id.productBrand)
        priceEditText = findViewById(R.id.productPrice)
        descriptionEditText = findViewById(R.id.productDescription)
        progressBar = findViewById(R.id.progressBar)

        productId = intent.getStringExtra(EXTRA_PRODUCT_ID) ?: ""
        selectedCategory = intent.getStringExtra(EXTRA_CATEGORY_NAME) ?: ""

        // Load existing product data
        if (productId.isNotEmpty()) loadProduct()

        selectImageButton.setOnClickListener { openImagePicker() }
        saveProductButton.setOnClickListener { if (validateInputs()) uploadImageAndSaveProduct() }
    }

    private fun loadProduct() {
        progressBar.visibility = View.VISIBLE
        db.collection("products").document(productId).get()
            .addOnSuccessListener { doc ->
                if (doc.exists()) {
                    nameEditText.setText(doc.getString("name"))
                    brandEditText.setText(doc.getString("brand"))
                    priceEditText.setText(doc.getDouble("price")?.toString() ?: "")
                    descriptionEditText.setText(doc.getString("description"))
                    currentImageUrl = doc.getString("imageUrl") ?: ""
                    selectedCategory = doc.getString("category") ?: selectedCategory

                    if (currentImageUrl.isNotEmpty()) {
                        Picasso.get().load(currentImageUrl).into(productImage)
                    }
                }
                progressBar.visibility = View.GONE
            }
            .addOnFailureListener { e ->
                progressBar.visibility = View.GONE
                Toast.makeText(this, "Failed to load product: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("EditProduct", "Load failed", e)
            }
    }

    private fun openImagePicker() {
        val intent = Intent(Intent.ACTION_PICK)
        intent.type = "image/*"
        startActivityForResult(intent, PICK_IMAGE_REQUEST)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_IMAGE_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
            imageUri = data.data
            productImage.setImageURI(imageUri)
        }
    }

    private fun validateInputs(): Boolean {
        return when {
            nameEditText.text.isEmpty() -> { nameEditText.error = "Enter product name"; false }
            brandEditText.text.isEmpty() -> { brandEditText.error = "Enter brand"; false }
            priceEditText.text.isEmpty() -> { priceEditText.error = "Enter price"; false }
            descriptionEditText.text.isEmpty() -> { descriptionEditText.error = "Enter description"; false }
            else -> true
        }
    }

    private fun uploadImageAndSaveProduct() {
        progressBar.visibility = View.VISIBLE

        if (imageUri != null) {
            // New image selected → upload
            val fileName = UUID.randomUUID().toString()
            val fileRef = storageRef.child("images/$fileName")

            fileRef.putFile(imageUri!!)
                .addOnSuccessListener {
                    fileRef.downloadUrl.addOnSuccessListener { uri ->
                        saveProductToFirestore(uri.toString())
                    }.addOnFailureListener { e ->
                        progressBar.visibility = View.GONE
                        Toast.makeText(this, "Failed to get URL: ${e.message}", Toast.LENGTH_LONG).show()
                        Log.e("EditProduct", "Failed to get URL", e)
                    }
                }
                .addOnFailureListener { e ->
                    progressBar.visibility = View.GONE
                    Toast.makeText(this, "Upload failed: ${e.message}", Toast.LENGTH_LONG).show()
                    Log.e("EditProduct", "Upload failed", e)
                }
        } else {
            // No new image → keep existing
            saveProductToFirestore(currentImageUrl)
        }
    }

    private fun saveProductToFirestore(imageUrl: String) {
        val updatedProduct = hashMapOf(
            "name" to nameEditText.text.toString(),
            "brand" to brandEditText.text.toString(),
            "price" to priceEditText.text.toString().toDouble(),
            "description" to descriptionEditText.text.toString(),
            "imageUrl" to imageUrl,
            "category" to selectedCategory,
            "updatedAt" to System.currentTimeMillis()
        )

        db.collection("products").document(productId)
            .set(updatedProduct)
            .addOnSuccessListener {
                progressBar.visibility = View.GONE
                Toast.makeText(this, "Product updated successfully!", Toast.LENGTH_SHORT).show()
                finish()
            }
            .addOnFailureListener { e ->
                progressBar.visibility = View.GONE
                Toast.makeText(this, "Failed to update product: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("EditProduct", "Update failed", e)
            }
    }
}
