package com.example.ferfume

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.findNavController
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.setupActionBarWithNavController
import androidx.navigation.ui.setupWithNavController
import com.example.ferfume.databinding.ActivityHomeBinding
import com.google.android.material.bottomnavigation.BottomNavigationView

class Home : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inflate the layout using ViewBinding
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Reference the BottomNavigationView from the binding
        val navView: BottomNavigationView = binding.navView

        // Attempt to find the NavController for the NavHostFragment with error logging
        val navController = try {
            findNavController(R.id.nav_view)
        } catch (e: Exception) {
            Log.e("Home", "Error finding NavController", e)
            null
        }

        // If navController was successfully found, proceed with setup
        navController?.let {
            // Define the top-level destinations in the AppBarConfiguration
            val appBarConfiguration = AppBarConfiguration(
                setOf(
                    R.id.navigation_home, R.id.navigation_dashboard, R.id.navigation_notifications
                )
            )

            // Set up the ActionBar with the NavController and AppBarConfiguration
            setupActionBarWithNavController(it, appBarConfiguration)

            // Link the BottomNavigationView with the NavController
            navView.setupWithNavController(it)
        } ?: run {
            // Handle the case where navController is null
            Log.e("Home", "NavController is null. Navigation setup failed.")
        }
    }

    // Handle the Up button in the ActionBar
    override fun onSupportNavigateUp(): Boolean {
        val navController = findNavController(R.id.nav_host_fragment)
        return navController.navigateUp() || super.onSupportNavigateUp()
    }
}


