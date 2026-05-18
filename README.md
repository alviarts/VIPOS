# VIPOS - Point of Sale System

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/alviarts/VIPOS)
[![Tests](https://img.shields.io/badge/tests-163%2F163-brightgreen)](https://github.com/alviarts/VIPOS)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/alviarts/VIPOS/releases)

Modern, feature-rich Point of Sale system built with Kotlin, Jetpack Compose, and Node.js.

![VIPOS Banner](https://via.placeholder.com/1200x400/4CAF50/FFFFFF?text=VIPOS+Point+of+Sale+System)

---

## 🚀 Features

### Core POS
- ✅ Product catalogue with variants
- ✅ Cart management & checkout
- ✅ Multiple payment methods (Cash, QRIS, EDC, E-wallet)
- ✅ Receipt printing (ESC/POS)
- ✅ Barcode scanning
- ✅ Offline mode with sync

### Business Management
- ✅ **Appointment System** - Schedule & manage appointments
- ✅ **Inventory Tracking** - Stock in/out movements
- ✅ **Stock Opname** - Physical inventory counting
- ✅ **Employee Management** - Full CRUD with roles
- ✅ **Customer Loyalty** - Points & rewards system
- ✅ **Multi-outlet** - Manage multiple stores
- ✅ **Sales Reports** - KPIs, trends, analytics
- ✅ **Owner Dashboard** - Real-time business insights

### Advanced Features
- ✅ Online order integration
- ✅ Transaction history
- ✅ Low stock alerts
- ✅ Cashier shift management
- ✅ Commission tracking
- ✅ Payroll management
- ✅ Attendance tracking

---

## 🏗️ Tech Stack

### Android App
- **Language**: Kotlin 100%
- **UI**: Jetpack Compose + Material 3
- **DI**: Hilt
- **Database**: Room
- **Network**: Retrofit + OkHttp
- **Async**: Coroutines + Flow
- **Architecture**: MVVM + Clean Architecture

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express
- **Database**: PostgreSQL (prod), SQLite (dev)
- **ORM**: Prisma
- **Auth**: JWT
- **Process Manager**: PM2

### Web Dashboard
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Router**: React Router v6

---

## 📱 Screenshots

| Home Screen | POS Catalogue | Checkout |
|-------------|---------------|----------|
| ![Home](https://via.placeholder.com/300x600/4CAF50/FFFFFF?text=Home) | ![Catalogue](https://via.placeholder.com/300x600/2196F3/FFFFFF?text=Catalogue) | ![Checkout](https://via.placeholder.com/300x600/FF9800/FFFFFF?text=Checkout) |

| Appointments | Inventory | Reports |
|--------------|-----------|---------|
| ![Appointments](https://via.placeholder.com/300x600/9C27B0/FFFFFF?text=Appointments) | ![Inventory](https://via.placeholder.com/300x600/F44336/FFFFFF?text=Inventory) | ![Reports](https://via.placeholder.com/300x600/00BCD4/FFFFFF?text=Reports) |

---

## 🚀 Quick Start

### Prerequisites
- **Android Studio**: Arctic Fox or newer
- **Node.js**: 18+ 
- **PostgreSQL**: 14+ (or SQLite for dev)
- **Git**: Latest version

### Clone Repository
```bash
git clone https://github.com/alviarts/VIPOS.git
cd VIPOS
```

### Backend Setup
```bash
cd apps/backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
npm run seed
npm run dev
```

Backend will run on `http://localhost:3001`

### Android Setup
```bash
cd apps/android
# Open in Android Studio
# Sync Gradle
# Run on device/emulator
```

Or build APK:
```bash
./gradlew assembleDevDebug
```

### Web Setup
```bash
cd apps/web
npm install
npm run dev
```

Web will run on `http://localhost:5173`

---

## 📚 Documentation

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference
- **[Automation Guide](AUTOMATION.md)** - Development workflow
- **[Testing Guide](TESTING.md)** - Test plans & results
- **[Project Summary](PROJECT_COMPLETE_SUMMARY.md)** - Complete overview

---

## 🧪 Testing

### Run All Tests
```bash
cd apps/android
./gradlew test
```

### Test Results
- **Total Tests**: 163
- **Passing**: 163 (100%)
- **Coverage**: Core business logic

### Test Categories
- Repository tests (API integration)
- ViewModel tests (state management)
- Domain tests (business logic)
- Utility tests (formatters, validators)

---

## 🏗️ Project Structure

```
VIPOS/
├── apps/
│   ├── android/              # Android app (Kotlin + Compose)
│   │   ├── app/              # Main app module
│   │   ├── core/             # Core modules (network, database, etc)
│   │   └── feature/          # Feature modules (auth, pos, etc)
│   ├── backend/              # Node.js backend
│   │   ├── src/
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── middleware/   # Auth, validation
│   │   │   └── lib/          # Utilities
│   │   └── prisma/           # Database schema
│   └── web/                  # React web dashboard
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── pages/        # Page components
│       │   └── api/          # API client
│       └── public/           # Static assets
├── docs/                     # Documentation
└── scripts/                  # Build & deploy scripts
```

---

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/vipos
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
```

**Android (local.properties)**:
```properties
sdk.dir=/path/to/Android/sdk
api.base.url=http://10.0.2.2:3001
```

---

## 🚀 Deployment

### Backend (VPS)
```bash
# SSH to VPS
ssh root@103.74.5.44

# Pull latest code
cd /var/www/vipos
git pull origin main

# Install dependencies
cd apps/backend
npm install --omit=dev

# Restart PM2
pm2 restart vipos-backend
```

### Android (Play Store)
```bash
# Build release APK
./gradlew assembleProdRelease

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore release.keystore \
  app-prod-release.apk alias_name

# Upload to Play Console
```

---

## 📊 Performance

### Backend
- **DB Latency**: 2-16ms (avg 7.6ms)
- **API Response**: 58-361ms (avg 88ms)
- **Memory**: 46-48MB stable
- **Uptime**: 99.9%

### Android
- **App Startup**: <2s cold start
- **Screen Transitions**: <100ms
- **Memory**: <100MB typical
- **APK Size**: ~13-15 MB

---

## 🔐 Security

- ✅ JWT authentication (15 min expiry)
- ✅ 2FA support
- ✅ Rate limiting
- ✅ Password hashing (bcrypt)
- ✅ Role-based access control
- ✅ Multi-tenancy with row-level security
- ✅ HTTPS/TLS encryption
- ✅ SQL injection prevention
- ✅ XSS protection

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style (formatting)
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

- **Developer**: Alvi Arts
- **Project Manager**: [Your Name]
- **Designer**: [Designer Name]

---

## 📞 Support

- **Documentation**: [docs.vipos.id](https://docs.vipos.id) (coming soon)
- **Issues**: [GitHub Issues](https://github.com/alviarts/VIPOS/issues)
- **Email**: support@vipos.id (coming soon)
- **Discord**: [Join our community](https://discord.gg/vipos) (coming soon)

---

## 🗺️ Roadmap

### Phase 5: Polish & Production (Q2 2026)
- [ ] UI polish & animations
- [ ] Firebase integration (FCM, Crashlytics)
- [ ] Domain setup (vipos.id)
- [ ] Play Store submission

### Phase 6: Advanced Features (Q3 2026)
- [ ] Hardware integration (printer, scanner, EDC)
- [ ] Advanced analytics & BI
- [ ] Marketplace integration (GoFood, GrabFood)
- [ ] Multi-language support

### Phase 7: Enterprise (Q4 2026)
- [ ] Franchise management
- [ ] Central kitchen system
- [ ] Supply chain management
- [ ] White-label solution

---

## 🌟 Acknowledgments

- [Material Design](https://m3.material.io/) - Design system
- [Jetpack Compose](https://developer.android.com/jetpack/compose) - UI framework
- [Retrofit](https://square.github.io/retrofit/) - HTTP client
- [Hilt](https://dagger.dev/hilt/) - Dependency injection
- [Express](https://expressjs.com/) - Backend framework
- [Prisma](https://www.prisma.io/) - Database ORM

---

## 📈 Stats

![GitHub stars](https://img.shields.io/github/stars/alviarts/VIPOS?style=social)
![GitHub forks](https://img.shields.io/github/forks/alviarts/VIPOS?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/alviarts/VIPOS?style=social)

---

**Made with ❤️ by Alvi Arts**

[⬆ Back to top](#vipos---point-of-sale-system)
