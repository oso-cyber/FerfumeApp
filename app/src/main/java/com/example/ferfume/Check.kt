package com.example.ferfume

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class Check : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var tokenManager: TokenManager

    private val LOCATION_PERMISSION_REQUEST_CODE = 1
    private val WEB_URL = "https://map.pargo.co.za/?token=uvwNZGSiUypW1GHiTGFZiqWWu2W4s78SwUIEWp10GKogqJKt"

    private var selectedPickupCode: String? = null
    private var pickupAddress: String? = null
    private var warehouseCode: String? = null // optional

    private val PREFS_NAME = "pickupPrefs"
    private val KEY_PICKUP_CODE = "pickupCode"
    private val KEY_PICKUP_ADDRESS = "pickupAddress"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_check)

        tokenManager = TokenManager(this)
        webView = findViewById(R.id.webView)

        // Setup WebView
        webView.settings.apply {
            javaScriptEnabled = true
            setGeolocationEnabled(true)
        }

        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                callback?.invoke(origin, true, false)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                val js = """
                    javascript:
                    window.selectPargoPoint = function(item) {
                        var payload = {
                            code: item?.data?.pargoPointCode,
                            address: item?.data?.addressSms
                        };
                        Android.onPargoPointSelected(JSON.stringify(payload));
                    }

                    var btn = document.createElement('button');
                    btn.innerText = 'Confirm Pickup';
                    btn.style.position = 'fixed';
                    btn.style.bottom = '20px';
                    btn.style.right = '20px';
                    btn.style.padding = '12px 20px';
                    btn.style.backgroundColor = '#2196F3';
                    btn.style.color = '#fff';
                    btn.style.border = 'none';
                    btn.style.borderRadius = '4px';
                    btn.style.zIndex = '9999';
                    btn.onclick = function() {
                        Android.onConfirmClicked();
                    };
                    document.body.appendChild(btn);
                """.trimIndent()

                webView.evaluateJavascript(js, null)
            }
        }

        // Ask for permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        } else {
            webView.loadUrl(WEB_URL)
        }

        // Optional: Fetch warehouse code
        fetchWarehouses()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            webView.loadUrl(WEB_URL)
        } else {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    // Interface for JS callbacks
    inner class WebAppInterface(private val context: Context) {

        @JavascriptInterface
        fun onPargoPointSelected(json: String) {
            try {
                val obj = JSONObject(json)
                val code = obj.optString("code")
                val address = obj.optString("address")

                selectedPickupCode = code
                pickupAddress = address

                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().apply {
                    putString(KEY_PICKUP_CODE, code)
                    putString(KEY_PICKUP_ADDRESS, address)
                    apply()
                }

                runOnUiThread {
                    Toast.makeText(context, "✅ Pickup point selected!", Toast.LENGTH_SHORT).show()
                }

            } catch (e: Exception) {
                Log.e("PARGO_PICK", "Failed to parse selection: ${e.message}")
            }
        }

        @JavascriptInterface
        fun onConfirmClicked() {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val code = selectedPickupCode ?: prefs.getString(KEY_PICKUP_CODE, null)

            if (code.isNullOrEmpty()) {
                runOnUiThread {
                    Toast.makeText(context, "❌ No pickup point selected!", Toast.LENGTH_LONG).show()
                }
                return
            }

            createPargoOrder(
                warehouseCode = null, // leave empty
                pickupPointCode = code,
                firstName = "John",
                lastName = "Doe",
                email = "john@example.com",
                phoneNumber = "+27123456789",
                height = 10.0,
                width = 10.0,
                length = 10.0,
                weight = 1.5
            )
        }
    }

    // Optional warehouse fetch
    private fun fetchWarehouses() {
        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://api.staging.pargo.co.za/warehouses")
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("WAREHOUSE_FAIL", e.message ?: "Error")
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                if (response.isSuccessful && body != null) {
                    val json = JSONObject(body)
                    val warehouses = json.getJSONArray("data")
                    if (warehouses.length() > 0) {
                        warehouseCode = warehouses.getJSONObject(0)
                            .getJSONObject("attributes")
                            .getString("code")
                        Log.d("WAREHOUSE", "Loaded warehouse: $warehouseCode")
                    }
                }
            }
        })
    }

    private fun createPargoOrder(
        warehouseCode: String?,
        pickupPointCode: String,
        firstName: String,
        lastName: String,
        email: String,
        phoneNumber: String,
        height: Double,
        width: Double,
        length: Double,
        weight: Double
    ) {
        val accessToken = tokenManager.getAccessToken()
        if (accessToken.isNullOrBlank()) {
            Toast.makeText(this, "Missing access token", Toast.LENGTH_SHORT).show()
            return
        }

        val consignee = JSONObject().apply {
            put("firstName", firstName)
            put("lastName", lastName)
            put("email", email)
            put("phoneNumber", phoneNumber)
        }

        val parcel = JSONObject().apply {
            put("height", height)
            put("width", width)
            put("length", length)
            put("weight", weight)
        }

        val attributes = JSONObject().apply {
            put("pickupPointCode", pickupPointCode)
            put("consignee", consignee)
            put("parcel", parcel)
            if (!warehouseCode.isNullOrEmpty()) {
                put("warehouseAddressCode", warehouseCode)
                put("returnAddressCode", warehouseCode)
            }
        }

        val requestJson = JSONObject().apply {
            put("data", JSONObject().apply {
                put("type", "W2P")
                put("attributes", attributes)
            })
        }

        val body = requestJson.toString().toRequestBody("application/json".toMediaType())
        val client = OkHttpClient()

        val request = Request.Builder()
            .url("https://api.staging.pargo.co.za/orders")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("ORDER_FAIL", e.message ?: "Unknown error")
                runOnUiThread {
                    Toast.makeText(this@Check, "Order creation failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val res = response.body?.string()
                Log.d("ORDER_RESPONSE", res ?: "No response")
                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@Check, "✅ Order placed!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@Check, "❌ Failed: $res", Toast.LENGTH_LONG).show()
                    }
                }
            }
        })
    }
}
