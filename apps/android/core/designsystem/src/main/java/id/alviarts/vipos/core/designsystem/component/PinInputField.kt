package id.alviarts.vipos.core.designsystem.component

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * PIN input field with individual digit boxes (P3-14 AC #5).
 *
 * Used for manager PIN verification when variance exceeds
 * threshold, and for employee PIN at shift start.
 *
 * Renders N boxes (default 4) that fill as the user types.
 */
@Composable
fun PinInputField(
    value: String,
    onValueChange: (String) -> Unit,
    pinLength: Int = 4,
    modifier: Modifier = Modifier,
) {
    BasicTextField(
        value = value,
        onValueChange = { newValue ->
            if (newValue.length <= pinLength && newValue.all { it.isDigit() }) {
                onValueChange(newValue)
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        decorationBox = {
            Row(
                modifier = modifier,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                repeat(pinLength) { index ->
                    val char = value.getOrNull(index)
                    val isFocused = index == value.length
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .border(
                                width = if (isFocused) 2.dp else 1.dp,
                                color = if (isFocused) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.outline
                                },
                                shape = RoundedCornerShape(8.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (char != null) "●" else "",
                            style = MaterialTheme.typography.headlineSmall,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        },
    )
}
