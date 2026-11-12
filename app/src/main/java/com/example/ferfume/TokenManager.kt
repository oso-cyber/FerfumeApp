package com.example.ferfume

import android.content.Context
import android.content.SharedPreferences
class TokenManager(private val context: Context) {

    private val sharedPreferences = context.getSharedPreferences("TokenPrefs", Context.MODE_PRIVATE)

    // Save access token
    fun saveAccessToken(token: String) {
        sharedPreferences.edit().putString("access_token", token).apply()
    }

    // Retrieve access token
    fun getAccessToken(): String? {
        return sharedPreferences.getString("access_token", null)
    }

    // Save refresh token
    fun saveRefreshToken(token: String) {
        sharedPreferences.edit().putString("refresh_token", token).apply()
    }

    // Retrieve refresh token
    fun getRefreshToken(): String? {
        return sharedPreferences.getString("refresh_token", null)
    }
}
