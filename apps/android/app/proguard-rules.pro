# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class nl.devrijehond.app.api.models.** {
    *** Companion;
}
-keep class nl.devrijehond.app.api.models.**$Companion { *; }

# Retrofit
-keepattributes Signature, Exceptions
-keep interface nl.devrijehond.app.api.apis.** { *; }
