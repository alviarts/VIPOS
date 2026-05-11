package id.alviarts.vipos.core.designsystem.component

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Confirmation dialog for destructive actions.
 * 
 * Usage:
 * ```
 * ConfirmationDialog(
 *     title = "Delete Item",
 *     message = "Are you sure you want to delete this item?",
 *     confirmText = "Delete",
 *     onConfirm = { viewModel.delete() },
 *     onDismiss = { showDialog = false }
 * )
 * ```
 */
@Composable
fun ConfirmationDialog(
    title: String,
    message: String,
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    dismissText: String = "Cancel",
    isDestructive: Boolean = true,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = { Text(text = message) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = if (isDestructive) {
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    )
                } else {
                    ButtonDefaults.buttonColors()
                },
            ) {
                Text(text = confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = dismissText)
            }
        },
        modifier = modifier,
    )
}

/**
 * Delete confirmation dialog.
 */
@Composable
fun DeleteConfirmationDialog(
    itemName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ConfirmationDialog(
        title = "Delete $itemName",
        message = "Are you sure you want to delete this $itemName? This action cannot be undone.",
        confirmText = "Delete",
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        modifier = modifier,
        isDestructive = true,
    )
}

/**
 * Discard changes confirmation dialog.
 */
@Composable
fun DiscardChangesDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ConfirmationDialog(
        title = "Discard Changes",
        message = "You have unsaved changes. Are you sure you want to discard them?",
        confirmText = "Discard",
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        modifier = modifier,
        isDestructive = true,
    )
}

/**
 * Logout confirmation dialog.
 */
@Composable
fun LogoutConfirmationDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ConfirmationDialog(
        title = "Logout",
        message = "Are you sure you want to logout?",
        confirmText = "Logout",
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        modifier = modifier,
        isDestructive = false,
    )
}
