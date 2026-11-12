package com.example.ferfume

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.example.ferfume.ManageProducts

class Adminpannel : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_adminpannel)

        // Apply edge insets
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        // 🔹 Navigation cards
        findViewById<CardView>(R.id.cardUsers).setOnClickListener {
            startActivity(Intent(this, ManageUsers::class.java))
        }

        findViewById<CardView>(R.id.cardProducts).setOnClickListener {
            startActivity(Intent(this, ManageCtegories::class.java))
        }

        findViewById<CardView>(R.id.cardCarts).setOnClickListener {
            startActivity(Intent(this, AdminOrders::class.java))
        }
        findViewById<CardView>(R.id.cardStats).setOnClickListener {
            startActivity(Intent(this, AdminStats::class.java))
        }
    }
}
