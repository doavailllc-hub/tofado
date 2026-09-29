package com.tofado.merchant

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class AppVariantModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TofadoAppConfig"

  override fun getConstants(): Map<String, Any> = mapOf(
    "variant" to BuildConfig.APP_VARIANT,
    "applicationId" to BuildConfig.APPLICATION_ID
  )
}
