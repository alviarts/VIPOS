package id.alviarts.vipos.core.common

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Maps exceptions to user-friendly Indonesian error messages.
 *
 * Used by ViewModels to convert raw throwables from repositories
 * into messages suitable for Toast/Snackbar display.
 */
object ErrorMapper {

    fun toUserMessage(throwable: Throwable): String = when (throwable) {
        is UnknownHostException -> "Tidak ada koneksi internet"
        is ConnectException -> "Tidak bisa terhubung ke server"
        is SocketTimeoutException -> "Koneksi timeout, coba lagi"
        is IOException -> "Gangguan jaringan, coba lagi"
        else -> {
            val message = throwable.localizedMessage ?: throwable.message
            message ?: "Terjadi kesalahan. Coba lagi."
        }
    }

    fun isNetworkError(throwable: Throwable): Boolean = when (throwable) {
        is IOException,
        is UnknownHostException,
        is ConnectException,
        is SocketTimeoutException,
        -> true
        else -> false
    }

    fun isRetryable(throwable: Throwable): Boolean = when (throwable) {
        is IOException -> true
        is SocketTimeoutException -> true
        else -> false
    }
}
