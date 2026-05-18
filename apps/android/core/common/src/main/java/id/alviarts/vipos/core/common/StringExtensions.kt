package id.alviarts.vipos.core.common

/**
 * String extension functions used across the app.
 */

/** Capitalize first letter only: "hello world" -> "Hello world" */
fun String.capitalizeFirst(): String {
    if (isEmpty()) return this
    return this[0].uppercase() + substring(1)
}

/** Truncate with ellipsis: "Hello World".truncate(5) -> "Hello…" */
fun String.truncate(maxLength: Int, suffix: String = "…"): String {
    if (length <= maxLength) return this
    return take(maxLength) + suffix
}

/** Remove all whitespace: "  hello  world  " -> "helloworld" */
fun String.removeWhitespace(): String = replace(Regex("\\s+"), "")

/** Convert to slug: "Hello World!" -> "hello-world" */
fun String.toSlug(): String = lowercase()
    .replace(Regex("[^a-z0-9\\s-]"), "")
    .replace(Regex("\\s+"), "-")
    .replace(Regex("-+"), "-")
    .trim('-')

/** Mask phone number: "081234567890" -> "0812****7890" */
fun String.maskPhone(): String {
    if (length < 8) return this
    val prefix = take(4)
    val suffix = takeLast(4)
    val masked = "*".repeat(length - 8)
    return "$prefix$masked$suffix"
}

/** Mask email: "user@example.com" -> "u***@example.com" */
fun String.maskEmail(): String {
    val parts = split("@")
    if (parts.size != 2) return this
    val local = parts[0]
    val domain = parts[1]
    val maskedLocal = if (local.length > 1) {
        local[0] + "*".repeat(local.length - 1)
    } else {
        local
    }
    return "$maskedLocal@$domain"
}

/** Check if string is a valid Indonesian phone number */
fun String.isIndonesianPhone(): Boolean =
    Validators.isValidPhone(this)

/** Normalize to +62 format */
fun String.toIndonesianPhone(): String =
    Validators.normalizePhone(this)
