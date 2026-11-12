package com.example.ferfume

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.SignInButton
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings

class MainActivity : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth
    private lateinit var googleSignInClient: GoogleSignInClient
    private lateinit var firestore: FirebaseFirestore
    private lateinit var pargoAuth: PargoAuth

    // Track failed login attempts (basic brute-force protection)
    private var failedAttempts = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize Firebase
        auth = FirebaseAuth.getInstance()
        firestore = FirebaseFirestore.getInstance()
        firestore.firestoreSettings = FirebaseFirestoreSettings.Builder()
            .setPersistenceEnabled(true)
            .build()

        pargoAuth = PargoAuth(this)

        if (!isNetworkAvailable()) {
            Toast.makeText(this, "No internet connection. Some features may be unavailable.", Toast.LENGTH_LONG).show()
        }

        // Google Sign-In (⚠️ still hardcoded clientId here since local.properties is skipped)
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken("692168217074-bisvmvkuj9lk0j04s3k0adjugjqp6kof.apps.googleusercontent.com")
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        findViewById<SignInButton>(R.id.btnGoogleSignIn).setOnClickListener {
            signInWithGoogle()
        }

        // Email sign-in
        val btnEmailAuth = findViewById<Button>(R.id.btnEmailAuth)
        val emailEditText = findViewById<EditText>(R.id.editTextText)
        val passwordEditText = findViewById<EditText>(R.id.editTextTextPassword2)

        btnEmailAuth.setOnClickListener {
            val email = emailEditText.text.toString().trim()
            val password = passwordEditText.text.toString().trim()

            // Input validation
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                Toast.makeText(this, "Invalid email format", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (password.length < 8) {
                Toast.makeText(this, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            signInWithEmail(email, password)
        }

        // Register navigation
        findViewById<TextView>(R.id.textView).setOnClickListener {
            startActivity(Intent(this, Register::class.java))
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val networkInfo = connectivityManager.activeNetworkInfo
        return networkInfo != null && networkInfo.isConnected
    }

    private fun signInWithEmail(email: String, password: String) {
        if (failedAttempts >= 5) {
            Toast.makeText(this, "Too many failed attempts. Try again later.", Toast.LENGTH_LONG).show()
            return
        }

        // Check for admin credentials
        val adminEmail = "admin@example.com"  // replace with your admin email
        val adminPassword = "CONFIGURE_ADMIN_PASSWORD"       // replace with your admin password

        if (email == adminEmail && password == adminPassword) {
            // Admin login
            Toast.makeText(this, "Admin login successful", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, Adminpannel::class.java))
            finish()
            return
        }

        // Normal user login
        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    failedAttempts = 0 // reset on success
                    Toast.makeText(this, "Sign-in successful", Toast.LENGTH_SHORT).show()
                    checkOrCreateCart()
                    pargoAuth.authenticate()
                } else {
                    failedAttempts++
                    Toast.makeText(this, "Sign-in failed: ${task.exception?.message}", Toast.LENGTH_SHORT).show()
                }
            }
    }


    private fun signInWithGoogle() {
        val signInIntent = googleSignInClient.signInIntent
        startActivityForResult(signInIntent, RC_SIGN_IN)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            val task: Task<GoogleSignInAccount> = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(ApiException::class.java)!!
                firebaseAuthWithGoogle(account.idToken!!)
            } catch (e: ApiException) {
                Toast.makeText(this, "Google sign-in failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    checkOrCreateCart()
                    pargoAuth.authenticate()
                } else {

                }
            }
    }

    private fun checkOrCreateCart() {
        val userId = auth.currentUser?.uid ?: return
        val cartRef = firestore.collection("carts").document(userId)

        cartRef.get()
            .addOnSuccessListener { document ->
                if (document.exists()) {
                    redirectToHome()
                } else {
                    val newCart = hashMapOf(
                        "userId" to userId,
                        "items" to listOf<HashMap<String, Any>>(),
                        "timestamp" to System.currentTimeMillis()
                    )
                    cartRef.set(newCart)
                        .addOnSuccessListener {
                            redirectToHome()
                        }
                        .addOnFailureListener { e ->
                            Toast.makeText(this, "Failed to create cart: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                }
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Error checking cart: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private fun redirectToHome() {
        startActivity(Intent(this, Main::class.java))
        finish()
    }

    companion object {
        private const val RC_SIGN_IN = 9001
    }
}
