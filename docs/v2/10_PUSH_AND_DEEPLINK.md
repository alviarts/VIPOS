# 10 · Push Notifications & Deep Linking

> Push and deep linking are entwined: most pushes carry a deep link. This doc covers both.

## §1 FCM channels

Recommended channel set on Android 8+:

| Channel id | Importance | Sound | Vibration | Bypass DND | Use |
|---|---|---|---|---|---|
| `pos_orders` | HIGH | Default | Yes | Yes | New marketplace order, kitchen ready |
| `kds` | HIGH | Custom (kitchen ding) | Yes | Yes | KDS new ticket |
| `cashier_alerts` | HIGH | Default | Yes | No | Void approval needed, cash drop, void/refund pending manager PIN |
| `system` | DEFAULT | Default | No | No | App update, subscription warning, server maintenance |
| `marketing` | LOW | None | No | No | Promo announcements, articles |
| `payroll` | DEFAULT | Default | No | No | Slip gaji terbit |
| `reports` | LOW | None | No | No | Daily report digest |

Create channels at app start:
```kotlin
val nm = getSystemService(NotificationManager::class.java)
listOf(
  NotificationChannel("pos_orders", "Pesanan Baru", IMPORTANCE_HIGH).apply { ... },
  ...
).forEach(nm::createNotificationChannel)
```

## §2 Payload shape

Recommended FCM payload (data-only message for guaranteed delivery / custom UI):
```json
{
  "to": "<fcm_token>",
  "data": {
    "category": "ORDER_NEW",
    "title": "Pesanan baru dari GoFood",
    "body": "Order #GF-12345 — Rp 50.000",
    "channel": "pos_orders",
    "deep_link": "vipos://order/online/789",
    "entity_id": "789",
    "outlet_id": "5",
    "received_at": "2026-05-03T09:30:00Z"
  },
  "android": {
    "priority": "high"
  }
}
```

**Why data-only?** Allows the app to control:
- Notification UI (rich layout, actions)
- Sound (per-channel)
- Whether to show notification at all (suppress if app is foreground in the relevant screen)

## §3 Categories

| Category | Trigger | Channel | Default action |
|---|---|---|---|
| `ORDER_NEW` | New marketplace order | `pos_orders` | Open online order detail |
| `ORDER_CANCEL` | Marketplace order cancelled | `pos_orders` | Open detail |
| `KDS_TICKET` | Kitchen receives ticket | `kds` | Open KDS detail |
| `KDS_BUMP` | Kitchen marks ready | `pos_orders` | Highlight order in cashier list |
| `VOID_APPROVAL` | Cashier requests void | `cashier_alerts` | Open void approval (manager only) |
| `STOCK_LOW` | Stock falls below threshold | `system` | Open product detail |
| `STOCK_RECEIVED` | GR posted | `system` | Open GR detail |
| `MUTATION_ARRIVED` | Inbound mutation | `system` | Open mutation detail |
| `RESERVATION_REMINDER` | 1 hour before reservation | `pos_orders` | Open reservation |
| `PAYROLL_AVAILABLE` | Slip gaji terbit | `payroll` | Open payroll detail |
| `SUBSCRIPTION_WARNING` | Tier expires in 7 days | `system` | Open subscription |
| `APP_UPDATE_AVAILABLE` | New app version | `system` | Open Play Store |
| `MARKETING` | Promo announcement | `marketing` | Open URL |
| `DAILY_REPORT` | End-of-day digest | `reports` | Open report |

## §4 Deep link scheme

Use both:
1. Custom scheme: `vipos://...` (most reliable, no domain registration)
2. App Link with HTTPS: `https://app.vipos.id/...` (preferred for marketing emails, SEO)

### Path inventory

| Path | Maps to |
|---|---|
| `vipos://home` | Dashboard |
| `vipos://pos` | POS / Kasir |
| `vipos://pos?order=clientId` | POS with cart restored |
| `vipos://order/online/:id` | Online order detail |
| `vipos://order/online?status=NEW` | Online order list filtered |
| `vipos://order/history/:id` | Local transaction detail |
| `vipos://kds` | KDS view |
| `vipos://kds/ticket/:id` | KDS specific ticket |
| `vipos://product/:id` | Product detail |
| `vipos://product/new` | Add product |
| `vipos://customer/:id` | Customer detail |
| `vipos://customer/new` | Add customer |
| `vipos://shift/active` | Active shift |
| `vipos://shift/open` | Buka kasir |
| `vipos://shift/close` | Tutup kasir |
| `vipos://stock` | Stock list |
| `vipos://stock/opname/:id` | Opname detail |
| `vipos://stock/po/:id` | PO detail |
| `vipos://stock/mutation/:id` | Mutation detail |
| `vipos://promo/:id` | Promo detail |
| `vipos://promo/new` | Add promo |
| `vipos://campaign/:id` | Campaign detail |
| `vipos://reservation/:id` | Reservation detail |
| `vipos://employee/:id` | Employee detail |
| `vipos://attendance` | Attendance log |
| `vipos://payroll/:id` | Payroll detail |
| `vipos://report/:type?from=&to=&outlet=` | Specific report |
| `vipos://settings` | Settings root |
| `vipos://settings/printer` | Printer config |
| `vipos://settings/subscription` | Subscription |
| `vipos://help` | Help center |

