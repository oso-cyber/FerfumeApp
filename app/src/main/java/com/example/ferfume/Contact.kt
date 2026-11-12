package com.example.ferfume

import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import java.util.*

class Contact : AppCompatActivity() {

    private lateinit var etMessage: TextInputEditText
    private lateinit var btnSubmit: Button
    private val firestore = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contact)

        etMessage = findViewById(R.id.et_message)
        btnSubmit = findViewById(R.id.btn_submit)

        btnSubmit.setOnClickListener {
            val message = etMessage.text.toString().trim()
            if (message.isEmpty()) {
                Toast.makeText(this, "Please enter a message", Toast.LENGTH_SHORT).show()
            } else {
                saveMessage(message)
            }
        }
    }

    private fun saveMessage(message: String) {
        val user = auth.currentUser
        if (user == null) {
            Toast.makeText(this, "You must be logged in to send a message", Toast.LENGTH_SHORT).show()
            return
        }

        val messageData = hashMapOf(
            "userId" to user.uid,
            "userEmail" to user.email,
            "message" to message,
            "timestamp" to Timestamp.now() // Firestore Timestamp
        )

        firestore.collection("support_messages")
            .add(messageData)
            .addOnSuccessListener {
                Toast.makeText(this, "Message sent!", Toast.LENGTH_SHORT).show()
                etMessage.text?.clear()
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }
}
