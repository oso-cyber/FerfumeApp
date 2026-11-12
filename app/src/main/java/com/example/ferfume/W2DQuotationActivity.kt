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
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.*

class W2DQuotationActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val LOCATION_PERMISSION_REQUEST_CODE = 1
    private val WEB_URL = "https://ferfume-4457f.web.app"

    // TODO: Replace with your actual client id and secret
    private val CLIENT_ID = "CONFIGURE_CLIENT_ID"
    private val CLIENT_SECRET = "CONFIGURE_CLIENT_SECRET"
    private val TOKEN_URL = "https://api.staging.pargo.co.za/oauth/token"

    private var accessToken: String? = null
    private var selectedPickupPointCode: String? = null
    private var warehouseCode: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_check)

        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled = true
            setGeolocationEnabled(true)
        }

        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val js = """
                    javascript:
                    window.selectPargoPoint = function(item) {
                        var json = JSON.stringify(item.data);
                        Android.onPargoPointSelected(json);
                    }
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        } else {
            webView.loadUrl(WEB_URL)
        }

        // Step 1: Get access token first
        fetchAccessToken()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            webView.loadUrl(WEB_URL)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun onPargoPointSelected(json: String) {
            Log.d("PARGO_SELECTED", json)
            runOnUiThread {
                Toast.makeText(context, "Selected Pickup Point:\n$json", Toast.LENGTH_LONG).show()
            }

            val jsonObj = JSONObject(json)
            selectedPickupPointCode = jsonObj.optString("code")

            if (warehouseCode != null && selectedPickupPointCode != null && accessToken != null) {
                sendQuotationRequest(warehouseCode!!)
            } else if (accessToken == null) {
                Toast.makeText(this@W2DQuotationActivity, "Fetching access token, please wait...", Toast.LENGTH_SHORT).show()
                fetchAccessToken()
            } else {
                Toast.makeText(this@W2DQuotationActivity, "Waiting for warehouse info...", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun fetchAccessToken() {
        val client = OkHttpClient()

        val formBody = FormBody.Builder()
            .add("grant_type", "client_credentials")
            .add("client_id", CLIENT_ID)
            .add("client_secret", CLIENT_SECRET)
            .build()

        val request = Request.Builder()
            .url(TOKEN_URL)
            .post(formBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("TOKEN_FAIL", e.message ?: "Failed to get access token")
                runOnUiThread {
                    Toast.makeText(this@W2DQuotationActivity, "Failed to get access token", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val respBody = response.body?.string()
                Log.d("TOKEN_RESP", respBody ?: "No response")

                if (response.isSuccessful && respBody != null) {
                    val json = JSONObject(respBody)
                    accessToken = json.optString("access_token")
                    Log.d("ACCESS_TOKEN", "Got token: $accessToken")

                    // After getting token, fetch warehouses
                    fetchWarehouses()
                } else {
                    runOnUiThread {
                        Toast.makeText(this@W2DQuotationActivity, "Error getting access token", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun fetchWarehouses() {
        if (accessToken == null) {
            Log.e("WAREHOUSE_ERR", "Access token is null, cannot fetch warehouses")
            return
        }

        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://api.staging.pargo.co.za/warehouses")
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $accessToken")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("WAREHOUSES_FAIL", e.message ?: "Failed to fetch warehouses")
                runOnUiThread {
                    Toast.makeText(this@W2DQuotationActivity, "Failed to fetch warehouses", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val respBody = response.body?.string()
                Log.d("WAREHOUSES_RESP", respBody ?: "No response")

                if (response.isSuccessful && respBody != null) {
                    val json = JSONObject(respBody)
                    val dataArray = json.getJSONArray("data")
                    if (dataArray.length() > 0) {
                        warehouseCode = dataArray.getJSONObject(0)
                            .getJSONObject("attributes")
                            .getString("code")

                        Log.d("WAREHOUSE_CODE", "Using warehouse code: $warehouseCode")
                    }
                }
            }
        })
    }

    private fun sendQuotationRequest(warehouseCode: String) {
        if (accessToken == null) {
            Log.e("QUOTATION_ERR", "Access token is null, cannot send quotation")
            Toast.makeText(this@W2DQuotationActivity, "Access token missing, try again", Toast.LENGTH_SHORT).show()
            fetchAccessToken()
            return
        }

        val trackingCode = UUID.randomUUID().toString()

        val consignee = JSONObject().apply {
            put("firstName", "John")
            put("lastName", "Doe")
            put("email", "john.doe@example.com")
            put("phoneNumbers", JSONArray().put("+27123456789"))
            put("address1", "123 Main St")
            put("city", "Cape Town")
            put("province", "Western Cape")
            put("postalCode", "8001")
            put("country", "ZA")  // Use country code as per API spec
        }

        val parcel = JSONObject().apply {
            put("deadWeight", 1.5)
            put("cubicWeight", 2.0)
            put("length", 50)
            put("width", 50)
            put("height", 20)
        }

        val parcelsArray = JSONArray().apply {
            put(parcel)
        }

        val attributes = JSONObject().apply {
            put("warehouseAddressCode", warehouseCode)
            put("returnAddressCode", warehouseCode)
            put("trackingCode", trackingCode)
            put("pickupPointCode", selectedPickupPointCode)
            put("consignee", consignee)
            put("parcels", parcelsArray)
        }

        val data = JSONObject().apply {
            put("type", "W2D")
            put("attributes", attributes)
        }

        val bodyJson = JSONObject().apply {
            put("data", data)
        }

        val requestBody = bodyJson.toString().toRequestBody("application/json".toMediaType())

        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://api.staging.pargo.co.za/orders/quotation")
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $accessToken")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("QUOTATION_FAIL", e.message ?: "Failed to send quotation")
                runOnUiThread {
                    Toast.makeText(this@W2DQuotationActivity, "Quotation request failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val respBody = response.body?.string()
                Log.d("QUOTATION_RESP", respBody ?: "No response")

                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@W2DQuotationActivity, "Quotation sent successfully", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this@W2DQuotationActivity, "Quotation request failed: ${response.code}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        })
    }
}


