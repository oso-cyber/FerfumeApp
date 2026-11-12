package com.example.ferfume

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ShoppingPageActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_shopping_page2)

        // Apply window insets for padding
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        // --- Handle fragment selection ---
        if (savedInstanceState == null) {
            val fragmentToOpen = intent.getIntExtra("fragment_to_open", 0)

            val fragment = when (fragmentToOpen) {
                1 -> SecondFragment()
                else -> FirstFragment()
            }

            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, fragment) // Make sure this ID exists in activity_shopping_page2.xml
                .commit()
        }
    }
}
