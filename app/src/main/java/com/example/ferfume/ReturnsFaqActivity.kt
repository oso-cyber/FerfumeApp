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

class ReturnsFaqActivity : AppCompatActivity() {

    data class FaqItem(val question: String, val answer: String)

    private val faqList = listOf(
        FaqItem(
            "What is your return policy?",
            "We accept returns within 7 days of delivery if the item is unopened, unused, and in its original packaging."
        ),
        FaqItem(
            "How do I request a return?",
            "Go to your Orders page, select the item, and click 'Request Return'. Our support team will guide you through the process."
        ),
        FaqItem(
            "Do I have to pay for return shipping?",
            "If the return is due to our error (like a damaged or incorrect item), return shipping is free. Otherwise, you’ll cover the return cost."
        ),
        FaqItem(
            "When will I get my refund?",
            "Once your return is received and inspected, your refund will be processed within 5–10 business days, depending on your bank."
        ),
        FaqItem(
            "Can I exchange a product instead of a refund?",
            "Yes, exchanges are possible if the requested product is in stock. Contact our support team to arrange it."
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_returns_faq)

        // Toolbar setup
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        // FAQ container
        val faqContainer = findViewById<LinearLayout>(R.id.faq_container)
        val inflater = LayoutInflater.from(this)

        // Inflate FAQ cards dynamically
        faqList.forEach { faqItem ->
            val card = inflater.inflate(R.layout.item_faq_card, faqContainer, false) as MaterialCardView
            val questionText = card.findViewById<TextView>(R.id.tv_question)
            val answerText = card.findViewById<TextView>(R.id.tv_answer)
            val arrowIcon = card.findViewById<ImageView>(R.id.iv_arrow)

            questionText.text = faqItem.question
            answerText.text = faqItem.answer
            answerText.visibility = View.GONE
            arrowIcon.rotation = 0f

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
