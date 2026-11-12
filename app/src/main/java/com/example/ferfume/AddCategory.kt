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

class AddCategory : AppCompatActivity() {

    private lateinit var imagePreview: ImageView
    private lateinit var nameInput: EditText
    private lateinit var saveButton: Button
    private lateinit var selectImageButton: Button

    private var selectedImageUri: Uri? = null
    private val firestore = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance("gs://ferfume-4457f.firebasestorage.app").reference

    companion object {
        private const val PICK_IMAGE_REQUEST = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_add_category)

        imagePreview = findViewById(R.id.imagePreview)
        nameInput = findViewById(R.id.editCategoryName)
        saveButton = findViewById(R.id.btnSaveCategory)
        selectImageButton = findViewById(R.id.btnSelectImage)

        selectImageButton.setOnClickListener { openFilePicker() }
        saveButton.setOnClickListener {
            if (validateInputs()) uploadImageAndSaveCategory()
        }
    }

    // Opens Files app (not gallery)
    private fun openFilePicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
        intent.addCategory(Intent.CATEGORY_OPENABLE)
        intent.type = "image/*"
        startActivityForResult(intent, PICK_IMAGE_REQUEST)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_IMAGE_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
            selectedImageUri = data.data
            imagePreview.setImageURI(selectedImageUri)
        }
    }

    private fun validateInputs(): Boolean {
        return when {
            nameInput.text.isEmpty() -> {
                nameInput.error = "Enter category name"
                false
            }
            selectedImageUri == null -> {
                Toast.makeText(this, "Please select an image", Toast.LENGTH_SHORT).show()
                false
            }
            else -> true
        }
    }

    private fun uploadImageAndSaveCategory() {
        if (selectedImageUri == null) return

        val fileName = "category_${UUID.randomUUID()}.jpg"
        val fileRef = storage.child("category_images/$fileName")

        fileRef.putFile(selectedImageUri!!)
            .addOnSuccessListener {
                fileRef.downloadUrl.addOnSuccessListener { uri ->
                    saveToFirestore(nameInput.text.toString(), uri.toString())
                }.addOnFailureListener { e ->
                    Toast.makeText(this, "Failed to get URL: ${e.message}", Toast.LENGTH_LONG).show()
                    Log.e("AddCategory", "Failed to get download URL", e)
                }
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Upload failed: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("AddCategory", "Upload failed", e)
            }
    }

    private fun saveToFirestore(name: String, imageUrl: String) {
        val data = hashMapOf(
            "name" to name,
            "imageUrl" to imageUrl,
            "createdAt" to System.currentTimeMillis()
        )

        firestore.collection("categoriesM")
            .add(data)
            .addOnSuccessListener {
                Toast.makeText(this, "Category added successfully!", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, Adminpannel::class.java))
            }
            .addOnFailureListener {
                Toast.makeText(this, "Failed to save category", Toast.LENGTH_SHORT).show()
            }
    }
}

