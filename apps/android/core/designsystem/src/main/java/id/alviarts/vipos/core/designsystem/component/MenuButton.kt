package id.alviarts.vipos.core.designsystem.component

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/**
 * Primary menu button with icon and text.
 * Used for main actions in the app.
 */
@Composable
fun PrimaryMenuButton(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .widthIn(max = 360.dp),
        contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(text)
    }
}

/**
 * Secondary menu button with icon and text.
 * Used for secondary actions in the app.
 */
@Composable
fun SecondaryMenuButton(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .widthIn(max = 360.dp),
        contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(text)
    }
}

/**
 * Menu button with icon only (compact).
 * Used in toolbars or when space is limited.
 */
@Composable
fun IconMenuButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    androidx.compose.material3.IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
        )
    }
}

/**
 * Predefined menu icons for consistency across the app.
 */
object MenuIcons {
    val PointOfSale = Icons.Default.ShoppingCart
    val TransactionHistory = Icons.Default.History
    val OnlineOrders = Icons.Default.ShoppingBag
    val Dashboard = Icons.Default.Dashboard
    val Appointments = Icons.Default.Event
    val StockMovement = Icons.Default.Inventory
    val StockOpname = Icons.Default.Checklist
    val SalesReport = Icons.Default.Assessment
    val Employees = Icons.Default.People
    val Logout = Icons.Default.ExitToApp
    val Settings = Icons.Default.Settings
    val Search = Icons.Default.Search
    val Filter = Icons.Default.FilterList
    val Add = Icons.Default.Add
    val Edit = Icons.Default.Edit
    val Delete = Icons.Default.Delete
    val Save = Icons.Default.Save
    val Cancel = Icons.Default.Close
    val Refresh = Icons.Default.Refresh
    val Sync = Icons.Default.Sync
    val Customer = Icons.Default.Person
    val Product = Icons.Default.Inventory2
    val Payment = Icons.Default.Payment
    val Receipt = Icons.Default.Receipt
    val Calendar = Icons.Default.CalendarToday
    val Time = Icons.Default.Schedule
    val Location = Icons.Default.LocationOn
    val Phone = Icons.Default.Phone
    val Email = Icons.Default.Email
    val Info = Icons.Default.Info
    val Warning = Icons.Default.Warning
    val Error = Icons.Default.Error
    val Success = Icons.Default.CheckCircle
    val ArrowBack = Icons.Default.ArrowBack
    val ArrowForward = Icons.Default.ArrowForward
    val ArrowUp = Icons.Default.ArrowUpward
    val ArrowDown = Icons.Default.ArrowDownward
    val More = Icons.Default.MoreVert
    val Menu = Icons.Default.Menu
    val Notification = Icons.Default.Notifications
    val Language = Icons.Default.Language
    val Print = Icons.Default.Print
    val Download = Icons.Default.Download
    val Upload = Icons.Default.Upload
    val Share = Icons.Default.Share
    val Favorite = Icons.Default.Favorite
    val Star = Icons.Default.Star
    val Visibility = Icons.Default.Visibility
    val VisibilityOff = Icons.Default.VisibilityOff
}
