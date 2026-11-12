package com.example.ferfume

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

class Edit : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit)

        // Fetch and print warehouse list
        fetchWarehouses()
    }

    private fun fetchWarehouses() {
        val client = OkHttpClient()

        val request = Request.Builder()
            .url("https://api.staging.pargo.co.za/warehouses")
            .addHeader("Authorization", "Bearer YOUR_ACCESS_TOKEN") // Replace with real token
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("WAREHOUSES_FAIL", "Failed to fetch: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (!response.isSuccessful || responseBody == null) {
                    Log.e("WAREHOUSES_ERROR", "Invalid response: ${response.code}")
                    return
                }

                try {
                    val json = JSONObject(responseBody)
                    val data: JSONArray = json.getJSONArray("data")
                    for (i in 0 until data.length()) {
                        val attributes = data.getJSONObject(i).getJSONObject("attributes")
                        val code = attributes.optString("code", "N/A")
                        val name = attributes.optString("name", "Unnamed")
                        val city = attributes.optString("city", "Unknown")

                        Log.d("WAREHOUSE", "Code: $code | Name: $name | City: $city")
                    }
                } catch (e: Exception) {
                    Log.e("WAREHOUSE_PARSE", "Error parsing JSON: ${e.message}")
                }
            }
        })
    }
}
