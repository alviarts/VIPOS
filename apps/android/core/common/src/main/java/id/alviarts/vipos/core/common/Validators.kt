package id.alviarts.vipos.core.common

/**
 * Input validation utilities used across the app.
 */
object Validators {

    /** Validate Indonesian phone number (08xx or +628xx). */
    fun isValidPhone(phone: String): Boolean {
        val cleaned = phone.replace(Regex("[\\s\\-()]"), "")
        return cleaned.matches(Regex("^(\\+62|62|0)8[0-9]{8,12}$"))
    }

    /** Validate email format. */
    fun isValidEmail(email: String): Boolean {
        return email.matches(Regex("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$"))
    }

    /** Validate that a string is a positive integer. */
    fun isPositiveInteger(value: String): Boolean {
        val num = value.toLongOrNull() ?: return false
        return num > 0
    }

    /** Validate Indonesian NPWP format (15 or 16 digits). */
    fun isValidNpwp(npwp: String): Boolean {
        val cleaned = npwp.replace(Regex("[.\\-]"), "")
        return cleaned.matches(Regex("^[0-9]{15,16}$"))
    }

    /** Validate SKU format (alphanumeric + dash, 3-20 chars). */
    fun isValidSku(sku: String): Boolean {
        return sku.matches(Regex("^[A-Za-z0-9\\-]{3,20}$"))
    }

    /** Validate password strength (min 6 chars). */
    fun isStrongPassword(password: String): Boolean {
        return password.length >= 6
    }

    /** Normalize Indonesian phone to +62 format. */
    fun normalizePhone(phone: String): String {
        val cleaned = phone.replace(Regex("[\\s\\-()]"), "")
        return when {
            cleaned.startsWith("+62") -> cleaned
            cleaned.startsWith("62") -> "+$cleaned"
            cleaned.startsWith("0") -> "+62${cleaned.drop(1)}"
            else -> "+62$cleaned"
        }
    }
}
