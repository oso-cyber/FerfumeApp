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

class Item_orders_shipping : AppCompatActivity() {

    data class FaqItem(val question: String, val answer: String)

    private val faqList = listOf(
        FaqItem(
            "How long does shipping take?",
            "Orders are processed within 1–2 business days. Delivery typically takes 2–5 business days depending on your location and chosen shipping method."
        ),
        FaqItem(
            "Do you offer international shipping?",
            "Currently, Ferfume ships only within South Africa. We’re working to expand our international shipping soon."
        ),
        FaqItem(
            "How can I track my order?",
            "Once your order is shipped, you’ll receive an email or app notification with your tracking details and estimated delivery date."
        ),
        FaqItem(
            "What if my package is delayed or lost?",
            "If your package is delayed beyond the expected delivery time, please contact our support team. Lost packages will be investigated and replaced where applicable."
        ),
        FaqItem(
            "Can I change my shipping address after placing an order?",
            "You can update your address before your order is processed by contacting support. Once the order is shipped, changes are no longer possible."
        ),
        FaqItem(
            "Do you charge for delivery?",
            "Standard delivery is free for orders above R800. Orders below that amount may include a small delivery fee depending on location."
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_item_orders_shipping)

        // Toolbar setup
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        val faqContainer = findViewById<LinearLayout>(R.id.faq_container)
        val inflater = LayoutInflater.from(this)

        faqList.forEach { faqItem ->
            val card = inflater.inflate(R.layout.item_faq_card, faqContainer, false) as MaterialCardView
            val questionText = card.findViewById<TextView>(R.id.tv_question)
            val answerText = card.findViewById<TextView>(R.id.tv_answer)
            val arrowIcon = card.findViewById<ImageView>(R.id.iv_arrow)

            questionText.text = faqItem.question
            answerText.text = faqItem.answer
            answerText.visibility = View.GONE
            arrowIcon.rotation = 0f

            questionText.setOnClickListener {
                val isVisible = answerText.visibility == View.VISIBLE

                if (isVisible) {
                    // Collapse with arrow rotation
                    arrowIcon.animate().rotation(0f).setDuration(200).start()
                    answerText.animate().alpha(0f).setDuration(200).withEndAction {
                        answerText.visibility = View.GONE
                    }.start()
                } else {
                    // Expand with arrow rotation
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
