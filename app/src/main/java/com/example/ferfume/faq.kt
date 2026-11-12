package com.example.ferfume

import android.content.Intent
import com.google.android.material.card.MaterialCardView
import android.widget.Toast
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.ferfume.GeneralAccountFaqActivity
class Faq : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_faq) // Replace with your actual layout name

        val cardGeneral = findViewById<MaterialCardView>(R.id.card_general)
        val cardOrders = findViewById<MaterialCardView>(R.id.card_orders)
        val cardProducts = findViewById<MaterialCardView>(R.id.card_products)
        val cardPayments = findViewById<MaterialCardView>(R.id.card_payments)
        val cardReturns = findViewById<MaterialCardView>(R.id.card_returns)
        val cardTechnical = findViewById<MaterialCardView>(R.id.card_technical)

        cardGeneral.setOnClickListener {
            val intent = Intent(this, GeneralAccountFaqActivity::class.java)
            startActivity(intent)
        }

        cardOrders.setOnClickListener {
            // Navigate to Orders & Shipping FAQ page
            val intent = Intent(this, Item_orders_shipping::class.java)
            startActivity(intent)
        }


        cardProducts.setOnClickListener {
            val intent = Intent(this, ProductsFaqActivity::class.java)
            startActivity(intent)
        }

        cardPayments.setOnClickListener {
            val intent = Intent(this, PaymentsFaqActivity::class.java)
            startActivity(intent)
        }


        cardReturns.setOnClickListener {
            val intent = Intent(this, ReturnsFaqActivity::class.java)
            startActivity(intent)
        }


        cardTechnical.setOnClickListener {
            val intent = Intent(this, TechnicalFaqActivity::class.java)
            startActivity(intent)
        }

    }
}


