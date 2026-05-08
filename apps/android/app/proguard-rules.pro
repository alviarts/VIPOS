# VIPOS ProGuard / R8 rules (P4-14)
# ===================================
# R8 is enabled for release builds to reduce APK size and
# improve cold start time. These rules supplement the consumer
# rules shipped by AndroidX, Hilt, Retrofit, and kotlinx-serialization.

# -- kotlinx-serialization ------------------------------------
# Keep @Serializable data classes and their generated serializers.
# Without this, R8 strips the companion $serializer() which
# causes runtime crashes on JSON decode.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep all @Serializable classes in the app's packages.
-keep,includedescriptorclasses class id.alviarts.vipos.**$$serializer { *; }
-keepclassmembers class id.alviarts.vipos.** {
    *** Companion;
}
-keepclasseswithmembers class id.alviarts.vipos.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# -- Retrofit --------------------------------------------------
# Retrofit uses reflection to create service implementations.
-keepattributes Signature, Exceptions
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# -- OkHttp ----------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**

# -- Room ------------------------------------------------------
# Room generates code at compile time; the runtime reflection
# is minimal. Keep the database class and DAOs.
-keep class id.alviarts.vipos.core.database.** { *; }

# -- Hilt ------------------------------------------------------
# Hilt's consumer rules handle most cases. This is a safety net
# for the generated _HiltModules and _Factory classes.
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# -- ZXing (QR code) ------------------------------------------
-keep class com.google.zxing.** { *; }

# -- General ---------------------------------------------------
# Keep the application class (Hilt entry point).
-keep class id.alviarts.vipos.VIPOSApplication { *; }
