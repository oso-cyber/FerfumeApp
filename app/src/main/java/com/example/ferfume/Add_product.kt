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
import java.util.*
class Add_product : AppCompatActivity() {

    private lateinit var productImage: ImageView
    private lateinit var selectImageButton: Button
    private lateinit var saveProductButton: Button
    private lateinit var nameEditText: EditText
    private lateinit var brandEditText: EditText
    private lateinit var priceEditText: EditText
    private lateinit var descriptionEditText: EditText
    private lateinit var progressBar: ProgressBar

    private var imageUri: Uri? = null
    private val storageRef = FirebaseStorage.getInstance("gs://ferfume-4457f.firebasestorage.app").reference
    private val db = FirebaseFirestore.getInstance()

    private lateinit var selectedCategory: String // NEW: store category

    companion object {
        private const val PICK_IMAGE_REQUEST = 1001
        const val EXTRA_CATEGORY_NAME = "categoryName" // optional constant
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_add_product)

        // Get category from intent
        selectedCategory = intent.getStringExtra(EXTRA_CATEGORY_NAME) ?: ""

        productImage = findViewById(R.id.productImage)
        selectImageButton = findViewById(R.id.selectImageButton)
        saveProductButton = findViewById(R.id.saveProductButton)
        nameEditText = findViewById(R.id.productName)
        brandEditText = findViewById(R.id.productBrand)
        priceEditText = findViewById(R.id.productPrice)
        descriptionEditText = findViewById(R.id.productDescription)
        progressBar = findViewById(R.id.progressBar)

        selectImageButton.setOnClickListener { openImagePicker() }
        saveProductButton.setOnClickListener { if (validateInputs()) uploadImageAndSaveProduct() }
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
            imageUri == null -> { Toast.makeText(this, "Please select an image", Toast.LENGTH_SHORT).show(); false }
            else -> true
        }
    }

    private fun uploadImageAndSaveProduct() {
        if (imageUri == null) return

        progressBar.visibility = View.VISIBLE
        val fileName = UUID.randomUUID().toString()
        val fileRef = storageRef.child("images/$fileName")

        fileRef.putFile(imageUri!!)
            .addOnSuccessListener {
                fileRef.downloadUrl.addOnSuccessListener { uri ->
                    progressBar.visibility = View.GONE
                    saveProductToFirestore(uri.toString())
                }.addOnFailureListener { e ->
                    progressBar.visibility = View.GONE
                    Toast.makeText(this, "Failed to get URL: ${e.message}", Toast.LENGTH_LONG).show()
                    Log.e("AddProduct", "Failed to get URL", e)
                }
            }
            .addOnFailureListener { e ->
                progressBar.visibility = View.GONE
                Toast.makeText(this, "Upload failed: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("AddProduct", "Upload failed", e)
            }
    }

    private fun saveProductToFirestore(imageUrl: String) {
        val product = hashMapOf(
            "name" to nameEditText.text.toString(),
            "brand" to brandEditText.text.toString(),
            "price" to priceEditText.text.toString().toDouble(),
            "description" to descriptionEditText.text.toString(),
            "imageUrl" to imageUrl,
            "category" to selectedCategory, // SAVE THE CATEGORY
            "createdAt" to System.currentTimeMillis()
        )

        db.collection("products")
            .add(product)
            .addOnSuccessListener { docRef ->
                Toast.makeText(this, "Product added successfully!", Toast.LENGTH_SHORT).show()

                // Send back result including the category
                val intent = Intent(this, ManageCtegories::class.java)
                intent.putExtra("categoryName", selectedCategory) // pass category
                startActivity(intent)


                finish() // close Add_product
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to add product", Toast.LENGTH_SHORT).show()
            }
    }

}
