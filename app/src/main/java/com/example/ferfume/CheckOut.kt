package com.example.ferfume

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import java.util.*

class CheckOut : AppCompatActivity() {

    private lateinit var editTextProductName: EditText
    private lateinit var editTextProductBrand: EditText
    private lateinit var editTextProductPrice: EditText
    private lateinit var editTextProductDescription: EditText
    private lateinit var buttonSelectImage: Button
    private lateinit var buttonSaveProduct: Button
    private lateinit var imageViewProduct: ImageView

    private val db = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance()
    private var imageUri: Uri? = null

    // This launcher handles the result from the image picker
    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                imageUri = uri
                imageViewProduct.setImageURI(uri)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_check_out) // Assuming this is your new layout file

        // Find and assign UI elements from the layout
        editTextProductName = findViewById(R.id.editTextProductName)
        editTextProductBrand = findViewById(R.id.editTextProductBrand)
        editTextProductPrice = findViewById(R.id.editTextProductPrice)
        editTextProductDescription = findViewById(R.id.editTextProductDescription)
        buttonSelectImage = findViewById(R.id.buttonSelectImage)
        buttonSaveProduct = findViewById(R.id.buttonSaveProduct)
        imageViewProduct = findViewById(R.id.imageViewProduct)

        // Set up button click listeners
        buttonSelectImage.setOnClickListener {
            // Check for storage read permission before opening the image picker
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                // Request permission if not granted
                requestPermissions(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE), 100)
            } else {
                // Permission already granted, proceed to open image picker
                openImagePicker()
            }
        }

        buttonSaveProduct.setOnClickListener {
            // Trigger the process to save the product
            saveProductToFirestore()
        }
    }

    private fun openImagePicker() {
        val intent = Intent(Intent.ACTION_PICK)
        intent.type = "image/*"
        pickImageLauncher.launch(intent)
    }

    // Handle the result of the permission request
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            openImagePicker()
        } else {
            Toast.makeText(this, "Permission denied to read storage", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveProductToFirestore() {
        val name = editTextProductName.text.toString().trim()
        val brand = editTextProductBrand.text.toString().trim()
        val priceStr = editTextProductPrice.text.toString().trim()
        val description = editTextProductDescription.text.toString().trim()

        // Validate that all fields are filled and an image is selected
        if (name.isEmpty() || brand.isEmpty() || priceStr.isEmpty() || description.isEmpty() || imageUri == null) {
            Toast.makeText(this, "Please fill in all fields and select an image", Toast.LENGTH_SHORT).show()
            return
        }

        val price = priceStr.toDoubleOrNull() ?: run {
            Toast.makeText(this, "Invalid price format", Toast.LENGTH_SHORT).show()
            return
        }

        // Proceed to upload the image to Firebase Storage
        uploadImageToStorage(name, brand, price, description)
    }

    private fun uploadImageToStorage(name: String, brand: String, price: Double, description: String) {
        val fileName = UUID.randomUUID().toString() + ".jpg"
        val imageRef = storage.reference.child("product_images/$fileName")

        // Upload the image file
        imageRef.putFile(imageUri!!)
            .addOnSuccessListener {
                // Get the public download URL of the uploaded image
                imageRef.downloadUrl.addOnSuccessListener { uri ->
                    val imageUrl = uri.toString()
                    // Save the product details to Firestore
                    saveProductDetailsToFirestore(name, brand, price, description, imageUrl)
                }
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Image upload failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
    }

    private fun saveProductDetailsToFirestore(name: String, brand: String, price: Double, description: String, imageUrl: String) {
        val newProduct = hashMapOf(
            "name" to name,
            "brand" to brand,
            "price" to price,
            "description" to description,
            "imageUrl" to imageUrl
        )

        // Add the new product document to the "products" collection
        db.collection("products")
            .add(newProduct)
            .addOnSuccessListener {
                Toast.makeText(this, "Product added successfully! 🎉", Toast.LENGTH_LONG).show()
                clearInputFields()
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Error adding product: ${e.message}", Toast.LENGTH_LONG).show()
            }
    }

    private fun clearInputFields() {
        editTextProductName.text.clear()
        editTextProductBrand.text.clear()
        editTextProductPrice.text.clear()
        editTextProductDescription.text.clear()
        imageViewProduct.setImageResource(android.R.color.transparent)
        imageUri = null
    }
}