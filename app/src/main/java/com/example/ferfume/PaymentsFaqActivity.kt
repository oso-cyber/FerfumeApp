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

class PaymentsFaqActivity : AppCompatActivity() {

    data class FaqItem(val question: String, val answer: String)

    // FAQ list for Payments & Billing
    private val faqList = listOf(
        FaqItem(
            "What payment methods do you accept?",
            "We accept Paystack, credit and debit cards, and other secure online payment methods."
        ),
        FaqItem(
            "Is my payment information safe?",
            "Yes. We use encrypted payment gateways to protect your financial details."
        ),
        FaqItem(
            "Can I save my payment details for future purchases?",
            "Yes, you can safely store your card details for faster checkout through Paystack’s secure vault."
        ),
        FaqItem(
            "My payment failed. What should I do?",
            "Double-check your card details and ensure you have sufficient funds. If the issue continues, contact your bank or our support team."
        ),
        FaqItem(
            "Do you offer refunds?",
            "Refunds are available for eligible orders according to our Refund Policy. Contact support within 7 days of purchase."
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_payments_faq)

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
