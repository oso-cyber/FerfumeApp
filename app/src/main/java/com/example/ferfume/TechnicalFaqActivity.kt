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

class TechnicalFaqActivity : AppCompatActivity() {

    data class FaqItem(val question: String, val answer: String)

    private val faqList = listOf(
        FaqItem(
            "The app won’t open or keeps crashing. What can I do?",
            "Try closing the app completely and reopening it. If that doesn’t help, clear the cache or reinstall the app."
        ),
        FaqItem(
            "I can’t log in to my account. What should I check?",
            "Make sure you’re using the correct email and password. If you forgot your password, tap 'Forgot Password' to reset it."
        ),
        FaqItem(
            "Why aren’t notifications appearing?",
            "Ensure app notifications are enabled in your device’s settings. Also check that battery saver mode isn’t restricting the app."
        ),
        FaqItem(
            "The app isn’t updating my order information.",
            "Check your internet connection and try refreshing the app. If the problem persists, log out and back in again."
        ),
        FaqItem(
            "How do I report a bug or issue?",
            "Go to Settings → Help & Support → Report a Problem, and describe the issue in detail. Screenshots help us resolve it faster."
        )
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_technical_faq)

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

