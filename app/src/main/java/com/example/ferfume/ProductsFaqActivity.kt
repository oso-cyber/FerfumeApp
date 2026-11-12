package com.example.ferfume

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.card.MaterialCardView

class ProductsFaqActivity : AppCompatActivity() {

    // Data class for FAQ entries
    data class FaqItem(val question: String, val answer: String)

    // Product & Inventory FAQ list
    private val faqList = listOf(
        FaqItem(
            "How do I add a new product?",
            "Go to the 'My Products' section and tap on 'Add Product'. Fill in details such as name, description, price, and quantity."
        ),
        FaqItem(
            "Can I edit product details after adding them?",
            "Yes. Tap on the product you wish to edit, make your changes, and save."
        ),
        FaqItem(
            "How do I update inventory?",
            "You can update inventory levels by editing the product quantity directly in the 'My Products' section."
        ),
        FaqItem(
            "Can I delete a product?",
            "Yes. Simply select the product and choose 'Delete'. Confirm your action to remove it permanently."
        ),
        FaqItem(
            "Why is my product not visible to customers?",
            "Ensure your product is marked as 'Active' and that all required details are completed."
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_products_faq)

        // Toolbar setup
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        // Main container for FAQ cards
        val faqContainer = findViewById<LinearLayout>(R.id.faq_container)
        val inflater = LayoutInflater.from(this)

        // Dynamically inflate all FAQ cards
        faqList.forEach { faqItem ->
            val card = inflater.inflate(R.layout.item_faq_card, faqContainer, false) as MaterialCardView
            val questionText = card.findViewById<TextView>(R.id.tv_question)
            val answerText = card.findViewById<TextView>(R.id.tv_answer)
            val arrowIcon = card.findViewById<ImageView>(R.id.iv_arrow)

            questionText.text = faqItem.question
            answerText.text = faqItem.answer
            answerText.visibility = View.GONE
            arrowIcon.rotation = 0f

            // Expand/Collapse behavior
            card.setOnClickListener {
                val isVisible = answerText.visibility == View.VISIBLE

                if (isVisible) {
                    arrowIcon.animate().rotation(0f).setDuration(200).start()
                    answerText.animate().alpha(0f).setDuration(200).withEndAction {
                        answerText.visibility = View.GONE
                    }.start()
                } else {
                    arrowIcon.animate().rotation(180f).setDuration(200).start()
                    answerText.visibility = View.VISIBLE
                    answerText.alpha = 0f
                    answerText.animate().alpha(1f).setDuration(200).start()

                }
            }

            faqContainer.addView(card)
        }
    }
}
