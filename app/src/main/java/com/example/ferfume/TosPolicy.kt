package com.example.ferfume

import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class TosPolicy : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_tos_policy)

        // Back button logic
        val backButton = findViewById<Button>(R.id.btn_back)
        backButton?.setOnClickListener {
            finish() // Return to previous screen
        }
    }
}
