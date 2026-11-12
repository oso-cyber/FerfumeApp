package com.example.ferfume
import android.util.Log
import android.content.Context
import android.widget.Toast
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaType
import android.os.Handler
import android.os.Looper
import okhttp3.RequestBody.Companion.toRequestBody


class PargoAuth(private val context: Context) {

    private val client = OkHttpClient()
    private val tokenManager = TokenManager(context)

    private val loginUrl = "https://api.staging.pargo.co.za/auth"
    private val refreshUrl = "https://api.staging.pargo.co.za/auth/refresh"
    private val apiUrl = "https://api.staging.pargo.co.za/some_endpoint"

    fun authenticate(onSuccess: (() -> Unit)? = null) {
        val jsonBody = JSONObject().apply {
            put("username", "morena.mahlatsi@icloud.com")
            put("password", "ThePerfumeCo!")
        }.toString()

        val request = buildPostRequest(loginUrl, jsonBody)

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handleFailure("Pargo Authentication Failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    response.body?.string()?.let { body ->
                        try {
                            val json = JSONObject(body)
                            tokenManager.saveAccessToken(json.getString("access_token"))
                            tokenManager.saveRefreshToken(json.getString("refresh_token"))
                            showToast("Authentication Successful")
                            onSuccess?.invoke()
                        } catch (e: Exception) {
                            showToast("Error parsing authentication response: ${e.message}")
                        }
                    }
                } else {
                    handleErrorResponse("Authenticatio Failed", response)
                }
            }
        })
    }

    fun makeApiRequest() {
        val token = tokenManager.getAccessToken()
        if (token == null) {
            showToast("Access token missing. Authenticating...")
            authenticate { makeApiRequest() }
            return
        }

        val request = Request.Builder()
            .url(apiUrl)
            .addHeader("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handleFailure("API Request Failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    response.body?.string()?.let { println("API Success: $it") }
                } else {
                    handleErrorResponse("API Request Failed", response)
                    if (response.code == 401) {
                        refreshToken { makeApiRequest() }
                    }
                }
            }
        })
    }

    private fun refreshToken(onSuccess: (() -> Unit)? = null) {
        val refreshToken = tokenManager.getRefreshToken()
        if (refreshToken == null) {
            showToast("No refresh token found. Re-authenticating...")
            authenticate(onSuccess)
            return
        }

        val jsonBody = JSONObject().apply {
            put("refresh_token", refreshToken)
        }.toString()

        val request = buildPostRequest(refreshUrl, jsonBody)

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handleFailure("Token Refresh Failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    response.body?.string()?.let { body ->
                        try {
                            val json = JSONObject(body)
                            tokenManager.saveAccessToken(json.getString("access_token"))
                            tokenManager.saveRefreshToken(json.getString("refresh_token"))
                            showToast("Token Refreshed Successfully")
                            onSuccess?.invoke()
                        } catch (e: Exception) {
                            showToast("Error parsing refresh response: ${e.message}")
                        }
                    }
                } else {
                    handleErrorResponse("Token Refresh Failed", response)
                }
            }
        })
    }

    private fun buildPostRequest(url: String, jsonBody: String): Request {
        val mediaType = "application/json".toMediaType()
        val requestBody = jsonBody.toRequestBody(mediaType)

        return Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()
    }

    private fun showToast(message: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context.applicationContext, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun handleFailure(tag: String, e: IOException) {
        e.printStackTrace()
        showToast("$tag: ${e.message}")
    }

    private fun handleErrorResponse(tag: String, response: Response) {
        val errorBody = response.body?.string()
        println("$tag: ${response.code} - ${response.message}")
        println("Error body: $errorBody")
        showToast("$tag: ${response.message}")
    }
}