### Handling

```kotlin
// AndroidManifest.xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="vipos" />
</intent-filter>
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="https"
    android:host="app.vipos.id" />
</intent-filter>
```

Compose Navigation:
```kotlin
NavHost(navController, "home") {
  composable("home") { ... }
  composable(
    "order/online/{id}",
    deepLinks = listOf(navDeepLink { uriPattern = "vipos://order/online/{id}" })
  ) { backStack ->
    OnlineOrderScreen(id = backStack.arguments?.getString("id"))
  }
  ...
}
```

### Permission gate on deep link

If user lacks permission for the destination → show "Tidak memiliki akses" then go back to home.

If user is logged out → save intent to launchpad, prompt login, then resume.

## §5 Token lifecycle

1. On first launch (after login), call `FirebaseMessaging.getInstance().token` (suspending).
2. Send to server: `POST /api/v1/device-token`
   ```json
   { "fcm_token": "...", "device_model": "...", "app_version": 142, "terminal_id": "..." }
   ```
3. On token refresh (`onNewToken` callback), re-send.
4. On logout, `DELETE /api/v1/device-token` to deregister this terminal.

## §6 Foreground vs background

When app is **foreground in the relevant screen** (e.g. user is already on online-order list and `ORDER_NEW` arrives):
- Don't show notification banner.
- Update list in-place.
- Optional: small in-app toast or badge increment.

When app is **foreground in a different screen**:
- Show in-app notification (snackbar) at top with action.
- Don't fire system notification (avoids double display).

When app is **background or killed**:
- Show system notification on the right channel.
- Tap → deep link.

```kotlin
class ViposMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    if (App.foregroundScreenMatches(data["category"], data["entity_id"])) {
      // suppress notification
      App.dispatchInAppEvent(data)
    } else {
      buildAndShowNotification(data)
    }
  }
}
```

## §7 Notification actions

Inline actions (Android N+):

| Category | Actions |
|---|---|
| `ORDER_NEW` | "Terima", "Tolak", "Buka detail" |
| `KDS_TICKET` | "Tandai siap", "Buka detail" |
| `VOID_APPROVAL` | "Setujui (PIN)", "Tolak", "Lihat detail" |
| `STOCK_LOW` | "Buat PO", "Lihat produk" |
| `RESERVATION_REMINDER` | "Tandai datang", "Tandai no-show" |

Tap action → broadcast → handle → optionally update notification or dismiss.

## §8 Notification grouping

For multiple `ORDER_NEW` arriving within 5 min, group as a summary notification:
```
Pesanan baru
3 pesanan menunggu
[Buka semua]
```

Use `NotificationCompat.GROUP_KEY = "online_orders"`.

## §9 Snooze / silence per outlet

Allow OWNER to snooze notifications for an outlet (e.g. closed for renovation). Server side: filter at FCM topic level.

Topics:
- `outlet_5_orders` — ORDER_NEW for outlet 5
- `outlet_5_kds` — KDS for outlet 5
- `merchant_88_marketing` — marketing for merchant 88
- `user_1234_personal` — personal events

App subscribes/unsubscribes via `FirebaseMessaging.subscribeToTopic`.

## §10 In-app message center

Maintain a local `notifications` table mirroring incoming pushes. Show badge count on bell icon. User can tap to see history.

`POST /api/v1/notification/:id/read` to mark read across devices.

## §11 Sound files

Custom sounds (in `res/raw/`):
- `kds_ding.wav` — kitchen ding for `kds` channel
- `pos_chime.wav` — gentle chime for `pos_orders`
- `cashier_alert.wav` — urgent for `cashier_alerts`
- Use 16-bit PCM WAV, 44100 Hz, ≤2 s duration.

## §12 Icon

- Status bar icon: monochrome white silhouette of VIPOS logo (transparent PNG, vector drawable preferred).
- Large icon: full-color logo for the notification body.

## §13 Localization

All notification text must be in **Bahasa Indonesia**. Server should look up user's `locale` and pick `id-ID` body. Or send `body_id` and `body_en` and app picks.

## §14 Test plan

- Send each category from FCM console; verify notification appears on right channel with right sound.
- Tap each notification; verify deep link navigates correctly.
- Foreground app with relevant screen → verify suppression.
- Background app → verify system notification.
- Killed app → verify deep link still works after cold start.
- Token rotation → verify server re-registers.
- Logout → verify subsequent push to old token is silenced.
