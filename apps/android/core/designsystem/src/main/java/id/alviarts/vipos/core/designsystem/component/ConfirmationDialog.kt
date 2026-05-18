package id.alviarts.vipos.core.designsystem.component

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource

/**
 * Confirmation dialog for destructive actions.
 * 
 * Features:
 * - Warning icon
 * - Title and message
 * - Confirm and dismiss buttons
 * - Customizable colors
 */
@Composable
fun ConfirmationDialog(
    title: String,
    message: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    confirmText: String = "Confirm",
    dismissText: String = "Cancel",
    icon: ImageVector = Icons.Default.Warning,
    isDestructive: Boolean = false,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isDestructive) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.primary
                },
            )
        },
        title = {
            Text(text = title)
        },
        text = {
            Text(text = message)
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm()
                    onDismiss()
                },
            ) {
                Text(
                    text = confirmText,
                    color = if (isDestructive) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = dismissText)
            }
        },
    )
}

/**
 * Delete confirmation dialog.
 * Pre-configured for delete actions.
 */
@Composable
fun DeleteConfirmationDialog(
    itemName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    ConfirmationDialog(
        title = stringResource(id.alviarts.vipos.R.string.confirm_delete_title),
        message = stringResource(id.alviarts.vipos.R.string.confirm_delete_message),
        confirmText = stringResource(id.alviarts.vipos.R.string.delete),
        dismissText = stringResource(id.alviarts.vipos.R.string.cancel),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        isDestructive = true,
    )
}

/**
 * Logout confirmation dialog.
 * Pre-configured for logout action.
 */
@Composable
fun LogoutConfirmationDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    ConfirmationDialog(
        title = stringResource(id.alviarts.vipos.R.string.confirm_logout_title),
        message = stringResource(id.alviarts.vipos.R.string.confirm_logout_message),
        confirmText = stringResource(id.alviarts.vipos.R.string.yes),
        dismissText = stringResource(id.alviarts.vipos.R.string.no),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        icon = MenuIcons.Logout,
    )
}

/**
 * Discard changes confirmation dialog.
 * Pre-configured for discarding unsaved changes.
 */
@Composable
fun DiscardChangesDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    ConfirmationDialog(
        title = stringResource(id.alviarts.vipos.R.string.confirm_discard_title),
        message = stringResource(id.alviarts.vipos.R.string.confirm_discard_message),
        confirmText = stringResource(id.alviarts.vipos.R.string.yes),
        dismissText = stringResource(id.alviarts.vipos.R.string.no),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        isDestructive = true,
    )
}
